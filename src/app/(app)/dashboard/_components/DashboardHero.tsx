"use client";

import { useTransition, useState } from "react";
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

export function DashboardHero({ user, apnRate, planDoc }: DashboardHeroProps) {
  const [, startTx] = useTransition();
  const [claiming, setClaiming] = useState(false);

  const handleClaim = () => {
    setClaiming(true);
    startTx(async () => {
      try {
        await claimHourlyAccrualAction();
      } finally {
        setClaiming(false);
      }
    });
  };

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
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleClaim}
          disabled={claiming}
        >
          <Sparkles size={14} />
          Claim
        </Button>
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
