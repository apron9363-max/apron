import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { projectUserAccrualBalance, getTierMultiplier, floorHourTs, floorHourBucketOf } from "@/lib/hourly-math";
import type { PlanId, SettingsDoc, UserDoc } from "@/types";

const MS_H = 3600 * 1000;

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

function approxEq(a: number, b: number, eps = 0.01) {
  return Math.abs(a - b) <= eps;
}

function baseSettings(): SettingsDoc {
  return {
    id: "platform",
    referralBonus: 50,
    withdrawalFeePct: 0.05,
    minWithdrawal: 1000,
    hourlyInactivityDays: 30,
    globalAccrualCapAPN: 100_000,
  };
}

function baseUser(overrides: Partial<UserDoc> = {}): UserDoc {
  const now = Date.now();
  return {
    uid: "test-hourly-user",
    name: "Test User",
    email: "test-hourly@example.com",
    phone: "+10000000000",
    role: "user",
    plan: "starter",
    planExpiresAt: null,
    balance: 0,
    taskBalance: 0,
    apnRate: 10,
    referralCode: "TEST1234",
    referredBy: null,
    referralPaidOut: false,
    bankDetails: null,
    status: "active",
    emailVerified: true,
    createdAt: now - 90 * MS_H,
    updatedAt: now - 2 * MS_H,
    lastHourlyClaimAt: now - 5 * MS_H,
    ...overrides,
  };
}

console.log("== test-hourly-math ==");
console.log();

/* --- Tier multiplier tests --- */
console.log("-- Tier multipliers --");
assert("starter x1", getTierMultiplier("starter" as PlanId) === 1);
assert("pro x3", getTierMultiplier("pro" as PlanId) === 3);
assert("elite x5", getTierMultiplier("elite" as PlanId) === 5);
assert("unknown falls back to x1", getTierMultiplier("bogus" as PlanId) === 1);

/* --- floor helper tests --- */
console.log("-- floor helpers --");
{
  const ts = Date.UTC(2025, 5, 15, 14, 35, 22);
  const bucket = floorHourBucketOf(ts);
  assert("bucket is yyyymmddhh format", bucket.length === 10, bucket);
  const fts = floorHourTs(ts);
  const d = new Date(fts);
  assert("floorHourTs zeroes minutes", d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0);
}

/* --- first-time claim case --- */
console.log("-- First-time claim --");
{
  const now = Date.now();
  const user = baseUser({ lastHourlyClaimAt: undefined, updatedAt: now, createdAt: now });
  const res = projectUserAccrualBalance(user, baseSettings(), now);
  assert("no_claims_yet reason for first-time claimer", res.reason === "no_claims_yet", `reason=${res.reason}`);
  assert("accrualAmount = 0 for first claim", res.accrualAmount === 0, `amount=${res.accrualAmount}`);
}

/* --- 0 hours since last claim --- */
console.log("-- 0h diff --");
{
  const now = Date.now();
  const then = floorHourTs(now);
  const user = baseUser({ lastHourlyClaimAt: then });
  const res = projectUserAccrualBalance(user, baseSettings(), then);
  assert("0h diff accruableHours=0", res.accruableHours === 0);
  assert("0h diff amount=0", res.accrualAmount === 0);
}

/* --- 1 hour at starter 10 APN --- */
console.log("-- 1h starter 10APN x1 = 10 --");
{
  const now = Date.now();
  const then = floorHourTs(now) - 1 * MS_H;
  const user = baseUser({ lastHourlyClaimAt: then, plan: "starter", apnRate: 10 });
  const res = projectUserAccrualBalance(user, baseSettings(), now);
  assert("accruableHours=1", res.accruableHours === 1, `got ${res.accruableHours}`);
  assert("accrualAmount=10", approxEq(res.accrualAmount, 10), `got ${res.accrualAmount}`);
  assert("reason ok", res.reason === "ok");
  assert("effectiveRate = 10 x1 = 10", approxEq(res.effectiveRatePerHour, 10));
}

/* --- 24 hours pro rate x3 --- */
console.log("-- 24h pro 5 APN x3 = 360 --");
{
  const now = Date.now();
  const then = floorHourTs(now) - 24 * MS_H;
  const user = baseUser({ lastHourlyClaimAt: then, plan: "pro", apnRate: 5 });
  const res = projectUserAccrualBalance(user, baseSettings(), now);
  assert("accruableHours=24", res.accruableHours === 24, `got ${res.accruableHours}`);
  assert("accrualAmount=360 (5*24*3)", approxEq(res.accrualAmount, 360), `got ${res.accrualAmount}`);
  assert("tier multiplier=3", res.tierMultiplier === 3);
}

/* --- elite x5 -- */
console.log("-- 10h elite 2 x5 = 100 --");
{
  const now = Date.now();
  const then = floorHourTs(now) - 10 * MS_H;
  const user = baseUser({ lastHourlyClaimAt: then, plan: "elite", apnRate: 2 });
  const res = projectUserAccrualBalance(user, baseSettings(), now);
  assert("accrualAmount=100", approxEq(res.accrualAmount, 100), `got ${res.accrualAmount}`);
}

/* --- 1000 hours huge window, cap must apply --- */
console.log("-- 1000h with cap=100k truncates --");
{
  const now = Date.now();
  const then = floorHourTs(now) - 1000 * MS_H;
  const user = baseUser({
    lastHourlyClaimAt: then,
    plan: "elite",
    apnRate: 20,
    taskBalance: 0,
  });
  const settings = { ...baseSettings(), globalAccrualCapAPN: 5000 };
  const res = projectUserAccrualBalance(user, settings, now);
  assert("capped flag true", res.capped === true);
  assert("accrualAmount <= 5000 cap", res.accrualAmount <= 5000 && res.accrualAmount > 0);
  assert("reason at_cap", res.reason === "at_cap", res.reason);
  assert("projectedTaskBalance ~ 5000", approxEq(res.projectedTaskBalance, 5000, 1e-6), `got ${res.projectedTaskBalance}`);
}

/* --- zero base rate --- */
console.log("-- zero rate case --");
{
  const now = Date.now();
  const then = floorHourTs(now) - 5 * MS_H;
  const user = baseUser({ lastHourlyClaimAt: then, apnRate: 0 });
  const res = projectUserAccrualBalance(user, baseSettings(), now);
  assert("reason zero_rate", res.reason === "zero_rate");
  assert("amount zero", res.accrualAmount === 0);
}

/* --- plan expired --- */
console.log("-- plan expired case --");
{
  const now = Date.now();
  const then = floorHourTs(now) - 3 * MS_H;
  const user = baseUser({ lastHourlyClaimAt: then, planExpiresAt: now - 1000 });
  const res = projectUserAccrualBalance(user, baseSettings(), now);
  assert("reason plan_inactive", res.reason === "plan_inactive");
  assert("amount zero", res.accrualAmount === 0);
}

/* --- inactivity timeout --- */
console.log("-- inactivity timeout (31 days) --");
{
  const now = Date.now();
  const then30dAgo = now - 31 * 24 * MS_H;
  const user = baseUser({
    lastHourlyClaimAt: then30dAgo + 2 * MS_H,
    updatedAt: then30dAgo,
    createdAt: then30dAgo - 10 * MS_H,
  });
  const settings = baseSettings();
  const res = projectUserAccrualBalance(user, settings, now);
  assert("inactivityTimeout true", res.inactivityTimeout === true);
  assert("reason inactive_too_long", res.reason === "inactive_too_long");
  assert("amount zero", res.accrualAmount === 0);
}

/* --- inactivity ok at 10 days --- */
console.log("-- inactivity ok 10 days --");
{
  const now = Date.now();
  const then10dAgo = now - 10 * 24 * MS_H;
  const user = baseUser({
    lastHourlyClaimAt: now - 2 * MS_H,
    updatedAt: then10dAgo,
    createdAt: then10dAgo - 10 * MS_H,
    plan: "starter",
    apnRate: 10,
  });
  const res = projectUserAccrualBalance(user, baseSettings(), now);
  assert("inactivityTimeout false", res.inactivityTimeout === false);
  assert("hours 2", res.accruableHours === 2, `got ${res.accruableHours}`);
  assert("reason ok", res.reason === "ok", res.reason);
}

/* --- plan override rate --- */
console.log("-- planHourlyRate override --");
{
  const now = Date.now();
  const then = floorHourTs(now) - 1 * MS_H;
  const user = baseUser({ lastHourlyClaimAt: then, plan: "starter", apnRate: 999 });
  const res = projectUserAccrualBalance(user, baseSettings(), now, 20);
  assert("override 20 x1 = 20", approxEq(res.effectiveRatePerHour, 20) && approxEq(res.accrualAmount, 20));
}

/* --- summary --- */
console.log();
console.log("== Summary ==");
console.log(`PASS=${PASS}  FAIL=${FAIL}`);
process.exit(FAIL === 0 ? 0 : 1);
