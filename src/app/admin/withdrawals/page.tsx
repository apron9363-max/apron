"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Banknote,
  Search,
  Download,
  Filter,
  AlertTriangle,
  UserCheck,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Modal } from "@/components/ui/Modal";
import {
  adminListWithdrawalsAction,
  adminApproveWithdrawalAction,
  adminRejectWithdrawalAction,
  adminExportWithdrawalsCsvAction,
} from "@/server/actions/adminActions";
import { formatDateTime, formatNaira, cn } from "@/lib/utils";
import type { WithdrawalDoc } from "@/types";

type EnrichedWD = WithdrawalDoc & { userName?: string; userEmail?: string };

const STATUSES: Array<{ key: "all" | WithdrawalDoc["status"]; label: string }> = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "paid", label: "Paid" },
  { key: "rejected", label: "Rejected" },
];

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
  if (end) d.setHours(23, 59, 59, 999);
  else d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export default function AdminWithdrawalsClient() {
  const [withdrawals, setWithdrawals] = useState<EnrichedWD[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUSES)[number]["key"]>("all");
  const [minAmountStr, setMinAmountStr] = useState("");
  const [maxAmountStr, setMaxAmountStr] = useState("");
  const initialFrom = useMemo(
    () => toLocalDateInput(Date.now() - 30 * 24 * 60 * 60 * 1000),
    [],
  );
  const initialTo = useMemo(() => toLocalDateInput(Date.now()), []);
  const [fromStr, setFromStr] = useState<string>(initialFrom);
  const [toStr, setToStr] = useState<string>(initialTo);
  const [, startTx] = useTransition();

  const [approveOpen, setApproveOpen] = useState<EnrichedWD | null>(null);
  const [rejectOpen, setRejectOpen] = useState<EnrichedWD | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    startTx(async () => {
      const fromMs = fromLocalDateInput(fromStr);
      const toMs = fromLocalDateInput(toStr, true);
      const minAmt = Number(minAmountStr);
      const maxAmt = Number(maxAmountStr);
      const res = (await adminListWithdrawalsAction({
        status: statusFilter,
        search: query.trim() || undefined,
        fromMs: fromMs || undefined,
        toMs: toMs || undefined,
        limit: 200,
        minAmount: Number.isFinite(minAmt) && minAmt > 0 ? minAmt : undefined,
        maxAmount: Number.isFinite(maxAmt) && maxAmt > 0 ? maxAmt : undefined,
      })) as any;
      if (res.ok) {
        setWithdrawals((res.withdrawals ?? []) as EnrichedWD[]);
      }
      setLoading(false);
    });
  }, [fromStr, toStr, minAmountStr, maxAmountStr, statusFilter, query]);

  useEffect(refresh, [refresh]);

  async function handleApprove() {
    if (!approveOpen) return;
    setBusy(`approve-${approveOpen.id}`);
    const res = await adminApproveWithdrawalAction({
      wdId: approveOpen.id,
      reason: undefined,
    });
    setBusy(null);
    if ((res as any).ok) {
      setApproveOpen(null);
      refresh();
    }
  }

  async function handleReject() {
    if (!rejectOpen) return;
    const reason = rejectReason.trim();
    if (reason.length < 3) return;
    setBusy(`reject-${rejectOpen.id}`);
    const res = await adminRejectWithdrawalAction({
      wdId: rejectOpen.id,
      reason,
    });
    setBusy(null);
    if ((res as any).ok) {
      setRejectOpen(null);
      setRejectReason("");
      refresh();
    }
  }

  async function handleCsv() {
    setBusy("csv");
    const fromMs = fromLocalDateInput(fromStr);
    const toMs = fromLocalDateInput(toStr, true);
    const minAmt = Number(minAmountStr);
    const maxAmt = Number(maxAmountStr);
    const res = (await adminExportWithdrawalsCsvAction({
      status: statusFilter,
      search: query.trim() || undefined,
      fromMs: fromMs || undefined,
      toMs: toMs || undefined,
      minAmount: Number.isFinite(minAmt) && minAmt > 0 ? minAmt : undefined,
      maxAmount: Number.isFinite(maxAmt) && maxAmt > 0 ? maxAmt : undefined,
    })) as any;
    setBusy(null);
    if (res.ok) {
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename || `withdrawals-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }
  }

  const sorted = useMemo(() => {
    return [...withdrawals].sort((a, b) => {
      const statusRank = { pending: 0, rejected: 1, paid: 2 };
      const aR = statusRank[a.status] ?? 3;
      const bR = statusRank[b.status] ?? 3;
      if (aR !== bR) return aR - bR;
      return a.createdAt - b.createdAt;
    });
  }, [withdrawals]);

  const stats = useMemo(() => {
    const pending = sorted.filter((w) => w.status === "pending");
    const paid = sorted.filter((w) => w.status === "paid");
    const pendingTotal = pending.reduce((acc, w) => acc + (w.amount ?? 0), 0);
    const paidTotal = paid.reduce((acc, w) => acc + (w.amount ?? 0), 0);
    return {
      pendingCount: pending.length,
      pendingTotal,
      paidCount: paid.length,
      paidTotal,
    };
  }, [sorted]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Withdrawals</h1>
          <p className="mt-1 text-sm text-white/60">
            Approve or reject user withdrawals. Pending requests are prioritized.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Button size="sm" variant="outline" onClick={handleCsv} loading={busy === "csv"}>
            <Download size={14} /> Export CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Pending count" value={stats.pendingCount} color="text-apron-gold" />
        <StatTile label="Pending amount" value={formatNaira(stats.pendingTotal)} color="text-apron-pink" />
        <StatTile label="Paid count" value={stats.paidCount} color="text-green-300" />
        <StatTile label="Paid amount" value={formatNaira(stats.paidTotal)} color="text-apron-gold" />
      </div>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-wide text-white/50 flex items-center gap-1">
              <Filter size={12} /> Filters
            </span>
            <div className="flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
              {STATUSES.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setStatusFilter(s.key)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-medium transition",
                    statusFilter === s.key
                      ? "bg-apron-gold/20 text-apron-gold border border-apron-gold/40"
                      : "text-white/70 hover:text-white hover:bg-white/5",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40"
              />
              <Input
                placeholder="Search user, email, TX, bank…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && refresh()}
                className="pl-8 h-8 text-xs min-w-[200px]"
              />
            </div>
            <Input
              placeholder="Min ₦"
              inputMode="numeric"
              value={minAmountStr}
              onChange={(e) => setMinAmountStr(e.target.value.replace(/[^0-9.]/g, ""))}
              className="h-8 text-xs w-[96px]"
            />
            <Input
              placeholder="Max ₦"
              inputMode="numeric"
              value={maxAmountStr}
              onChange={(e) => setMaxAmountStr(e.target.value.replace(/[^0-9.]/g, ""))}
              className="h-8 text-xs w-[96px]"
            />
            <Input
              type="date"
              value={fromStr}
              onChange={(e) => setFromStr(e.target.value)}
              className="h-8 text-xs w-[140px]"
            />
            <Input
              type="date"
              value={toStr}
              onChange={(e) => setToStr(e.target.value)}
              className="h-8 text-xs w-[140px]"
            />
            <Button size="xs" onClick={refresh}>
              Apply
            </Button>
          </div>
          <div className="text-xs text-white/60">
            {sorted.length.toLocaleString()} requests shown
          </div>
        </CardHeader>
        <CardContent>
          {loading && sorted.length === 0 ? (
            <div className="text-center text-white/60 py-8 text-sm">
              Loading withdrawals…
            </div>
          ) : sorted.length === 0 ? (
            <div className="text-center text-white/60 py-8 text-sm">
              No withdrawals match your filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wide text-white/50 border-b border-white/5">
                    <th className="py-2.5 pr-2 min-w-[160px]">User</th>
                    <th className="py-2.5 pr-2 min-w-[120px]">Amounts</th>
                    <th className="py-2.5 pr-2 min-w-[200px]">Bank</th>
                    <th className="py-2.5 pr-2 min-w-[150px]">Dates</th>
                    <th className="py-2.5 pr-2 min-w-[150px]">TX / Reject</th>
                    <th className="py-2.5 pr-2">Status</th>
                    <th className="py-2.5 pr-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((w) => (
                    <tr
                      key={w.id}
                      className={cn(
                        "border-t border-white/5",
                        w.status === "pending" ? "bg-apron-gold/[0.04]" : "",
                      )}
                    >
                      <td className="py-3 pr-2">
                        <Link
                          href={`/admin/users/${w.userId}`}
                          className="flex items-center gap-2 -mx-2 px-2 py-1 rounded-lg hover:bg-white/5"
                        >
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white shrink-0">
                            {(w.userName ?? "U").slice(0, 1).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-white">{w.userName ?? "User"}</div>
                            <div className="truncate text-[11px] text-white/50">{w.userEmail ?? ""}</div>
                            <div className="truncate text-[10px] text-white/40 font-mono">{w.userId.slice(0, 12)}…</div>
                          </div>
                        </Link>
                      </td>
                      <td className="py-3 pr-2">
                        <div className="text-sm font-semibold text-white">
                          ₦{(w.amount ?? 0).toLocaleString()}
                        </div>
                        <div className="text-[11px] text-white/50">
                          Fee ₦{(w.fee ?? 0).toLocaleString()} → Net{" "}
                          <span className="text-apron-gold">
                            ₦{((w.netAmount) ?? w.amount ?? 0).toLocaleString()}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 pr-2">
                        {w.bankDetails ? (
                          <div>
                            <div className="text-sm font-medium text-white">{w.bankDetails.bankName}</div>
                            <div className="text-[11px] text-white/60 font-mono">
                              {w.bankDetails.accountNumber}
                            </div>
                            <div className="text-[11px] text-white/50 truncate">
                              {w.bankDetails.accountName ?? ""}
                            </div>
                          </div>
                        ) : (
                          <div className="text-white/40 text-[11px]">No bank details</div>
                        )}
                      </td>
                      <td className="py-3 pr-2 text-white/70">
                        <div className="text-[11px]">
                          <span className="text-white/50">Requested:</span>{" "}
                          {formatDateTime(w.createdAt)}
                        </div>
                        {w.processedAt ? (
                          <div className="text-[11px] mt-0.5">
                            <span className="text-white/50">
                              {w.status === "paid" ? "Paid:" : "Rejected:"}
                            </span>{" "}
                            {formatDateTime(w.processedAt)}
                          </div>
                        ) : null}
                      </td>
                      <td className="py-3 pr-2 text-[11px]">
                        {w.transactionId ? (
                          <div>
                            <div className="text-white/60 font-mono truncate">{w.transactionId}</div>
                          </div>
                        ) : w.rejectReason ? (
                          <div className="text-red-300/90 max-w-[160px] truncate" title={w.rejectReason}>
                            {w.rejectReason}
                          </div>
                        ) : (
                          <span className="text-white/30">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-2">
                        <StatusPill status={w.status} />
                      </td>
                      <td className="py-3 pr-2 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {w.status === "pending" ? (
                            <>
                              <Button
                                size="xs"
                                onClick={() => setApproveOpen(w)}
                                loading={busy === `approve-${w.id}`}
                              >
                                <CheckCircle2 size={12} /> Approve
                              </Button>
                              <Button
                                size="xs"
                                variant="danger"
                                onClick={() => {
                                  setRejectOpen(w);
                                  setRejectReason("");
                                }}
                                loading={busy === `reject-${w.id}`}
                              >
                                <XCircle size={12} /> Reject
                              </Button>
                            </>
                          ) : (
                            <Link href={`/admin/users/${w.userId}`}>
                              <Button size="xs" variant="outline">
                                <UserCheck size={12} /> View user
                              </Button>
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Modal
        open={!!approveOpen}
        onOpenChange={(o) => !o && setApproveOpen(null)}
        title={`Approve withdrawal #${approveOpen?.id.slice(0, 8) ?? ""}`}
        description="Marking this withdrawal as paid will log an audit entry and finalize the TX ID."
        footer={
          <>
            <Button variant="outline" onClick={() => setApproveOpen(null)}>Cancel</Button>
            <Button loading={!!approveOpen && busy === `approve-${approveOpen.id}`} onClick={handleApprove}>
              <CheckCircle2 size={14} /> Confirm approve
            </Button>
          </>
        }
      >
        {approveOpen ? (
          <div className="space-y-3 text-xs">
            <div className="glass !p-3 grid grid-cols-2 gap-3">
              <Mini label="Amount" value={formatNaira(approveOpen.amount)} />
              <Mini label="Fee" value={formatNaira(approveOpen.fee ?? 0)} />
              <Mini label="Net" value={formatNaira((approveOpen.netAmount) ?? approveOpen.amount)} />
              <Mini label="User" value={approveOpen.userName ?? approveOpen.userId} />
            </div>
            {approveOpen.bankDetails ? (
              <div className="glass !p-3">
                <div className="text-[10px] uppercase tracking-wide text-white/50 mb-1 flex items-center gap-1">
                  <Banknote size={11} /> Bank details
                </div>
                <div className="text-sm font-medium text-white">{approveOpen.bankDetails.bankName}</div>
                <div className="text-xs text-white/70 font-mono">{approveOpen.bankDetails.accountNumber}</div>
                <div className="text-xs text-white/60">{approveOpen.bankDetails.accountName ?? ""}</div>
              </div>
            ) : null}
            {approveOpen.note || approveOpen.bankAccountId ? (
              <div className="glass !p-3 text-white/70">
                <div className="text-[10px] uppercase tracking-wide text-white/50 mb-1">Notes</div>
                <div>{approveOpen.note ?? "—"}</div>
              </div>
            ) : null}
            <div className="rounded-xl border border-green-400/20 bg-green-500/10 p-3 text-green-300 flex items-start gap-2">
              <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
              <div>
                On confirm, the balance refund will NOT be issued — the user&apos;s
                balance was already deducted at the time of request. An audit log
                entry will be written and user notification will be queued.
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={!!rejectOpen}
        onOpenChange={(o) => !o && setRejectOpen(null)}
        title={`Reject withdrawal #${rejectOpen?.id.slice(0, 8) ?? ""}`}
        description="A reason is mandatory. The full amount will be refunded to the user&apos;s balance and task balance, and the action is written to the audit log."
        footer={
          <>
            <Button variant="outline" onClick={() => setRejectOpen(null)}>Cancel</Button>
            <Button
              variant="danger"
              loading={!!rejectOpen && busy === `reject-${rejectOpen.id}`}
              onClick={handleReject}
              disabled={rejectReason.trim().length < 3}
            >
              <XCircle size={14} /> Confirm reject
            </Button>
          </>
        }
      >
        {rejectOpen ? (
          <div className="space-y-3 text-xs">
            <div className="glass !p-3 grid grid-cols-2 gap-3">
              <Mini label="Amount" value={formatNaira(rejectOpen.amount)} />
              <Mini label="Refund to user" value={rejectOpen.userName ?? rejectOpen.userId} />
            </div>
            <div className="rounded-xl border border-yellow-400/20 bg-yellow-500/10 p-3 text-yellow-200 flex items-start gap-2">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <div>
                Both <code className="text-white px-1 rounded bg-white/10">balance</code> and{" "}
                <code className="text-white px-1 rounded bg-white/10">taskBalance</code> will be
                increased by the original withdrawal amount to restore what was deducted.
              </div>
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wide text-white/60 mb-1 block">
                Rejection reason (minimum 3 characters)
              </label>
              <Textarea
                rows={4}
                placeholder="Why is this withdrawal being rejected? (insufficient balance, suspicious activity, missing KYC, bank details mismatch…)"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
              {rejectReason && rejectReason.trim().length < 3 ? (
                <div className="mt-1 text-[11px] text-red-300">Please enter a valid rejection reason.</div>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function StatTile({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="glass !p-3 flex flex-col gap-1">
      <div className="text-[10px] uppercase tracking-wide text-white/50">{label}</div>
      <div className={cn("text-sm font-semibold truncate", color)}>{value}</div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-white/50">{label}</div>
      <div className="text-sm font-semibold text-white truncate">{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: WithdrawalDoc["status"] }) {
  const cls =
    status === "paid"
      ? "bg-green-500/15 text-green-300 border-green-400/30"
      : status === "rejected"
      ? "bg-red-500/15 text-red-300 border-red-400/30"
      : "bg-yellow-500/15 text-yellow-300 border-yellow-400/30";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase", cls)}>
      {status === "paid" ? (
        <><CheckCircle2 size={10} /> Paid</>
      ) : status === "rejected" ? (
        <><XCircle size={10} /> Rejected</>
      ) : (
        <><Clock size={10} /> Pending</>
      )}
    </span>
  );
}
