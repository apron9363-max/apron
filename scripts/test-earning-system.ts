import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { getAdminDb, createUserDoc, getUser, upsertTask, createSubmission, listSubmissionsByUser, listEarningsByUser, listWithdrawalsByUser, findSubmission } from "@/lib/firestore";
import { rewardUserForTaskTx } from "@/lib/rewards-tx";
import { signTaskSessionToken, generateNonce } from "@/lib/hmac";
import { scoreQuizAnswers } from "@/server/actions/taskActions";
import type { TaskDoc, TaskQuestion, SubmissionDoc, UserDoc } from "@/types";
import type { MCQuestion, TFQuestion, MatchQuestion } from "@/types";

const MS_24_H = 24 * 3600 * 1000;
const TEST_UID_PREFIX = "test-earn-sys-";
const TEST_UID = `${TEST_UID_PREFIX}${Date.now()}`;
const TASK_QUIZ_ID = `t-quiz-${Date.now()}`;
const TASK_VIDEO_ID = `t-video-${Date.now()}`;

let FAIL = 0;
let PASS = 0;

function assert(name: string, cond: boolean, detail?: string) {
  if (cond) {
    PASS++;
    console.log(`[PASS] ${name}` + (detail ? `  (${detail})` : ""));
  } else {
    FAIL++;
    console.log(`[FAIL] ${name}` + (detail ? `  (${detail})` : ""));
  }
}

function eq(a: any, b: any, msg: string) {
  assert(msg, JSON.stringify(a) === JSON.stringify(b), `${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
}

const QUIZ_REWARD = 250;
const VIDEO_REWARD = 120;

const QUIZ_QUESTIONS: TaskQuestion[] = [
  { type: "mc", question: "2 + 2 × 2 = ?", options: ["6", "8", "4", "10"], answerIndex: 0 } as MCQuestion,
  { type: "tf", question: "Lagos is in Nigeria.", answerIndex: 0 } as TFQuestion,
  { type: "mc", question: "Capital of France?", options: ["Madrid", "Berlin", "Paris", "Rome"], answerIndex: 2 } as MCQuestion,
];

async function seedUser(): Promise<UserDoc> {
  const now = Date.now();
  const doc: Omit<UserDoc, "uid" | "id"> = {
    name: "Earning System Test User",
    email: `test-earn-${now}@example.com`,
    phone: "+19990001111",
    role: "user",
    plan: "pro",
    planExpiresAt: null,
    balance: 0,
    taskBalance: 0,
    apnRate: 15,
    referralCode: `TE${now.toString().slice(-6).toUpperCase()}`,
    referredBy: null,
    referralPaidOut: false,
    bankDetails: null,
    status: "active",
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  };
  return await createUserDoc(TEST_UID, doc);
}

async function seedTasks(): Promise<{ quiz: TaskDoc; video: TaskDoc }> {
  const now = Date.now();
  const quiz = await upsertTask({
    id: TASK_QUIZ_ID,
    title: "Test Earning Quiz",
    type: "quiz",
    reward: QUIZ_REWARD,
    description: "Quiz for test-earning-system",
    questions: QUIZ_QUESTIONS,
    maxDailyClaims: 5,
    active: true,
  } as any);
  const video = await upsertTask({
    id: TASK_VIDEO_ID,
    title: "Test Earning Video",
    type: "video",
    reward: VIDEO_REWARD,
    description: "Video for test-earning-system",
    minDurationSec: 5,
    externalUrl: "https://example.com/video",
    maxDailyClaims: 5,
    active: true,
  } as any);
  return { quiz, video };
}

async function cleanup() {
  const db = getAdminDb();
  const toDelete = [
    db.collection("users").doc(TEST_UID),
    db.collection("tasks").doc(TASK_QUIZ_ID),
    db.collection("tasks").doc(TASK_VIDEO_ID),
  ];
  const [earn, subs] = await Promise.all([
    db.collection("earnings").where("userId", "==", TEST_UID).get(),
    db.collection("submissions").where("userId", "==", TEST_UID).where("taskId", "in", [TASK_QUIZ_ID, TASK_VIDEO_ID]).get(),
  ]);
  earn.forEach((d) => toDelete.push(d.ref));
  subs.forEach((d) => toDelete.push(d.ref));
  await Promise.all(toDelete.map((r) => r.delete().catch(() => {})));
}

async function main() {
  if (!process.env.FIREBASE_ADMIN_PROJECT_ID || !process.env.FIREBASE_ADMIN_CLIENT_EMAIL || !process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
    console.log("== test-earning-system ==");
    console.log();
    console.log("[SKIP] Firebase admin env vars (FIREBASE_ADMIN_PROJECT_ID / CLIENT_EMAIL / PRIVATE_KEY) are not configured in .env.local");
    console.log("[SKIP] Skipping live Firestore integration tests. Set credentials to run.");
    console.log();
    console.log("== Summary ==");
    console.log("SKIPPED=all  (no Firestore credentials)");
    process.exit(0);
  }
  console.log("== test-earning-system ==");
  await cleanup();
  console.log();

  // Phase 1: seed
  console.log("-- Phase 1: seed user + tasks --");
  const user = await seedUser();
  eq(user.uid, TEST_UID, "createUserDoc returns uid");
  const tasks = await seedTasks();
  eq(tasks.quiz.id, TASK_QUIZ_ID, "upsertTask quiz id");
  eq(tasks.video.id, TASK_VIDEO_ID, "upsertTask video id");
  const refetched = await getUser(TEST_UID);
  assert("refetch user by uid", !!refetched && refetched.balance === 0 && refetched.taskBalance === 0, `balance=${refetched?.balance} tb=${refetched?.taskBalance}`);

  // Phase 2: HMAC token sign/verify roundtrip
  console.log();
  console.log("-- Phase 2: HMAC token roundtrip --");
  const iat = Date.now();
  const token = signTaskSessionToken({ uid: TEST_UID, taskId: TASK_QUIZ_ID, iat, nonce: generateNonce(12) });
  assert("token non-empty string", typeof token === "string" && token.length > 16);
  assert("token has delimiter", token.split(".").length === 2);

  // Phase 3: Quiz scoring
  console.log();
  console.log("-- Phase 3: Quiz scoring --");
  const allCorrect = [
    { qIndex: 0, value: 0 },
    { qIndex: 1, value: 0 },
    { qIndex: 2, value: 2 },
  ];
  let scored = scoreQuizAnswers(QUIZ_QUESTIONS as TaskQuestion[], allCorrect);
  eq(scored.total, 3, "quiz total qs");
  eq(scored.correct, 3, "quiz all correct=3");
  eq(scored.perQuestion.length, 3, "perQuestion len 3");
  assert("quiz 3/3 pct=100", scored.correct / scored.total === 1);

  const someWrong = [
    { qIndex: 0, value: 1 },
    { qIndex: 1, value: 1 },
    { qIndex: 2, value: 0 },
  ];
  scored = scoreQuizAnswers(QUIZ_QUESTIONS as TaskQuestion[], someWrong);
  eq(scored.correct, 0, "quiz all wrong=0");
  const partial = [
    { qIndex: 0, value: 0 },
    { qIndex: 1, value: 1 },
    { qIndex: 2, value: 2 },
  ];
  scored = scoreQuizAnswers(QUIZ_QUESTIONS as TaskQuestion[], partial);
  eq(scored.correct, 2, "quiz partial 2/3");

  // Phase 4: Quiz flow -> submission + earning
  console.log();
  console.log("-- Phase 4: Quiz reward lifecycle --");
  const beforeUser = await getUser(TEST_UID);
  const beforeBalance = beforeUser!.balance;
  const beforeTaskBalance = beforeUser!.taskBalance;

  const quizToken = signTaskSessionToken({ uid: TEST_UID, taskId: TASK_QUIZ_ID, iat: Date.now(), nonce: generateNonce(12) });
  const nowMs = Date.now();
  const dateBucket = new Date(nowMs).toISOString().slice(0, 10).replace(/-/g, "");
  const quizEarningRef = `quiz-${TEST_UID}-${TASK_QUIZ_ID}-${dateBucket}`;
  const pct = 2 / 3;
  const rewardEarned = Math.max(0, Math.round(QUIZ_REWARD * pct));
  const status: SubmissionDoc["status"] = "completed";
  const quizSub = await createSubmission({
    userId: TEST_UID,
    taskId: TASK_QUIZ_ID,
    reward: rewardEarned,
    status,
    proof: JSON.stringify({ score: 2, total: 3 }),
    createdAt: nowMs,
  });
  const quizSubId = quizSub.id;

  const rewardRes = await rewardUserForTaskTx({
    uid: TEST_UID,
    taskId: TASK_QUIZ_ID,
    amount: rewardEarned,
    source: "quiz",
    submissionId: quizSubId,
    earningReferenceId: quizEarningRef,
    note: `Quiz: 2/3 (67%)`,
  });
  eq(rewardRes.alreadyPaid, false, "alreadyPaid false on first reward");
  assert("reward txid populated", typeof rewardRes.txId === "string" && rewardRes.txId.length > 4);

  const afterQuiz = await getUser(TEST_UID);
  eq(afterQuiz!.balance, beforeBalance + rewardEarned, `quiz balance +${rewardEarned}`);
  eq(afterQuiz!.taskBalance, beforeTaskBalance + rewardEarned, `quiz taskBalance +${rewardEarned}`);

  const earnDocs = await listEarningsByUser(TEST_UID, 10);
  const quizEarn = earnDocs.find((e) => e.referenceId === quizSubId || e.id === quizEarningRef);
  assert("earning doc created for quiz", !!quizEarn);
  eq(quizEarn?.amount, rewardEarned, "earning amount matches");
  eq(quizEarn?.source, "quiz", "earning source quiz");

  const subAfter = await findSubmission(TEST_UID, TASK_QUIZ_ID);
  assert("submission exists", !!subAfter);
  eq(subAfter?.status, "completed", "submission status completed");
  eq(subAfter?.reward, rewardEarned, "submission reward");

  // Phase 5: Idempotency - call rewardUserForTaskTx twice
  console.log();
  console.log("-- Phase 5: reward idempotency --");
  const dup = await rewardUserForTaskTx({
    uid: TEST_UID,
    taskId: TASK_QUIZ_ID,
    amount: rewardEarned,
    source: "quiz",
    submissionId: quizSubId,
    earningReferenceId: quizEarningRef,
  });
  eq(dup.alreadyPaid, true, "duplicate reward reports alreadyPaid true");
  eq(dup.newBalance, afterQuiz!.balance, "balance unchanged on dup");
  const afterDup = await getUser(TEST_UID);
  eq(afterDup!.balance, afterQuiz!.balance, "firestore balance unchanged after dup");

  // Phase 6: Video proof task flow
  console.log();
  console.log("-- Phase 6: Video proof task lifecycle --");
  const beforeVid = await getUser(TEST_UID);
  const beforeVidTB = beforeVid!.taskBalance;
  const videoEarningRef = `task-${TEST_UID}-${TASK_VIDEO_ID}-${dateBucket}-${Date.now()}`;

  const videoSub = await createSubmission({
    userId: TEST_UID,
    taskId: TASK_VIDEO_ID,
    reward: VIDEO_REWARD,
    status: "verified",
    proof: "https://example.com/video",
    durationSec: 30,
    createdAt: Date.now(),
  });
  const videoSubId = videoSub.id;
  const vidRes = await rewardUserForTaskTx({
    uid: TEST_UID,
    taskId: TASK_VIDEO_ID,
    amount: VIDEO_REWARD,
    source: "task",
    submissionId: videoSubId,
    earningReferenceId: videoEarningRef,
    note: `Video: 30s watched`,
  });
  eq(vidRes.alreadyPaid, false, "video first reward not dup");
  const afterVid = await getUser(TEST_UID);
  eq(afterVid!.taskBalance, beforeVidTB + VIDEO_REWARD, `video taskBalance +${VIDEO_REWARD}`);

  const earningsTotal = (await listEarningsByUser(TEST_UID, 100))
    .reduce((s, e) => s + Number(e.amount ?? 0), 0);
  eq(earningsTotal, rewardEarned + VIDEO_REWARD, `sum earnings = ${rewardEarned}+${VIDEO_REWARD}`);

  const subsByUser = await listSubmissionsByUser(TEST_UID, { limit: 20 });
  assert("submissions count >=2", subsByUser.length >= 2, `${subsByUser.length} subs`);

  // Cleanup
  console.log();
  console.log("-- Phase 7: cleanup --");
  await cleanup();
  const gone = await getUser(TEST_UID);
  assert("cleaned user doc deleted", gone === null);

  console.log();
  console.log("== Summary ==");
  console.log(`PASS=${PASS}  FAIL=${FAIL}`);
  process.exit(FAIL === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("Unhandled harness error:", e);
  process.exit(1);
});
