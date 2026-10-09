"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  Users,
  Banknote,
  Wallet,
  TrendingUp,
  Coins,
  ChevronRight,
  Crown,
  Search,
  Edit2,
  CheckCircle2,
  Calendar,
  Activity,
  BarChart2,
  UserCheck,
  Download,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  Area,
  AreaChart,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  adminGetOverviewAction,
  adminListUsersAction,
} from "@/server/actions/adminActions";
import { formatAPN, formatDateTime, formatNaira } from "@/lib/utils";
import type { UserDoc } from "@/types";
import { cn } from "@/lib/utils";

type Overview = {
  totalUsers: number;
  activeUsers7d: number;
  totalWithdrawalsAmount: number;
  totalWithdrawalsCount: number;
  pendingWithdrawals: number;
  pendingWithdrawalsAmount: number;
  paidWithdrawalsCount: number;
  paidWithdrawalsAmount: number;
  revenueEstimate: number;
  withdrawalsToday: number;
  withdrawalsTodayCount: number;
  earningsSeries: Array<{ day: string; amount: number }>;
  withdrawalsSeries: Array<{ day: string; paid: number; pending: number; count: number }>;
};

const PRESETS = [
  { key: "7d", label: "7D", fromMs: () => Date.now() - 7 * 24 * 60 * 60 * 1000 },
  { key: "14d", label: "14D", fromMs: () => Date.now() - 14 * 24 * 60 * 60 * 1000 },
  { key: "30d", label: "30D", fromMs: () => Date.now() - 30 * 24 * 60 * 60 * 1000 },
  { key: "90d", label: "90D", fromMs: () => Date.now() - 90 * 24 * 60 * 60 * 1000 },
  { key: "all", label: "All", fromMs: () => 0 },
] as const;

type PresetKey = (typeof PRESETS)[number]["key"];

function toLocalDateInput(v: number) {
  const d = new Date(v);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function fromLocalDateInput(v: string, end = false): number {
  if (!v) return 0;
  const d = new Date(v);
  if (end) {
    d.setHours(23, 59, 59, 999);
  } else {
    d.setHours(0, 0, 0, 0);
  }
  return d.getTime();
}

export default function AdminOverviewClient() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [query, setQuery] = useState("");
  const [, startTx] = useTransition();
  const [loading, setLoading] = useState(true);

  const [preset, setPreset] = useState<PresetKey>("30d");
  const initialFrom = useMemo(() => toLocalDateInput(Date.now() - 30 * 24 * 60 * 60 * 1000), []);
  const initialTo = useMemo(() => toLocalDateInput(Date.now()), []);
  const [fromStr, setFromStr] = useState<string>(initialFrom);
  const [toStr, setToStr] = useState<string>(initialTo);

  const load = useCallback(() => {
    setLoading(true);
    const fromMs = preset ? PRESETS.find((p) => p.key === preset)!.fromMs() : fromLocalDateInput(fromStr);
    const toMs = preset ? Date.now() : fromLocalDateInput(toStr, true);
    startTx(async () => {
      try {
        const [oRes, uRes] = await Promise.all([
          adminGetOverviewAction({
            fromMs: fromMs,
            toMs,
          } as any),
          adminListUsersAction({ limit: 8, sortBy: "createdAt", sortDir: "desc" } as any),
        ]);
        const overviewResp = (oRes as any)?.overview ?? null;
        const usersResp = (uRes as any)?.users ?? [];
        setOverview(overviewResp);
        setUsers(usersResp);
      } finally {
        setLoading(false);
      }
    });
  }, [preset, fromStr, toStr]);

  useEffect(load, [load]);

  const filtered = users.filter(
    (u) =>
      !query ||
      u.name.toLowerCase().includes(query.toLowerCase()) ||
      u.email.toLowerCase().includes(query.toLowerCase()) ||
      u.referralCode.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Overview</h1>
          <p className="mt-1 text-sm text-white/60">
            Platform-wide analytics and quick actions.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-end">
          <div className="flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPreset(p.key)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition",
                  preset === p.key
                    ? "bg-apron-gold/20 text-apron-gold border border-apron-gold/40"
                    : "text-white/70 hover:text-white hover:bg-white/5",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-end gap-2">
            <div>
              <label className="text-[10px] uppercase tracking-wide text-white/50 mb-1 block">
                From
              </label>
              <Input
                type="date"
                value={fromStr}
                onChange={(e) => {
                  setFromStr(e.target.value);
                  setPreset("" as any);
                }}
                className="h-9 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wide text-white/50 mb-1 block">
                To
              </label>
              <Input
                type="date"
                value={toStr}
                onChange={(e) => {
                  setToStr(e.target.value);
                  setPreset("" as any);
                }}
                className="h-9 text-xs"
              />
            </div>
            <Button size="sm" onClick={load}>
              <Calendar size={14} /> Apply
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-8 text-center text-white/60 text-sm">
          Loading dashboard…
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total users"
              value={overview?.totalUsers ?? 0}
              icon={Users}
              iconColor="text-apron-gold"
            />
            <StatCard
              label="Active users (7d)"
              value={overview?.activeUsers7d ?? 0}
              icon={UserCheck}
              iconColor="text-green-300"
            />
            <StatCard
              label="Pending withdrawals"
              value={`${overview?.pendingWithdrawals ?? 0} · ${formatNaira(overview?.pendingWithdrawalsAmount ?? 0)}`}
              icon={Wallet}
              iconColor="text-apron-pink"
            />
            <StatCard
              label="Revenue estimate"
              value={formatNaira(overview?.revenueEstimate ?? 0)}
              icon={TrendingUp}
              iconColor="text-apron-gold"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniTile
              icon={Banknote}
              label="Paid today"
              value={`${formatNaira(overview?.withdrawalsToday ?? 0)} · ${overview?.withdrawalsTodayCount ?? 0} tx`}
              color="text-green-300"
            />
            <MiniTile
              icon={Activity}
              label="Total withdrawals"
              value={`${overview?.totalWithdrawalsCount ?? 0} tx · ${formatNaira(overview?.totalWithdrawalsAmount ?? 0)}`}
              color="text-white/90"
            />
            <MiniTile
              icon={Coins}
              label="Paid volume"
              value={formatNaira(overview?.paidWithdrawalsAmount ?? 0)}
              color="text-apron-gold"
            />
            <MiniTile
              icon={BarChart2}
              label="Paid count"
              value={overview?.paidWithdrawalsCount ?? 0}
              color="text-apron-pink"
            />
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex-row items-end justify-between gap-3">
                <div>
                  <CardTitle>Earnings (range)</CardTitle>
                  <p className="mt-0.5 text-xs text-white/60">
                    Daily APN earned across all users.
                  </p>
                </div>
                <div className="text-[11px] text-white/50 flex items-center gap-1">
                  <Activity size={12} />
                  {overview?.earningsSeries.length ?? 0} data points
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={overview?.earningsSeries ?? []}
                      margin={{ top: 10, right: 10, bottom: 10, left: -10 }}
                    >
                      <defs>
                        <linearGradient id="earnGrad" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="5%" stopColor="#FFC400" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#FFC400" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff15" />
                      <XAxis
                        dataKey="day"
                        tick={{ fill: "#ffffff80", fontSize: 11 }}
                        stroke="#ffffff15"
                      />
                      <YAxis tick={{ fill: "#ffffff80", fontSize: 11 }} stroke="#ffffff15" />
                      <Tooltip
                        contentStyle={{
                          background: "#2a0e42",
                          border: "1px solid #ffffff20",
                          borderRadius: 12,
                          color: "#fff",
                          fontSize: 12,
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="amount"
                        stroke="#FFC400"
                        strokeWidth={2.5}
                        fill="url(#earnGrad)"
                        name="Earnings (APN)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-end justify-between gap-3">
                <div>
                  <CardTitle>Withdrawals (range)</CardTitle>
                  <p className="mt-0.5 text-xs text-white/60">
                    Paid vs pending volume per day.
                  </p>
                </div>
                <Link href="/admin/withdrawals" className="text-xs text-apron-gold hover:underline flex items-center gap-1">
                  Withdrawal queue <ChevronRight size={12} />
                </Link>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={overview?.withdrawalsSeries ?? []}
                      margin={{ top: 10, right: 10, bottom: 10, left: -10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff15" />
                      <XAxis
                        dataKey="day"
                        tick={{ fill: "#ffffff80", fontSize: 11 }}
                        stroke="#ffffff15"
                      />
                      <YAxis tick={{ fill: "#ffffff80", fontSize: 11 }} stroke="#ffffff15" />
                      <Tooltip
                        contentStyle={{
                          background: "#2a0e42",
                          border: "1px solid #ffffff20",
                          borderRadius: 12,
                          color: "#fff",
                          fontSize: 12,
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11, color: "#ffffff80" }} />
                      <Line
                        type="monotone"
                        dataKey="paid"
                        stroke="#10B981"
                        strokeWidth={2}
                        dot={{ r: 2, fill: "#10B981" }}
                        name="Paid"
                      />
                      <Line
                        type="monotone"
                        dataKey="pending"
                        stroke="#FFC400"
                        strokeWidth={2}
                        dot={{ r: 2, fill: "#FFC400" }}
                        name="Pending"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex-row items-end justify-between gap-3 flex-wrap">
              <div>
                <CardTitle>Users</CardTitle>
                <p className="mt-0.5 text-xs text-white/60">
                  Latest registered users.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/admin/users"
                  className="text-xs text-apron-gold hover:underline flex items-center gap-1"
                >
                  View all <ChevronRight size={12} />
                </Link>
                <Link
                  href="/admin/users?export=1"
                  className="hidden sm:inline-flex btn-outline h-9 px-3 text-xs items-center gap-1"
                >
                  <Download size={12} /> CSV
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40"
                />
                <Input
                  placeholder="Search name, email, or referral code…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-white/50">
                      <th className="py-2 pr-2">User</th>
                      <th className="py-2 pr-2">Plan</th>
                      <th className="py-2 pr-2">Joined</th>
                      <th className="py-2 pr-2">Balance</th>
                      <th className="py-2 pr-2">Status</th>
                      <th className="py-2 pr-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="text-center text-white/50 py-6 text-sm"
                        >
                          No users match your query.
                        </td>
                      </tr>
                    ) : (
                      filtered.map((u) => (
                        <tr
                          key={u.uid}
                          className="border-t border-white/5"
                        >
                          <td className="py-3 pr-2">
                            <Link
                              href={`/admin/users/${u.uid}`}
                              className="flex items-center gap-2 hover:bg-white/5 -mx-2 px-2 py-1 rounded-lg"
                            >
                              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">
                                {u.name.slice(0, 1).toUpperCase()}
                              </span>
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium text-white">
                                  {u.name}
                                </div>
                                <div className="truncate text-[11px] text-white/50">
                                  {u.email}
                                </div>
                              </div>
                            </Link>
                          </td>
                          <td className="py-3 pr-2 text-xs text-white/80 capitalize">
                            <span className="inline-flex items-center gap-1">
                              <Crown size={12} className="text-apron-gold" />
                              {u.plan}
                            </span>
                          </td>
                          <td className="py-3 pr-2 text-xs text-white/60">
                            {formatDateTime(u.createdAt)}
                          </td>
                          <td className="py-3 pr-2 text-xs text-white/80">
                            {formatAPN(u.balance)}
                          </td>
                          <td className="py-3 pr-2">
                            <span
                              className={cn(
                                "inline-flex rounded-full px-2 py-0.5 text-[10px] uppercase",
                                u.status === "banned"
                                  ? "bg-red-500/15 text-red-300 border border-red-400/30"
                                  : "bg-green-500/15 text-green-300 border border-green-400/30",
                              )}
                            >
                              {u.status}
                            </span>
                          </td>
                          <td className="py-3 pr-2 text-right">
                            <Link href={`/admin/users/${u.uid}`}>
                              <Button size="xs" variant="outline">
                                <Edit2 size={12} /> Edit
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function MiniTile({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="glass !p-3 flex items-center gap-3">
      <span
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5",
          color,
        )}
      >
        <Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wide text-white/50">{label}</div>
        <div className="text-sm font-semibold text-white truncate">{value}</div>
      </div>
    </div>
  );
}
