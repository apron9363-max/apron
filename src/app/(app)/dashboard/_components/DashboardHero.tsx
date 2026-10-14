"use client";

import { useTransition, useState, useEffect, useCallback } from "react";
import { Sparkles, Clock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatAPN } from "@/lib/utils";
import {
  claimHourlyAccrualAction,
} from "@/server/actions/userActions";
import type { UserDoc, PlanDoc } from "@/types";
import { HeroRateRefresh } from "./ReferralTools";

interface DashboardHeroProps {
  user: UserDoc;
  apnRate: number;
  planDoc?: PlanDoc | null;
}

const COOLDOWN_MS = 60 * 60 * 1000;

function formatRemaining(ms: number): string {
  if (ms <= 0) return "0m 0s";
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

export function DashboardHero({ user, apnRate, planDoc }: DashboardHeroProps) {
  const [, startTx] = useTransition();
  const [claiming, setClaiming] = useState(false);
  const [lastClaimAt, setLastClaimAt] = useState<number | null>(
    typeof user.lastHourlyClaimAt === "number" ? user.lastHourlyClaimAt : null,
  );
  const [now, setNow] = useState<number>(Date.now());

  // Tick every second to drive the countdown timer.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remainingMs = lastClaimAt ? Math.max(0, lastClaimAt + COOLDOWN_MS - now) : 0;
  const onCooldown = remainingMs > 0;

  const handleClaim = useCallback(() => {
    if (onCooldown || claiming) return;
    setClaiming(true);
    startTx(async () => {
      try {
        const res = await claimHourlyAccrualAction();
        if (res?.ok) {
          setLastClaimAt(Date.now());
        } else if (res?.cooldown && typeof res.waitMs === "number") {
          // Sync client cooldown with the server-enforced window.
          setLastClaimAt(Date.now() + res.waitMs - COOLDOWN_MS);
        }
      } finally {
        setClaiming(false);
      }
    });
  }, [onCooldown, claiming]);

  return (
    <section className="glass p-5 md:p-6 lg:p-7">
      <div className="flex items-center gap-3 md:gap-4">
        <div className="flex h-12 w-12 md:h-14 md:w-14 items-center justify-center rounded-2xl bg-apron-gold/15 border border-apron-gold/30 text-apron-gold font-bold text-lg md:text-xl">
          {user.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm text-white/60 md:text-base">Welcome back,</div>
          <div className="truncate text-lg font-semibold text-white md:text-xl-plus">
            {user.name}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleClaim}
            disabled={claiming || onCooldown}
            aria-disabled={claiming || onCooldown}
          >
            <Sparkles size={14} />
            {claiming ? "Claiming…" : onCooldown ? "Claimed" : "Claim"}
          </Button>
          {onCooldown ? (
            <span className="text-[11px] text-white/50 flex items-center gap-1">
              <Clock size={11} className="text-apron-gold" />
              Next in {formatRemaining(remainingMs)}
            </span>
          ) : (
            <span className="text-[11px] text-apron-gold/80">Available now</span>
          )}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between rounded-2xl bg-white/5 border border-white/10 px-4 py-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-white/60">
            Hourly coin rate
          </div>
          <div className="text-lg font-semibold text-gradient-gold">
            {formatAPN(apnRate)} / hour
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/70">
          <Clock size={14} className="text-apron-gold" />
          Plan:{" "}
          <span className="capitalize font-semibold text-white">
            {planDoc?.name ?? user.plan}
          </span>
          <HeroRateRefresh />
        </div>
      </div>
    </section>
  );
}

export default DashboardHero;
