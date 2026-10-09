import type { PlanId, SettingsDoc, UserDoc } from "@/types";
import { PLAN_IDS } from "@/lib/constants";

const TIER_MULTIPLIERS: Record<PlanId, number> = {
  [PLAN_IDS.starter]: 1,
  [PLAN_IDS.pro]: 3,
  [PLAN_IDS.elite]: 5,
};

export function getTierMultiplier(plan: PlanId): number {
  return TIER_MULTIPLIERS[plan] ?? 1;
}

export function floorHourBucketOf(nowMs: number): string {
  const d = new Date(nowMs);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  return `${yyyy}${mm}${dd}${hh}`;
}

export function floorHourTs(nowMs: number): number {
  const d = new Date(nowMs);
  d.setUTCMinutes(0, 0, 0);
  return d.getTime();
}

export type ProjectionResult = {
  projectedBalance: number;
  projectedTaskBalance: number;
  accruableHours: number;
  accrualAmount: number;
  effectiveRatePerHour: number;
  tierMultiplier: number;
  inactivityTimeout: boolean;
  capped: boolean;
  fromHour: string;
  toHour: string;
  reason:
    | "ok"
    | "inactive_too_long"
    | "plan_inactive"
    | "zero_rate"
    | "at_cap"
    | "no_claims_yet";
};

export function projectUserAccrualBalance(
  user: UserDoc,
  settings: SettingsDoc,
  nowMs: number = Date.now(),
  planHourlyRateOverride?: number,
): ProjectionResult {
  const tierMult = getTierMultiplier(user.plan as PlanId);
  const baseRate = typeof planHourlyRateOverride === "number"
    ? planHourlyRateOverride
    : (user.apnRate ?? 0);
  const effRate = baseRate * tierMult;
  const cap = settings.globalAccrualCapAPN ?? 100_000;
  const inactivityDays = settings.hourlyInactivityDays ?? 30;
  const inactivityCutoff = nowMs - inactivityDays * 24 * 3600 * 1000;

  const lastClaim = user.lastHourlyClaimAt ?? user.createdAt ?? nowMs;
  const fromHourTs = floorHourTs(lastClaim);
  const toHourTs = floorHourTs(nowMs);
  const fromHour = floorHourBucketOf(lastClaim);
  const toHour = floorHourBucketOf(nowMs);

  const planActive = user.planExpiresAt === null || user.planExpiresAt > nowMs;
  const lastActivity = Math.max(user.updatedAt ?? 0, lastClaim);
  const inactive = lastActivity < inactivityCutoff;

  const currentBalance = user.taskBalance ?? 0;

  if (!planActive) {
    return {
      projectedBalance: user.balance ?? 0,
      projectedTaskBalance: currentBalance,
      accruableHours: 0,
      accrualAmount: 0,
      effectiveRatePerHour: effRate,
      tierMultiplier: tierMult,
      inactivityTimeout: inactive,
      capped: false,
      fromHour,
      toHour,
      reason: "plan_inactive",
    };
  }
  if (inactive) {
    return {
      projectedBalance: user.balance ?? 0,
      projectedTaskBalance: currentBalance,
      accruableHours: 0,
      accrualAmount: 0,
      effectiveRatePerHour: effRate,
      tierMultiplier: tierMult,
      inactivityTimeout: true,
      capped: false,
      fromHour,
      toHour,
      reason: "inactive_too_long",
    };
  }
  if (effRate <= 0) {
    return {
      projectedBalance: user.balance ?? 0,
      projectedTaskBalance: currentBalance,
      accruableHours: 0,
      accrualAmount: 0,
      effectiveRatePerHour: effRate,
      tierMultiplier: tierMult,
      inactivityTimeout: false,
      capped: false,
      fromHour,
      toHour,
      reason: "zero_rate",
    };
  }

  const hourDiffMs = toHourTs - fromHourTs;
  let accruableHours = Math.max(0, Math.floor(hourDiffMs / (3600 * 1000)));

  if (accruableHours === 0 && !user.lastHourlyClaimAt) {
    return {
      projectedBalance: user.balance ?? 0,
      projectedTaskBalance: currentBalance,
      accruableHours: 0,
      accrualAmount: 0,
      effectiveRatePerHour: effRate,
      tierMultiplier: tierMult,
      inactivityTimeout: false,
      capped: false,
      fromHour,
      toHour,
      reason: "no_claims_yet",
    };
  }

  let rawAccrual = accruableHours * effRate;
  let capped = false;
  const headroom = Math.max(0, cap - currentBalance);
  if (rawAccrual > headroom) {
    rawAccrual = headroom;
    accruableHours = Math.floor(headroom / Math.max(effRate, 1e-9));
    capped = true;
  }
  if (rawAccrual < 0) rawAccrual = 0;

  const newTaskBalance = currentBalance + rawAccrual;

  return {
    projectedBalance: user.balance ?? 0,
    projectedTaskBalance: newTaskBalance,
    accruableHours,
    accrualAmount: rawAccrual,
    effectiveRatePerHour: effRate,
    tierMultiplier: tierMult,
    inactivityTimeout: false,
    capped,
    fromHour,
    toHour,
    reason: capped ? "at_cap" : "ok",
  };
}
