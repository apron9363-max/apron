"use server";

import * as z from "zod";
import {
  createEarning,
  createTxLog,
  getPlan,
  getSettings,
  listEarningsByUser,
  listPlans,
  listWithdrawalsByUser,
  updateUser,
  getUser,
  getAdminDb,
  generateUniqueReferralCode,
  listTasks,
  listSubmissionsByUser,
  listHistoryActionWithFilters,
  addBankAccountToUser,
  setDefaultBankAccountForUser,
  deleteBankAccountFromUser,
  listBankAccountsByUser,
  type HistoryRow,
  type HistoryRowEarning,
  type HistoryRowWithdrawal,
} from "@/lib/firestore";
import { csvToDataUrl, generateCsv, type HistoryCsvRow } from "@/lib/csv";
import { verifySessionCookie } from "@/lib/server/session";
import {
  ALLOWED_QUICKLINK_ICONS,
  appendBalanceSnapshotSchema,
  bankDetailsSchema,
  addBankAccountSchema,
  setDefaultBankAccountSchema,
  deleteBankAccountSchema,
  exportHistoryCsvSchema,
  hourlyAccrualClaimSchema,
  listHistoryPaginatedSchema,
  listQuizzesSchema,
  listTasksFilterSchema,
  refreshDashboardRateOutputSchema,
  saveQuickLinksSchema,
} from "@/lib/validations/schemas";
import { MAX_BANK_ACCOUNTS } from "@/lib/constants";
import {
  floorHourBucketOf,
  projectUserAccrualBalance,
} from "@/lib/hourly-math";
import { rewardUserForTaskTx } from "@/lib/rewards-tx";
import type {
  BankDetails,
  BalanceSnapshot,
  PlanDoc,
  PlanId,
  QuickLink,
  SubmissionDoc,
  SubmissionStatus,
  TaskDoc,
  TaskType,
  UserDoc,
  VerifiedBankAccount,
} from "@/types";
import type { FieldValue as FV } from "firebase-admin/firestore";

const MS_30_DAYS = 30 * 24 * 60 * 60 * 1000;
const MS_24_H = 24 * 60 * 60 * 1000;
const MS_1_H = 60 * 60 * 1000;

const DEFAULT_QUICK_LINKS: Omit<QuickLink, "id">[] = [
  { href: "/tasks", label: "Tasks", iconName: "ClipboardList", custom: false, order: 0 },
  { href: "/quiz", label: "Quiz", iconName: "HelpCircle", custom: false, order: 1 },
  { href: "/contest", label: "Contest", iconName: "Trophy", custom: false, order: 2 },
  { href: "/wallet", label: "Wallet", iconName: "Wallet", custom: false, order: 3 },
];

export type EnrichedDashboardPayload = {
  user: UserDoc | null;
  earnings: any[];
  withdrawals: any[];
  plans: PlanDoc[];
  pendingBalanceSum: number;
  historicalSum30d: number;
  referralSignupsCount: number;
  quickLinks: QuickLink[];
  balanceHistory: BalanceSnapshot[];
  planDoc: PlanDoc | null;
};

function normalizeQuickLinks(raw: QuickLink[] | undefined | null): QuickLink[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_QUICK_LINKS.map((q, i) => ({
      ...q,
      id: `default-${i}`,
    }));
  }
  const filtered = raw
    .filter((l) => l && typeof l.href === "string" && typeof l.label === "string")
    .filter((l) => ALLOWED_QUICKLINK_ICONS.has(l.iconName));
  filtered.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return filtered.map((l, i) => ({ ...l, order: i }));
}

async function countReferralSignups(uid: string): Promise<number> {
  const db = getAdminDb();
  const snap = await db
    .collection("users")
    .where("referredBy", "==", uid)
    .where("emailVerified", "==", true)
    .count()
    .get();
  return Number(snap.data().count ?? 0);
}

export async function getCurrentUserDataAction(): Promise<EnrichedDashboardPayload> {
  const empty = {
    user: null,
    earnings: [],
    withdrawals: [],
    plans: [] as PlanDoc[],
    pendingBalanceSum: 0,
    historicalSum30d: 0,
    referralSignupsCount: 0,
    quickLinks: normalizeQuickLinks([]),
    balanceHistory: [] as BalanceSnapshot[],
    planDoc: null,
  };
  const session = await verifySessionCookie();
  if (!session) return empty;
  const [user, earnings, withdrawals, plans] = await Promise.all([
    getUser(session.uid),
    listEarningsByUser(session.uid, 50),
    listWithdrawalsByUser(session.uid, 50),
    listPlans(),
  ]);
  if (!user) return empty;

  const now = Date.now();
  const pendingBalanceSum = withdrawals
    .filter((w: any) => w.status === "pending")
    .reduce((s: number, w: any) => s + Number(w.netAmount ?? 0), 0);
  const historicalSum30d = earnings
    .filter((e: any) => (e.createdAt ?? 0) > now - MS_30_DAYS)
    .reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0);

  let referralSignupsCount = 0;
  try {
    referralSignupsCount = await countReferralSignups(session.uid);
  } catch {
    referralSignupsCount = 0;
  }

  const balanceHistory = (user.balanceHistory ?? [] as BalanceSnapshot[])
    .slice()
    .sort((a, b) => a.at - b.at)
    .slice(-30) as BalanceSnapshot[];
  const quickLinks = normalizeQuickLinks(user.quickLinks ?? []);
  const planDoc = (plans.find((p) => p.id === user.plan) as PlanDoc) ?? null;

  return {
    user,
    earnings,
    withdrawals,
    plans,
    pendingBalanceSum,
    historicalSum30d,
    referralSignupsCount,
    quickLinks,
    balanceHistory,
    planDoc,
  };
}

export async function updateUserBankDetailsAction(
  input: z.infer<typeof bankDetailsSchema>,
) {
  const session = await verifySessionCookie();
  if (!session) return { ok: false, error: "Unauthenticated" };
  const parsed = bankDetailsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid bank details" };
  await updateUser(session.uid, {
    bankDetails: parsed.data as BankDetails,
  });
  return { ok: true };
}

export async function listMyBankAccountsAction(): Promise<{ ok: true; accounts: VerifiedBankAccount[] } | { ok: false; error: string }> {
  const session = await verifySessionCookie();
  if (!session) return { ok: false, error: "Unauthenticated" };
  const user = await getUser(session.uid);
  if (!user) return { ok: false, error: "No user" };
  const accounts = listBankAccountsByUser(user);
  return { ok: true, accounts };
}

export async function addBankAccountAction(
  input: z.infer<typeof addBankAccountSchema>,
): Promise<{ ok: true; account: VerifiedBankAccount } | { ok: false; error: string }> {
  const session = await verifySessionCookie();
  if (!session) return { ok: false, error: "Unauthenticated" };
  const parsed = addBankAccountSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const user = await getUser(session.uid);
  if (!user) return { ok: false, error: "No user" };
  const current = listBankAccountsByUser(user);
  if (current.length >= MAX_BANK_ACCOUNTS) {
    return { ok: false, error: `Maximum ${MAX_BANK_ACCOUNTS} bank accounts allowed` };
  }
  const duplicate = current.find((a) =>
    a.accountNumber === parsed.data.accountNumber && a.bankName.toLowerCase() === parsed.data.bankName.toLowerCase(),
  );
  if (duplicate) {
    return { ok: false, error: "This bank account is already saved" };
  }
  const account = await addBankAccountToUser(
    session.uid,
    {
      bankName: parsed.data.bankName,
      accountNumber: parsed.data.accountNumber,
      accountName: parsed.data.accountName,
      nickname: parsed.data.nickname,
      verified: true,
    },
    MAX_BANK_ACCOUNTS,
  );
  if (!account) return { ok: false, error: "Failed to add bank account" };
  return { ok: true, account };
}

export async function setDefaultBankAccountAction(
  input: z.infer<typeof setDefaultBankAccountSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await verifySessionCookie();
  if (!session) return { ok: false, error: "Unauthenticated" };
  const parsed = setDefaultBankAccountSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const ok = await setDefaultBankAccountForUser(session.uid, parsed.data.accountId);
  if (!ok) return { ok: false, error: "Unable to update default bank account" };
  return { ok: true };
}

export async function deleteBankAccountAction(
  input: z.infer<typeof deleteBankAccountSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await verifySessionCookie();
  if (!session) return { ok: false, error: "Unauthenticated" };
  const parsed = deleteBankAccountSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const ok = await deleteBankAccountFromUser(session.uid, parsed.data.accountId);
  if (!ok) return { ok: false, error: "Unable to remove bank account" };
  return { ok: true };
}

export async function upgradeUserPlanAction(planId: string) {
  const session = await verifySessionCookie();
  if (!session) return { ok: false, error: "Unauthenticated" };

  const plan = await getPlan(planId);
  if (!plan || !plan.active) return { ok: false, error: "Plan unavailable" };

  const expiry = Date.now() + MS_30_DAYS;

  await updateUser(session.uid, {
    plan: plan.id as PlanId,
    planExpiresAt: expiry,
    apnRate: plan.hourlyRate,
  });

  return { ok: true };
}

export async function getPlansAction() {
  return listPlans();
}

export async function listTasksAction() {
  const { listTasks } = await import("@/lib/firestore");
  return listTasks(true);
}

export async function listHistoryAction(limit = 30) {
  const session = await verifySessionCookie();
  if (!session) return { earnings: [], withdrawals: [] };
  const [earnings, withdrawals] = await Promise.all([
    listEarningsByUser(session.uid, limit),
    listWithdrawalsByUser(session.uid, limit),
  ]);
  return { earnings, withdrawals };
}

export async function ensureReferralCode() {
  const session = await verifySessionCookie();
  if (!session) return null;
  const u = await getUser(session.uid);
  if (!u) return null;
  if (!u.referralCode) {
    const code = await generateUniqueReferralCode();
    await updateUser(session.uid, { referralCode: code });
    return code;
  }
  return u.referralCode;
}

export async function claimHourlyAccrualAction(
  input: z.infer<typeof hourlyAccrualClaimSchema> = {},
) {
  const session = await verifySessionCookie();
  if (!session) return { ok: false, error: "Unauthenticated" };
  const parsed = hourlyAccrualClaimSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  const nowMs = Date.now();
  const user = await getUser(session.uid);
  if (!user) return { ok: false, error: "No user" };

  const hasPrior = typeof user.lastHourlyClaimAt === "number";
  if (hasPrior && user.lastHourlyClaimAt! + MS_1_H > nowMs) {
    const waitMs = user.lastHourlyClaimAt! + MS_1_H - nowMs;
    const waitMin = Math.ceil(waitMs / 60000);
    await createTxLog({
      event: "hourly_claim_skip",
      userId: user.uid,
      payload: { reason: "cooldown", waitMin, skipAt: nowMs },
      at: nowMs,
    });
    return { ok: false, error: `Cooldown active. Try again in ${waitMin}m`, cooldown: true, waitMs };
  }

  const [settings, planDoc] = await Promise.all([
    getSettings(),
    getPlan(user.plan).catch(() => null),
  ]);

  const proj = projectUserAccrualBalance(
    user,
    settings,
    nowMs,
    planDoc?.hourlyRate,
  );

  if (proj.accrualAmount <= 0) {
    await createTxLog({
      event: "hourly_claim_skip",
      userId: user.uid,
      payload: { reason: proj.reason, projection: proj, skipAt: nowMs },
      at: nowMs,
    });
    await updateUser(user.uid, { lastHourlyClaimAt: nowMs });
    return {
      ok: false,
      error: `Nothing to claim (${proj.reason})`,
      reason: proj.reason,
      projection: proj,
    };
  }

  const earningRefId = `hourly-${user.uid}-${proj.toHour}`;
  try {
    const res = await rewardUserForTaskTx({
      uid: user.uid,
      taskId: `hourly-${proj.toHour}`,
      amount: proj.accrualAmount,
      source: "claim",
      earningReferenceId: earningRefId,
      note: `Hourly accrual ${proj.fromHour}->${proj.toHour} x${proj.tierMultiplier}`,
    });

    await updateUser(user.uid, { lastHourlyClaimAt: nowMs });

    try {
      await appendBalanceSnapshotAction({ effectiveRate: proj.effectiveRatePerHour });
    } catch {
      // non-fatal
    }

    await createTxLog({
      event: "hourly_claim_success",
      userId: user.uid,
      payload: {
        amount: res.newTaskBalance - (user.taskBalance ?? 0),
        hours: proj.accruableHours,
        fromHour: proj.fromHour,
        toHour: proj.toHour,
        earningRefId,
        alreadyPaid: res.alreadyPaid,
        newTaskBalance: res.newTaskBalance,
      },
      at: nowMs,
    });

    return {
      ok: true,
      amount: proj.accrualAmount,
      alreadyPaid: res.alreadyPaid,
      hours: proj.accruableHours,
      projection: proj,
      newBalance: res.newBalance,
      newTaskBalance: res.newTaskBalance,
    };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Claim failed",
    };
  }
}

export async function applyScheduledHourlyAccrualForUser(
  uid: string,
  nowMs: number = Date.now(),
): Promise<{
  ok: boolean;
  applied: boolean;
  alreadyPaid: boolean;
  amount: number;
  hours: number;
  reason: string;
  earningRefId?: string;
}> {
  const user = await getUser(uid);
  if (!user) return { ok: false, applied: false, alreadyPaid: false, amount: 0, hours: 0, reason: "user_not_found" };

  const [settings, planDoc] = await Promise.all([
    getSettings(),
    getPlan(user.plan).catch(() => null),
  ]);
  const proj = projectUserAccrualBalance(user, settings, nowMs, planDoc?.hourlyRate);
  if (proj.accrualAmount <= 0) {
    await createTxLog({
      event: "hourly_claim_skip",
      userId: uid,
      payload: { origin: "worker", reason: proj.reason, projection: proj },
      at: nowMs,
    });
    await updateUser(uid, { lastHourlyClaimAt: nowMs });
    return { ok: true, applied: false, alreadyPaid: false, amount: 0, hours: 0, reason: proj.reason };
  }
  const earningRefId = `hourly-${uid}-${proj.toHour}`;
  const res = await rewardUserForTaskTx({
    uid,
    taskId: `hourly-worker-${proj.toHour}`,
    amount: proj.accrualAmount,
    source: "claim",
    earningReferenceId: earningRefId,
    note: `Scheduled hourly ${proj.fromHour}->${proj.toHour} x${proj.tierMultiplier}`,
  });
  await updateUser(uid, { lastHourlyClaimAt: nowMs });
  await createTxLog({
    event: "hourly_claim_success",
    userId: uid,
    payload: {
      origin: "worker",
      amount: proj.accrualAmount,
      hours: proj.accruableHours,
      fromHour: proj.fromHour,
      toHour: proj.toHour,
      alreadyPaid: res.alreadyPaid,
      earningRefId,
    },
    at: nowMs,
  });
  return {
    ok: true,
    applied: !res.alreadyPaid,
    alreadyPaid: res.alreadyPaid,
    amount: proj.accrualAmount,
    hours: proj.accruableHours,
    reason: proj.reason,
    earningRefId,
  };
}

export { floorHourBucketOf };

export async function saveQuickLinksAction(
  input: z.infer<typeof saveQuickLinksSchema>,
) {
  const session = await verifySessionCookie();
  if (!session) return { ok: false, error: "Unauthenticated" };
  const parsed = saveQuickLinksSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.flatten().fieldErrors ?? "Invalid links",
    };
  }
  const cleaned: QuickLink[] = parsed.data.links.map((l, idx) => ({
    id: l.id,
    href: l.href,
    label: l.label.slice(0, 40),
    iconName: ALLOWED_QUICKLINK_ICONS.has(l.iconName) ? l.iconName : "Sparkles",
    custom: l.custom ?? false,
    order: idx,
  }));
  await updateUser(session.uid, { quickLinks: cleaned });
  return { ok: true, links: cleaned };
}

export async function incrementReferralClickAction() {
  const session = await verifySessionCookie();
  if (!session) return { ok: false, error: "Unauthenticated" };
  const db = getAdminDb();
  const FieldValue = (await import("firebase-admin/firestore")).FieldValue;
  const ref = db.collection("users").doc(session.uid);
  await ref.set(
    { referralClicks: (FieldValue as typeof FV).increment(1), updatedAt: Date.now() },
    { merge: true },
  );
  return { ok: true };
}

export async function appendBalanceSnapshotAction(
  input: z.infer<typeof appendBalanceSnapshotSchema> = {},
) {
  const session = await verifySessionCookie();
  if (!session) return { ok: false, error: "Unauthenticated" };
  const parsed = appendBalanceSnapshotSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const user = await getUser(session.uid);
  if (!user) return { ok: false, error: "No user" };

  const snapshot: BalanceSnapshot = {
    at: parsed.data.at ?? Date.now(),
    balance: Number(user.balance ?? 0),
    ...(typeof parsed.data.effectiveRate === "number"
      ? { effectiveRate: parsed.data.effectiveRate }
      : {}),
  };
  const next: BalanceSnapshot[] = [
    ...(Array.isArray(user.balanceHistory) ? user.balanceHistory : []),
    snapshot,
  ].sort((a, b) => a.at - b.at).slice(-100);

  await updateUser(session.uid, { balanceHistory: next });
  return { ok: true, length: next.length };
}

function lastTwoEffectiveRates(bh: BalanceSnapshot[]) {
  const withRates = bh
    .filter((s) => typeof s.effectiveRate === "number")
    .slice(-2);
  if (withRates.length < 2) return null;
  const [a, b] = withRates as [BalanceSnapshot & { effectiveRate: number }, BalanceSnapshot & { effectiveRate: number }];
  return { prev: a.effectiveRate, cur: b.effectiveRate };
}

export async function refreshDashboardRateAction(): Promise<
  z.SafeParseReturnType<any, z.infer<typeof refreshDashboardRateOutputSchema>> extends never
    ? never
    : { ok: true; data: z.infer<typeof refreshDashboardRateOutputSchema> } | { ok: false; error: string }
> {
  const session = await verifySessionCookie();
  if (!session) return { ok: false, error: "Unauthenticated" };
  const user = await getUser(session.uid);
  if (!user) return { ok: false, error: "No user" };
  const planDoc = (await getPlan(user.plan)) ?? null;
  const baseRate = Number(user.apnRate ?? planDoc?.hourlyRate ?? 0);

  const now = Date.now();
  const start24 = now - MS_24_H;
  const bh = (user.balanceHistory ?? [] as BalanceSnapshot[]).filter(
    (s) => s.at >= start24 && s.at <= now,
  );

  const buckets: { t: number; value: number }[] = [];
  for (let i = 0; i < 24; i++) {
    const bucketStart = start24 + i * MS_1_H;
    const bucketEnd = bucketStart + MS_1_H;
    const inBucket = bh.filter((s) => s.at >= bucketStart && s.at < bucketEnd);
    let value = baseRate;
    if (inBucket.length > 0) {
      const rates = inBucket
        .map((s) => (typeof s.effectiveRate === "number" ? s.effectiveRate : NaN))
        .filter((v) => !isNaN(v));
      if (rates.length > 0) {
        value = rates.reduce((s, v) => s + v, 0) / rates.length;
      }
    }
    buckets.push({ t: bucketStart, value: Math.max(0, value) });
  }

  let fluctuation: { pct: number | null; dir: "up" | "down" | "flat" } = {
    pct: null,
    dir: "flat",
  };
  const two = lastTwoEffectiveRates(user.balanceHistory ?? [] as BalanceSnapshot[]);
  if (two && two.prev > 0) {
    const pct = ((two.cur - two.prev) / Math.abs(two.prev)) * 100;
    fluctuation = {
      pct: Number(pct.toFixed(2)),
      dir: pct > 0.01 ? "up" : pct < -0.01 ? "down" : "flat",
    };
  } else if (two && two.prev === 0 && two.cur > 0) {
    fluctuation = { pct: 100, dir: "up" };
  }

  const out = {
    apnRate: baseRate,
    planLabel: planDoc?.name ?? String(user.plan ?? "starter"),
    trend24h: buckets,
    fluctuation,
  };

  const parsed = refreshDashboardRateOutputSchema.safeParse(out);
  if (!parsed.success) {
    return { ok: false, error: "Failed to validate output" };
  }
  return { ok: true, data: parsed.data };
}

export async function getSideMenuProfileAction() {
  const session = await verifySessionCookie();
  if (!session) return { ok: false, error: "Unauthenticated" };
  const u = await getUser(session.uid);
  if (!u) return { ok: false, error: "No user" };
  return {
    ok: true,
    data: {
      name: u.name,
      email: u.email,
      plan: u.plan,
      balance: u.balance ?? 0,
    },
  };
}

export type EnrichedTask = TaskDoc & {
  userStatus: {
    state: "available" | "submitted" | "verified" | "completed" | "rejected" | "failed";
    lastSubmissionAt?: number;
    lastReward?: number;
    cooldownUntil?: number;
  };
};

function normalizeTaskStatus(submissions: SubmissionDoc[], task: TaskDoc, nowMs: number): EnrichedTask["userStatus"] {
  const relevant = submissions.filter((s) => s.taskId === task.id);
  if (relevant.length === 0) return { state: "available" };
  const latest = relevant.sort((a, b) => b.createdAt - a.createdAt)[0];
  const in24h = nowMs - latest.createdAt < MS_24_H;
  if (!in24h) return { state: "available" };
  const base = {
    lastSubmissionAt: latest.createdAt,
    lastReward: latest.reward,
    cooldownUntil: latest.createdAt + MS_24_H,
  };
  switch (latest.status) {
    case "submitted":
    case "verified":
    case "completed":
    case "failed":
    case "rejected":
      return { state: latest.status as EnrichedTask["userStatus"]["state"], ...base };
    default:
      return { state: "available" };
  }
}

export async function listTasksWithFiltersAction(
  input: z.infer<typeof listTasksFilterSchema> = { type: "all", sort: "newest", status: "all" },
): Promise<{ ok: true; tasks: EnrichedTask[] } | { ok: false; error: string }> {
  const session = await verifySessionCookie();
  if (!session) return { ok: false, error: "Unauthenticated" };
  const parsed = listTasksFilterSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid filter" };
  const { type, sort, status } = parsed.data;
  const nowMs = Date.now();

  const [allTasks, submissions] = await Promise.all([
    listTasks(true),
    listSubmissionsByUser(session.uid, { limit: 200 }),
  ]);

  let tasks: TaskDoc[] = allTasks;
  if (type !== "all") {
    tasks = tasks.filter((t) => t.type === type);
  }

  const enriched: EnrichedTask[] = tasks.map((t) => ({
    ...t,
    userStatus: normalizeTaskStatus(submissions, t, nowMs),
  }));

  if (status !== "all") {
    if (status === "available") {
      enriched.splice(0, enriched.length, ...enriched.filter((t) => t.userStatus.state === "available"));
    } else if (status === "completed") {
      enriched.splice(0, enriched.length, ...enriched.filter((t) =>
        t.userStatus.state === "verified" || t.userStatus.state === "completed"
      ));
    }
  }

  switch (sort) {
    case "reward_desc":
      enriched.sort((a, b) => b.reward - a.reward);
      break;
    case "reward_asc":
      enriched.sort((a, b) => a.reward - b.reward);
      break;
    case "newest":
    default:
      enriched.sort((a, b) => b.createdAt - a.createdAt);
  }

  return { ok: true, tasks: enriched };
}

export type QuizSummary = {
  id: string;
  title: string;
  reward: number;
  questionCount: number;
  description?: string;
  expiresAt?: number;
  state: "available" | "cooldown" | "completed";
  cooldownUntil?: number;
  lastScore?: number;
};

export async function listQuizzesAction(
  _input: z.infer<typeof listQuizzesSchema> = {},
): Promise<{ ok: true; quizzes: QuizSummary[] } | { ok: false; error: string }> {
  const session = await verifySessionCookie();
  if (!session) return { ok: false, error: "Unauthenticated" };
  const parsed = listQuizzesSchema.safeParse(_input ?? {});
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const nowMs = Date.now();

  const [allTasks, submissions] = await Promise.all([
    listTasks(true),
    listSubmissionsByUser(session.uid, { limit: 100 }),
  ]);

  const quizTasks = allTasks.filter((t) => t.type === "quiz");
  const quizzes: QuizSummary[] = quizTasks.map((t) => {
    const mine = submissions.filter((s) => s.taskId === t.id).sort((a, b) => b.createdAt - a.createdAt);
    const latest = mine[0];
    let state: QuizSummary["state"] = "available";
    let cooldownUntil: number | undefined;
    let lastScore: number | undefined;
    if (latest) {
      const inWindow = nowMs - latest.createdAt < MS_24_H;
      if (inWindow) {
        if (latest.status === "completed" || latest.status === "verified") {
          state = "completed";
        } else {
          state = "cooldown";
        }
        cooldownUntil = latest.createdAt + MS_24_H;
      }
      try {
        if (latest.proof) {
          const parsed = JSON.parse(latest.proof) as { score?: number };
          if (typeof parsed.score === "number") lastScore = parsed.score;
        }
      } catch {}
    }
    return {
      id: t.id,
      title: t.title,
      reward: t.reward,
      questionCount: Array.isArray(t.questions) ? t.questions.length : 0,
      description: t.description,
      expiresAt: t.expiresAt,
      state,
      cooldownUntil,
      lastScore,
    };
  });

  quizzes.sort((a, b) => b.reward - a.reward);
  return { ok: true, quizzes };
}

export type HistoryPageRow = HistoryRow;

export async function listHistoryPaginatedAction(
  input: z.infer<typeof listHistoryPaginatedSchema> = { kind: "all", source: "all", limit: 50 },
): Promise<{ ok: true; rows: HistoryPageRow[]; nextCursor: { id: string; kind: "earning" | "withdrawal" } | null; hasMore: boolean; totalInPage: number } | { ok: false; error: string }> {
  const session = await verifySessionCookie();
  if (!session) return { ok: false, error: "Unauthenticated" };
  const parsed = listHistoryPaginatedSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid filters" };
  const { kind, source, fromTs, toTs, limit, cursorId, cursorKind } = parsed.data;

  const historySource: HistoryRowEarning["source"] | "withdrawal" | undefined =
    kind === "withdrawal"
      ? "withdrawal"
      : source === "all"
      ? undefined
      : (source as HistoryRowEarning["source"]);

  const result = await listHistoryActionWithFilters(session.uid, {
    source: historySource,
    limit,
    cursor: cursorId,
    cursorKind,
    fromTs,
    toTs,
  });

  let rows = result.rows as HistoryPageRow[];
  if (kind === "earning") rows = rows.filter((r) => r.kind === "earning");

  return {
    ok: true,
    rows,
    nextCursor: result.nextCursor,
    hasMore: result.nextCursor !== null,
    totalInPage: rows.length,
  };
}

export async function exportHistoryCsvAction(
  input: z.infer<typeof exportHistoryCsvSchema> = { kind: "all", source: "all" },
): Promise<{ ok: true; filename: string; dataUrl: string; rowCount: number } | { ok: false; error: string }> {
  const session = await verifySessionCookie();
  if (!session) return { ok: false, error: "Unauthenticated" };
  const parsed = exportHistoryCsvSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid filters" };
  const { kind, source, fromTs, toTs } = parsed.data;

  const historySource: HistoryRowEarning["source"] | "withdrawal" | undefined =
    kind === "withdrawal"
      ? "withdrawal"
      : source === "all"
      ? undefined
      : (source as HistoryRowEarning["source"]);

  const ALL_ROWS_LIMIT = 5000;
  let cursorId: string | undefined;
  let cursorKind: "earning" | "withdrawal" | undefined;
  const collectedRaw: HistoryPageRow[] = [];

  for (let i = 0; i < 10; i++) {
    const result = await listHistoryActionWithFilters(session.uid, {
      source: historySource,
      limit: ALL_ROWS_LIMIT,
      cursor: cursorId,
      cursorKind,
      fromTs,
      toTs,
    });
    collectedRaw.push(...(result.rows as HistoryPageRow[]));
    if (!result.nextCursor) break;
    cursorId = result.nextCursor.id;
    cursorKind = result.nextCursor.kind;
  }

  const collected = kind === "earning" ? collectedRaw.filter((r) => r.kind === "earning") : collectedRaw;

  const csvRows: HistoryCsvRow[] = collected.map((r) => {
    if (r.kind === "earning") {
      return {
        kind: "earning",
        id: r.id,
        createdAt: r.createdAt,
        source: r.source,
        amount: r.amount,
        referenceId: r.referenceId,
        txId: r.txId,
        note: (r as any).note,
      };
    }
    return {
      kind: "withdrawal",
      id: r.id,
      createdAt: r.createdAt,
      status: r.status,
      amount: r.amount,
      fee: r.fee,
      netAmount: r.netAmount,
      rejectReason: r.rejectReason,
    };
  });

  const csv = generateCsv(csvRows);
  const dataUrl = csvToDataUrl(csv);
  const stamp = new Date();
  const yyyy = stamp.getFullYear();
  const mm = String(stamp.getMonth() + 1).padStart(2, "0");
  const dd = String(stamp.getDate()).padStart(2, "0");
  const filename = `apron-history-${yyyy}${mm}${dd}.csv`;
  return { ok: true, filename, dataUrl, rowCount: csvRows.length };
}
