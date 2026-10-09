export const COLLECTIONS = {
  users: "users",
  tasks: "tasks",
  submissions: "submissions",
  withdrawals: "withdrawals",
  plans: "plans",
  earnings: "earnings",
  settings: "settings",
  tx_logs: "tx_logs",
  admin_audit_logs: "admin_audit_logs",
  balance_edit_logs: "balance_edit_logs",
  plan_version_logs: "plan_version_logs",
  admin_ops_tasks: "admin_ops_tasks",
} as const;

export const DEFAULT_REFERRAL_BONUS = Number(
  process.env.DEFAULT_REFERRAL_BONUS ?? 50,
);

export const WITHDRAWAL_FEE_PCT = Number(
  process.env.WITHDRAWAL_FEE_PCT ?? 0.05,
);

export const WITHDRAWAL_PROCESSING_FEE_PCT = Number(
  process.env.WITHDRAWAL_PROCESSING_FEE_PCT ?? 0,
);

export const MIN_WITHDRAWAL = Number(process.env.MIN_WITHDRAWAL ?? 1000);
export const MAX_WITHDRAWAL = Number(process.env.MAX_WITHDRAWAL ?? 1_000_000);

export const DUPLICATE_WITHDRAWAL_WINDOW_MS = 60 * 1000;
export const MAX_BANK_ACCOUNTS = 5;

export const SESSION_DURATION_SECONDS = Number(
  process.env.SESSION_DURATION_SECONDS ?? 604_800,
);

export const SESSION_COOKIE_NAME = "session";
export const ADMIN_SESSION_COOKIE_NAME = "admin_session";

export const PLAN_IDS = {
  starter: "starter",
  pro: "pro",
  elite: "elite",
} as const;

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
