"use client";

import * as React from "react";
import { type LucideIcon, TrendingUp, TrendingDown, Minus, HelpCircle } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);

  return matches;
}

function twClassToHex(className: string, fallback = "#FFC400"): string {
  if (className.startsWith("#")) return className;
  const map: Record<string, string> = {
    "text-apron-gold": "#FFC400",
    "text-apron-pink": "#FF6B9D",
    "text-green-300": "#86EFAC",
    "text-white/70": "#B3B3B3",
    "text-white/60": "#999999",
    "text-red-300": "#FCA5A5",
    "text-red-400": "#F87171",
    "text-sky-400": "#38BDF8",
    "text-emerald-400": "#34D399",
    "text-amber-400": "#FBBF24",
  };
  return map[className] ?? fallback;
}

interface TrendProps {
  value: number;
  label?: string;
  direction?: "up" | "down" | "flat";
}

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  iconColor?: string;
  sublabel?: React.ReactNode;
  valueClassName?: string;
  className?: string;
  trend?: TrendProps | null;
  tooltip?: React.ReactNode;
  sparklineData?: { label: string; value: number }[];
  sparklineColor?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  iconColor = "text-apron-gold",
  sublabel,
  valueClassName,
  className,
  trend,
  tooltip,
  sparklineData,
  sparklineColor = "text-apron-gold",
}: StatCardProps) {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [tooltipOpen, setTooltipOpen] = React.useState(false);
  const gradId = React.useId();

  const strokeHex = twClassToHex(sparklineColor);

  const TrendIcon = trend?.direction === "up"
    ? TrendingUp
    : trend?.direction === "down"
      ? TrendingDown
      : Minus;

  const trendPillClasses = trend?.direction === "up"
    ? "border-apron-gold/30 text-apron-gold bg-apron-gold/10"
    : trend?.direction === "down"
      ? "border-red-400/30 text-red-300 bg-red-400/10"
      : "border-white/20 text-white/60 bg-white/5";

  return (
    <Card
      className={cn(
        "!p-4 transition-transform duration-200 hover:-translate-y-0.5 focus-visible:-translate-y-0.5 outline-none",
        className,
      )}
      tabIndex={0}
    >
      <CardContent className="!pt-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-medium uppercase tracking-wide text-white/60">
                {label}
              </div>
              {tooltip ? (
                <div
                  className="relative"
                  onMouseEnter={() => setTooltipOpen(true)}
                  onMouseLeave={() => setTooltipOpen(false)}
                  onFocus={() => setTooltipOpen(true)}
                  onBlur={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setTooltipOpen(false);
                    }
                  }}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    aria-label="Stat info"
                    type="button"
                  >
                    <HelpCircle size={14} />
                  </Button>
                  {tooltipOpen ? (
                    <div
                      role="tooltip"
                      className={cn(
                        "absolute right-0 top-full mt-1 glass !rounded-xl !p-2 text-xs text-white/80 max-w-[220px] z-10 border border-white/15",
                      )}
                    >
                      {tooltip}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="flex items-center justify-between gap-2 mt-1.5">
              <div
                className={cn(
                  "text-xl font-semibold text-white truncate",
                  valueClassName,
                )}
              >
                {value}
              </div>
              {trend ? (
                <div
                  className={cn(
                    "shrink-0 inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 border font-medium",
                    trendPillClasses,
                  )}
                >
                  <TrendIcon size={12} />
                  <span>
                    {trend.value > 0 ? "+" : ""}
                    {trend.value.toFixed(1)}%
                  </span>
                </div>
              ) : null}
            </div>
            {sublabel ? (
              <div className="mt-1 text-xs text-white/60">{sublabel}</div>
            ) : null}
            {sparklineData && sparklineData.length > 0 ? (
              <div className="mt-3 -mx-1 mb-1 h-[42px]">
                <ResponsiveContainer width="100%" height={42}>
                  <AreaChart data={sparklineData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                    <defs>
                      <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={strokeHex} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={strokeHex} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke={strokeHex}
                      strokeWidth={2}
                      fill={`url(#${gradId})`}
                      isAnimationActive={!reducedMotion}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : null}
          </div>
          {Icon ? (
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 border border-white/20",
                iconColor,
              )}
            >
              <Icon size={18} />
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
