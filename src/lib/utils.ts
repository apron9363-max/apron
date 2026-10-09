import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { v4 as uuidv4 } from "uuid";
import type { BalanceSnapshot } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNaira(amount: number): string {
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `₦${amount.toFixed(0)}`;
  }
}

export function formatAPN(amount: number): string {
  return `${amount.toFixed(2)} APN`;
}

export function formatDateTime(ms: number): string {
  try {
    return new Date(ms).toLocaleString("en-NG", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return new Date(ms).toISOString();
  }
}

export function generateReferralCode(length = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.getRandomValues === "function"
  ) {
    const arr = new Uint32Array(length);
    crypto.getRandomValues(arr);
    for (let i = 0; i < length; i++) {
      out += chars[arr[i] % chars.length];
    }
  } else {
    for (let i = 0; i < length; i++) {
      out += chars[Math.floor(Math.random() * chars.length)];
    }
  }
  return out;
}

export function generateTransactionId(): string {
  const hex = uuidv4().replace(/-/g, "").slice(0, 16).toUpperCase();
  return `APN-${hex}`;
}

export function computeBalanceTrend(history: BalanceSnapshot[]): {
  value: number;
  direction: "up" | "down" | "flat";
} {
  if (!Array.isArray(history) || history.length < 2) {
    return { value: 0, direction: "flat" };
  }
  const sorted = history.slice().sort((a, b) => a.at - b.at);
  const mid = Math.floor(sorted.length / 2);
  const firstHalf = sorted.slice(0, Math.max(1, mid));
  const secondHalf = sorted.slice(Math.max(1, mid));
  const firstAvg =
    firstHalf.reduce((s, x) => s + x.balance, 0) / firstHalf.length;
  const secondAvg =
    secondHalf.reduce((s, x) => s + x.balance, 0) / secondHalf.length;
  if (firstAvg <= 0 && secondAvg <= 0) {
    return { value: 0, direction: "flat" };
  }
  if (firstAvg <= 0 && secondAvg > 0) {
    return { value: 100, direction: "up" };
  }
  const pct = ((secondAvg - firstAvg) / Math.abs(firstAvg)) * 100;
  const direction: "up" | "down" | "flat" =
    pct > 0.5 ? "up" : pct < -0.5 ? "down" : "flat";
  return { value: Number(pct.toFixed(1)), direction };
}

export function computeHistoricalTrend(
  history: BalanceSnapshot[],
  historicalSum30d: number,
): { value: number; direction: "up" | "down" | "flat" } {
  if (!Array.isArray(history) || history.length < 2) {
    return { value: 0, direction: "flat" };
  }
  const sorted = history.slice().sort((a, b) => a.at - b.at);
  const first = sorted[0].balance;
  const last = sorted[sorted.length - 1].balance;
  const delta = last - first;
  if (historicalSum30d <= 0 && delta <= 0) {
    return { value: 0, direction: "flat" };
  }
  const base = Math.max(historicalSum30d - delta, 1);
  const pct = (delta / base) * 100;
  const direction: "up" | "down" | "flat" =
    pct > 0.5 ? "up" : pct < -0.5 ? "down" : "flat";
  return { value: Number(pct.toFixed(1)), direction };
}

export function buildBalanceSparklineData(
  history: BalanceSnapshot[],
): { label: string; value: number }[] {
  return history
    .slice()
    .sort((a, b) => a.at - b.at)
    .map((x) => ({
      label: new Date(x.at).toLocaleDateString("en-NG", {
        day: "2-digit",
        month: "short",
      }),
      value: x.balance,
    }));
}
