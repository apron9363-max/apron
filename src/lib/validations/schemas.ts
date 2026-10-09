import { z } from "zod";

const PASSWORD_UPPER = /[A-Z]/;
const PASSWORD_DIGIT = /\d/;
const passwordMinRules = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(PASSWORD_UPPER, "Password must include at least one uppercase letter")
  .regex(PASSWORD_DIGIT, "Password must include at least one number");

export const registerSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters").max(80),
    email: z.string().email("Enter a valid email"),
    phone: z
      .string()
      .min(8, "Enter a valid phone")
      .max(20, "Phone too long")
      .regex(/^[+\d][\d\s-]{7,}$/, "Invalid phone format"),
    password: passwordMinRules,
    confirmPassword: passwordMinRules,
    referralCode: z.string().max(16).optional().or(z.literal("")),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: passwordMinRules,
});
export type LoginInput = z.infer<typeof loginSchema>;

export const bankDetailsSchema = z.object({
  bankName: z.string().min(2, "Bank name required").max(60),
  accountNumber: z.string().min(8, "Account number too short").max(12),
  accountName: z.string().min(2, "Account name required").max(100),
});
export type BankDetailsInput = z.infer<typeof bankDetailsSchema>;

export const addBankAccountSchema = bankDetailsSchema.extend({
  nickname: z.string().min(1, "Nickname required").max(40).optional(),
});
export type AddBankAccountInput = z.infer<typeof addBankAccountSchema>;

export const setDefaultBankAccountSchema = z.object({
  accountId: z.string().min(1, "Account id required"),
});
export type SetDefaultBankAccountInput = z.infer<typeof setDefaultBankAccountSchema>;

export const deleteBankAccountSchema = z.object({
  accountId: z.string().min(1, "Account id required"),
});
export type DeleteBankAccountInput = z.infer<typeof deleteBankAccountSchema>;

export const withdrawalRequestSchema = z.object({
  amount: z.number().int().positive(),
  bankAccountId: z.string().min(1).optional(),
});
export type WithdrawalRequestInput = z.infer<typeof withdrawalRequestSchema>;

export const planSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(40),
  price: z.number().int().nonnegative(),
  hourlyRate: z.number().nonnegative(),
  features: z.array(z.string()).default([]),
  active: z.boolean().default(true),
});

const mcQuestionSchema = z
  .object({
    type: z.literal("mc").optional(),
    question: z.string().min(1).max(500),
    options: z.array(z.string()).min(2).max(6),
    answerIndex: z.number().int().nonnegative(),
  })
  .refine(
    (q) => q.answerIndex >= 0 && q.answerIndex < q.options.length,
    { message: "answerIndex out of options bounds", path: ["answerIndex"] },
  );
const tfQuestionSchema = z.object({
  type: z.literal("tf"),
  question: z.string().min(1).max(500),
  options: z.tuple([z.literal("True"), z.literal("False")]).optional(),
  answerIndex: z.union([z.literal(0), z.literal(1)]),
});
const matchQuestionSchema = z
  .object({
    type: z.literal("match"),
    question: z.string().min(1).max(500),
    leftPairs: z.array(z.string()).min(1).max(10),
    rightPairs: z.array(z.string()).min(1).max(10),
    correctMapping: z.array(z.number().int().nonnegative()),
  })
  .refine(
    (q) =>
      q.correctMapping.length === q.leftPairs.length &&
      q.correctMapping.every(
        (idx) => idx >= 0 && idx < q.rightPairs.length,
      ),
    {
      message:
        "correctMapping length must match leftPairs and all indices within rightPairs bounds",
      path: ["correctMapping"],
    },
  );
const questionSchema = z.union([mcQuestionSchema, tfQuestionSchema, matchQuestionSchema]);

export const taskUpsertSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(2).max(160),
  type: z.enum(["quiz", "video", "survey"]),
  reward: z.number().nonnegative(),
  description: z.string().max(1000).optional().or(z.literal("")),
  questions: z.array(questionSchema).optional(),
  externalUrl: z.string().url().max(1000).optional().or(z.literal("")),
  url: z.string().url().max(1000).optional().or(z.literal("")),
  minDurationSec: z.number().int().positive().optional(),
  proofKey: z.string().min(1).max(200).optional(),
  maxDailyClaims: z.number().int().positive().optional(),
  expiresAt: z.number().int().positive().optional(),
  plan: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  active: z.boolean().default(true),
});

export const taskClaimSchema = z.object({ taskId: z.string().min(1) });

export const initiateTaskSchema = z.object({ taskId: z.string().min(1) });

export const completeProofTaskSchema = z.object({
  taskSessionToken: z.string().min(1),
  proof: z.string().max(2000),
  durationSec: z.number().int().nonnegative(),
});

export const completeQuizTaskSchema = z.object({
  taskSessionToken: z.string().min(1),
  answers: z.array(
    z.object({
      qIndex: z.number().int().nonnegative(),
      value: z.union([z.number().int(), z.array(z.number().int())]),
    }),
  ),
});

export const hourlyAccrualClaimSchema = z.object({}).strict();

export const taskSessionTokenPayloadSchema = z.object({
  uid: z.string().min(1),
  taskId: z.string().min(1),
  iat: z.number().int().positive(),
  nonce: z.string().min(8),
});
export type TaskSessionTokenPayload = z.infer<typeof taskSessionTokenPayloadSchema>;

export const userIdSchema = z.object({ uid: z.string().min(1) });
export const balanceDeltaSchema = z.object({
  uid: z.string().min(1),
  delta: z.number(),
  reason: z.string().max(200).optional(),
});
export const roleSchema = z.object({ uid: z.string().min(1), role: z.enum(["user", "admin", "vip"]) });
export const statusSchema = z.object({
  uid: z.string().min(1),
  status: z.enum(["active", "banned", "pending"]),
});
export const withdrawalDecisionSchema = z.object({
  wdId: z.string().min(1),
  reason: z.string().max(400).optional().or(z.literal("")),
});
export const referralBonusSchema = z.object({ amount: z.number().nonnegative() });

export const quickLinkSchema = z.object({
  id: z.string().min(1).max(32),
  href: z
    .string()
    .min(1)
    .max(400)
    .refine(
      (v) => v.startsWith("/") || v.startsWith("https://"),
      "Link must be internal (/...) or start with https://",
    ),
  label: z.string().min(1).max(40),
  iconName: z
    .string()
    .min(1)
    .max(32)
    .refine((v) => ALLOWED_QUICKLINK_ICONS.has(v), "Unsupported icon"),
  custom: z.boolean().optional(),
  order: z.number().int().nonnegative(),
});
export type QuickLinkInput = z.infer<typeof quickLinkSchema>;

export const ALLOWED_QUICKLINK_ICON_NAMES = [
  "HelpCircle",
  "ClipboardList",
  "Trophy",
  "Banknote",
  "Wallet",
  "Gift",
  "Crown",
  "GraduationCap",
  "Share2",
  "History",
  "Sparkles",
  "Coins",
  "UserPlus",
  "Home",
  "Settings",
] as const;
export const ALLOWED_QUICKLINK_ICONS = new Set<string>(ALLOWED_QUICKLINK_ICON_NAMES);

export const saveQuickLinksSchema = z.object({
  links: z
    .array(quickLinkSchema)
    .max(12, "Maximum 12 quick links"),
});
export type SaveQuickLinksInput = z.infer<typeof saveQuickLinksSchema>;

export const appendBalanceSnapshotSchema = z.object({
  at: z.number().int().positive().optional(),
  effectiveRate: z.number().nonnegative().optional(),
});
export type AppendBalanceSnapshotInput = z.infer<typeof appendBalanceSnapshotSchema>;

export const refreshDashboardRateOutputSchema = z.object({
  apnRate: z.number().nonnegative(),
  planLabel: z.string(),
  trend24h: z.array(
    z.object({ t: z.number().int().nonnegative(), value: z.number().nonnegative() }),
  ),
  fluctuation: z.object({
    pct: z.number().nullable(),
    dir: z.enum(["up", "down", "flat"]),
  }),
});
export type RefreshDashboardRateOutput = z.infer<typeof refreshDashboardRateOutputSchema>;

export const listTasksFilterSchema = z.object({
  type: z.enum(["all", "quiz", "video", "survey"]).default("all"),
  sort: z.enum(["newest", "reward_desc", "reward_asc"]).default("newest"),
  status: z.enum(["all", "available", "completed"]).default("all"),
});
export type ListTasksFilterInput = z.infer<typeof listTasksFilterSchema>;

export const listHistoryPaginatedSchema = z.object({
  kind: z.enum(["all", "earning", "withdrawal"]).default("all"),
  source: z.enum(["all", "task", "referral", "claim", "quiz"]).default("all"),
  fromTs: z.number().int().positive().optional(),
  toTs: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(200).default(50),
  cursorId: z.string().min(1).optional(),
  cursorKind: z.enum(["earning", "withdrawal"]).optional(),
});
export type ListHistoryPaginatedInput = z.infer<typeof listHistoryPaginatedSchema>;

export const exportHistoryCsvSchema = z.object({
  kind: z.enum(["all", "earning", "withdrawal"]).default("all"),
  source: z.enum(["all", "task", "referral", "claim", "quiz"]).default("all"),
  fromTs: z.number().int().positive().optional(),
  toTs: z.number().int().positive().optional(),
});
export type ExportHistoryCsvInput = z.infer<typeof exportHistoryCsvSchema>;

export const listQuizzesSchema = z.object({}).strict();

export const adminDateRangeSchema = z.object({
  fromMs: z.number().int().positive().optional(),
  toMs: z.number().int().positive().optional(),
  preset: z.enum(["7d", "14d", "30d", "90d", "all"]).optional(),
});
export type AdminDateRangeInput = z.infer<typeof adminDateRangeSchema>;

export const adminOverviewSchema = adminDateRangeSchema;
export type AdminOverviewInput = z.infer<typeof adminOverviewSchema>;

export const adminListUsersSchema = z.object({
  search: z.string().max(120).optional().or(z.literal("")),
  limit: z.number().int().positive().max(200).default(50),
  sortBy: z
    .enum(["createdAt", "updatedAt", "balance", "name", "email", "plan"])
    .default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  status: z.enum(["all", "active", "banned", "pending"]).default("all"),
  role: z.enum(["all", "user", "admin", "vip"]).default("all"),
  offset: z.number().int().nonnegative().optional(),
});
export type AdminListUsersInput = z.infer<typeof adminListUsersSchema>;

export const adminUpdateBalanceSchema = z.object({
  uid: z.string().min(1),
  delta: z.number(),
  reason: z.string().min(2, "Reason required").max(500),
});
export type AdminUpdateBalanceInput = z.infer<typeof adminUpdateBalanceSchema>;

export const adminCreatePlanSchema = z.object({
  id: z.string().min(1).max(32).optional(),
  name: z.string().min(1).max(40),
  price: z.number().int().nonnegative(),
  hourlyRate: z.number().nonnegative(),
  features: z.array(z.string()).default([]),
  active: z.boolean().default(true),
  durationDays: z.number().int().positive().optional(),
  description: z.string().max(500).optional().or(z.literal("")),
  note: z.string().max(500).optional().or(z.literal("")),
});
export type AdminCreatePlanInput = z.infer<typeof adminCreatePlanSchema>;

export const adminUpdatePlanSchema = adminCreatePlanSchema.extend({
  id: z.string().min(1).max(32),
});
export type AdminUpdatePlanInput = z.infer<typeof adminUpdatePlanSchema>;

export const adminDeletePlanSchema = z.object({ id: z.string().min(1) });
export type AdminDeletePlanInput = z.infer<typeof adminDeletePlanSchema>;

export const adminListPlanVersionsSchema = z.object({
  planId: z.string().min(1),
  limit: z.number().int().positive().max(100).default(30),
});

export const adminOpsTaskPrioritySchema = z.enum(["low", "medium", "high", "critical"]);
export const adminOpsTaskStatusSchema = z.enum([
  "pending",
  "in_progress",
  "completed",
  "cancelled",
]);
export const adminOpsTaskCategorySchema = z.enum([
  "operations",
  "finance",
  "support",
  "product",
  "compliance",
  "marketing",
  "other",
]);

export const adminCreateOpsTaskSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(2000).optional().or(z.literal("")),
  category: adminOpsTaskCategorySchema,
  priority: adminOpsTaskPrioritySchema,
  status: adminOpsTaskStatusSchema.default("pending"),
  assigneeUid: z.string().min(1).optional(),
  deadlineAt: z.number().int().positive().optional(),
  reminderAt: z.number().int().positive().optional(),
  comment: z.string().max(500).optional().or(z.literal("")),
});
export type AdminCreateOpsTaskInput = z.infer<typeof adminCreateOpsTaskSchema>;

export const adminUpdateOpsTaskSchema = adminCreateOpsTaskSchema
  .partial()
  .extend({
    id: z.string().min(1),
  });
export type AdminUpdateOpsTaskInput = z.infer<typeof adminUpdateOpsTaskSchema>;

export const adminListOpsTasksSchema = z.object({
  category: adminOpsTaskCategorySchema.optional(),
  priority: adminOpsTaskPrioritySchema.optional(),
  status: adminOpsTaskStatusSchema.optional(),
  assigneeUid: z.string().min(1).optional(),
  limit: z.number().int().positive().max(500).default(100),
});
export type AdminListOpsTasksInput = z.infer<typeof adminListOpsTasksSchema>;

export const adminDeleteOpsTaskSchema = z.object({ id: z.string().min(1) });
export type AdminDeleteOpsTaskInput = z.infer<typeof adminDeleteOpsTaskSchema>;

export const adminListWithdrawalsSchema = z.object({
  status: z.enum(["all", "pending", "paid", "rejected"]).default("all"),
  search: z.string().max(120).optional().or(z.literal("")),
  fromMs: z.number().int().positive().optional(),
  toMs: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(1000).default(500),
  minAmount: z.number().int().nonnegative().optional(),
  maxAmount: z.number().int().nonnegative().optional(),
});
export type AdminListWithdrawalsInput = z.infer<typeof adminListWithdrawalsSchema>;

export const adminExportWithdrawalsCsvSchema = adminListWithdrawalsSchema.omit({ limit: true });
export type AdminExportWithdrawalsCsvInput = z.infer<typeof adminExportWithdrawalsCsvSchema>;

export const adminExportUsersCsvSchema = z.object({
  search: z.string().max(120).optional().or(z.literal("")),
  status: z.enum(["all", "active", "banned", "pending"]).default("all"),
  role: z.enum(["all", "user", "admin", "vip"]).default("all"),
});
export type AdminExportUsersCsvInput = z.infer<typeof adminExportUsersCsvSchema>;

export const adminUpdateSettingsSchema = z.object({
  referralBonus: z.number().nonnegative().optional(),
  withdrawalFeePct: z.number().min(0).max(1).optional(),
  withdrawalProcessingFeePct: z.number().min(0).max(1).optional(),
  minWithdrawal: z.number().int().nonnegative().optional(),
  maxWithdrawal: z.number().int().nonnegative().optional(),
  duplicateWithdrawalWindowMs: z.number().int().positive().optional(),
  maxBankAccounts: z.number().int().positive().max(20).optional(),
  note: z.string().max(500).optional().or(z.literal("")),
});
export type AdminUpdateSettingsInput = z.infer<typeof adminUpdateSettingsSchema>;
