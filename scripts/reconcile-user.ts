import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import {
  createUserDoc,
  createWithdrawal,
  getAdminDb,
  getUser,
  listEarningsByUser,
  listWithdrawalsByUser,
  updateUser,
} from "@/lib/firestore";
import { rewardUserForTaskTx } from "@/lib/rewards-tx";
import type { EarningDoc, UserDoc, WithdrawalDoc } from "@/types";

const TEST_UID = `test-reconcile-${Date.now()}`;

let FAIL = 0;
let PASS = 0;
const REPORT: string[] = [];

function say(line: string) {
  REPORT.push(line);
  console.log(line);
}

function assert(name: string, cond: boolean, detail?: string) {
  if (cond) {
    PASS++;
    say(`  [PASS] ${name}` + (detail ? `  (${detail})` : ""));
  } else {
    FAIL++;
    say(`  [FAIL] ${name}` + (detail ? `  (${detail})` : ""));
  }
}

async function seedReconcileUser(): Promise<UserDoc> {
  const now = Date.now();
  return await createUserDoc(TEST_UID, {
    name: "Reconcile Audit User",
    email: `reconcile-${now}@example.com`,
    phone: "+17770002222",
    role: "user",
    plan: "starter",
    planExpiresAt: null,
    balance: 0,
    taskBalance: 0,
    apnRate: 10,
    referralCode: `RC${now.toString().slice(-6).toUpperCase()}`,
    referredBy: null,
    referralPaidOut: false,
    bankDetails: null,
    status: "active",
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  });
}

async function cleanup() {
  const db = getAdminDb();
  const toDelete = [db.collection("users").doc(TEST_UID)];
  const [earn, wd] = await Promise.all([
    db.collection("earnings").where("userId", "==", TEST_UID).get(),
    db.collection("withdrawals").where("userId", "==", TEST_UID).get(),
  ]);
  earn.forEach((d) => toDelete.push(d.ref));
  wd.forEach((d) => toDelete.push(d.ref));
  await Promise.all(toDelete.map((r) => r.delete().catch(() => {})));
}

async function grantViaEarning(amount: number, source: EarningDoc["source"], refId: string) {
  return await rewardUserForTaskTx({
    uid: TEST_UID,
    taskId: `recon-${refId}`,
    amount,
    source,
    earningReferenceId: `recon-earn-${TEST_UID}-${refId}`,
    note: `reconcile seed ${refId}`,
  });
}

async function withdraw(amount: number, feePct = 0.05): Promise<WithdrawalDoc> {
  const fee = Math.round(amount * feePct);
  const net = amount - fee;
  // Simulate withdrawal: deduct balance from user first via transaction (minimal)
  const user = await getUser(TEST_UID);
  if (!user) throw new Error("no user");
  const fromTask = Math.min(user.taskBalance, amount);
  const fromBal = amount - fromTask;
  const db = getAdminDb();
  await db.runTransaction(async (tx) => {
    const ref = db.collection("users").doc(TEST_UID);
    const snap = await tx.get(ref);
    const cur = snap.data() as UserDoc;
    tx.update(ref, {
      balance: (cur.balance ?? 0) - fromBal,
      taskBalance: (cur.taskBalance ?? 0) - fromTask,
      updatedAt: Date.now(),
    });
  });
  return await createWithdrawal({
    userId: TEST_UID,
    amount,
    fee,
    netAmount: net,
    bankDetails: { bankName: "Test", accountNumber: "0000000000", accountName: "Test" },
    status: "paid",
    createdAt: Date.now(),
    processedAt: Date.now(),
    transactionId: `tx-wd-${Date.now()}`,
  });
}

async function main() {
  if (!process.env.FIREBASE_ADMIN_PROJECT_ID || !process.env.FIREBASE_ADMIN_CLIENT_EMAIL || !process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
    console.log("== reconcile-user ==");
    console.log();
    console.log("[SKIP] Firebase admin env vars (FIREBASE_ADMIN_PROJECT_ID / CLIENT_EMAIL / PRIVATE_KEY) are not configured in .env.local");
    console.log("[SKIP] Skipping live Firestore reconcile checks. Set credentials to run.");
    console.log();
    console.log("== Final Report ==");
    console.log("SKIPPED=all  (no Firestore credentials)");
    process.exit(0);
  }
  const argvUid = process.argv[2];
  const uid = argvUid && argvUid.length > 4 ? argvUid : null;
  console.log("== reconcile-user ==");
  console.log(`mode=${uid ? "audit-existing" : "self-seed"}  uid=${uid ?? TEST_UID}`);
  console.log();

  if (uid) {
    await auditExistingUser(uid);
  } else {
    await auditSelfSeed();
  }

  console.log();
  console.log("== Final Report ==");
  console.log(REPORT.slice(2).join("\n"));
  console.log();
  console.log(`PASS=${PASS}  FAIL=${FAIL}`);
  process.exit(FAIL === 0 ? 0 : 1);
}

async function auditSelfSeed() {
  await cleanup();
  await seedReconcileUser();
  say("-- Seed phase --");

  // 3 earnings: 100 task + 200 referral + 75 claim
  const e1 = await grantViaEarning(100, "task", "t1");
  say(`  grant task 100 → newTaskBalance=${e1.newTaskBalance}`);
  const e2 = await grantViaEarning(200, "referral", "t2");
  say(`  grant referral 200 → newTaskBalance=${e2.newTaskBalance}`);
  const e3 = await grantViaEarning(75, "claim", "t3");
  say(`  grant claim 75 → newTaskBalance=${e3.newTaskBalance}`);

  const grossEarnings = 100 + 200 + 75;
  say(`  gross earnings expected = ${grossEarnings}`);

  // One withdrawal of 200
  const wd = await withdraw(200, 0.05);
  say(`  withdrawal request ${wd.amount} (fee ${wd.fee} net ${wd.netAmount})`);
  const netWd = wd.amount;

  say("");
  await runAudit(TEST_UID, {
    expectedGrossEarnings: grossEarnings,
    expectedWithdrawalsCount: 1,
    expectedWithdrawalGrossAmount: netWd,
  });

  say("");
  say("-- Referral determinism check --");
  await checkReferralDeterminism(TEST_UID);

  say("");
  say("-- Cleanup --");
  await cleanup();
  const gone = await getUser(TEST_UID);
  assert("cleanup removed user", gone === null);
}

async function auditExistingUser(uid: string) {
  await runAudit(uid, null);
  say("");
  await checkReferralDeterminism(uid);
}

async function runAudit(
  uid: string,
  expected: {
    expectedGrossEarnings?: number;
    expectedWithdrawalsCount?: number;
    expectedWithdrawalGrossAmount?: number;
  } | null,
) {
  say("-- Audit snapshot --");
  const [user, earnings, withdrawals] = await Promise.all([
    getUser(uid),
    listEarningsByUser(uid, 10000),
    listWithdrawalsByUser(uid, 10000),
  ]);
  if (!user) {
    say("  [ABORT] User not found");
    return;
  }
  say(`  user: ${user.name} <${user.email}>`);
  say(`  balance=${user.balance}  taskBalance=${user.taskBalance}  total=${user.balance + user.taskBalance}`);

  const earningsSum = earnings.reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0);
  say(`  earningsCount=${earnings.length}  earningsSum=${earningsSum}`);

  const withdrawalsGross = withdrawals.reduce((s: number, w: any) => s + Number(w.amount ?? 0), 0);
  const withdrawalsFees = withdrawals.reduce((s: number, w: any) => s + Number(w.fee ?? 0), 0);
  const withdrawalsNet = withdrawalsGross - withdrawalsFees;
  say(`  withdrawalsCount=${withdrawals.length}  gross=${withdrawalsGross}  fees=${withdrawalsFees}  net=${withdrawalsNet}`);

  say("");
  say("-- Checks --");

  // Check 1: balance + taskBalance + withdrawn_net == earnings_sum (assuming starting from 0; for existing accounts we just report deltas)
  const assets = (user.balance ?? 0) + (user.taskBalance ?? 0);
  say(`  current_assets = balance(${user.balance}) + taskBalance(${user.taskBalance}) = ${assets}`);
  say(`  earnings_sum - withdrawals_gross = ${earningsSum} - ${withdrawalsGross} = ${earningsSum - withdrawalsGross}`);
  assert(
    "assets + withdrawalsGross matches earningsSum (0-balance seed invariant)",
    assets + withdrawalsGross === earningsSum,
    `${assets + withdrawalsGross} vs ${earningsSum}`,
  );

  // Check 2: every withdrawal has processedAt if status=paid
  const paidNoProc = withdrawals.filter((w: any) => w.status === "paid" && typeof w.processedAt !== "number");
  assert("every paid withdrawal has processedAt", paidNoProc.length === 0, paidNoProc.length > 0 ? `${paidNoProc.map((w: any) => w.id).join(",")}` : "ok");

  // Check 3: every paid withdrawal has transactionId
  const paidNoTxId = withdrawals.filter((w: any) => w.status === "paid" && !w.transactionId);
  assert("every paid withdrawal has transactionId", paidNoTxId.length === 0, paidNoTxId.length > 0 ? paidNoTxId.map((w: any) => w.id).join(",") : "ok");

  // Check 4: all earning amounts finite & positive (0 allowed for informational earnings)
  const badEarnings = earnings.filter(
    (e: any) => typeof e.amount !== "number" || !Number.isFinite(e.amount) || e.amount < 0,
  );
  assert("all earning amounts are finite and >=0", badEarnings.length === 0, badEarnings.map((e: any) => `${e.id}=${e.amount}`).join(",") || "ok");

  if (expected) {
    if (typeof expected.expectedGrossEarnings === "number") {
      assert(
        `earningsSum matches expected ${expected.expectedGrossEarnings}`,
        earningsSum === expected.expectedGrossEarnings,
        `${earningsSum} vs ${expected.expectedGrossEarnings}`,
      );
    }
    if (typeof expected.expectedWithdrawalsCount === "number") {
      assert(
        `withdrawalsCount matches expected ${expected.expectedWithdrawalsCount}`,
        withdrawals.length === expected.expectedWithdrawalsCount,
        `${withdrawals.length} vs ${expected.expectedWithdrawalsCount}`,
      );
    }
  }
}

async function checkReferralDeterminism(uid: string) {
  say("-- Referral earning determinism check --");
  const all = await listEarningsByUser(uid, 10000);
  const referralEarnings = all.filter((e: any) => e.source === "referral");
  say(`  referral_earnings_count = ${referralEarnings.length}`);
  // No duplicates by earningReferenceId / note pattern
  const seen = new Map<string, EarningDoc>();
  const dups: string[] = [];
  for (const e of referralEarnings as any[]) {
    const key = e.referenceId ?? e.id;
    if (seen.has(key)) dups.push(key);
    else seen.set(key, e);
  }
  assert("no duplicate referral earnings per referenceId", dups.length === 0, dups.join(",") || "ok");
  // Deterministic ID pattern: referral-${inviteeUid} should appear at most once per inviteeUid extraction
  const inviteeSeen = new Map<string, EarningDoc>();
  const inviteeDups: string[] = [];
  for (const e of referralEarnings as any[]) {
    // check pattern in id / referenceId / txId
    const tokens = [e.id, e.referenceId ?? "", e.txId ?? ""].join(" ");
    const match = tokens.match(/referral-([A-Za-z0-9_-]{4,})/);
    if (match) {
      const key = match[1];
      if (inviteeSeen.has(key)) inviteeDups.push(key);
      else inviteeSeen.set(key, e);
    }
  }
  assert("referral inviter/invitee determinism: only one earning per referral id", inviteeDups.length === 0, inviteeDups.join(",") || "ok");
}

main().catch((e) => {
  console.error("Unhandled reconcile error:", e);
  process.exit(1);
});
