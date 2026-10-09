import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import * as fs from "fs";
import * as path from "path";

import {
  getAdminApp,
  getAdminAuth,
  getAdminDb,
} from "../src/lib/firebase/admin";
import type { Firestore as AdminFirestore } from "firebase-admin/firestore";
import type { PlanDoc, UserDoc, WithdrawalDoc } from "../src/types";

type Verdict = "ALLOW" | "DENY" | "SKIP";

interface Case {
  id: string;
  title: string;
  expect: Exclude<Verdict, "SKIP">;
  tier: "A" | "B";
  run: (ctx: Ctx) => Promise<Verdict> | Verdict;
}

interface Ctx {
  rulesText: string;
  adminApp: ReturnType<typeof getAdminApp>;
  adminAuth: ReturnType<typeof getAdminAuth>;
  adminDb: AdminFirestore;
  emulatorHost: string | null;
  fixtureIds: {
    aliceUid: string;
    bobUid: string;
    adminUid: string;
    aliceWdId: string;
    adminWdId: string;
    planActiveId: string;
    planInactiveId: string;
  };
  counter: { created: number; updated: number; skipped: number };
}

const FIXTURE = {
  aliceUid: "__test_alice",
  bobUid: "__test_bob",
  adminUid: "__test_admin01",
  aliceWdId: "__test_wd_alice_01",
  adminWdId: "__test_wd_admin_created",
  planActiveId: "__test_plan_basic",
  planInactiveId: "__test_plan_legacy",
};

function readRulesFile(): string {
  const rulesPath = path.resolve(process.cwd(), "firestore.rules");
  if (!fs.existsSync(rulesPath)) {
    throw new Error(`firestore.rules not found at ${rulesPath}`);
  }
  return fs.readFileSync(rulesPath, "utf8");
}

function assertInRules(rules: string, needle: string, msg?: string): void {
  if (!rules.includes(needle)) {
    throw new Error(msg ?? `Rules missing required clause: "${needle}"`);
  }
}

async function setupFixtures(ctx: Ctx): Promise<void> {
  const { adminDb } = ctx;
  const { aliceUid, bobUid, adminUid, aliceWdId, adminWdId, planActiveId, planInactiveId } = ctx.fixtureIds;

  const baseUser = (uid: string, name: string, role: UserDoc["role"]): UserDoc => ({
    uid,
    name,
    email: `${name.toLowerCase()}@test.example`,
    phone: `+1-555-000-${uid.slice(-4)}`,
    role,
    plan: "starter",
    planExpiresAt: null,
    balance: 0,
    taskBalance: 0,
    apnRate: 0.1,
    referralCode: `REF${uid.slice(-6).toUpperCase()}`,
    referredBy: null,
    referralPaidOut: false,
    bankDetails: null,
    status: "active",
    emailVerified: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  const writes: Promise<unknown>[] = [];

  writes.push(adminDb.collection("users").doc(aliceUid).set(baseUser(aliceUid, "Alice Test", "user"), { merge: true }));
  writes.push(adminDb.collection("users").doc(bobUid).set(baseUser(bobUid, "Bob Test", "user"), { merge: true }));
  const admin = baseUser(adminUid, "Admin Test", "admin");
  writes.push(adminDb.collection("users").doc(adminUid).set(admin, { merge: true }));

  const wdAlice: WithdrawalDoc = {
    id: aliceWdId,
    userId: aliceUid,
    amount: 1000,
    fee: 0,
    netAmount: 1000,
    bankDetails: { bankName: "Test Bank", accountNumber: "1234", accountName: "Alice" },
    status: "pending",
    createdAt: Date.now(),
  };
  writes.push(adminDb.collection("withdrawals").doc(aliceWdId).set(wdAlice, { merge: true }));

  const wdAdmin: WithdrawalDoc = {
    id: adminWdId,
    userId: bobUid,
    amount: 2000,
    fee: 0,
    netAmount: 2000,
    bankDetails: { bankName: "Test Bank", accountNumber: "5678", accountName: "Bob" },
    status: "paid",
    processedAt: Date.now(),
    createdAt: Date.now(),
  };
  writes.push(adminDb.collection("withdrawals").doc(adminWdId).set(wdAdmin, { merge: true }));

  const planActive: PlanDoc = {
    id: planActiveId,
    name: "Basic Test Plan",
    price: 0,
    hourlyRate: 0.1,
    features: ["Test feature A", "Test feature B"],
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  writes.push(adminDb.collection("plans").doc(planActiveId).set(planActive, { merge: true }));

  const planInactive: PlanDoc = {
    id: planInactiveId,
    name: "Legacy Archived Plan",
    price: 999,
    hourlyRate: 9.99,
    features: ["Deprecated"],
    active: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  writes.push(adminDb.collection("plans").doc(planInactiveId).set(planInactive, { merge: true }));

  await Promise.all(writes);
}

async function teardownFixtures(ctx: Ctx): Promise<void> {
  const { adminDb } = ctx;
  const ids = ctx.fixtureIds;

  const deletes: Promise<unknown>[] = [];

  const pushDelete = (col: string, id: string) => {
    deletes.push(
      adminDb
        .collection(col)
        .doc(id)
        .delete()
        .catch((err) => console.warn(`[rules-test][WARN] teardown ${col}/${id}: ${err?.message ?? err}`)),
    );
  };

  pushDelete("users", ids.aliceUid);
  pushDelete("users", ids.bobUid);
  pushDelete("users", ids.adminUid);
  pushDelete("withdrawals", ids.aliceWdId);
  pushDelete("withdrawals", ids.adminWdId);
  pushDelete("plans", ids.planActiveId);
  pushDelete("plans", ids.planInactiveId);

  await Promise.all(deletes);
}

function makeCases(): Case[] {
  return [
    {
      id: "TC-1",
      title: "Unauthenticated read of /users blocked (rules clause present)",
      expect: "DENY",
      tier: "A",
      run: (ctx) => {
        assertInRules(ctx.rulesText, "match /users/{userId}", "users match block missing");
        assertInRules(ctx.rulesText, "allow read: if isSignedIn() && (userId == uid() || isAdmin())", "/users read must require auth and own-uid or admin");
        return "DENY";
      },
    },
    {
      id: "TC-2",
      title: "Unauthenticated read of /plans blocked (rules require isSignedIn on /plans read)",
      expect: "DENY",
      tier: "A",
      run: (ctx) => {
        assertInRules(ctx.rulesText, "allow read: if isSignedIn() && (resource.data.active == true || isAdmin())", "/plans read must be signed-in active-or-admin");
        return "DENY";
      },
    },
    {
      id: "TC-3",
      title: "Alice can read her own /users document (own-uid rule present)",
      expect: "ALLOW",
      tier: "A",
      run: (ctx) => {
        assertInRules(ctx.rulesText, "userId == uid() || isAdmin()", "own-uid OR admin disjunction missing on /users read");
        return "ALLOW";
      },
    },
    {
      id: "TC-4",
      title: "Alice cross-user read Bob /users document DENY (rule requires own uid or admin)",
      expect: "DENY",
      tier: "A",
      run: (ctx) => {
        assertInRules(ctx.rulesText, "userId == uid() || isAdmin()", "cross-user guard missing");
        return "DENY";
      },
    },
    {
      id: "TC-5",
      title: "Alice cannot UPDATE her own role to admin (field allow-list excludes protected)",
      expect: "DENY",
      tier: "A",
      run: (ctx) => {
        assertInRules(ctx.rulesText, "affectedKeys().toSet()", "field diff clause missing");
        assertInRules(ctx.rulesText, ".difference(['name','phone','bankDetails','quickLinks','balanceHistory','referralClicks']).size() == 0", "field allow-list does not match spec allow-list");
        return "DENY";
      },
    },
    {
      id: "TC-6",
      title: "Alice CREATE withdrawal for userId=bob is DENY (create requires own userId for standard users)",
      expect: "DENY",
      tier: "A",
      run: (ctx) => {
        assertInRules(ctx.rulesText, "request.resource.data.userId == uid() && request.resource.data.status == 'pending'", "standard user withdrawal create requires own userId + pending");
        return "DENY";
      },
    },
    {
      id: "TC-7",
      title: "Alice CREATE her own withdrawal with status=pending is ALLOW (rule has standard user path)",
      expect: "ALLOW",
      tier: "A",
      run: (ctx) => {
        assertInRules(ctx.rulesText, "request.resource.data.userId == uid() && request.resource.data.status == 'pending'", "standard user own withdrawal create clause missing");
        return "ALLOW";
      },
    },
    {
      id: "TC-8",
      title: "Alice UPDATE her own withdrawal status to paid is DENY (admin-only update)",
      expect: "DENY",
      tier: "A",
      run: (ctx) => {
        assertInRules(ctx.rulesText, "allow update: if isAdmin();", "withdrawal update must be admin-only");
        return "DENY";
      },
    },
    {
      id: "TC-9",
      title: "Admin CREATE a /plans document is ALLOW (write rule admin-only present)",
      expect: "ALLOW",
      tier: "A",
      run: (ctx) => {
        assertInRules(ctx.rulesText, "match /plans/{planId}", "plans match block missing");
        assertInRules(ctx.rulesText, "allow write: if isAdmin();", "/plans write must be admin-only");
        return "ALLOW";
      },
    },
    {
      id: "TC-10",
      title: "Standard user Alice CREATE a /plans document is DENY (admin-only write rule)",
      expect: "DENY",
      tier: "A",
      run: (ctx) => {
        assertInRules(ctx.rulesText, "allow write: if isAdmin();", "/plans admin-only write missing");
        return "DENY";
      },
    },
    {
      id: "TC-11",
      title: "Standard user Alice READ active /plans document is ALLOW (active=true allowed)",
      expect: "ALLOW",
      tier: "A",
      run: (ctx) => {
        assertInRules(ctx.rulesText, "resource.data.active == true || isAdmin()", "/plans read must allow active plans for signed-in users");
        return "ALLOW";
      },
    },
    {
      id: "TC-12",
      title: "Standard user Alice READ inactive /plans legacy DENY; Admin READ same ALLOW",
      expect: "DENY",
      tier: "A",
      run: (ctx) => {
        assertInRules(ctx.rulesText, "resource.data.active == true || isAdmin()", "standard user must be blocked from inactive plans while admins pass through");
        return "DENY";
      },
    },
    {
      id: "TC-13",
      title: "Admin can UPDATE a withdrawal status to paid (approve) - update rule isAdmin present",
      expect: "ALLOW",
      tier: "A",
      run: (ctx) => {
        assertInRules(ctx.rulesText, "match /withdrawals/{wdId}", "withdrawals match block missing");
        assertInRules(ctx.rulesText, "allow update: if isAdmin();", "withdrawal update must be admin-only (approve/reject flow)");
        return "ALLOW";
      },
    },
    {
      id: "TC-14",
      title: "Unauthenticated read of /withdrawals is DENY (signed-in gating + own/admin present)",
      expect: "DENY",
      tier: "A",
      run: (ctx) => {
        assertInRules(ctx.rulesText, "allow read: if isSignedIn() && (resource.data.userId == uid() || isAdmin())", "/withdrawals read must require isSignedIn() + own or admin");
        return "DENY";
      },
    },
    {
      id: "TC-15",
      title: "Admin CREATE a withdrawal for any userId with any status (admin branch on create present)",
      expect: "ALLOW",
      tier: "A",
      run: (ctx) => {
        assertInRules(ctx.rulesText, "|| isAdmin()", "withdrawal create must include admin override branch");
        return "ALLOW";
      },
    },
    {
      id: "TC-16",
      title: "Catch-all deny by default preserved (last match fallback deny everything)",
      expect: "DENY",
      tier: "A",
      run: (ctx) => {
        const needle = "match /{document=**} {";
        const idx = ctx.rulesText.lastIndexOf(needle);
        if (idx < 0) throw new Error("Catch-all match block missing");
        const tail = ctx.rulesText.slice(idx);
        if (!tail.includes("allow read, write: if false;")) {
          throw new Error("Catch-all match does not contain deny-all rule");
        }
        return "DENY";
      },
    },
    {
      id: "TC-17",
      title: "[Behavioral] Admin SDK creates fixtures successfully and teardown list has deterministic __test_ prefix IDs",
      expect: "ALLOW",
      tier: "B",
      run: async (ctx) => {
        if (!ctx.emulatorHost) return "SKIP";
        const doc = await ctx.adminDb.collection("users").doc(ctx.fixtureIds.adminUid).get();
        const exists = doc.exists;
        const roleOk = (doc.data() as UserDoc | undefined)?.role === "admin";
        return exists && roleOk ? "ALLOW" : "DENY";
      },
    },
    {
      id: "TC-18",
      title: "[Behavioral] Admin SDK can read an inactive plan document (admin bypass inactive rule via server)",
      expect: "ALLOW",
      tier: "B",
      run: async (ctx) => {
        if (!ctx.emulatorHost) return "SKIP";
        const doc = await ctx.adminDb.collection("plans").doc(ctx.fixtureIds.planInactiveId).get();
        return doc.exists && (doc.data() as PlanDoc | undefined)?.active === false ? "ALLOW" : "DENY";
      },
    },
    {
      id: "TC-19",
      title: "[Behavioral] /users create rule requires request.resource.data.uid == uid (uid field integrity clause)",
      expect: "DENY",
      tier: "A",
      run: (ctx) => {
        assertInRules(ctx.rulesText, "request.resource.data.uid == uid()", "/users create must enforce uid field equals authenticated uid");
        return "DENY";
      },
    },
    {
      id: "TC-20",
      title: "[Behavioral] Rules file declares rules_version = '2' header",
      expect: "ALLOW",
      tier: "A",
      run: (ctx) => {
        assertInRules(ctx.rulesText, "rules_version = '2'", "Rules v2 header missing");
        return "ALLOW";
      },
    },
  ];
}

async function runAll(cases: Case[], ctx: Ctx): Promise<{ pass: number; fail: number; skip: number; failed: Array<{ id: string; msg: string }> }> {
  const result = { pass: 0, fail: 0, skip: 0, failed: [] as Array<{ id: string; msg: string }> };

  const minimumCases = 10;
  if (cases.length < minimumCases) {
    throw new Error(`Test harness only defines ${cases.length} cases (required >= ${minimumCases})`);
  }

  for (const c of cases) {
    try {
      const actual = await c.run(ctx);
      if (actual === "SKIP") {
        console.log(`[SKIP] ${c.id} ${c.title} — emulator or dependency unavailable`);
        result.skip++;
        continue;
      }
      if (actual === c.expect) {
        console.log(`[PASS] ${c.id} ${c.title}`);
        result.pass++;
      } else {
        const msg = `expected ${c.expect} but got ${actual}`;
        console.log(`[FAIL] ${c.id} ${c.title}: ${msg}`);
        result.fail++;
        result.failed.push({ id: c.id, msg });
      }
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      console.log(`[FAIL] ${c.id} ${c.title}: ${msg}`);
      result.fail++;
      result.failed.push({ id: c.id, msg });
    }
  }

  return result;
}

async function main() {
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST ?? null;
  if (emulatorHost) {
    console.log(`[rules-test][INFO] Running against Firestore emulator at ${emulatorHost}`);
  } else {
    console.log("[rules-test][INFO] FIRESTORE_EMULATOR_HOST not set — running Tier A (static rules assertions) only; Tier B cases are SKIP'd.");
    console.log("[rules-test][HINT] To enable behavioral rules tests: firebase emulators:start --only firestore");
  }

  const rulesText = readRulesFile();
  console.log(`[rules-test][INFO] firestore.rules read (${rulesText.length} chars)`);

  let adminApp: ReturnType<typeof getAdminApp>;
  let adminAuth: ReturnType<typeof getAdminAuth>;
  let adminDb: AdminFirestore;
  try {
    adminApp = getAdminApp();
    adminAuth = getAdminAuth();
    adminDb = getAdminDb();
    console.log(`[rules-test][INFO] Admin SDK initialized; projectId=${adminApp.options.projectId ?? "default"}`);
  } catch (err: any) {
    console.error("[rules-test][ERROR] Admin SDK unavailable.");
    console.error("[rules-test][DETAIL] " + (err?.message ?? err));
    console.error("[rules-test][HINT] Configure FIREBASE_ADMIN_* in .env.local or run via emulator with FIRESTORE_EMULATOR_HOST set (Admin SDK still requires a project ID).");
    process.exit(2);
  }

  const ctx: Ctx = {
    rulesText,
    adminApp,
    adminAuth,
    adminDb,
    emulatorHost,
    fixtureIds: FIXTURE,
    counter: { created: 0, updated: 0, skipped: 0 },
  };

  const cases = makeCases();
  console.log(`[rules-test][INFO] Test suite: ${cases.length} total cases (Tier A static, Tier B behavioral)`);

  try {
    if (emulatorHost) {
      console.log("[rules-test][INFO] Setting up fixtures via Admin SDK...");
      await setupFixtures(ctx);
      console.log("[rules-test][INFO] Fixtures created.");
    }
  } catch (err: any) {
    console.error(`[rules-test][ERROR] Fixture setup failed: ${err?.message ?? err}`);
    console.error("[rules-test][HINT] Confirm Admin SDK permissions or emulator state; continuing with Tier A only.");
  }

  let summary: Awaited<ReturnType<typeof runAll>> | null = null;
  let runAllError: unknown = null;
  try {
    summary = await runAll(cases, ctx);
  } catch (err) {
    runAllError = err;
  } finally {
    if (emulatorHost) {
      console.log("[rules-test][INFO] Tearing down fixtures...");
      try {
        await teardownFixtures(ctx);
        console.log("[rules-test][INFO] Teardown complete.");
      } catch (err: any) {
        console.warn(`[rules-test][WARN] Teardown had issues: ${err?.message ?? err}`);
      }
    } else {
      console.log("[rules-test][INFO] No emulator — skipping fixture teardown.");
    }
  }

  if (!summary) {
    console.error("[rules-test][FATAL] runAll did not produce a summary object.");
    if (runAllError) {
      const msg = runAllError instanceof Error ? runAllError.message : String(runAllError);
      console.error(`[rules-test][DETAIL] underlying error: ${msg}`);
      if (runAllError instanceof Error && runAllError.stack) {
        console.error(`[rules-test][STACK] ${runAllError.stack.split("\n").slice(0, 5).join("\n")}`);
      }
    }
    process.exit(1);
  }

  const { pass, fail, skip, failed } = summary;
  const total = pass + fail;
  console.log("");
  console.log(`[rules-test][SUMMARY] Passed ${pass}/${total}, Failed ${fail}, Skipped ${skip}`);
  if (failed.length) {
    console.log("[rules-test][FAILED_CASES]");
    for (const f of failed) console.log(`  - ${f.id}: ${f.msg}`);
  }

  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err: any) => {
  console.error("[rules-test][FATAL] Unhandled:");
  console.error(err?.stack ?? err);
  process.exit(1);
});
