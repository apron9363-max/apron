import "server-only";
import { getAdminDb } from "@/firebase/admin";
import { COLLECTIONS } from "@/lib/constants";
import { generateTransactionId } from "@/lib/utils";
import {
  updateUserBalanceTx,
  type HistoryRow,
  type HistoryRowEarning,
} from "@/lib/firestore";
import type {
  EarningDoc,
  EarningSource,
  SubmissionDoc,
  UserDoc,
} from "@/types";
import type { Transaction } from "firebase-admin/firestore";

export async function withDeterministicEarningTx<T>(opts: {
  referenceId: string;
  fn: (tx: Transaction, alreadyPaid: boolean, earningRef: FirebaseFirestore.DocumentReference) => Promise<T>;
}): Promise<T> {
  const db = getAdminDb();
  const earningRef = db.collection(COLLECTIONS.earnings).doc(opts.referenceId);
  return await db.runTransaction(async (tx) => {
    const snap = await tx.get(earningRef);
    const alreadyPaid = snap.exists;
    return await opts.fn(tx, alreadyPaid, earningRef);
  });
}

export type RewardTaskOpts = {
  uid: string;
  taskId: string;
  amount: number;
  source: EarningSource;
  submissionId?: string;
  earningReferenceId: string;
  note?: string;
  skipTaskBalance?: boolean;
};

export async function rewardUserForTaskTx(opts: RewardTaskOpts): Promise<{
  earningId: string;
  txId: string;
  alreadyPaid: boolean;
  newBalance: number;
  newTaskBalance: number;
}> {
  const db = getAdminDb();
  const earningRef = db.collection(COLLECTIONS.earnings).doc(opts.earningReferenceId);
  const userRef = db.collection(COLLECTIONS.users).doc(opts.uid);

  const res = await db.runTransaction(async (tx) => {
    const earnSnap = await tx.get(earningRef);
    if (earnSnap.exists) {
      const existing = earnSnap.data() as EarningDoc;
      const userSnap = await tx.get(userRef);
      const user = userSnap.data() as UserDoc | undefined;
      return {
        alreadyPaid: true,
        earningId: opts.earningReferenceId,
        txId: existing.txId ?? "",
        newBalance: user?.balance ?? 0,
        newTaskBalance: user?.taskBalance ?? 0,
      };
    }
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) throw new Error(`User ${opts.uid} not found`);
    const user = userSnap.data() as UserDoc;

    const txId = generateTransactionId();
    const earningDoc: Omit<EarningDoc, "id"> = {
      userId: opts.uid,
      source: opts.source,
      amount: opts.amount,
      referenceId: opts.submissionId ?? opts.taskId,
      txId,
      createdAt: Date.now(),
    };
    tx.set(earningRef, earningDoc);

    const newBalance = (user.balance ?? 0) + opts.amount;
    const newTaskBalance = opts.skipTaskBalance
      ? user.taskBalance ?? 0
      : (user.taskBalance ?? 0) + opts.amount;

    await updateUserBalanceTx(tx, opts.uid, {
      balance: newBalance,
      taskBalance: newTaskBalance,
    });

    return {
      alreadyPaid: false,
      earningId: opts.earningReferenceId,
      txId,
      newBalance,
      newTaskBalance,
    };
  });

  return res;
}

export function earningDocToHistoryRow(e: EarningDoc, note?: string): HistoryRowEarning {
  return {
    kind: "earning",
    id: e.id,
    userId: e.userId,
    source: e.source,
    amount: e.amount,
    referenceId: e.referenceId,
    txId: e.txId,
    createdAt: e.createdAt,
    note,
  };
}

export function applyEarningToSubmissionStatus(
  submission: Pick<SubmissionDoc, "status">,
): SubmissionDoc["status"] {
  if (submission.status === "submitted") return "verified";
  if (submission.status === "verified") return "completed";
  return submission.status;
}
