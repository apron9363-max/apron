"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  UserCheck,
  Ban,
  PencilLine,
  Search,
  Wallet,
  ScrollText,
  History,
  Download,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Modal } from "@/components/ui/Modal";
import {
  adminGetUserAction,
  adminSetUserStatusAction,
  adminSetUserRoleAction,
  adminUpdateUserBalanceAction,
} from "@/server/actions/adminActions";
import {
  formatAPN,
  formatDateTime,
  formatNaira,
  cn,
} from "@/lib/utils";
import type { BalanceEditLog, UserDoc, WithdrawalDoc } from "@/types";
import { Crown, Copy } from "lucide-react";

type Params = { uid: string };

export default function AdminUserDetailClient() {
  const { uid } = useParams<Params>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserDoc | null>(null);
  const [userRawEmail, setUserRawEmail] = useState<string | undefined>(undefined);
  const [withdrawals, setWithdrawals] = useState<WithdrawalDoc[]>([]);
  const [earnings, setEarnings] = useState<any[]>([]);
  const [balanceEditLogs, setBalanceEditLogs] = useState<BalanceEditLog[]>([]);

  const [tab, setTab] = useState<"overview" | "withdrawals" | "earnings" | "balance_logs">("overview");
  const [, startTx] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  // Balance edit modal state
  const [balanceModalOpen, setBalanceModalOpen] = useState(false);
  const [deltaStr, setDeltaStr] = useState<string>("");
  const [balanceReason, setBalanceReason] = useState<string>("");

  // Ban modal state
  const [banOpen, setBanOpen] = useState(false);
  const [banReason, setBanReason] = useState<string>("");

  // Role modal state
  const [roleOpen, setRoleOpen] = useState(false);
  const [roleInput, setRoleInput] = useState<UserDoc["role"]>("user");

  const load = useCallback(() => {
    setLoading(true);
    startTx(async () => {
      const r = (await adminGetUserAction(uid)) as any;
      if (!r.ok) {
        setLoading(false);
        return;
      }
      setUser(r.user);
      setUserRawEmail(r.userRawEmail);
      setWithdrawals(r.withdrawals ?? []);
      setEarnings(r.earnings ?? []);
      setBalanceEditLogs(r.balanceEditLogs ?? []);
      setLoading(false);
    });
  }, [uid]);

  useEffect(() => {
    if (uid) load();
  }, [uid, load]);

  const delta = Number(deltaStr);
  const balanceEditValid =
    !Number.isNaN(delta) && delta !== 0 && balanceReason.trim().length >= 2;

  async function handleSaveBalance() {
    if (!user || !balanceEditValid) return;
    setBusy("balance");
    const res = await adminUpdateUserBalanceAction({
      uid: user.uid,
      delta,
      reason: balanceReason.trim(),
    });
    setBusy(null);
    if ((res as any).ok) {
      setBalanceModalOpen(false);
      setDeltaStr("");
      setBalanceReason("");
      load();
    }
  }

  async function handleToggleStatus(to: UserDoc["status"]) {
    if (!user) return;
    if (to === "banned" && !banReason.trim()) return;
    setBusy("status");
    const res = await adminSetUserStatusAction({
      uid: user.uid,
      status: to,
      reason: banReason.trim() || undefined,
    } as any);
    setBusy(null);
    if ((res as any).ok) {
      setBanOpen(false);
      setBanReason("");
      load();
    }
  }

  async function handleSaveRole() {
    if (!user) return;
    setBusy("role");
    const res = await adminSetUserRoleAction({ uid: user.uid, role: roleInput });
    setBusy(null);
    if ((res as any).ok) {
      setRoleOpen(false);
      load();
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-white/60 text-sm">
          Loading user profile…
        </CardContent>
      </Card>
    );
  }
  if (!user) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-white/60 text-sm">
          User not found.
          <div className="mt-3">
            <Link href="/admin/users">
              <Button size="sm" variant="outline">
                <ArrowLeft size={14} /> Back to users
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <Link href="/admin/users" className="text-xs text-white/60 hover:text-white flex items-center gap-1 w-fit">
            <ArrowLeft size={12} /> Users
          </Link>
          <div className="flex items-center gap-3">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-2xl font-semibold text-white">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <h1 className="text-2xl font-bold text-white">{user.name}</h1>
              <div className="text-xs text-white/60 font-mono">{userRawEmail ?? user.email}</div>
              {user.phone ? <div className="text-xs text-white/60">{user.phone}</div> : null}
              <div className="mt-1 flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase",
                    user.status === "banned"
                      ? "border-red-400/30 bg-red-500/15 text-red-300"
                      : "border-green-400/30 bg-green-500/15 text-green-300",
                  )}
                >
                  {user.status === "banned" ? (
                    <>
                      <Ban size={10} /> Banned
                    </>
                  ) : (
                    <>
                      <UserCheck size={10} /> {user.status}
                    </>
                  )}
                </span>
                <span
                  className={cn(
                    "inline-flex rounded-full border px-2 py-0.5 text-[10px] uppercase",
                    user.role === "admin"
                      ? "border-apron-gold/30 bg-apron-gold/15 text-apron-gold"
                      : user.role === "vip"
                      ? "border-apron-pink/30 bg-apron-pink/15 text-apron-pink"
                      : "border-white/10 bg-white/5 text-white/70",
                  )}
                >
                  {user.role}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] text-white/70">
                  <Crown size={10} className="text-apron-gold" /> Plan: {user.plan}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setRoleOpen(true);
              setRoleInput(user.role);
            }}
            loading={busy === "role"}
          >
            <PencilLine size={12} /> Change role
          </Button>
          {user.status === "banned" ? (
            <Button
              size="sm"
              className="text-green-300 border-green-400/30 hover:bg-green-500/10"
              variant="outline"
              onClick={() => handleToggleStatus("active")}
              loading={busy === "status"}
            >
              <UserCheck size={12} /> Unban
            </Button>
          ) : (
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                setBanOpen(true);
                setBanReason("");
              }}
              loading={busy === "status"}
            >
              <Ban size={12} /> Ban
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => {
              setBalanceModalOpen(true);
              setDeltaStr("");
              setBalanceReason("");
            }}
            loading={busy === "balance"}
          >
            <Wallet size={12} /> Adjust balance
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatPill label="Balance (APN)" value={formatAPN(user.balance)} />
        <StatPill label="Task balance" value={formatAPN(user.taskBalance)} />
        <StatPill
          label="Referrals"
          value={user.referralsCount ?? 0}
          sub={user.referralCode}
        />
        <StatPill label="Joined" value={formatDateTime(user.createdAt)} />
      </div>

      <div className="flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1 w-fit">
        {(["overview", "withdrawals", "earnings", "balance_logs"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium capitalize",
              tab === t
                ? "bg-apron-gold/20 text-apron-gold border border-apron-gold/40"
                : "text-white/70 hover:text-white hover:bg-white/5",
            )}
          >
            {t === "balance_logs" ? "Balance edit logs" : t}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Balances</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Row label="Balance" value={formatAPN(user.balance)} />
              <Row label="Task balance" value={formatAPN(user.taskBalance)} />
              <Row label="APN rate" value={`${user.apnRate} APN / NGN`} />
              <Row label="Total withdrawals" value={withdrawals.length} />
              <Row
                label="Pending withdrawals"
                value={withdrawals.filter((w) => w.status === "pending").length}
              />
            </CardContent>
          </Card>
          <Card className="md:col-span-2">
            <CardHeader className="flex-row items-end justify-between">
              <div>
                <CardTitle>Recent withdrawals</CardTitle>
                <p className="mt-0.5 text-xs text-white/60">Latest 10</p>
              </div>
              <button
                onClick={() => setTab("withdrawals")}
                className="text-xs text-apron-gold hover:underline"
              >
                Show all
              </button>
            </CardHeader>
            <CardContent>
              {withdrawals.slice(0, 10).length === 0 ? (
                <div className="text-xs text-white/50 py-6 text-center">
                  No withdrawals yet.
                </div>
              ) : (
                <ul className="space-y-2 text-xs">
                  {withdrawals.slice(0, 10).map((w) => (
                    <li
                      key={w.id}
                      className="flex items-center justify-between gap-2 border-b border-white/5 py-2 last:border-b-0"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-white truncate">
                          {formatNaira(w.netAmount ?? w.amount)} net
                        </div>
                        <div className="text-[11px] text-white/50 truncate">
                          {w.bankDetails?.bankName ?? "Unknown bank"} · {formatDateTime(w.createdAt)}
                        </div>
                      </div>
                      <StatusPill status={w.status} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      ) : tab === "withdrawals" ? (
        <Card>
          <CardHeader>
            <CardTitle>Withdrawals</CardTitle>
          </CardHeader>
          <CardContent>
            {withdrawals.length === 0 ? (
              <div className="text-xs text-white/50 py-6 text-center">
                No withdrawals yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-wide text-white/50 border-b border-white/5">
                      <th className="py-2 pr-2">Date</th>
                      <th className="py-2 pr-2">Amount (NGN)</th>
                      <th className="py-2 pr-2">Fee</th>
                      <th className="py-2 pr-2">Net</th>
                      <th className="py-2 pr-2">Bank</th>
                      <th className="py-2 pr-2">Status</th>
                      <th className="py-2 pr-2">TX ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {withdrawals.map((w) => (
                      <tr key={w.id} className="border-t border-white/5">
                        <td className="py-2 pr-2">{formatDateTime(w.createdAt)}</td>
                        <td className="py-2 pr-2">{w.amount.toLocaleString()}</td>
                        <td className="py-2 pr-2">{w.fee?.toLocaleString() ?? "—"}</td>
                        <td className="py-2 pr-2 font-medium">
                          {(w.netAmount ?? w.amount).toLocaleString()}
                        </td>
                        <td className="py-2 pr-2">
                          {w.bankDetails?.bankName ?? "—"} {w.bankDetails?.accountNumber ? `•••${w.bankDetails.accountNumber.slice(-4)}` : ""}
                        </td>
                        <td className="py-2 pr-2"><StatusPill status={w.status} /></td>
                        <td className="py-2 pr-2 font-mono text-[10px] text-white/60">
                          {w.transactionId ? (
                            <button
                              onClick={() => navigator.clipboard?.writeText(w.transactionId!)}
                              className="inline-flex items-center gap-0.5 hover:text-apron-gold"
                              title="Copy"
                            >
                              {w.transactionId.slice(0, 12)}…
                              <Copy size={10} />
                            </button>
                          ) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : tab === "earnings" ? (
        <Card>
          <CardHeader>
            <CardTitle>Earnings history</CardTitle>
          </CardHeader>
          <CardContent>
            {earnings.length === 0 ? (
              <div className="text-xs text-white/50 py-6 text-center">
                No earnings yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-wide text-white/50 border-b border-white/5">
                      <th className="py-2 pr-2">Date</th>
                      <th className="py-2 pr-2">Task</th>
                      <th className="py-2 pr-2">Amount (APN)</th>
                      <th className="py-2 pr-2">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {earnings.map((e) => (
                      <tr key={e.id} className="border-t border-white/5">
                        <td className="py-2 pr-2">{formatDateTime(e.createdAt ?? e.timestamp)}</td>
                        <td className="py-2 pr-2">{e.taskId ?? e.note ?? e.title ?? "—"}</td>
                        <td className="py-2 pr-2 font-medium text-apron-gold">
                          +{formatAPN(e.amount ?? e.reward ?? 0)}
                        </td>
                        <td className="py-2 pr-2">{e.type ?? "earning"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History size={16} className="text-apron-gold" />
              Balance edit logs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {balanceEditLogs.length === 0 ? (
              <div className="text-xs text-white/50 py-6 text-center">
                No manual balance adjustments logged yet.
              </div>
            ) : (
              <ul className="space-y-3">
                {balanceEditLogs.map((log) => {
                  const positive = log.delta > 0;
                  return (
                    <li key={log.id} className="glass !p-4 flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex items-start gap-2">
                          <span
                            className={cn(
                              "inline-flex h-8 w-8 items-center justify-center rounded-lg border",
                              positive
                                ? "bg-green-500/10 border-green-400/20 text-green-300"
                                : "bg-red-500/10 border-red-400/20 text-red-300",
                            )}
                          >
                            {positive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                          </span>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-white flex items-center gap-2">
                              {positive ? "+" : ""}
                              {formatAPN(log.delta)}
                              <span className="text-[10px] text-white/50 font-normal">
                                {formatDateTime(log.timestamp)}
                              </span>
                            </div>
                            <div className="text-xs text-white/60 mt-0.5">
                              By{" "}
                              <span className="text-white/80">{log.actorName}</span>{" "}
                              <span className="font-mono text-[10px] text-white/40">
                                ({log.actorUid.slice(0, 8)}…)
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 text-xs text-white/70">
                        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                          <MiniRow label="Old bal" value={formatAPN(log.oldBalance)} />
                          <MiniRow label="New bal" value={formatAPN(log.newBalance)} />
                          <MiniRow label="Old task bal" value={formatAPN(log.oldTaskBalance)} />
                          <MiniRow label="New task bal" value={formatAPN(log.newTaskBalance)} />
                        </div>
                        <div className="mt-1 glass !p-3 !bg-white/[0.03]">
                          <div className="text-[10px] uppercase tracking-wide text-white/50 mb-1 flex items-center gap-1">
                            <ScrollText size={10} /> Reason
                          </div>
                          <div className="text-white/85 whitespace-pre-wrap break-words text-sm leading-relaxed">
                            {log.reason}
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <Modal
        open={balanceModalOpen}
        onOpenChange={(o) => !o && setBalanceModalOpen(false)}
        title="Adjust balance"
        description="This change will be written to both the user balance and task balance, with a mandatory reason captured in the audit trail."
        footer={
          <>
            <Button variant="outline" onClick={() => setBalanceModalOpen(false)}>Cancel</Button>
            <Button
              loading={busy === "balance"}
              onClick={handleSaveBalance}
              disabled={!balanceEditValid}
            >
              Apply adjustment
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="text-[11px] uppercase tracking-wide text-white/60 mb-1 block">
              Delta (APN, use negative to subtract)
            </label>
            <Input
              inputMode="decimal"
              placeholder="e.g. +1000 or -500"
              value={deltaStr}
              onChange={(e) => setDeltaStr(e.target.value.replace(/[^0-9.-]/g, ""))}
            />
            {!Number.isNaN(delta) && delta !== 0 ? (
              <div className="mt-2 text-xs">
                <span className="text-white/60">New balance: </span>
                <span
                  className={cn(
                    "font-semibold",
                    (user.balance + delta) >= 0 ? "text-white" : "text-red-300",
                  )}
                >
                  {formatAPN(user.balance + delta)}
                </span>
                <span className="text-white/50"> · </span>
                <span className="text-white/60">New task balance: </span>
                <span
                  className={cn(
                    "font-semibold",
                    (user.taskBalance + delta) >= 0 ? "text-white" : "text-red-300",
                  )}
                >
                  {formatAPN(user.taskBalance + delta)}
                </span>
              </div>
            ) : null}
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wide text-white/60 mb-1 block">
              Reason (minimum 2 characters, mandatory for audit)
            </label>
            <Textarea
              rows={4}
              placeholder="Why is this balance being adjusted? (manual refund, bonus, withdrawal correction, admin credit, etc.)"
              value={balanceReason}
              onChange={(e) => setBalanceReason(e.target.value)}
            />
            {balanceReason && balanceReason.trim().length < 2 ? (
              <div className="mt-1 text-[11px] text-red-300">
                Please enter a valid reason.
              </div>
            ) : null}
          </div>
        </div>
      </Modal>

      <Modal
        open={banOpen}
        onOpenChange={(o) => !o && setBanOpen(false)}
        title={`Ban user ${user.name}`}
        description="Please provide a reason — this action is logged and reversible later."
        footer={
          <>
            <Button variant="outline" onClick={() => setBanOpen(false)}>Cancel</Button>
            <Button
              variant="danger"
              loading={busy === "status"}
              onClick={() => handleToggleStatus("banned")}
              disabled={!banReason.trim() || banReason.trim().length < 2}
            >
              <Ban size={14} /> Confirm ban
            </Button>
          </>
        }
      >
        <Textarea
          rows={4}
          placeholder="Reason for the ban (minimum 2 chars)…"
          value={banReason}
          onChange={(e) => setBanReason(e.target.value)}
        />
        {banReason.trim() && banReason.trim().length < 2 ? (
          <div className="mt-1 text-[11px] text-red-300">Please enter a valid reason.</div>
        ) : null}
      </Modal>

      <Modal
        open={roleOpen}
        onOpenChange={(o) => !o && setRoleOpen(false)}
        title={`Change role: ${user.name}`}
        description="Role changes are written to the admin audit log."
        footer={
          <>
            <Button variant="outline" onClick={() => setRoleOpen(false)}>Cancel</Button>
            <Button loading={busy === "role"} onClick={handleSaveRole}>Save role</Button>
          </>
        }
      >
        <Select
          value={roleInput}
          options={[
            { value: "user", label: "User" },
            { value: "vip", label: "VIP" },
            { value: "admin", label: "Admin" },
          ]}
          onChange={(v) => setRoleInput(v as UserDoc["role"])}
        />
      </Modal>
    </div>
  );
}

function StatPill({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="glass !p-3 flex flex-col gap-1">
      <div className="text-[10px] uppercase tracking-wide text-white/50">{label}</div>
      <div className="text-sm font-semibold text-white truncate">{value}</div>
      {sub ? <div className="text-[10px] font-mono text-white/40 truncate">{sub}</div> : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <div className="text-white/60">{label}</div>
      <div className="font-medium text-white text-right">{value}</div>
    </div>
  );
}
function MiniRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="glass !p-2 !bg-white/[0.03]">
      <div className="text-[10px] uppercase tracking-wide text-white/50">{label}</div>
      <div className="text-xs font-medium text-white">{value}</div>
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
        <><ClockFallback /> Pending</>
      )}
    </span>
  );
}

function ClockFallback() {
  return <div className="h-[10px] w-[10px] rounded-full border border-yellow-300/60" />;
}
