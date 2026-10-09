"use server";

import { z } from "zod";
import {
  getAdminDb,
  getUser,
  listUsers,
  listWithdrawalsByStatus,
  updateUser as updateUserHelper,
  updateWithdrawalStatus,
  getWithdrawal,
  upsertPlan,
  upsertTask,
  updateSettings,
  getSettings,
  listTasks as listTasksHelper,
  getAdminOverview,
  listAdminUsers,
  writeAdminAuditLog,
  appendBalanceEditLog,
  listBalanceEditLogsByUser,
  createPlanDoc,
  deletePlanDoc,
  appendPlanVersionLog,
  listPlanVersionLogs,
  diffPlan,
  listAdminOpsTasks,
  createAdminOpsTask,
  updateAdminOpsTask,
  deleteAdminOpsTask,
  adminAuditActionForWithdrawal,
} from "@/lib/firestore";
import { verifySessionCookie } from "@/lib/server/session";
import {
  balanceDeltaSchema,
  planSchema,
  referralBonusSchema,
  roleSchema,
  statusSchema,
  taskUpsertSchema,
  withdrawalDecisionSchema,
  adminOverviewSchema,
  adminListUsersSchema,
  adminUpdateBalanceSchema,
  adminCreatePlanSchema,
  adminUpdatePlanSchema,
  adminDeletePlanSchema,
  adminCreateOpsTaskSchema,
  adminUpdateOpsTaskSchema,
  adminListOpsTasksSchema,
  adminDeleteOpsTaskSchema,
  adminListWithdrawalsSchema,
  adminExportWithdrawalsCsvSchema,
  adminExportUsersCsvSchema,
  adminUpdateSettingsSchema,
  adminListPlanVersionsSchema,
} from "@/lib/validations/schemas";
import type {
  AdminAuditAction,
  AdminOpsTask,
  BalanceEditLog,
  PlanDoc,
  PlanVersionLog,
  SettingsDoc,
  UserDoc,
  WithdrawalDoc,
} from "@/types";
import { generateTransactionId } from "@/lib/utils";
import { COLLECTIONS } from "@/lib/constants";

type ActorInfo = { uid: string; name: string; email?: string };

type WithCodeErr = Error & { code?: number | string };

const GRPC_ERROR_MSG = /^\d+\s+[A-Z_][A-Z0-9_]*:/;

function isFirestoreError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  const w = e as WithCodeErr;
  if (typeof w.code === "number" && w.code >= 1 && w.code <= 16) return true;
  if (typeof w.code === "string" && /^\d+$/.test(w.code)) return true;
  if (GRPC_ERROR_MSG.test(e.message)) return true;
  return false;
}

const EMPTY_ADMIN_OVERVIEW = {
  totalUsers: 0,
  activeUsers7d: 0,
  totalWithdrawalsAmount: 0,
  totalWithdrawalsCount: 0,
  pendingWithdrawals: 0,
  pendingWithdrawalsAmount: 0,
  paidWithdrawalsCount: 0,
  paidWithdrawalsAmount: 0,
  revenueEstimate: 0,
  withdrawalsToday: 0,
  withdrawalsTodayCount: 0,
  earningsSeries: [] as Array<{ day: string; amount: number }>,
  withdrawalsSeries: [] as Array<{ day: string; paid: number; pending: number; count: number }>,
};

async function requireAdmin(): Promise<ActorInfo> {
  const s = await verifySessionCookie();
  if (!s || s.role !== "admin") throw new Error("Forbidden");
  return { uid: s.uid, name: s.name ?? s.email, email: s.email };
}

async function audit(
  actor: ActorInfo,
  action: AdminAuditAction,
  target: { kind: "user" | "withdrawal" | "plan" | "settings" | "admin_task"; id: string },
  payload?: Record<string, unknown>,
  note?: string,
) {
  try {
    await writeAdminAuditLog({
      actorUid: actor.uid,
      actorName: actor.name,
      action,
      targetKind: target.kind,
      targetId: target.id,
      payload,
      note,
    });
  } catch {
    // Non-blocking: if audit log write fails, allow the action to proceed
  }
}

function toCsvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(rows: Array<Record<string, unknown>>, columns: string[]): string {
  const header = columns.map(toCsvCell).join(",");
  const body = rows
    .map((row) => columns.map((c) => toCsvCell(row[c])).join(","))
    .join("\r\n");
  return `${header}\r\n${body}\r\n`;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  if (local.length <= 2) return `${"*".repeat(local.length)}@${domain}`;
  return `${local[0]}${"*".repeat(Math.max(1, local.length - 2))}${local[local.length - 1]}@${domain}`;
}

function maskPhone(phone: string): string {
  if (!phone) return phone;
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 4) return phone;
  const keep = 3;
  const masked = digits.slice(0, keep) + "*".repeat(digits.length - keep - 2) + digits.slice(-2);
  return masked;
}

export async function adminGetOverviewAction(
  input?: z.infer<typeof adminOverviewSchema>,
) {
  const actor = await requireAdmin();
  const parsed = adminOverviewSchema.safeParse(input ?? {});
  const q = parsed.success ? parsed.data : {};
  let fromMs = q.fromMs;
  let toMs = q.toMs;
  if (q.preset && !fromMs && !toMs) {
    const now = Date.now();
    if (q.preset === "7d") fromMs = now - 7 * 24 * 60 * 60 * 1000;
    if (q.preset === "14d") fromMs = now - 14 * 24 * 60 * 60 * 1000;
    if (q.preset === "30d") fromMs = now - 30 * 24 * 60 * 60 * 1000;
    if (q.preset === "90d") fromMs = now - 90 * 24 * 60 * 60 * 1000;
    if (q.preset === "all") {
      fromMs = 0;
      toMs = now + 60 * 1000;
    }
  }
  let overview = EMPTY_ADMIN_OVERVIEW;
  try {
    const o = await getAdminOverview({ fromMs, toMs });
    overview = {
      totalUsers: o.totalUsers,
      activeUsers7d: o.activeUsers7d,
      totalWithdrawalsAmount: o.totalWithdrawalsAmount,
      totalWithdrawalsCount: o.totalWithdrawalsCount,
      pendingWithdrawals: o.pendingWithdrawals,
      pendingWithdrawalsAmount: o.pendingWithdrawalsAmount,
      paidWithdrawalsCount: o.paidWithdrawalsCount,
      paidWithdrawalsAmount: o.paidWithdrawalsAmount,
      revenueEstimate: o.revenueEstimate,
      withdrawalsToday: o.withdrawalsTodayAmount,
      withdrawalsTodayCount: o.withdrawalsTodayCount,
      earningsSeries: o.earningsSeries,
      withdrawalsSeries: o.withdrawalsSeries,
    };
  } catch (e) {
    if (!isFirestoreError(e)) throw e;
  }
  return {
    ok: true,
    overview,
  };
}

export async function adminListUsersAction(
  input?: z.infer<typeof adminListUsersSchema>,
) {
  await requireAdmin();
  const parsed = adminListUsersSchema.safeParse(input ?? {});
  const q = parsed.success ? parsed.data : adminListUsersSchema.parse({});
  let users: UserDoc[] = [];
  let total = 0;
  let hasMore = false;
  try {
    const res = await listAdminUsers({
      search: q.search || undefined,
      limit: q.limit,
      sortBy: q.sortBy,
      sortDir: q.sortDir,
      status: q.status,
      role: q.role,
      offset: q.offset,
    });
    users = res.users;
    total = res.total;
    hasMore = res.hasMore;
  } catch (e) {
    if (!isFirestoreError(e)) throw e;
  }
  const maskedUsers: UserDoc[] = users.map((u) => ({
    ...u,
    email: maskEmail(u.email),
    phone: maskPhone(u.phone),
  }));
  return {
    ok: true,
    users: maskedUsers,
    total,
    hasMore,
  };
}

export async function adminGetUserAction(uid: string) {
  const actor = await requireAdmin();
  const user = await getUser(uid);
  if (!user) return { ok: false, error: "No user" };
  const masked: UserDoc = {
    ...user,
    email: maskEmail(user.email),
    phone: maskPhone(user.phone),
  };
  const db = getAdminDb();
  const [withdrawalsRaw, earningsRaw, balanceLogsRaw] = await Promise.all([
    db
      .collection(COLLECTIONS.withdrawals)
      .where("userId", "==", uid)
      .orderBy("createdAt", "desc")
      .limit(50)
      .get(),
    db
      .collection(COLLECTIONS.earnings)
      .where("userId", "==", uid)
      .orderBy("createdAt", "desc")
      .limit(100)
      .get(),
    listBalanceEditLogsByUser(uid, 50),
  ]);
  const withdrawals: WithdrawalDoc[] = [];
  withdrawalsRaw.forEach((d) =>
    withdrawals.push({ ...(d.data() as object), id: d.id } as WithdrawalDoc),
  );
  const earnings = earningsRaw.docs.map((d) => ({
    ...(d.data() as object),
    id: d.id,
  }));
  const balanceEditLogs: BalanceEditLog[] = balanceLogsRaw.map((l) => ({
    ...l,
    actorName: l.actorName,
  }));
  return {
    ok: true,
    user: masked,
    userRawEmail: actor.uid === uid ? user.email : undefined,
    withdrawals,
    earnings,
    balanceEditLogs,
  };
}

export async function adminUpdateUserBalanceAction(
  input: z.infer<typeof adminUpdateBalanceSchema>,
) {
  const actor = await requireAdmin();
  const { uid, delta, reason } = adminUpdateBalanceSchema.parse(input);
  const db = getAdminDb();
  let oldBalance = 0;
  let oldTask = 0;
  let newBalance = 0;
  let newTask = 0;
  await db.runTransaction(async (tx) => {
    const ref = db.collection(COLLECTIONS.users).doc(uid);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error("No user");
    const cur = snap.data() as Pick<UserDoc, "balance" | "taskBalance">;
    oldBalance = cur.balance ?? 0;
    oldTask = cur.taskBalance ?? 0;
    const rawBal = oldBalance + delta;
    const rawTask = oldTask + delta;
    newBalance = Math.max(0, rawBal);
    newTask = Math.max(0, rawTask);
    tx.update(ref, {
      balance: newBalance,
      taskBalance: newTask,
      updatedAt: Date.now(),
    });
  });
  await appendBalanceEditLog({
    targetUid: uid,
    actorUid: actor.uid,
    actorName: actor.name,
    delta,
    oldBalance,
    newBalance,
    oldTaskBalance: oldTask,
    newTaskBalance: newTask,
    reason,
  });
  await audit(
    actor,
    "user.update_balance",
    { kind: "user", id: uid },
    { delta, oldBalance, newBalance, oldTaskBalance: oldTask, newTaskBalance: newTask },
    reason,
  );
  return { ok: true };
}

export async function adminSetUserRoleAction(input: z.infer<typeof roleSchema>) {
  const me = await requireAdmin();
  const { uid, role } = roleSchema.parse(input);
  if (uid === me.uid && role !== "admin") {
    return { ok: false, error: "Cannot demote yourself" };
  }
  await updateUserHelper(uid, { role });
  await audit(me, "user.set_role", { kind: "user", id: uid }, { role });
  return { ok: true };
}

export async function adminSetUserStatusAction(
  input: z.infer<typeof statusSchema>,
) {
  const me = await requireAdmin();
  const { uid, status } = statusSchema.parse(input);
  await updateUserHelper(uid, { status });
  await audit(me, "user.set_status", { kind: "user", id: uid }, { status });
  return { ok: true };
}

export async function adminListWithdrawalsAction(
  input?: z.infer<typeof adminListWithdrawalsSchema>,
) {
  const actor = await requireAdmin();
  const parsed = adminListWithdrawalsSchema.safeParse(input ?? {});
  if (!parsed.success) return { ok: false, error: "Invalid filters", withdrawals: [] };
  const q = parsed.data;
  const statuses: WithdrawalDoc["status"][] =
    q.status === "all"
      ? ["pending", "paid", "rejected"]
      : ([q.status] as WithdrawalDoc["status"][]);
  const all: WithdrawalDoc[] = [];
  for (const s of statuses) {
    const list = await listWithdrawalsByStatus(s, q.limit);
    all.push(...list);
  }
  let withdrawals = all.sort((a, b) => b.createdAt - a.createdAt).slice(0, q.limit);
  const fromMs = q.fromMs;
  const toMs = q.toMs;
  const minAmt = q.minAmount;
  const maxAmt = q.maxAmount;
  if (fromMs) withdrawals = withdrawals.filter((w) => w.createdAt >= fromMs);
  if (toMs) withdrawals = withdrawals.filter((w) => w.createdAt <= toMs);
  if (minAmt !== undefined)
    withdrawals = withdrawals.filter((w) => w.amount >= minAmt);
  if (maxAmt !== undefined)
    withdrawals = withdrawals.filter((w) => w.amount <= maxAmt);
  if (q.search) {
    const s = q.search.toLowerCase().trim();
    const userIds = new Set<string>();
    for (const w of withdrawals) userIds.add(w.userId);
    const userMap = new Map<string, { name: string; email: string }>();
    for (const uid of Array.from(userIds)) {
      const u = await getUser(uid);
      if (u) userMap.set(uid, { name: u.name, email: u.email });
    }
    withdrawals = withdrawals.filter((w) => {
      const u = userMap.get(w.userId);
      const name = u?.name.toLowerCase() ?? "";
      const email = u?.email.toLowerCase() ?? "";
      return (
        name.includes(s) ||
        email.includes(s) ||
        (w.transactionId ?? "").toLowerCase().includes(s) ||
        (w.bankDetails?.accountNumber ?? "").includes(s) ||
        (w.bankDetails?.bankName ?? "").toLowerCase().includes(s) ||
        w.id.toLowerCase().includes(s)
      );
    });
  }
  const enriched = await enrichWithdrawalsWithUsers(withdrawals);
  return { ok: true, withdrawals: enriched, actorUid: actor.uid };
}

async function enrichWithdrawalsWithUsers(withdrawals: WithdrawalDoc[]) {
  const userIds = Array.from(new Set(withdrawals.map((w) => w.userId)));
  const users = new Map<string, { name: string; email: string }>();
  for (const uid of userIds) {
    const u = await getUser(uid);
    if (u) users.set(uid, { name: u.name, email: u.email });
  }
  return withdrawals.map((w) => ({
    ...w,
    userName: users.get(w.userId)?.name ?? "",
    userEmail: users.get(w.userId)?.email ?? "",
  }));
}

export async function adminApproveWithdrawalAction(
  input: z.infer<typeof withdrawalDecisionSchema>,
) {
  const actor = await requireAdmin();
  const { wdId } = withdrawalDecisionSchema.parse(input);
  const w = await getWithdrawal(wdId);
  if (!w) return { ok: false, error: "Withdrawal not found" };
  if (w.status !== "pending") return { ok: false, error: "Not pending" };

  const transactionId = w.transactionId ?? generateTransactionId();
  await updateWithdrawalStatus(wdId, {
    status: "paid",
    processedAt: Date.now(),
    transactionId,
  });
  await audit(
    actor,
    adminAuditActionForWithdrawal("paid"),
    { kind: "withdrawal", id: wdId },
    { amount: w.amount, fee: w.fee, netAmount: w.netAmount, transactionId },
  );
  return { ok: true, transactionId };
}

export async function adminRejectWithdrawalAction(
  input: z.infer<typeof withdrawalDecisionSchema>,
) {
  const actor = await requireAdmin();
  const parsed = withdrawalDecisionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const { wdId, reason } = parsed.data;
  const w = await getWithdrawal(wdId);
  if (!w) return { ok: false, error: "Withdrawal not found" };
  if (w.status !== "pending") return { ok: false, error: "Not pending" };
  if (!reason || reason.trim().length < 3)
    return { ok: false, error: "A rejection reason is required" };

  const user = await getUser(w.userId);
  if (user) {
    const db = getAdminDb();
    await db.runTransaction(async (tx) => {
      const ref = db.collection(COLLECTIONS.users).doc(w.userId);
      const snap = await tx.get(ref);
      if (!snap.exists) return;
      const cur = snap.data() as Pick<UserDoc, "balance" | "taskBalance">;
      tx.update(ref, {
        balance: (cur.balance ?? 0) + w.amount,
        taskBalance: (cur.taskBalance ?? 0) + w.amount,
        updatedAt: Date.now(),
      });
    });
  }

  await updateWithdrawalStatus(wdId, {
    status: "rejected",
    processedAt: Date.now(),
    rejectReason: reason,
  });
  await audit(
    actor,
    adminAuditActionForWithdrawal("rejected"),
    { kind: "withdrawal", id: wdId },
    { amount: w.amount, netAmount: w.netAmount, refunded: !!user },
    reason,
  );
  return { ok: true };
}

export async function adminExportWithdrawalsCsvAction(
  input: z.infer<typeof adminExportWithdrawalsCsvSchema>,
) {
  const res = await adminListWithdrawalsAction({
    ...(input ?? {}),
    limit: 1000,
  } as any);
  if (!res.ok) return { ok: false, error: res.error };
  const rows = (res.withdrawals as any[]).map((w) => ({
    id: w.id,
    transactionId: w.transactionId ?? "",
    createdAt: new Date(w.createdAt).toISOString(),
    processedAt: w.processedAt ? new Date(w.processedAt).toISOString() : "",
    status: w.status,
    userId: w.userId,
    userName: w.userName ?? "",
    userEmail: w.userEmail ?? "",
    bankName: w.bankDetails?.bankName ?? "",
    accountNumber: w.bankDetails?.accountNumber ?? "",
    accountName: w.bankDetails?.accountName ?? "",
    amount: w.amount,
    fee: w.fee,
    netAmount: w.netAmount,
    rejectReason: w.rejectReason ?? "",
  }));
  const csv = rowsToCsv(rows, [
    "id",
    "transactionId",
    "createdAt",
    "processedAt",
    "status",
    "userId",
    "userName",
    "userEmail",
    "bankName",
    "accountNumber",
    "accountName",
    "amount",
    "fee",
    "netAmount",
    "rejectReason",
  ]);
  return { ok: true, csv, rowCount: rows.length, filename: `withdrawals-${Date.now()}.csv` };
}

export async function adminExportUsersCsvAction(
  input: z.infer<typeof adminExportUsersCsvSchema>,
) {
  await requireAdmin();
  const parsed = adminExportUsersCsvSchema.safeParse(input ?? {});
  if (!parsed.success) return { ok: false, error: "Invalid filters" };
  const q = parsed.data;
  const { users } = await listAdminUsers({
    search: q.search || undefined,
    status: q.status,
    role: q.role,
    limit: 200,
  });
  const rows = users.map((u) => ({
    uid: u.uid,
    name: u.name,
    email: maskEmail(u.email),
    phone: maskPhone(u.phone),
    status: u.status,
    role: u.role,
    plan: u.plan,
    balance: u.balance,
    taskBalance: u.taskBalance,
    apnRate: u.apnRate,
    referralCode: u.referralCode,
    createdAt: new Date(u.createdAt).toISOString(),
  }));
  const csv = rowsToCsv(rows, [
    "uid",
    "name",
    "email",
    "phone",
    "status",
    "role",
    "plan",
    "balance",
    "taskBalance",
    "apnRate",
    "referralCode",
    "createdAt",
  ]);
  return { ok: true, csv, rowCount: rows.length, filename: `users-${Date.now()}.csv` };
}

export async function adminListPlansAction() {
  await requireAdmin();
  const plans = await (await import("@/lib/firestore")).listPlans();
  return { ok: true, plans: plans as PlanDoc[] };
}

export async function adminGetPlanVersionsAction(
  input: z.infer<typeof adminListPlanVersionsSchema>,
) {
  await requireAdmin();
  const { planId, limit } = adminListPlanVersionsSchema.parse(input);
  const logs = await listPlanVersionLogs(planId, limit);
  return { ok: true, versions: logs as PlanVersionLog[] };
}

export async function adminCreatePlanAction(
  input: z.infer<typeof adminCreatePlanSchema>,
) {
  const actor = await requireAdmin();
  const parsed = adminCreatePlanSchema.parse(input);
  const { note, ...fields } = parsed;
  const plan = await createPlanDoc({
    id: fields.id,
    name: fields.name,
    price: fields.price,
    hourlyRate: fields.hourlyRate,
    features: fields.features,
    active: fields.active,
    durationDays: fields.durationDays,
    description: fields.description,
  });
  const version = plan.version ?? 1;
  await appendPlanVersionLog({
    planId: plan.id,
    version,
    changedBy: actor.uid,
    snapshot: plan,
    diff: { _created: { before: null, after: plan } },
    note: note || undefined,
  });
  await audit(actor, "plan.create", { kind: "plan", id: plan.id }, { plan }, note || undefined);
  return { ok: true, plan };
}

export async function adminUpdatePlanAction(
  input: z.infer<typeof adminUpdatePlanSchema> | z.infer<typeof planSchema>,
) {
  const actor = await requireAdmin();
  const parsedCreate = adminUpdatePlanSchema.safeParse(input);
  if (!parsedCreate.success) {
    const legacy = planSchema.parse(input);
    const after: PlanDoc = {
      id: legacy.id,
      name: legacy.name,
      price: legacy.price,
      hourlyRate: legacy.hourlyRate,
      features: legacy.features,
      active: legacy.active,
      updatedAt: Date.now(),
    };
    await upsertPlan(after);
    return { ok: true, plan: after };
  }
  const { id, note, ...fields } = parsedCreate.data;
  const db = getAdminDb();
  const beforeSnap = await db.collection(COLLECTIONS.plans).doc(id).get();
  const before: PlanDoc | null = beforeSnap.exists
    ? ({ ...(beforeSnap.data() as object), id } as PlanDoc)
    : null;
  const nextVersion = (before?.version ?? 0) + 1;
  const after: PlanDoc = {
    id,
    name: fields.name,
    price: fields.price,
    hourlyRate: fields.hourlyRate,
    features: fields.features,
    active: fields.active,
    durationDays: fields.durationDays,
    description: fields.description,
    createdAt: before?.createdAt ?? Date.now(),
    updatedAt: Date.now(),
    updatedBy: actor.uid,
    version: nextVersion,
  };
  await upsertPlan(after);
  const diff = before ? diffPlan(before, after) : { _created: { before: null, after } };
  await appendPlanVersionLog({
    planId: id,
    version: nextVersion,
    changedBy: actor.uid,
    snapshot: after,
    diff,
    note: note || undefined,
  });
  await audit(actor, "plan.update", { kind: "plan", id }, diff as any, note || undefined);
  return { ok: true, plan: after };
}

export async function adminDeletePlanAction(
  input: z.infer<typeof adminDeletePlanSchema>,
) {
  const actor = await requireAdmin();
  const { id } = adminDeletePlanSchema.parse(input);
  const ok = await deletePlanDoc(id);
  if (!ok) return { ok: false, error: "Plan not found" };
  await audit(actor, "plan.delete", { kind: "plan", id }, { planId: id });
  return { ok: true };
}

export async function adminListTasksAction() {
  await requireAdmin();
  return listTasksHelper(false);
}

export async function adminUpsertTaskAction(
  input: z.infer<typeof taskUpsertSchema>,
) {
  const actor = await requireAdmin();
  const parsed = taskUpsertSchema.parse(input);
  const saved = await upsertTask(parsed);
  const kind = parsed.id ? "admin_task.update" : "admin_task.create";
  await audit(actor, kind, { kind: "admin_task", id: saved.id }, { taskId: saved.id });
  return { ok: true, id: saved.id };
}

export async function adminListOpsTasksAction(
  input?: z.infer<typeof adminListOpsTasksSchema>,
) {
  await requireAdmin();
  const parsed = adminListOpsTasksSchema.safeParse(input ?? {});
  const q = parsed.success
    ? parsed.data
    : { category: undefined, priority: undefined, status: undefined, assigneeUid: undefined, limit: 100 };
  const tasks = await listAdminOpsTasks(
    {
      category: q.category,
      priority: q.priority,
      status: q.status,
      assigneeUid: q.assigneeUid,
    },
    q.limit ?? 100,
  );
  return { ok: true, tasks: tasks as AdminOpsTask[] };
}

export async function adminCreateOpsTaskAction(
  input: z.infer<typeof adminCreateOpsTaskSchema>,
) {
  const actor = await requireAdmin();
  const parsed = adminCreateOpsTaskSchema.parse(input);
  const payload = { ...parsed };
  let assigneeName: string | undefined = undefined;
  if (parsed.assigneeUid) {
    const u = await getUser(parsed.assigneeUid);
    assigneeName = u?.name;
  }
  const saved = await createAdminOpsTask({
    title: payload.title,
    description: payload.description || undefined,
    category: payload.category,
    priority: payload.priority,
    status: payload.status,
    assigneeUid: payload.assigneeUid,
    assigneeName,
    deadlineAt: payload.deadlineAt,
    reminderAt: payload.reminderAt,
    createdBy: actor.uid,
    createdByName: actor.name,
  });
  await audit(
    actor,
    "admin_task.create",
    { kind: "admin_task", id: saved.id },
    {
      category: saved.category,
      priority: saved.priority,
      status: saved.status,
      assigneeUid: saved.assigneeUid,
    },
    payload.comment || undefined,
  );
  return { ok: true, task: saved };
}

export async function adminUpdateOpsTaskAction(
  input: z.infer<typeof adminUpdateOpsTaskSchema>,
) {
  const actor = await requireAdmin();
  const parsed = adminUpdateOpsTaskSchema.parse(input);
  const { id, comment, ...fields } = parsed;
  const assigneeName =
    fields.assigneeUid ? (await getUser(fields.assigneeUid))?.name : undefined;
  const updated = await updateAdminOpsTask({
    id,
    ...fields,
    assigneeName: assigneeName,
    comment: comment || undefined,
    actorUid: actor.uid,
    actorName: actor.name,
  });
  if (!updated) return { ok: false, error: "Task not found" };
  await audit(
    actor,
    "admin_task.update",
    { kind: "admin_task", id },
    { updated: Object.keys(fields) },
    comment || undefined,
  );
  return { ok: true, task: updated };
}

export async function adminDeleteOpsTaskAction(
  input: z.infer<typeof adminDeleteOpsTaskSchema>,
) {
  const actor = await requireAdmin();
  const { id } = adminDeleteOpsTaskSchema.parse(input);
  const ok = await deleteAdminOpsTask(id);
  if (!ok) return { ok: false, error: "Task not found" };
  await audit(actor, "admin_task.delete", { kind: "admin_task", id }, { id });
  return { ok: true };
}

export async function adminGetReferralBonusAction() {
  await requireAdmin();
  const s = (await getSettings()) as SettingsDoc;
  return {
    ok: true,
    bonus: s.referralBonus,
    settings: s,
  };
}

export async function adminUpdateReferralBonusAction(
  input: z.infer<typeof referralBonusSchema>,
) {
  const actor = await requireAdmin();
  const { amount } = referralBonusSchema.parse(input);
  const cur = (await getSettings()) as SettingsDoc;
  const before = { referralBonus: cur.referralBonus };
  await updateSettings({ referralBonus: amount });
  await audit(
    actor,
    "settings.update",
    { kind: "settings", id: "platform" },
    { referralBonus: { before: before.referralBonus, after: amount } },
  );
  return { ok: true };
}

export async function adminUpdateSettingsAction(
  input: z.infer<typeof adminUpdateSettingsSchema>,
) {
  const actor = await requireAdmin();
  const parsed = adminUpdateSettingsSchema.parse(input);
  const cur = (await getSettings()) as SettingsDoc;
  const fields: Partial<SettingsDoc> = {
    referralBonus: parsed.referralBonus,
    withdrawalFeePct: parsed.withdrawalFeePct,
    withdrawalProcessingFeePct: parsed.withdrawalProcessingFeePct,
    minWithdrawal: parsed.minWithdrawal,
    maxWithdrawal: parsed.maxWithdrawal,
    duplicateWithdrawalWindowMs: parsed.duplicateWithdrawalWindowMs,
    maxBankAccounts: parsed.maxBankAccounts,
    updatedAt: Date.now(),
    updatedBy: actor.uid,
  };
  const cleanFields: Partial<SettingsDoc> = {};
  (Object.keys(fields) as Array<keyof typeof fields>).forEach((k) => {
    if (fields[k] !== undefined) (cleanFields as any)[k] = fields[k];
  });
  const payload: Record<string, unknown> = {};
  (Object.keys(cleanFields) as Array<keyof SettingsDoc>).forEach((k) => {
    if (k === "updatedAt" || k === "updatedBy") return;
    payload[k] = { before: (cur as any)[k] ?? null, after: (cleanFields as any)[k] ?? null };
  });
  await updateSettings(cleanFields);
  await audit(
    actor,
    "settings.update",
    { kind: "settings", id: "platform" },
    payload,
    parsed.note || undefined,
  );
  return { ok: true };
}
