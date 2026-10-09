"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { RefreshCw, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatAPN } from "@/lib/utils";
import { refreshDashboardRateAction } from "@/server/actions/userActions";
import type { PlanDoc } from "@/types";

function useMediaQueryClient(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);
  return matches;
}

interface HourlyRateCardProps {
  initialRate: number;
  planDoc?: PlanDoc;
}

interface RateBucket {
  hourISO: string;
  t: number;
  value: number;
  hourTick: string;
}

export function HourlyRateCard({ initialRate, planDoc }: HourlyRateCardProps) {
  const reducedMotion = useMediaQueryClient("(prefers-reduced-motion: reduce)");
  const [, startTx] = useTransition();
  const [loading, setLoading] = useState(false);

  const makeInitialBuckets = (rate: number): RateBucket[] => {
    const now = Date.now();
    const out: RateBucket[] = [];
    for (let i = 23; i >= 0; i--) {
      const t = now - i * 60 * 60 * 1000;
      out.push({
        hourISO: new Date(t).toISOString(),
        t,
        value: rate,
        hourTick: new Date(t).toLocaleTimeString("en-NG", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      });
    }
    return out;
  };

  const [rateData, setRateData] = useState<{
    currentRate: number;
    buckets: RateBucket[];
    fluctuation: { pct: number | null; dir: "up" | "down" | "flat" };
  }>({
    currentRate: initialRate,
    buckets: makeInitialBuckets(initialRate),
    fluctuation: { pct: null, dir: "flat" },
  });

  const refresh = useCallback(() => {
    setLoading(true);
    startTx(async () => {
      try {
        const res = await refreshDashboardRateAction();
        if (res.ok) {
          const buckets: RateBucket[] = res.data.trend24h.map((b) => ({
            hourISO: new Date(b.t).toISOString(),
            t: b.t,
            value: b.value,
            hourTick: new Date(b.t).toLocaleTimeString("en-NG", {
              hour: "2-digit",
              minute: "2-digit",
            }),
          }));
          setRateData({
            currentRate: res.data.apnRate,
            buckets,
            fluctuation: res.data.fluctuation,
          });
        }
      } finally {
        setLoading(false);
      }
    });
  }, [startTx]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 3_600_000);
    return () => clearInterval(id);
  }, [refresh]);

  const { fluctuation } = rateData;
  const FluctIcon =
    fluctuation.dir === "up"
      ? TrendingUp
      : fluctuation.dir === "down"
        ? TrendingDown
        : Minus;
  const fluctClasses =
    fluctuation.dir === "up"
      ? "border-apron-gold/30 text-apron-gold bg-apron-gold/10"
      : fluctuation.dir === "down"
        ? "border-red-400/30 text-red-300 bg-red-400/10"
        : "border-white/20 text-white/60 bg-white/5";

  return (
    <Card aria-busy={loading}>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">
            Hourly APN rate Trend (24h)
          </CardTitle>
          <p className="mt-0.5 text-xs text-white/60">
            {planDoc?.name ?? "Plan"} · live rate per hour
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 border font-medium ${fluctClasses}`}
          >
            <FluctIcon size={12} />
            <span>
              {fluctuation.pct == null
                ? "—"
                : `${fluctuation.pct > 0 ? "+" : ""}${fluctuation.pct.toFixed(2)}%`}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="Refresh rate trend"
            type="button"
            disabled={loading}
            onClick={refresh}
          >
            <RefreshCw
              size={14}
              className={loading ? "animate-spin" : ""}
            />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between mb-3">
          <div>
            <div className="text-xs text-white/60 uppercase tracking-wide">
              Current
            </div>
            <div className="text-2xl font-semibold text-gradient-gold">
              {formatAPN(rateData.currentRate)}
              <span className="text-white/60 text-sm font-normal ml-1">
                / hour
              </span>
            </div>
          </div>
        </div>
        <div className="w-full h-[110px] -mx-2">
          <ResponsiveContainer width="100%" height={110}>
            <LineChart
              data={rateData.buckets}
              margin={{ top: 5, right: 10, bottom: 5, left: -20 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.08)"
              />
              <XAxis
                dataKey="hourTick"
                stroke="#ffffff40"
                tick={{ fill: "#ffffff60", fontSize: 10 }}
                tickLine={false}
                interval={5}
                axisLine={false}
              />
              <YAxis hide />
              <Tooltip
                contentStyle={{
                  background: "rgba(20,20,30,0.85)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: "0.75rem",
                  color: "#fff",
                  fontSize: 12,
                  backdropFilter: "blur(8px)",
                }}
                itemStyle={{ color: "#FFC400" }}
                labelStyle={{
                  color: "rgba(255,255,255,0.7)",
                  fontSize: 11,
                }}
                formatter={(v: number) => [formatAPN(v), "Rate"]}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#FFC400"
                strokeWidth={2.5}
                dot={false}
                isAnimationActive={!reducedMotion}
                activeDot={{ fill: "#FFC400", r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export default HourlyRateCard;
