import "server-only";
import { getAdminDb } from "@/firebase/admin";
import { COLLECTIONS } from "@/lib/constants";
import { generateReferralCode } from "@/lib/utils";
import type {
  UserDoc,
  TaskDoc,
  SubmissionDoc,
  WithdrawalDoc,
  PlanDoc,
  EarningDoc,
  SettingsDoc,
  TxLogDoc,
  TxLogEvent,
  VerifiedBankAccount,
  AdminAuditLog,
  AdminAuditAction,
  BalanceEditLog,
  PlanVersionLog,
  AdminOpsTask,
  AdminTaskHistoryEntry,
} from "@/types";
import type {
  Firestore,
  Transaction,
  DocumentData,
  FieldValue,
} from "firebase-admin/firestore";

function col(db: Firestore, name: string) {
  return db.collection(name);
}

function fromSnap<T>(snap: {
  exists: boolean;
  data: () => DocumentData | undefined;
  id: string;
}): T | null {
  if (!snap.exists) return null;
  const d = snap.data()!;
  return { ...(d as unknown as T), id: snap.id } as T;
}

function withId<T extends { id?: string }>(data: T, id: string) {
  return { ...data, id } as T & { id: string };
}

export async function getUser(uid: string): Promise<UserDoc | null> {
  const db = getAdminDb();
  const snap = await col(db, COLLECTIONS.users).doc(uid).get();
  return fromSnap<UserDoc>(snap);
}

export async function getUserByReferralCode(
  code: string,
): Promise<UserDoc | null> {
  const db = getAdminDb();
  const snap = await col(db, COLLECTIONS.users)
    .where("referralCode", "==", code.toUpperCase())
    .limit(1)
    .get();
  if (snap.empty) return null;
  return fromSnap<UserDoc>(snap.docs[0]);
}

export async function listUsers(opts?: {
  search?: string;
  limit?: number;
  cursor?: string;
}) {
  const db = getAdminDb();
  let q = col(db, COLLECTIONS.users).orderBy("createdAt", "desc") as FirebaseFirestore.Query;
  if (opts?.search) {
    const s = opts.search.toLowerCase();
    q = q.where("name", ">=", s).where("name", "<=", s + "\uf8ff");
  }
  if (opts?.cursor) {
    const snap = await col(db, COLLECTIONS.users).doc(opts.cursor).get();
    if (snap.exists) q = q.startAfter(snap);
  }
  if (opts?.limit) q = q.limit(opts.limit);
  const res = await q.get();
  return res.docs.map((d) => withId(d.data(), d.id) as unknown as UserDoc);
}

export async function createUserDoc(
  uid: string,
  data: Omit<UserDoc, "uid" | "id">,
): Promise<UserDoc> {
  const db = getAdminDb();
  const ref = col(db, COLLECTIONS.users).doc(uid);
  await ref.set(data);
  return { ...data, uid, id: uid } as UserDoc;
}

export async function updateUser(
  uid: string,
  patch: Partial<UserDoc>,
): Promise<void> {
  const db = getAdminDb();
  const ref = col(db, COLLECTIONS.users).doc(uid);
  await ref.set({ ...patch, updatedAt: Date.now() }, { merge: true });
}

export async function updateUserBalanceTx(
  tx: Transaction,
  uid: string,
  opts: { balance?: number; taskBalance?: number },
) {
  const db = getAdminDb();
  const ref = col(db, COLLECTIONS.users).doc(uid);
  const snap = await tx.get(ref);
  if (!snap.exists) throw new Error(`User ${uid} not found`);
  const patch: Partial<UserDoc> = { updatedAt: Date.now() } as Partial<UserDoc>;
  if (typeof opts.balance === "number") patch.balance = opts.balance;
  if (typeof opts.taskBalance === "number") patch.taskBalance = opts.taskBalance;
  tx.update(ref, patch as DocumentData);
}

export async function listTasks(onlyActive = true): Promise<TaskDoc[]> {
  const db = getAdminDb();
  let q: FirebaseFirestore.Query = col(db, COLLECTIONS.tasks).orderBy(
    "createdAt",
    "desc",
  );
  if (onlyActive) q = q.where("active", "==", true);
  const res = await q.get();
  return res.docs.map((d) => withId(d.data(), d.id) as TaskDoc);
}

export async function getTask(taskId: string): Promise<TaskDoc | null> {
  const db = getAdminDb();
  const snap = await col(db, COLLECTIONS.tasks).doc(taskId).get();
  return fromSnap<TaskDoc>(snap);
}

export async function upsertTask(
  input: Omit<TaskDoc, "id" | "createdAt"> & { id?: string },
): Promise<TaskDoc> {
  const db = getAdminDb();
  const id = input.id ?? col(db, COLLECTIONS.tasks).doc().id;
  const ref = col(db, COLLECTIONS.tasks).doc(id);
  const existing = await ref.get();
  const now = Date.now();
  const existingData = existing.exists ? (existing.data() as TaskDoc) : null;
  const doc: Omit<TaskDoc, "id"> = {
    title: input.title,
    type: input.type,
    reward: input.reward,
    description: input.description,
    questions: input.questions,
    externalUrl: input.externalUrl ?? input.url,
    url: input.url ?? input.externalUrl,
    minDurationSec: input.minDurationSec,
    proofKey: input.proofKey,
    maxDailyClaims: input.maxDailyClaims,
    expiresAt: input.expiresAt,
    plan: input.plan,
    metadata: input.metadata,
    active: input.active,
    createdAt: existingData ? existingData.createdAt : now,
  };
  await ref.set(doc, { merge: true });
  return { id, ...doc } as TaskDoc;
}

export async function createSubmission(
  data: Omit<SubmissionDoc, "id">,
): Promise<SubmissionDoc> {
  const db = getAdminDb();
  const ref = col(db, COLLECTIONS.submissions).doc();
  await ref.set(data);
  return { id: ref.id, ...data } as SubmissionDoc;
}

export async function findSubmission(userId: string, taskId: string) {
  const db = getAdminDb();
  const snap = await col(db, COLLECTIONS.submissions)
    .where("userId", "==", userId)
    .where("taskId", "==", taskId)
    .limit(1)
    .get();
  return snap.empty ? null : (withId(snap.docs[0].data(), snap.docs[0].id) as SubmissionDoc);
}

export async function createWithdrawal(
  data: Omit<WithdrawalDoc, "id">,
): Promise<WithdrawalDoc> {
  const db = getAdminDb();
  const ref = col(db, COLLECTIONS.withdrawals).doc();
  await ref.set(data);
  return { id: ref.id, ...data } as WithdrawalDoc;
}

export async function getWithdrawal(wdId: string) {
  const db = getAdminDb();
  const snap = await col(db, COLLECTIONS.withdrawals).doc(wdId).get();
  return fromSnap<WithdrawalDoc>(snap);
}

export async function listWithdrawalsByUser(
  userId: string,
  limit = 50,
): Promise<WithdrawalDoc[]> {
  const db = getAdminDb();
  const snap = await col(db, COLLECTIONS.withdrawals)
    .where("userId", "==", userId)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => withId(d.data(), d.id) as WithdrawalDoc);
}

export async function listWithdrawalsByStatus(
  status?: WithdrawalDoc["status"],
  limit = 100,
): Promise<WithdrawalDoc[]> {
  const db = getAdminDb();
  let q: FirebaseFirestore.Query = col(db, COLLECTIONS.withdrawals).orderBy(
    "createdAt",
    "desc",
  );
  if (status) q = q.where("status", "==", status);
  q = q.limit(limit);
  const snap = await q.get();
  return snap.docs.map((d) => withId(d.data(), d.id) as WithdrawalDoc);
}

export async function updateWithdrawalStatus(
  wdId: string,
  patch: Partial<Pick<WithdrawalDoc, "status" | "rejectReason" | "transactionId" | "processedAt">>,
) {
  const db = getAdminDb();
  await col(db, COLLECTIONS.withdrawals).doc(wdId).set(patch, { merge: true });
}

export async function listPlans(): Promise<PlanDoc[]> {
  const db = getAdminDb();
  try {
    const snap = await col(db, COLLECTIONS.plans).orderBy("price", "asc").get();
    return snap.docs.map((d) => withId(d.data(), d.id) as PlanDoc);
  } catch {
    return [];
  }
}

export async function getPlan(id: string): Promise<PlanDoc | null> {
  const db = getAdminDb();
  const snap = await col(db, COLLECTIONS.plans).doc(id).get();
  return fromSnap<PlanDoc>(snap);
}

export async function upsertPlan(input: PlanDoc): Promise<PlanDoc> {
  const db = getAdminDb();
  const ref = col(db, COLLECTIONS.plans).doc(input.id);
  await ref.set(input, { merge: true });
  return input;
}

export async function createEarning(
  data: Omit<EarningDoc, "id">,
): Promise<EarningDoc> {
  const db = getAdminDb();
  const ref = col(db, COLLECTIONS.earnings).doc();
  await ref.set(data);
  return { id: ref.id, ...data } as EarningDoc;
}

export async function listEarningsByUser(
  userId: string,
  limit = 50,
): Promise<EarningDoc[]> {
  const db = getAdminDb();
  const snap = await col(db, COLLECTIONS.earnings)
    .where("userId", "==", userId)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => withId(d.data(), d.id) as EarningDoc);
}

export async function getSettings(): Promise<SettingsDoc> {
  const db = getAdminDb();
  const snap = await col(db, COLLECTIONS.settings).doc("platform").get();
  if (!snap.exists) {
    const defaults: SettingsDoc = {
      id: "platform",
      referralBonus: 50,
      withdrawalFeePct: 0.05,
      minWithdrawal: 1000,
      hourlyInactivityDays: 30,
      globalAccrualCapAPN: 100_000,
    };
    await col(db, COLLECTIONS.settings).doc("platform").set(defaults);
    return defaults;
  }
  const raw = snap.data() as Partial<SettingsDoc>;
  const merged: SettingsDoc = {
    id: "platform",
    referralBonus: raw.referralBonus ?? 50,
    withdrawalFeePct: raw.withdrawalFeePct ?? 0.05,
    minWithdrawal: raw.minWithdrawal ?? 1000,
    hourlyInactivityDays: raw.hourlyInactivityDays ?? 30,
    globalAccrualCapAPN: raw.globalAccrualCapAPN ?? 100_000,
  };
  return merged;
}

export async function updateSettings(patch: Partial<SettingsDoc>) {
  const db = getAdminDb();
  await col(db, COLLECTIONS.settings)
    .doc("platform")
    .set(patch, { merge: true });
}

export async function listSubmissionsByUser(
  userId: string,
  opts?: { limit?: number; taskId?: string },
): Promise<SubmissionDoc[]> {
  const db = getAdminDb();
  let q: FirebaseFirestore.Query = col(db, COLLECTIONS.submissions)
    .where("userId", "==", userId)
    .orderBy("createdAt", "desc");
  if (opts?.taskId) q = q.where("taskId", "==", opts.taskId);
  if (opts?.limit) q = q.limit(opts.limit);
  const snap = await q.get();
  return snap.docs.map((d) => withId(d.data(), d.id) as SubmissionDoc);
}

export async function hasSubmittedTaskInWindow(
  userId: string,
  taskId: string,
  windowMs: number,
): Promise<boolean> {
  const db = getAdminDb();
  const since = Date.now() - windowMs;
  const snap = await col(db, COLLECTIONS.submissions)
    .where("userId", "==", userId)
    .where("taskId", "==", taskId)
    .where("createdAt", ">=", since)
    .limit(1)
    .get();
  return !snap.empty;
}

export async function createTxLog(
  data: Omit<TxLogDoc, "id">,
): Promise<TxLogDoc> {
  const db = getAdminDb();
  const ref = col(db, COLLECTIONS.tx_logs).doc();
  await ref.set(data);
  return { id: ref.id, ...data } as TxLogDoc;
}

export type HistoryRowEarning = {
  kind: "earning";
  id: string;
  userId: string;
  source: EarningDoc["source"];
  amount: number;
  referenceId?: string;
  txId?: string;
  createdAt: number;
  note?: string;
};
export type HistoryRowWithdrawal = {
  kind: "withdrawal";
  id: string;
  userId: string;
  amount: number;
  fee: number;
  netAmount: number;
  status: WithdrawalDoc["status"];
  rejectReason?: string;
  createdAt: number;
};
export type HistoryRow = HistoryRowEarning | HistoryRowWithdrawal;

export async function listHistoryActionWithFilters(
  userId: string,
  opts?: {
    source?: EarningDoc["source"] | "withdrawal";
    search?: string;
    limit?: number;
    cursor?: string;
    cursorKind?: "earning" | "withdrawal";
    fromTs?: number;
    toTs?: number;
  },
): Promise<{ rows: HistoryRow[]; nextCursor: { id: string; kind: "earning" | "withdrawal" } | null }> {
  const db = getAdminDb();
  const limit = opts?.limit ?? 50;
  const srcFilter = opts?.source;
  const wantEarnings = srcFilter === undefined || srcFilter !== "withdrawal";
  const wantWithdrawals = srcFilter === undefined || srcFilter === "withdrawal";

  let earningRows: HistoryRowEarning[] = [];
  let withdrawalRows: HistoryRowWithdrawal[] = [];

  if (wantEarnings) {
    let eq: FirebaseFirestore.Query = col(db, COLLECTIONS.earnings)
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc");
    if (srcFilter && srcFilter !== ("withdrawal" as string))
      eq = eq.where("source", "==", srcFilter as EarningDoc["source"]);
    if (opts?.fromTs) eq = eq.where("createdAt", ">=", opts.fromTs);
    if (opts?.toTs) eq = eq.where("createdAt", "<=", opts.toTs);
    if (opts?.cursor && opts?.cursorKind === "earning") {
      const snap = await col(db, COLLECTIONS.earnings).doc(opts.cursor).get();
      if (snap.exists) eq = eq.startAfter(snap);
    }
    eq = eq.limit(limit);
    const snap = await eq.get();
    earningRows = snap.docs.map((d) => {
      const e = withId(d.data(), d.id) as EarningDoc;
      return { kind: "earning", id: e.id, userId: e.userId, source: e.source, amount: e.amount, referenceId: e.referenceId, txId: e.txId, createdAt: e.createdAt } as HistoryRowEarning;
    });
  }

  if (wantWithdrawals) {
    let wq: FirebaseFirestore.Query = col(db, COLLECTIONS.withdrawals)
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc");
    if (opts?.fromTs) wq = wq.where("createdAt", ">=", opts.fromTs);
    if (opts?.toTs) wq = wq.where("createdAt", "<=", opts.toTs);
    if (opts?.cursor && opts?.cursorKind === "withdrawal") {
      const snap = await col(db, COLLECTIONS.withdrawals).doc(opts.cursor).get();
      if (snap.exists) wq = wq.startAfter(snap);
    }
    wq = wq.limit(limit);
    const snap = await wq.get();
    withdrawalRows = snap.docs.map((d) => {
      const w = withId(d.data(), d.id) as WithdrawalDoc;
      return { kind: "withdrawal", id: w.id, userId: w.userId, amount: w.amount, fee: w.fee, netAmount: w.netAmount, status: w.status, rejectReason: w.rejectReason, createdAt: w.createdAt } as HistoryRowWithdrawal;
    });
  }

  const combined = [...earningRows, ...withdrawalRows]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);

  if (opts?.search) {
    const s = opts.search.toLowerCase();
    const filtered = combined.filter((r) => {
      if (r.kind === "earning") return r.source.toLowerCase().includes(s) || String(r.amount).includes(s) || (r.referenceId ?? "").toLowerCase().includes(s);
      return r.status.toLowerCase().includes(s) || String(r.amount).includes(s);
    });
    combined.splice(0, combined.length, ...filtered);
  }

  const last = combined[combined.length - 1];
  const nextCursor = last && combined.length >= limit
    ? { id: last.id, kind: last.kind as "earning" | "withdrawal" }
    : null;

  return { rows: combined, nextCursor };
}

export async function generateUniqueReferralCode(
  length = 8,
  maxAttempts = 5,
): Promise<string> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = generateReferralCode(length);
    const existing = await getUserByReferralCode(candidate);
    if (!existing) return candidate;
  }
  throw new Error(
    `[referral-code] Failed to generate a unique code after ${maxAttempts} attempts`,
  );
}

export function listBankAccountsByUser(
  user: Pick<UserDoc, "bankAccounts" | "bankDetails" | "createdAt"> | null,
): VerifiedBankAccount[] {
  if (!user) return [];
  const arr = Array.isArray(user.bankAccounts) ? user.bankAccounts.slice() : [];
  if (user.bankDetails && !arr.some((a) =>
    a.bankName === user.bankDetails!.bankName &&
    a.accountNumber === user.bankDetails!.accountNumber,
  )) {
    arr.unshift({
      id: "legacy-default",
      bankName: user.bankDetails.bankName,
      accountNumber: user.bankDetails.accountNumber,
      accountName: user.bankDetails.accountName,
      nickname: "Default",
      verified: true,
      verifiedAt: user.createdAt ?? Date.now(),
      addedAt: user.createdAt ?? Date.now(),
      isDefault: true,
    });
  }
  arr.sort((a, b) => {
    if (!!b.isDefault !== !!a.isDefault) return (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0);
    return (b.addedAt ?? 0) - (a.addedAt ?? 0);
  });
  return arr as VerifiedBankAccount[];
}

export function getDefaultBankAccount(
  user: Pick<UserDoc, "bankAccounts" | "bankDetails" | "createdAt"> | null,
): VerifiedBankAccount | null {
  const list = listBankAccountsByUser(user);
  if (list.length === 0) return null;
  const def = list.find((a) => a.isDefault);
  return def ?? list[0];
}

export function getBankAccountById(
  user: Pick<UserDoc, "bankAccounts" | "bankDetails" | "createdAt"> | null,
  accountId: string,
): VerifiedBankAccount | null {
  const list = listBankAccountsByUser(user);
  return list.find((a) => a.id === accountId) ?? null;
}

export async function addBankAccountToUser(
  uid: string,
  account: Omit<VerifiedBankAccount, "id" | "addedAt" | "verified"> & { verified?: boolean; addedAt?: number },
  maxAccounts = 5,
): Promise<VerifiedBankAccount | null> {
  const db = getAdminDb();
  const userRef = col(db, COLLECTIONS.users).doc(uid);
  let created: VerifiedBankAccount | null = null;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) return;
    const data = snap.data() as UserDoc;
    const existing = listBankAccountsByUser(data);
    if (existing.length >= maxAccounts) return;
    const id = `ba-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const newRecord: VerifiedBankAccount = {
      id,
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      accountName: account.accountName,
      nickname: account.nickname,
      verified: account.verified ?? false,
      verifiedAt: account.verified ? Date.now() : undefined,
      addedAt: account.addedAt ?? Date.now(),
      isDefault: existing.length === 0,
    };
    created = newRecord;
    const next = [...(Array.isArray(data.bankAccounts) ? data.bankAccounts : []), newRecord];
    tx.update(userRef, {
      bankAccounts: next,
      updatedAt: Date.now(),
    } as DocumentData);
  });
  return created;
}

export async function setDefaultBankAccountForUser(
  uid: string,
  accountId: string,
): Promise<boolean> {
  const db = getAdminDb();
  const userRef = col(db, COLLECTIONS.users).doc(uid);
  let ok = false;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) return;
    const data = snap.data() as UserDoc;
    const list = listBankAccountsByUser(data);
    if (!list.find((a) => a.id === accountId)) return;
    const legacyDefaultOnly = list.length === 1 && list[0].id === "legacy-default";
    let nextBankAccounts = (Array.isArray(data.bankAccounts) ? data.bankAccounts : []).map((a) => ({
      ...a,
      isDefault: a.id === accountId,
    }));
    if (legacyDefaultOnly && data.bankDetails) {
      if (!nextBankAccounts.find((a) => a.id === accountId)) {
        nextBankAccounts.push({
          id: "legacy-default",
          bankName: data.bankDetails.bankName,
          accountNumber: data.bankDetails.accountNumber,
          accountName: data.bankDetails.accountName,
          nickname: "Default",
          verified: true,
          verifiedAt: data.createdAt ?? Date.now(),
          addedAt: data.createdAt ?? Date.now(),
          isDefault: accountId === "legacy-default",
        });
      }
    }
    tx.update(userRef, {
      bankAccounts: nextBankAccounts,
      updatedAt: Date.now(),
    } as DocumentData);
    ok = true;
  });
  return ok;
}

export async function deleteBankAccountFromUser(
  uid: string,
  accountId: string,
): Promise<boolean> {
  if (accountId === "legacy-default") return false;
  const db = getAdminDb();
  const userRef = col(db, COLLECTIONS.users).doc(uid);
  let ok = false;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) return;
    const data = snap.data() as UserDoc;
    const arr = Array.isArray(data.bankAccounts) ? data.bankAccounts.slice() : [];
    const idx = arr.findIndex((a) => a.id === accountId);
    if (idx === -1) return;
    const removed = arr[idx];
    arr.splice(idx, 1);
    if (removed?.isDefault && arr.length > 0) {
      arr[0].isDefault = true;
    }
    tx.update(userRef, {
      bankAccounts: arr,
      updatedAt: Date.now(),
    } as DocumentData);
    ok = true;
  });
  return ok;
}

export async function hasRecentDuplicateWithdrawal(
  userId: string,
  amount: number,
  bankAccountFingerprint: string,
  windowMs: number,
): Promise<boolean> {
  const db = getAdminDb();
  const since = Date.now() - windowMs;
  const snap = await col(db, COLLECTIONS.withdrawals)
    .where("userId", "==", userId)
    .where("status", "==", "pending")
    .where("amount", "==", amount)
    .where("createdAt", ">=", since)
    .limit(1)
    .get();
  if (!snap.empty) return true;
  const all = await col(db, COLLECTIONS.withdrawals)
    .where("userId", "==", userId)
    .where("createdAt", ">=", since)
    .orderBy("createdAt", "desc")
    .limit(10)
    .get();
  for (const doc of all.docs) {
    const w = withId(doc.data(), doc.id) as WithdrawalDoc;
    if (w.amount !== amount) continue;
    const fp = w.bankDetails
      ? `${w.bankDetails.bankName}|${w.bankDetails.accountNumber}`
      : "";
    if (fp && fp === bankAccountFingerprint) return true;
  }
  return false;
}

export interface AdminOverviewOptions {
  fromMs?: number;
  toMs?: number;
}

export interface AdminOverviewResult {
  totalUsers: number;
  activeUsers7d: number;
  totalWithdrawalsAmount: number;
  totalWithdrawalsCount: number;
  pendingWithdrawals: number;
  pendingWithdrawalsAmount: number;
  paidWithdrawalsCount: number;
  paidWithdrawalsAmount: number;
  revenueEstimate: number;
  withdrawalsTodayAmount: number;
  withdrawalsTodayCount: number;
  earningsSeries: Array<{ day: string; amount: number }>;
  withdrawalsSeries: Array<{ day: string; paid: number; pending: number; count: number }>;
}

export async function getAdminOverview(
  opts: AdminOverviewOptions = {},
): Promise<AdminOverviewResult> {
  try {
    return await getAdminOverviewInner(opts);
  } catch {
    return {
      totalUsers: 0,
      activeUsers7d: 0,
      totalWithdrawalsAmount: 0,
      totalWithdrawalsCount: 0,
      pendingWithdrawals: 0,
      pendingWithdrawalsAmount: 0,
      paidWithdrawalsCount: 0,
      paidWithdrawalsAmount: 0,
      revenueEstimate: 0,
      withdrawalsTodayAmount: 0,
      withdrawalsTodayCount: 0,
      earningsSeries: [],
      withdrawalsSeries: [],
    };
  }
}

async function getAdminOverviewInner(
  opts: AdminOverviewOptions = {},
): Promise<AdminOverviewResult> {
  const db = getAdminDb();
  const now = Date.now();
  const toMs = opts.toMs ?? now;
  const fromMs = opts.fromMs ?? now - 30 * 24 * 60 * 60 * 1000;
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayMs = todayStart.getTime();

  const [
    totalUsersSnap,
    usersUpdatedWeekSnap,
    withdrawalsRangeSnap,
    earningsRangeSnap,
    pendingAllSnap,
    plansList,
  ] = await Promise.all([
    db.collection(COLLECTIONS.users).count().get(),
    db
      .collection(COLLECTIONS.users)
      .where("updatedAt", ">=", weekAgo)
      .count()
      .get(),
    db
      .collection(COLLECTIONS.withdrawals)
      .where("createdAt", ">=", fromMs)
      .where("createdAt", "<=", toMs)
      .orderBy("createdAt", "asc")
      .get(),
    db
      .collection(COLLECTIONS.earnings)
      .where("createdAt", ">=", fromMs)
      .where("createdAt", "<=", toMs)
      .orderBy("createdAt", "asc")
      .get(),
    db.collection(COLLECTIONS.withdrawals).where("status", "==", "pending").get(),
    listPlans(),
  ]);

  const withdrawals: WithdrawalDoc[] = [];
  withdrawalsRangeSnap.forEach((d) =>
    withdrawals.push(withId(d.data(), d.id) as WithdrawalDoc),
  );

  const pendingAll: WithdrawalDoc[] = [];
  pendingAllSnap.forEach((d) =>
    pendingAll.push(withId(d.data(), d.id) as WithdrawalDoc),
  );

  const earningsPerDay = new Map<string, number>();
  earningsRangeSnap.forEach((d) => {
    const data = d.data() as { amount?: number; createdAt?: number };
    const day = new Date(data.createdAt ?? 0).toISOString().slice(0, 10);
    earningsPerDay.set(day, (earningsPerDay.get(day) ?? 0) + (data.amount ?? 0));
  });

  const wdPerDay = new Map<
    string,
    { paid: number; pending: number; count: number }
  >();
  let totalPaidAmt = 0;
  let totalPaidCount = 0;
  let pendingCount = 0;
  let pendingAmt = 0;
  let todayCount = 0;
  let todayAmt = 0;
  let totalAmt = 0;

  for (const w of withdrawals) {
    const day = new Date(w.createdAt).toISOString().slice(0, 10);
    const cur = wdPerDay.get(day) ?? { paid: 0, pending: 0, count: 0 };
    cur.count += 1;
    totalAmt += w.netAmount;
    if (w.status === "paid") {
      cur.paid += w.netAmount;
      totalPaidAmt += w.netAmount;
      totalPaidCount += 1;
    } else if (w.status === "pending") {
      cur.pending += w.netAmount;
    }
    wdPerDay.set(day, cur);
    if (w.createdAt >= todayMs && w.status === "paid") {
      todayCount += 1;
      todayAmt += w.netAmount;
    }
  }

  for (const w of pendingAll) {
    pendingCount += 1;
    pendingAmt += w.netAmount;
  }

  let revenue = 0;
  try {
    const activePlanUsers = await db
      .collection(COLLECTIONS.users)
      .where("planExpiresAt", ">", now)
      .get();
    const plansById = new Map(plansList.map((p) => [p.id, p]));
    activePlanUsers.forEach((d) => {
      const planId = (d.data() as { plan?: string }).plan;
      revenue += plansById.get(planId ?? "")?.price ?? 0;
    });
  } catch {
    revenue = 0;
  }

  const sortedDays = Array.from(
    new Set([
      ...Array.from(earningsPerDay.keys()),
      ...Array.from(wdPerDay.keys()),
    ]),
  ).sort();

  return {
    totalUsers: totalUsersSnap.data().count ?? 0,
    activeUsers7d: usersUpdatedWeekSnap.data().count ?? 0,
    totalWithdrawalsAmount: totalAmt,
    totalWithdrawalsCount: withdrawals.length,
    pendingWithdrawals: pendingCount,
    pendingWithdrawalsAmount: pendingAmt,
    paidWithdrawalsAmount: totalPaidAmt,
    paidWithdrawalsCount: totalPaidCount,
    revenueEstimate: revenue,
    withdrawalsTodayAmount: todayAmt,
    withdrawalsTodayCount: todayCount,
    earningsSeries: sortedDays.map((day) => ({
      day,
      amount: earningsPerDay.get(day) ?? 0,
    })),
    withdrawalsSeries: sortedDays.map((day) => {
      const x = wdPerDay.get(day) ?? { paid: 0, pending: 0, count: 0 };
      return { day, paid: x.paid, pending: x.pending, count: x.count };
    }),
  };
}

export interface AdminListUsersOptions {
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: "createdAt" | "updatedAt" | "balance" | "name" | "email" | "plan";
  sortDir?: "asc" | "desc";
  status?: UserDoc["status"] | "all";
  role?: UserDoc["role"] | "all";
}

export async function listAdminUsers(
  opts: AdminListUsersOptions = {},
): Promise<{ users: UserDoc[]; total: number; hasMore: boolean }> {
  const db = getAdminDb();
  const limit = Math.max(1, Math.min(opts.limit ?? 50, 200));
  const { search, status = "all", role = "all" } = opts;
  const sortBy = opts.sortBy ?? "createdAt";
  const sortDir = opts.sortDir ?? "desc";

  let q: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = col(
    db,
    COLLECTIONS.users,
  );
  if (status !== "all") q = q.where("status", "==", status);
  if (role !== "all") q = q.where("role", "==", role);
  q = q.orderBy(sortBy, sortDir).limit(limit + 1);

  let snap: FirebaseFirestore.QuerySnapshot;
  try {
    snap = await q.get();
  } catch (e) {
    try {
      const fallbackQ = col(db, COLLECTIONS.users).orderBy("createdAt", sortDir).limit(limit + 1);
      snap = await fallbackQ.get();
    } catch {
      return { users: [], total: 0, hasMore: false };
    }
  }

  const docs = snap.docs.map((d) => withId(d.data() as FirebaseFirestore.DocumentData & { id?: string }, d.id) as unknown as UserDoc);
  let users = docs;
  if (search) {
    const s = search.toLowerCase().trim();
    users = users.filter(
      (u) =>
        u.name.toLowerCase().includes(s) ||
        u.email.toLowerCase().includes(s) ||
        u.phone.includes(s) ||
        u.uid.toLowerCase().includes(s) ||
        u.referralCode.toLowerCase().includes(s),
    );
  }
  const hasMore = docs.length > limit;
  return {
    users: users.slice(0, limit),
    total: users.length,
    hasMore,
  };
}

export async function writeAdminAuditLog(
  log: Omit<AdminAuditLog, "id" | "timestamp"> & { timestamp?: number },
): Promise<AdminAuditLog> {
  const db = getAdminDb();
  const id = `aal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const rec: AdminAuditLog = {
    id,
    timestamp: log.timestamp ?? Date.now(),
    ...log,
  };
  await col(db, COLLECTIONS.admin_audit_logs).doc(id).set(rec as DocumentData);
  return rec;
}

export async function appendBalanceEditLog(
  log: Omit<BalanceEditLog, "id" | "timestamp"> & { timestamp?: number },
): Promise<BalanceEditLog> {
  const db = getAdminDb();
  const id = `bel-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const rec: BalanceEditLog = {
    id,
    timestamp: log.timestamp ?? Date.now(),
    ...log,
  };
  await col(db, COLLECTIONS.balance_edit_logs).doc(id).set(rec as DocumentData);
  return rec;
}

export async function listBalanceEditLogsByUser(
  uid: string,
  limit = 50,
): Promise<BalanceEditLog[]> {
  const db = getAdminDb();
  const snap = await col(db, COLLECTIONS.balance_edit_logs)
    .where("targetUid", "==", uid)
    .orderBy("timestamp", "desc")
    .limit(limit)
    .get();
  const out: BalanceEditLog[] = [];
  snap.forEach((d) => out.push(withId(d.data(), d.id) as BalanceEditLog));
  return out;
}

export async function createPlanDoc(
  plan: Omit<PlanDoc, "id" | "createdAt" | "updatedAt" | "version"> & { id?: string; version?: number },
): Promise<PlanDoc> {
  const db = getAdminDb();
  const now = Date.now();
  const id = plan.id ?? `plan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
  const version = plan.version ?? 1;
  const rec: PlanDoc = {
    ...plan,
    id,
    createdAt: now,
    updatedAt: now,
    version,
  };
  await col(db, COLLECTIONS.plans).doc(id).set(rec as DocumentData);
  return rec;
}

export async function deletePlanDoc(id: string): Promise<boolean> {
  const db = getAdminDb();
  const ref = col(db, COLLECTIONS.plans).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return false;
  await ref.delete();
  return true;
}

function diffObjects(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Record<string, { before: unknown; after: unknown }> {
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  const diff: Record<string, { before: unknown; after: unknown }> = {};
  for (const k of keys) {
    const b = before[k];
    const a = after[k];
    if (JSON.stringify(b) !== JSON.stringify(a)) {
      diff[k] = { before: b, after: a };
    }
  }
  return diff;
}

export async function appendPlanVersionLog(
  log: Omit<PlanVersionLog, "id" | "changedAt"> & { changedAt?: number },
): Promise<PlanVersionLog> {
  const db = getAdminDb();
  const id = `pvl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const rec: PlanVersionLog = {
    id,
    changedAt: log.changedAt ?? Date.now(),
    ...log,
  };
  await col(db, COLLECTIONS.plan_version_logs).doc(id).set(rec as DocumentData);
  return rec;
}

export async function listPlanVersionLogs(
  planId: string,
  limit = 30,
): Promise<PlanVersionLog[]> {
  const db = getAdminDb();
  const snap = await col(db, COLLECTIONS.plan_version_logs)
    .where("planId", "==", planId)
    .orderBy("changedAt", "desc")
    .limit(limit)
    .get();
  const out: PlanVersionLog[] = [];
  snap.forEach((d) => out.push(withId(d.data(), d.id) as PlanVersionLog));
  return out;
}

export function diffPlan(before: PlanDoc, after: PlanDoc) {
  const b: Record<string, unknown> = JSON.parse(JSON.stringify(before));
  const a: Record<string, unknown> = JSON.parse(JSON.stringify(after));
  return diffObjects(b, a);
}

export interface AdminOpsTaskCreate {
  title: string;
  description?: string;
  category: AdminOpsTask["category"];
  priority: AdminOpsTask["priority"];
  status?: AdminOpsTask["status"];
  assigneeUid?: string;
  deadlineAt?: number;
  reminderAt?: number;
}

export interface AdminOpsTaskUpdate {
  id: string;
  title?: string;
  description?: string;
  category?: AdminOpsTask["category"];
  priority?: AdminOpsTask["priority"];
  status?: AdminOpsTask["status"];
  assigneeUid?: string;
  assigneeName?: string;
  deadlineAt?: number;
  reminderAt?: number;
  comment?: string;
}

export async function listAdminOpsTasks(
  filters: {
    category?: AdminOpsTask["category"];
    priority?: AdminOpsTask["priority"];
    status?: AdminOpsTask["status"];
    assigneeUid?: string;
  } = {},
  limit = 100,
): Promise<AdminOpsTask[]> {
  const db = getAdminDb();
  let q: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = col(
    db,
    COLLECTIONS.admin_ops_tasks,
  );
  const keys = Object.keys(filters) as Array<keyof typeof filters>;
  for (const k of keys) {
    if (filters[k] !== undefined) q = q.where(k, "==", filters[k]);
  }
  q = q.orderBy("updatedAt", "desc").limit(limit);
  let snap: FirebaseFirestore.QuerySnapshot;
  try {
    snap = await q.get();
  } catch {
    q = col(db, COLLECTIONS.admin_ops_tasks)
      .orderBy("updatedAt", "desc")
      .limit(limit);
    snap = await q.get();
  }
  const out: AdminOpsTask[] = [];
  snap.forEach((d) => out.push(withId(d.data(), d.id) as AdminOpsTask));
  return out;
}

export async function getAdminOpsTask(id: string): Promise<AdminOpsTask | null> {
  const db = getAdminDb();
  const snap = await col(db, COLLECTIONS.admin_ops_tasks).doc(id).get();
  return fromSnap<AdminOpsTask>(snap);
}

export async function createAdminOpsTask(
  input: AdminOpsTaskCreate & { createdBy: string; createdByName: string; assigneeName?: string },
): Promise<AdminOpsTask> {
  const db = getAdminDb();
  const id = `aot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();
  const rec: AdminOpsTask = {
    id,
    title: input.title,
    description: input.description,
    category: input.category,
    priority: input.priority,
    status: input.status ?? "pending",
    assigneeUid: input.assigneeUid,
    assigneeName: input.assigneeName,
    createdBy: input.createdBy,
    createdByName: input.createdByName,
    deadlineAt: input.deadlineAt,
    reminderAt: input.reminderAt,
    createdAt: now,
    updatedAt: now,
    completedAt: input.status === "completed" ? now : undefined,
    history: [
      {
        at: now,
        by: input.createdBy,
        byName: input.createdByName,
        change: {
          _created: { before: null, after: input },
        },
      },
    ],
  };
  await col(db, COLLECTIONS.admin_ops_tasks).doc(id).set(rec as DocumentData);
  return rec;
}

export async function updateAdminOpsTask(
  input: AdminOpsTaskUpdate & { actorUid: string; actorName: string },
): Promise<AdminOpsTask | null> {
  const db = getAdminDb();
  const ref = col(db, COLLECTIONS.admin_ops_tasks).doc(input.id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const before = withId(snap.data() as FirebaseFirestore.DocumentData & { id?: string }, input.id) as unknown as AdminOpsTask;
  const now = Date.now();
  const after: AdminOpsTask = { ...before, updatedAt: now };
  const upd: Record<string, unknown> = {};
  const apply = <K extends keyof AdminOpsTask>(k: K, v: AdminOpsTask[K] | undefined, override?: (val: unknown) => unknown) => {
    if (v === undefined) return;
    const val = override ? override(v) : v;
    (after as any)[k] = val;
    upd[k] = val;
  };
  apply("title", input.title);
  apply("description", input.description);
  apply("category", input.category);
  apply("priority", input.priority);
  apply("status", input.status);
  apply("assigneeUid", input.assigneeUid);
  apply("assigneeName", input.assigneeName);
  apply("deadlineAt", input.deadlineAt);
  apply("reminderAt", input.reminderAt);
  if (after.status === "completed" && !after.completedAt) {
    after.completedAt = now;
    upd.completedAt = now;
  }
  if (after.status !== "completed" && after.completedAt) {
    after.completedAt = undefined;
    upd.completedAt = adminDbFieldValueDelete();
  }
  const diff = diffObjects(
    JSON.parse(JSON.stringify(before)),
    JSON.parse(JSON.stringify(after)),
  );
  const entry: AdminTaskHistoryEntry = {
    at: now,
    by: input.actorUid,
    byName: input.actorName,
    change: diff,
    comment: input.comment,
  };
  upd.history = [...before.history, entry];
  after.history = upd.history as AdminOpsTask["history"];
  upd.updatedAt = now;
  await ref.update(upd as DocumentData);
  return after;
}

export async function deleteAdminOpsTask(
  id: string,
): Promise<boolean> {
  const db = getAdminDb();
  const ref = col(db, COLLECTIONS.admin_ops_tasks).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return false;
  await ref.delete();
  return true;
}

function adminDbFieldValueDelete() {
  const db = getAdminDb() as any;
  return typeof db.FieldValue?.delete === "function"
    ? db.FieldValue.delete()
    : null;
}

export function adminAuditActionForWithdrawal(
  status: "paid" | "rejected",
): AdminAuditAction {
  return status === "paid" ? "withdrawal.approve" : "withdrawal.reject";
}

export { getAdminDb };
export type { FieldValue };
