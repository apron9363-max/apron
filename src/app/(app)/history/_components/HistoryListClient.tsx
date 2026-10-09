"use client";

import { useState, useMemo, useCallback, useTransition } from "react";
import Link from "next/link";
import {
  Coins,
  Banknote,
  Gift,
  ArrowRight,
  Download,
  Loader2,
  Filter,
  ChevronDown,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  HelpCircle,
  Wallet,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { formatAPN, formatDateTime, formatNaira, cn } from "@/lib/utils";
import {
  exportHistoryCsvAction,
  listHistoryPaginatedAction,
} from "@/server/actions/userActions";
import type { HistoryPageRow } from "@/server/actions/userActions";
import type { EarningSource } from "@/types";

type KindFilter = "all" | "earning" | "withdrawal";
type SourceFilter = "all" | EarningSource | "withdrawal";

const KIND_OPTIONS: { value: KindFilter; label: string }[] = [
  { value: "all", label: "All activity" },
  { value: "earning", label: "Earnings only" },
  { value: "withdrawal", label: "Withdrawals only" },
];

const SOURCE_OPTIONS: { value: SourceFilter; label: string }[] = [
  { value: "all", label: "All sources" },
  { value: "task", label: "Tasks" },
  { value: "quiz", label: "Quizzes" },
  { value: "claim", label: "Hourly claims" },
  { value: "referral", label: "Referrals" },
  { value: "withdrawal", label: "Withdrawals" },
];

function EarningIcon({ source }: { source: EarningSource }) {
  if (source === "referral") return <Gift size={16} />;
  if (source === "quiz") return <HelpCircle size={16} />;
  if (source === "claim") return <Sparkles size={16} />;
  return <Coins size={16} />;
}

function WithdrawalIcon() {
  return <Banknote size={16} />;
}

function WithdrawalStatusBadge({ status }: { status: string }) {
  if (status === "paid") return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-200">
      <CheckCircle2 size={10} /> Paid
    </span>
  );
  if (status === "rejected") return (
    <span className="inline-flex items-center gap-1 rounded-full border border-red-400/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-red-200">
      <XCircle size={10} /> Rejected
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-200">
      <Clock size={10} /> Processing
    </span>
  );
}

export default function HistoryListClient({
  initialRows,
  initialNextCursor,
  initialHasMore,
}: {
  initialRows: HistoryPageRow[];
  initialNextCursor: { id: string; kind: "earning" | "withdrawal" } | null;
  initialHasMore: boolean;
}) {
  const { toast } = useToast();
  const [rows, setRows] = useState<HistoryPageRow[]>(initialRows);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [kind, setKind] = useState<KindFilter>("all");
  const [source, setSource] = useState<SourceFilter>("all");
  const [fromTs, setFromTs] = useState<string>("");
  const [toTs, setToTs] = useState<string>("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [, startTx] = useTransition();
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const stats = useMemo(() => {
    const total = rows.length;
    const earnings = rows.filter((r): r is Extract<HistoryPageRow, { kind: "earning" }> => r.kind === "earning");
    const withdrawals = rows.filter((r): r is Extract<HistoryPageRow, { kind: "withdrawal" }> => r.kind === "withdrawal");
    const earnedSum = earnings.reduce((s, r) => s + Number(r.amount ?? 0), 0);
    const wdSum = withdrawals.reduce((s, r) => s + Number(r.netAmount ?? 0), 0);
    return { total, earningsCount: earnings.length, withdrawalsCount: withdrawals.length, earnedSum, wdSum };
  }, [rows]);

  const applyFilters = useCallback((
    k: KindFilter,
    s: SourceFilter,
    fTs: string,
    tTs: string,
  ) => {
    setRefreshing(true);
    startTx(async () => {
      const payload: any = {
        kind: k,
        source: s === "all" ? "all" : s,
        limit: 50,
      };
      if (fTs) payload.fromTs = new Date(fTs).getTime();
      if (tTs) payload.toTs = new Date(tTs).getTime() + 24 * 3600 * 1000;
      const res = await listHistoryPaginatedAction(payload);
      if (res.ok) {
        setRows(res.rows);
        setNextCursor(res.nextCursor);
        setHasMore(res.hasMore);
      } else {
        toast({ title: res.error ?? "Failed to load history", variant: "error" });
      }
      setRefreshing(false);
    });
  }, [toast]);

  function onKind(v: KindFilter) {
    setKind(v);
    applyFilters(v, source, fromTs, toTs);
  }
  function onSource(v: SourceFilter) {
    setSource(v);
    applyFilters(kind, v, fromTs, toTs);
  }
  function onFrom(v: string) {
    setFromTs(v);
    applyFilters(kind, source, v, toTs);
  }
  function onTo(v: string) {
    setToTs(v);
    applyFilters(kind, source, fromTs, v);
  }

  function loadMore() {
    if (!hasMore || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    startTx(async () => {
      const payload: any = {
        kind,
        source: source === "all" ? "all" : source,
        limit: 50,
        cursorId: nextCursor.id,
        cursorKind: nextCursor.kind,
      };
      if (fromTs) payload.fromTs = new Date(fromTs).getTime();
      if (toTs) payload.toTs = new Date(toTs).getTime() + 24 * 3600 * 1000;
      const res = await listHistoryPaginatedAction(payload);
      if (res.ok) {
        setRows((prev) => [...prev, ...res.rows]);
        setNextCursor(res.nextCursor);
        setHasMore(res.hasMore);
      } else {
        toast({ title: res.error ?? "Failed to load more", variant: "error" });
      }
      setLoadingMore(false);
    });
  }

  async function exportCsv() {
    setExporting(true);
    const payload: any = { kind, source: source === "all" ? "all" : source };
    if (fromTs) payload.fromTs = new Date(fromTs).getTime();
    if (toTs) payload.toTs = new Date(toTs).getTime() + 24 * 3600 * 1000;
    const res = await exportHistoryCsvAction(payload);
    setExporting(false);
    if (!res.ok) {
      toast({ title: res.error ?? "Export failed", variant: "error" });
      return;
    }
    try {
      const a = document.createElement("a");
      a.href = res.dataUrl;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast({ title: `Exported ${res.rowCount} rows`, variant: "success" });
    } catch {
      toast({ title: "Download failed — try right-click save", variant: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
          <Wallet size={22} className="text-apron-gold" /> Earning History
        </h1>
        <p className="mt-1 text-sm text-white/60">
          All your earnings and withdrawals
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total rows" value={stats.total} icon={Coins} />
        <StatCard label="Earnings" value={stats.earningsCount} iconColor="text-apron-gold" icon={Gift} />
        <StatCard label="Withdrawals" value={stats.withdrawalsCount} iconColor="text-apron-pink" icon={Banknote} />
        <StatCard
          label="Net (APN - NGN)"
          value={`${formatAPN(stats.earnedSum)} / ₦${stats.wdSum.toLocaleString()}`}
          iconColor="text-white/80"
          icon={Wallet}
        />
      </div>

      <Card>
        <CardHeader className="!pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter size={14} /> Filters
            <ChevronDown size={14} className="opacity-60" />
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-[150px] flex-1">
            <label className="mb-1 block text-xs text-white/60">Type</label>
            <Select
              value={kind}
              onChange={(v) => onKind(v as KindFilter)}
              options={KIND_OPTIONS}
            />
          </div>
          <div className="min-w-[150px] flex-1">
            <label className="mb-1 block text-xs text-white/60">Source</label>
            <Select
              value={source}
              onChange={(v) => onSource(v as SourceFilter)}
              options={SOURCE_OPTIONS}
            />
          </div>
          <div className="min-w-[150px] flex-1">
            <label className="mb-1 block text-xs text-white/60">From date</label>
            <Input type="date" value={fromTs} onChange={(e) => onFrom(e.target.value)} aria-label="From date" />
          </div>
          <div className="min-w-[150px] flex-1">
            <label className="mb-1 block text-xs text-white/60">To date</label>
            <Input type="date" value={toTs} onChange={(e) => onTo(e.target.value)} aria-label="To date" />
          </div>
          <div className="flex gap-2 sm:self-end">
            <Button variant="outline" onClick={() => {
              setKind("all"); setSource("all"); setFromTs(""); setToTs("");
              applyFilters("all", "all", "", "");
            }} disabled={refreshing} aria-label="Reset filters">
              Reset
            </Button>
            <Button onClick={exportCsv} loading={exporting} aria-label="Export as CSV">
              <Download size={14} /> CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-white/70">
            {refreshing ? (
              <><Loader2 className="mx-auto mb-2 animate-spin text-apron-gold" size={20} /> Loading…</>
            ) : (
              <>
                <AlertCircle className="mx-auto mb-2 text-white/50" size={20} />
                No activity matches the current filters.
                <div className="mt-3 flex justify-center">
                  <Link href="/tasks">
                    <Button variant="outline" size="sm">
                      Earn your first APN <ArrowRight size={12} />
                    </Button>
                  </Link>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-col gap-2" role="list" aria-label="Activity rows">
            {rows.map((r) => (
              <RowCard key={`${r.kind}-${r.id}`} row={r} />
            ))}
          </div>
          {hasMore ? (
            <div className="flex justify-center pt-1">
              <Button variant="outline" onClick={loadMore} loading={loadingMore} aria-label="Load more history">
                Load more
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function RowCard({ row }: { row: HistoryPageRow }) {
  if (row.kind === "earning") {
    return (
      <Card role="listitem" aria-label={`Earning ${row.id}`}>
        <CardContent className="!py-3 flex items-center gap-3 transition hover:bg-white/5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-apron-gold shrink-0">
            <EarningIcon source={row.source} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="truncate text-sm font-medium text-white capitalize">
                {row.source}
              </div>
              <span className="text-[10px] uppercase tracking-wide text-white/40">
                earning
              </span>
            </div>
            <div className="text-xs text-white/50">
              {formatDateTime(row.createdAt)}
              {row.referenceId ? (
                <span className="ml-2 truncate text-white/40">· {row.referenceId}</span>
              ) : null}
            </div>
          </div>
          <div className="text-sm font-semibold text-apron-gold shrink-0">
            +{formatAPN(Number(row.amount ?? 0))}
          </div>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card role="listitem" aria-label={`Withdrawal ${row.id}`}>
      <CardContent className="!py-3 flex items-center gap-3 transition hover:bg-white/5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-apron-pink shrink-0">
          <WithdrawalIcon />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="truncate text-sm font-medium text-white">
              Withdrawal
            </div>
            <WithdrawalStatusBadge status={row.status} />
          </div>
          <div className="text-xs text-white/50">
            {formatDateTime(row.createdAt)}
            {row.rejectReason ? (
              <span className="ml-2 text-red-300/80">· {row.rejectReason}</span>
            ) : null}
          </div>
          <div className="text-[10px] text-white/40 mt-0.5">
            Amount ₦{formatNaira(row.amount)} · Fee ₦{formatNaira(row.fee)}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-semibold text-white/80">
            -₦{formatNaira(row.netAmount)}
          </div>
          <div className="text-[10px] text-white/40">net</div>
        </div>
      </CardContent>
    </Card>
  );
}
