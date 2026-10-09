export type Role = "user" | "admin" | "vip";
export type UserStatus = "active" | "banned" | "pending";
export type TaskType = "quiz" | "video" | "survey";
export type WithdrawalStatus = "pending" | "paid" | "rejected";
export type EarningSource = "task" | "referral" | "claim" | "quiz";
export type PlanId = "starter" | "pro" | "elite";
export type SubmissionStatus =
  | "submitted"
  | "verified"
  | "completed"
  | "failed"
  | "rejected";

export type MCQuestion = {
  type?: "mc";
  question: string;
  options: string[];
  answerIndex: number;
};
export type TFQuestion = {
  type: "tf";
  question: string;
  options?: ["True", "False"];
  answerIndex: 0 | 1;
};
export type MatchQuestion = {
  type: "match";
  question: string;
  leftPairs: string[];
  rightPairs: string[];
  correctMapping: number[];
};
export type TaskQuestion = MCQuestion | TFQuestion | MatchQuestion;

export interface BankDetails {
  bankName: string;
  accountNumber: string;
  accountName: string;
}

export interface VerifiedBankAccount extends BankDetails {
  id: string;
  nickname?: string;
  verified: boolean;
  verifiedAt?: number;
  addedAt: number;
  isDefault?: boolean;
}

export interface BalanceSnapshot {
  at: number;
  balance: number;
  effectiveRate?: number;
}

export interface QuickLink {
  id: string;
  href: string;
  label: string;
  iconName: string;
  custom?: boolean;
  order: number;
}

export interface UserDoc {
  uid: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  plan: PlanId;
  planExpiresAt: number | null;
  balance: number;
  taskBalance: number;
  apnRate: number;
  referralCode: string;
  referredBy: string | null;
  referralPaidOut: boolean;
  bankDetails: BankDetails | null;
  bankAccounts?: VerifiedBankAccount[];
  status: UserStatus;
  emailVerified: boolean;
  createdAt: number;
  updatedAt: number;
  lastHourlyClaimAt?: number;
  balanceHistory?: BalanceSnapshot[];
  quickLinks?: QuickLink[];
  referralClicks?: number;
  referralSignups?: number;
  referralsCount?: number;
}

export interface TaskDoc {
  id: string;
  title: string;
  type: TaskType;
  reward: number;
  description?: string;
  questions?: TaskQuestion[];
  externalUrl?: string;
  url?: string;
  minDurationSec?: number;
  proofKey?: string;
  maxDailyClaims?: number;
  expiresAt?: number;
  plan?: PlanId | string;
  metadata?: Record<string, unknown>;
  active: boolean;
  createdAt: number;
}

export interface SubmissionDoc {
  id: string;
  userId: string;
  taskId: string;
  reward: number;
  status: SubmissionStatus;
  proof?: string;
  durationSec?: number;
  createdAt: number;
}

export interface WithdrawalDoc {
  id: string;
  userId: string;
  amount: number;
  fee: number;
  netAmount: number;
  bankDetails: BankDetails;
  bankAccountId?: string;
  platformFee?: number;
  processingFee?: number;
  status: WithdrawalStatus;
  rejectReason?: string;
  note?: string;
  transactionId?: string;
  createdAt: number;
  processedAt?: number;
}

export interface PlanDoc {
  id: PlanId | string;
  name: string;
  price: number;
  hourlyRate: number;
  features: string[];
  active: boolean;
  durationDays?: number;
  description?: string;
  createdAt?: number;
  updatedAt?: number;
  updatedBy?: string;
  version?: number;
}

export interface PlanVersionLog {
  id: string;
  planId: string;
  version: number;
  changedBy: string;
  changedAt: number;
  diff: Record<string, { before: unknown; after: unknown }>;
  snapshot: PlanDoc;
  note?: string;
}

export type AdminAuditAction =
  | "user.update_balance"
  | "user.set_status"
  | "user.set_role"
  | "withdrawal.approve"
  | "withdrawal.reject"
  | "plan.create"
  | "plan.update"
  | "plan.delete"
  | "settings.update"
  | "admin_task.create"
  | "admin_task.update"
  | "admin_task.delete"
  | "admin_task.assign";

export interface AdminAuditLog {
  id: string;
  actorUid: string;
  actorName: string;
  action: AdminAuditAction;
  targetKind: "user" | "withdrawal" | "plan" | "settings" | "admin_task";
  targetId: string;
  timestamp: number;
  payload?: Record<string, unknown>;
  note?: string;
  ip?: string;
  ua?: string;
}

export interface BalanceEditLog {
  id: string;
  targetUid: string;
  actorUid: string;
  actorName: string;
  delta: number;
  oldBalance: number;
  newBalance: number;
  oldTaskBalance: number;
  newTaskBalance: number;
  reason: string;
  timestamp: number;
}

export type AdminTaskStatus = "pending" | "in_progress" | "completed" | "cancelled";
export type AdminTaskPriority = "low" | "medium" | "high" | "critical";
export type AdminTaskCategory =
  | "operations"
  | "finance"
  | "support"
  | "product"
  | "compliance"
  | "marketing"
  | "other";

export interface AdminTaskHistoryEntry {
  at: number;
  by: string;
  byName: string;
  change: Record<string, { before: unknown; after: unknown }>;
  comment?: string;
  timestamp?: number;
  action?: string;
  actorUid?: string;
  actorName?: string;
  changes?: Record<string, { before: unknown; after: unknown }>;
}

export interface AdminOpsTask {
  id: string;
  title: string;
  description?: string;
  category: AdminTaskCategory;
  priority: AdminTaskPriority;
  status: AdminTaskStatus;
  assigneeUid?: string;
  assigneeName?: string;
  createdBy: string;
  createdByName: string;
  deadlineAt?: number;
  reminderAt?: number;
  overdueNotified?: boolean;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  history: AdminTaskHistoryEntry[];
}

export interface SettingsDoc {
  id: "platform";
  referralBonus: number;
  withdrawalFeePct: number;
  withdrawalProcessingFeePct?: number;
  minWithdrawal: number;
  maxWithdrawal?: number;
  duplicateWithdrawalWindowMs?: number;
  maxBankAccounts?: number;
  hourlyInactivityDays: number;
  globalAccrualCapAPN: number;
  updatedAt?: number;
  updatedBy?: string;
}

export interface EarningDoc {
  id: string;
  userId: string;
  source: EarningSource;
  amount: number;
  referenceId?: string;
  txId?: string;
  createdAt: number;
}

export type TxLogEvent =
  | "hourly_claim_success"
  | "hourly_claim_skip"
  | "worker_run";

export interface TxLogDoc {
  id: string;
  event: TxLogEvent;
  userId?: string;
  payload?: Record<string, unknown>;
  at: number;
}
