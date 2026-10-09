"use server";

import { z } from "zod";
import {
  createSubmission,
  findSubmission,
  getTask,
  getAdminDb,
  createEarning,
  createWithdrawal,
  listWithdrawalsByStatus,
  updateWithdrawalStatus,
  getWithdrawal,
  getUser,
  updateUser,
  getWithdrawal as getWithdrawalHelper,
  listWithdrawalsByUser,
  hasSubmittedTaskInWindow,
  listSubmissionsByUser,
  getBankAccountById,
  getDefaultBankAccount,
  listBankAccountsByUser,
  hasRecentDuplicateWithdrawal,
} from "@/lib/firestore";
import { verifySessionCookie } from "@/lib/server/session";
import {
  MIN_WITHDRAWAL,
  MAX_WITHDRAWAL,
  WITHDRAWAL_FEE_PCT,
  WITHDRAWAL_PROCESSING_FEE_PCT,
  DUPLICATE_WITHDRAWAL_WINDOW_MS,
} from "@/lib/constants";
import { generateTransactionId } from "@/lib/utils";
import type {
  EarningSource,
  MatchQuestion,
  MCQuestion,
  SubmissionDoc,
  SubmissionStatus,
  TaskDoc,
  TaskQuestion,
  TFQuestion,
  UserDoc,
  WithdrawalDoc,
} from "@/types";
import {
  completeProofTaskSchema,
  completeQuizTaskSchema,
  initiateTaskSchema,
  taskClaimSchema,
  withdrawalRequestSchema,
} from "@/lib/validations/schemas";
import { generateNonce, signTaskSessionToken, verifyTaskSessionToken } from "@/lib/hmac";
import { rewardUserForTaskTx } from "@/lib/rewards-tx";

const MS_24_H = 24 * 60 * 60 * 1000;
const MS_1_H = 60 * 60 * 1000;
const DEFAULT_MIN_VIDEO_DURATION_SEC = 30;
const DEFAULT_TASK_MAX_DAILY = 1;

type PublicQuestion =
  | (Omit<MCQuestion, "answerIndex"> & { type?: "mc" })
  | (Omit<TFQuestion, "answerIndex"> & { type: "tf" })
  | (Omit<MatchQuestion, "correctMapping"> & { type: "match" });

function stripAnswers(questions: TaskQuestion[] | undefined): PublicQuestion[] {
  if (!Array.isArray(questions)) return [];
  return questions.map((q) => {
    if (q.type === "tf") {
      const { answerIndex: _a, ...rest } = q;
      return rest as PublicQuestion;
    }
    if (q.type === "match") {
      const { correctMapping: _c, ...rest } = q;
      return rest as PublicQuestion;
    }
    const { answerIndex: _a, ...rest } = q;
    return rest as PublicQuestion;
  });
}

function bucket24hOf(tsMs: number): string {
  const d = new Date(tsMs);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(
    d.getUTCDate(),
  ).padStart(2, "0")}`;
}

async function countSubmissionsToday(userId: string, taskId: string, nowMs: number): Promise<number> {
  const startOfDay = new Date(nowMs);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const list = await listSubmissionsByUser(userId, { taskId });
  return list.filter((s) => s.createdAt >= startOfDay.getTime() && s.status !== "failed" && s.status !== "rejected").length;
}

async function preFlightTaskAccess(uid: string, task: TaskDoc, nowMs: number): Promise<{ ok: boolean; error?: string }> {
  if (task.expiresAt && nowMs > task.expiresAt) return { ok: false, error: "Task expired" };
  if (task.type === "quiz") {
    const exists = await hasSubmittedTaskInWindow(uid, task.id, MS_24_H);
    if (exists) return { ok: false, error: "Quiz completed in last 24h. Try again tomorrow." };
  }
  if (typeof task.maxDailyClaims === "number" && task.maxDailyClaims > 0) {
    const today = await countSubmissionsToday(uid, task.id, nowMs);
    if (today >= task.maxDailyClaims) return { ok: false, error: `Daily claim limit (${task.maxDailyClaims}) reached. Try again tomorrow.` };
  } else if (task.type !== "quiz") {
    const defaultDaily = DEFAULT_TASK_MAX_DAILY;
    const today = await countSubmissionsToday(uid, task.id, nowMs);
    if (today >= defaultDaily) return { ok: false, error: `Daily claim limit (${defaultDaily}) reached. Try again tomorrow.` };
  }
  return { ok: true };
}

function scoreQuizAnswers(questions: TaskQuestion[], userAnswers: { qIndex: number; value: number | number[] }[]): {
  total: number;
  correct: number;
  perQuestion: { qIndex: number; correct: boolean; correctValue?: number | number[]; feedback?: string }[];
} {
  const perQuestion: { qIndex: number; correct: boolean; correctValue?: number | number[]; feedback?: string }[] = [];
  let correctCount = 0;
  const total = questions.length;
  for (const answer of userAnswers) {
    const q = questions[answer.qIndex];
    if (!q) continue;
    let isCorrect = false;
    let expected: number | number[] | undefined;
    let feedback = "Incorrect";
    if (q.type === "tf" || q.type === undefined || !q.type) {
      const ans = typeof answer.value === "number" ? answer.value : -1;
      expected = (q as MCQuestion | TFQuestion).answerIndex;
      if (typeof expected === "number" && ans === expected) isCorrect = true;
      feedback = isCorrect ? "Correct" : `Expected choice ${Number(expected) + 1}`;
    } else if (q.type === "match") {
      const mapping = (q as MatchQuestion).correctMapping;
      expected = mapping;
      const arr = Array.isArray(answer.value) ? answer.value : [];
      if (arr.length === mapping.length && arr.every((v, i) => Number.isFinite(v) && v === mapping[i])) {
        isCorrect = true;
        feedback = "All pairs matched correctly";
      } else {
        feedback = `Incorrect matching. Review pair order.`;
      }
    }
    if (isCorrect) correctCount += 1;
    perQuestion.push({ qIndex: answer.qIndex, correct: isCorrect, correctValue: expected, feedback });
  }
  return { total, correct: correctCount, perQuestion };
}

export async function initiateTaskAction(input: z.infer<typeof initiateTaskSchema>) {
  const session = await verifySessionCookie();
  if (!session) return { ok: false, error: "Unauthenticated" };
  if (session.status === "banned") return { ok: false, error: "Account banned" };
  const parsed = initiateTaskSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const { taskId } = parsed.data;

  const nowMs = Date.now();
  const task = await getTask(taskId);
  if (!task || !task.active) return { ok: false, error: "Task unavailable" };

  const flight = await preFlightTaskAccess(session.uid, task, nowMs);
  if (!flight.ok) return { ok: false, error: flight.error };

  const token = signTaskSessionToken({
    uid: session.uid,
    taskId,
    iat: nowMs,
    nonce: generateNonce(12),
  });

  return {
    ok: true,
    taskSessionToken: token,
    task: {
      id: task.id,
      type: task.type,
      title: task.title,
      description: task.description ?? "",
      reward: task.reward,
      externalUrl: task.externalUrl,
      minDurationSec: task.type === "video" ? (task.minDurationSec ?? DEFAULT_MIN_VIDEO_DURATION_SEC) : undefined,
      expiresAt: task.expiresAt,
      questions: task.type === "quiz" ? stripAnswers(task.questions) : undefined,
      questionCount: task.type === "quiz" ? (task.questions?.length ?? 0) : undefined,
    },
  };
}

export async function completeQuizTaskAction(input: z.infer<typeof completeQuizTaskSchema>) {
  const session = await verifySessionCookie();
  if (!session) return { ok: false, error: "Unauthenticated" };
  if (session.status === "banned") return { ok: false, error: "Account banned" };
  const parsed = completeQuizTaskSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input", issues: parsed.error.flatten() };

  const nowMs = Date.now();
  const verifyRes = verifyTaskSessionToken(parsed.data.taskSessionToken, nowMs);
  if (!verifyRes.ok) {
    return { ok: false, error: `Session invalid: ${verifyRes.error}`, sessionError: verifyRes.error };
  }
  const { uid, taskId, iat } = verifyRes.payload;
  if (uid !== session.uid) return { ok: false, error: "Session/user mismatch" };

  const task = await getTask(taskId);
  if (!task || !task.active || task.type !== "quiz") return { ok: false, error: "Quiz unavailable" };

  const flight = await preFlightTaskAccess(uid, task, nowMs);
  if (!flight.ok) return { ok: false, error: flight.error };

  const qs = Array.isArray(task.questions) ? task.questions : [];
  if (qs.length === 0) return { ok: false, error: "Quiz has no questions" };

  const scored = scoreQuizAnswers(qs, parsed.data.answers);
  const pct = scored.total > 0 ? scored.correct / scored.total : 0;
  const passed = pct > 0;
  const rewardEarned = passed ? Math.max(0, Math.round(task.reward * (scored.correct / Math.max(scored.total, 1)))) : 0;

  const status: SubmissionStatus = passed ? "completed" : "failed";

  const dateBucket = bucket24hOf(nowMs);
  const earningRefId = `quiz-${uid}-${taskId}-${dateBucket}`;
  const quizSubmissionId = `quiz-${uid}-${taskId}-${iat}`;

  const alreadySubmitted = await findSubmission(uid, taskId);
  if (alreadySubmitted && nowMs - alreadySubmitted.createdAt < MS_24_H) {
    return { ok: false, error: "Already completed this quiz in the last 24h" };
  }

  let alreadyPaid = false;
  let finalReward = rewardEarned;
  let submission: SubmissionDoc | null = null;
  try {
    submission = await createSubmission({
      id: quizSubmissionId,
      userId: uid,
      taskId,
      reward: finalReward,
      status,
      proof: JSON.stringify({ score: scored.correct, total: scored.total, iat }),
      createdAt: nowMs,
    } as any);
  } catch {
    // submission idempotent; ignore collision on deterministic id; reload
  }
  if (!submission) {
    submission = (await findSubmission(uid, taskId)) ?? null;
  }

  if (passed && finalReward > 0) {
    const rewardRes = await rewardUserForTaskTx({
      uid,
      taskId,
      amount: finalReward,
      source: "quiz",
      submissionId: submission?.id,
      earningReferenceId: earningRefId,
      note: `Quiz: ${scored.correct}/${scored.total} correct (${Math.round(pct * 100)}%)`,
    });
    alreadyPaid = rewardRes.alreadyPaid;
  }

  const feedback = scored.perQuestion.map((p) => ({
    qIndex: p.qIndex,
    correct: p.correct,
    feedback: p.feedback ?? (p.correct ? "Correct" : "Incorrect"),
  }));

  return {
    ok: true,
    score: scored.correct,
    total: scored.total,
    pct: Math.round(pct * 100),
    passed,
    reward: finalReward,
    alreadyPaid,
    submissionId: submission?.id,
    feedback,
    cooldownUntil: nowMs + MS_24_H,
  };
}

export async function completeProofTaskAction(input: z.infer<typeof completeProofTaskSchema>) {
  const session = await verifySessionCookie();
  if (!session) return { ok: false, error: "Unauthenticated" };
  if (session.status === "banned") return { ok: false, error: "Account banned" };
  const parsed = completeProofTaskSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input", issues: parsed.error.flatten() };

  const nowMs = Date.now();
  const verifyRes = verifyTaskSessionToken(parsed.data.taskSessionToken, nowMs);
  if (!verifyRes.ok) return { ok: false, error: `Session invalid: ${verifyRes.error}`, sessionError: verifyRes.error };
  const { uid, taskId, iat } = verifyRes.payload;
  if (uid !== session.uid) return { ok: false, error: "Session/user mismatch" };

  const task = await getTask(taskId);
  if (!task || !task.active) return { ok: false, error: "Task unavailable" };
  if (task.type === "quiz") return { ok: false, error: "Quizzes must use completeQuizTaskAction" };

  const flight = await preFlightTaskAccess(uid, task, nowMs);
  if (!flight.ok) return { ok: false, error: flight.error };

  let status: SubmissionStatus = "submitted";
  let failReason: string | undefined;

  if (task.type === "video") {
    const required = task.minDurationSec ?? DEFAULT_MIN_VIDEO_DURATION_SEC;
    if (Number(parsed.data.durationSec) < required) {
      status = "rejected";
      failReason = `Minimum duration ${required}s not met (got ${parsed.data.durationSec}s)`;
    } else {
      status = "verified";
    }
  } else if (task.type === "survey") {
    const expected = task.proofKey;
    const got = (parsed.data.proof ?? "").trim();
    if (typeof expected === "string" && expected.length > 0) {
      if (expected.trim().toLowerCase() !== got.toLowerCase()) {
        status = "rejected";
        failReason = "Proof key mismatch";
      } else {
        status = "verified";
      }
    } else if (got.length === 0) {
      status = "rejected";
      failReason = "Missing proof";
    } else {
      status = "verified";
    }
  }

  const reward = status === "verified" ? Math.max(0, task.reward) : 0;
  const dateBucket = bucket24hOf(nowMs);
  const earningRefId = `task-${uid}-${taskId}-${dateBucket}-${iat}`;

  let submission: SubmissionDoc | null = null;
  try {
    submission = await createSubmission({
      userId: uid,
      taskId,
      reward,
      status,
      proof: typeof parsed.data.proof === "string" ? parsed.data.proof.slice(0, 2000) : undefined,
      durationSec: Number.isFinite(parsed.data.durationSec) ? parsed.data.durationSec : undefined,
      createdAt: nowMs,
    });
  } catch {
    // collision tolerant; try reload
  }
  if (!submission) submission = (await findSubmission(uid, taskId)) ?? null;

  let alreadyPaid = false;
  let finalReward = reward;
  if (status === "verified" && reward > 0) {
    const rewardRes = await rewardUserForTaskTx({
      uid,
      taskId,
      amount: reward,
      source: "task",
      submissionId: submission?.id,
      earningReferenceId: earningRefId,
      note: task.type === "video" ? `Video: ${parsed.data.durationSec}s watched` : `Survey: proof accepted`,
    });
    alreadyPaid = rewardRes.alreadyPaid;
    finalReward = alreadyPaid ? 0 : reward;
    if (!alreadyPaid && submission && submission.status === "verified") {
      try {
        const db = getAdminDb();
        await db.collection("submissions").doc(submission.id).set({ status: "completed" as const }, { merge: true });
        submission = { ...submission, status: "completed" as const };
      } catch {
        // non-fatal; submission remains verified
      }
    }
  }

  return {
    ok: status !== "rejected",
    status,
    reward: finalReward,
    alreadyPaid,
    submissionId: submission?.id,
    rejectReason: failReason,
    cooldownUntil: nowMs + MS_24_H,
  };
}

export async function completeTaskAction(
  input: string | z.infer<typeof taskClaimSchema>,
) {
  const normalized: z.infer<typeof taskClaimSchema> =
    typeof input === "string" ? { taskId: input } : input;
  const session = await verifySessionCookie();
  if (!session) return { ok: false, error: "Unauthenticated" };
  if (session.status === "banned") return { ok: false, error: "Account banned" };
  const parsed = taskClaimSchema.safeParse(normalized);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const task = await getTask(parsed.data.taskId);
  if (!task || !task.active) return { ok: false, error: "Task unavailable" };
  if (task.type === "quiz") {
    const initiated = await initiateTaskAction(parsed.data);
    if (!initiated.ok) return initiated;
    return { ok: false, error: "Use initiateTaskAction + completeQuizTaskAction for quizzes", taskSessionToken: initiated.taskSessionToken, initiationFallback: initiated };
  }
  const initiated = await initiateTaskAction(parsed.data);
  if (!initiated.ok) return initiated;
  const completed = await completeProofTaskAction({
    taskSessionToken: initiated.taskSessionToken!,
    proof: initiated.task?.externalUrl ?? initiated.ok ? "fallback_accepted" : "",
    durationSec: (task.minDurationSec ?? 0),
  });
  return {
    ok: completed.ok,
    reward: completed.reward,
    alreadyPaid: completed.alreadyPaid,
    submissionId: completed.submissionId,
    deprecation: "completeTaskAction is deprecated; use initiateTaskAction + completeProofTaskAction for secure flows.",
  };
}

export async function requestWithdrawalAction(
  input: z.infer<typeof withdrawalRequestSchema>,
) {
  const session = await verifySessionCookie();
  if (!session) return { ok: false, error: "Unauthenticated" };
  if (session.status === "banned") return { ok: false, error: "Banned" };

  const parsed = withdrawalRequestSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues.find((i) => i.path[0] === "amount")
      ? "Invalid amount"
      : "Invalid input";
    return { ok: false, error: msg };
  }

  const user = await getUser(session.uid);
  if (!user) return { ok: false, error: "No user" };

  const accounts = listBankAccountsByUser(user);
  if (accounts.length === 0) return { ok: false, error: "Save bank details first" };

  const selectedAccount = parsed.data.bankAccountId
    ? getBankAccountById(user, parsed.data.bankAccountId)
    : getDefaultBankAccount(user);

  if (!selectedAccount) return { ok: false, error: "Selected bank account not found" };
  if (!selectedAccount.verified) return { ok: false, error: "Bank account must be verified before withdrawal" };

  const amount = parsed.data.amount;
  if (!Number.isInteger(amount)) return { ok: false, error: "Invalid amount" };
  if (amount < MIN_WITHDRAWAL) {
    return { ok: false, error: `Minimum withdrawal is ${MIN_WITHDRAWAL}` };
  }
  if (amount > MAX_WITHDRAWAL) {
    return { ok: false, error: `Maximum withdrawal is ${MAX_WITHDRAWAL}` };
  }
  if (amount > user.balance) return { ok: false, error: "Insufficient balance" };

  const platformFee = Math.round(amount * WITHDRAWAL_FEE_PCT);
  const processingFee = Math.round(amount * WITHDRAWAL_PROCESSING_FEE_PCT);
  const fee = platformFee + processingFee;
  const net = amount - fee;
  if (net <= 0) return { ok: false, error: "Net amount invalid. Increase withdrawal amount." };

  const fp = `${selectedAccount.bankName}|${selectedAccount.accountNumber}`;
  const dup = await hasRecentDuplicateWithdrawal(
    session.uid,
    amount,
    fp,
    DUPLICATE_WITHDRAWAL_WINDOW_MS,
  );
  if (dup) {
    return {
      ok: false,
      error: "A similar withdrawal was just submitted. Please wait a moment before retrying.",
      duplicate: true,
    };
  }

  const fromTask = Math.min(user.taskBalance ?? 0, amount);
  const fromBalance = amount - fromTask;

  const db = getAdminDb();
  let withdrawalId = "";
  const transactionId = generateTransactionId();
  const now = Date.now();

  await db.runTransaction(async (tx) => {
    const userRef = db.collection("users").doc(session.uid);
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new Error("Missing user");
    const cur = snap.data() as Pick<UserDoc, "balance" | "taskBalance">;
    const newBalance = (cur.balance ?? 0) - fromBalance;
    const newTask = (cur.taskBalance ?? 0) - fromTask;
    if (newBalance < 0 || newTask < 0) throw new Error("Insufficient funds");
    tx.update(userRef, {
      balance: newBalance,
      taskBalance: newTask,
      updatedAt: now,
    });
  });

  const bankDetailsSnapshot = {
    bankName: selectedAccount.bankName,
    accountNumber: selectedAccount.accountNumber,
    accountName: selectedAccount.accountName,
  };

  const created = await createWithdrawal({
    userId: session.uid,
    amount,
    fee,
    netAmount: net,
    bankDetails: bankDetailsSnapshot,
    status: "pending",
    transactionId,
    createdAt: now,
  });
  withdrawalId = created.id;

  return {
    ok: true,
    withdrawalId,
    wdId: withdrawalId,
    fee,
    netAmount: net,
    platformFee,
    processingFee,
    transactionId,
  };
}

export async function listMyWithdrawalsAction() {
  const session = await verifySessionCookie();
  if (!session) return { ok: false, error: "Unauthenticated", withdrawals: [] as WithdrawalDoc[] };
  const list = await listWithdrawalsByUser(session.uid, 50);
  return { ok: true, withdrawals: list };
}

export async function getWithdrawalAction(
  id: string,
): Promise<{ ok: true; withdrawal: WithdrawalDoc } | { ok: false; error: string; withdrawal: null }> {
  const session = await verifySessionCookie();
  if (!session) return { ok: false, error: "Unauthenticated", withdrawal: null };
  if (!id || typeof id !== "string") return { ok: false, error: "Invalid id", withdrawal: null };
  const raw = await getWithdrawalHelper(id);
  if (!raw) return { ok: false, error: "Withdrawal not found", withdrawal: null };
  if (raw.userId !== session.uid) return { ok: false, error: "Forbidden", withdrawal: null };
  return { ok: true, withdrawal: raw };
}

export async function getWithdrawalReceiptAction(wdId: string) {
  const session = await verifySessionCookie();
  if (!session) return null;
  const doc = await getWithdrawalHelper(wdId);
  if (!doc || doc.userId !== session.uid) return null;
  return doc;
}

export { scoreQuizAnswers };
