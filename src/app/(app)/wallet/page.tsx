"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Wallet,
  Coins,
  ArrowRight,
  Banknote,
  Building2,
  CreditCard,
  Plus,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Trash2,
  Star,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { StatCard } from "@/components/ui/StatCard";
import { addBankAccountSchema } from "@/lib/validations/schemas";
import { formatAPN, formatNaira, formatDateTime } from "@/lib/utils";
import {
  getCurrentUserDataAction,
  updateUserBankDetailsAction,
  listMyBankAccountsAction,
  addBankAccountAction,
  setDefaultBankAccountAction,
  deleteBankAccountAction,
} from "@/server/actions/userActions";
import { listMyWithdrawalsAction } from "@/server/actions/taskActions";
import type { UserDoc, WithdrawalDoc, VerifiedBankAccount } from "@/types";
import { cn } from "@/lib/utils";
import { MAX_BANK_ACCOUNTS } from "@/lib/constants";

type BankValues = z.infer<typeof addBankAccountSchema>;

export default function WalletPageClient() {
  const router = useRouter();
  const [user, setUser] = useState<UserDoc | null>(null);
  const [accounts, setAccounts] = useState<VerifiedBankAccount[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalDoc[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [, startTx] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [pending, startSave] = useTransition();
  const [busyAccId, setBusyAccId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BankValues>({
    resolver: zodResolver(addBankAccountSchema),
    defaultValues: {
      accountName: "",
      accountNumber: "",
      bankName: "",
      nickname: "",
    },
  });

  const load = useCallback(function load() {
    setMsg(null);
    startTx(async () => {
      const [userRes, wdRes, accRes] = await Promise.all([
        getCurrentUserDataAction(),
        listMyWithdrawalsAction() as any,
        listMyBankAccountsAction(),
      ]);
      const userData = (userRes as any).user as UserDoc | null;
      const wdList: WithdrawalDoc[] = Array.isArray((wdRes as any)?.withdrawals)
        ? (wdRes as any).withdrawals
        : Array.isArray(wdRes)
        ? wdRes
        : [];
      const accList: VerifiedBankAccount[] =
        accRes.ok ? accRes.accounts : [];
      setUser(userData);
      setWithdrawals(wdList);
      setAccounts(accList);
      if (userData?.bankDetails && accList.length === 0) {
        setAccounts([
          {
            id: "legacy-default",
            bankName: userData.bankDetails.bankName,
            accountNumber: userData.bankDetails.accountNumber,
            accountName: userData.bankDetails.accountName,
            nickname: "Default",
            verified: true,
            addedAt: userData.createdAt ?? Date.now(),
            verifiedAt: userData.createdAt ?? Date.now(),
            isDefault: true,
          },
        ]);
      }
      setLoaded(true);
    });
  }, [startTx]);

  useEffect(() => {
    load();
  }, [load]);

  function addAccount(v: BankValues) {
    setMsg(null);
    setBusyAccId("new");
    startSave(async () => {
      const res: any = await addBankAccountAction(v);
      if (res.ok) {
        setMsg({ kind: "ok", text: "Bank account added successfully." });
        setShowAdd(false);
        reset();
        load();
      } else {
        setMsg({ kind: "err", text: res.error ?? "Unable to add bank account." });
      }
      setBusyAccId(null);
    });
  }

  function saveLegacyBank(v: BankValues) {
    setMsg(null);
    setBusyAccId("legacy");
    startSave(async () => {
      const legacy = {
        bankName: v.bankName,
        accountNumber: v.accountNumber,
        accountName: v.accountName,
      };
      const res: any = await updateUserBankDetailsAction(legacy);
      if (res.ok) {
        setMsg({ kind: "ok", text: "Bank details saved successfully." });
        setShowAdd(false);
        reset();
        load();
      } else {
        setMsg({ kind: "err", text: res.error ?? "Unable to save bank details." });
      }
      setBusyAccId(null);
    });
  }

  function setDefault(id: string) {
    setMsg(null);
    setBusyAccId(id);
    startSave(async () => {
      const res: any = await setDefaultBankAccountAction({ accountId: id });
      if (res.ok) {
        setMsg({ kind: "ok", text: "Default bank account updated." });
        load();
      } else {
        setMsg({ kind: "err", text: res.error ?? "Unable to set default." });
      }
      setBusyAccId(null);
    });
  }

  function removeAccount(id: string) {
    if (id === "legacy-default") return;
    setMsg(null);
    setBusyAccId(id);
    startSave(async () => {
      const res: any = await deleteBankAccountAction({ accountId: id });
      if (res.ok) {
        setMsg({ kind: "ok", text: "Bank account removed." });
        load();
      } else {
        setMsg({ kind: "err", text: res.error ?? "Unable to remove account." });
      }
      setBusyAccId(null);
    });
  }

  if (!loaded || !user) {
    return (
      <Card>
        <CardContent className="text-sm text-white/70 py-8 text-center">
          Loading wallet…
        </CardContent>
      </Card>
    );
  }

  const pendingWd = withdrawals.filter((w) => w.status === "pending").length;
  const paidWd = withdrawals.filter((w) => w.status === "paid");
  const lastPaid = paidWd[0];

  const usingLegacy = accounts.length === 0 && user.bankDetails;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
          <Wallet size={22} className="text-apron-gold" /> Wallet
        </h1>
        <p className="mt-1 text-sm text-white/60">
          Manage balances and withdrawals.
        </p>
      </div>

      <Card className="!border-apron-gold/30 !bg-gradient-to-br from-apron-gold/10 to-apron-pink/10">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wide text-white/70">
                Total Balance (APN)
              </div>
              <div className="text-3xl font-bold text-gradient-gold mt-1">
                {formatAPN(user.balance)}
              </div>
              <div className="text-xs text-white/60 mt-1">
                ≈ {formatNaira(Math.max(0, user.balance))}
              </div>
            </div>
            <Link href="/wallet/withdraw">
              <Button size="lg">
                Withdraw <ArrowRight size={16} />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Task Balance"
          value={formatAPN(user.taskBalance)}
          icon={Coins}
          iconColor="text-apron-pink"
        />
        <StatCard
          label="Pending withdrawal"
          value={pendingWd.toString()}
          icon={Banknote}
        />
      </div>

      {msg ? (
        <div
          className={cn(
            "rounded-xl border p-3 text-sm",
            msg.kind === "ok"
              ? "border-green-400/40 bg-green-500/10 text-green-200"
              : "border-red-400/40 bg-red-500/10 text-red-200",
          )}
        >
          <div className="flex items-center gap-2">
            {msg.kind === "ok" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {msg.text}
          </div>
        </div>
      ) : null}

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">Bank accounts</CardTitle>
            <p className="mt-0.5 text-xs text-white/60">
              {accounts.length}/{MAX_BANK_ACCOUNTS} saved · Verified accounts are eligible for withdrawals.
            </p>
          </div>
          <button
            onClick={() => setShowAdd((v) => !v)}
            disabled={accounts.length >= MAX_BANK_ACCOUNTS && !showAdd}
            className="text-xs text-apron-gold hover:underline disabled:opacity-50 disabled:no-underline flex items-center gap-1"
          >
            {showAdd ? (
              <> <EyeOff size={12} /> Cancel </>
            ) : (
              <> <Plus size={12} /> Add new </>
            )}
          </button>
        </CardHeader>
        <CardContent className="space-y-3">
          {accounts.length === 0 && !usingLegacy ? (
            <div className="text-sm text-white/60 text-center py-4">
              No bank accounts saved yet.
            </div>
          ) : null}

          {accounts.map((acc) => (
            <div
              key={acc.id}
              className={cn(
                "rounded-xl border p-3 transition",
                acc.isDefault
                  ? "border-apron-gold/40 bg-apron-gold/5"
                  : "border-white/10 bg-white/5",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    {acc.nickname ? (
                      <span className="text-sm font-semibold text-white">
                        {acc.nickname}
                      </span>
                    ) : null}
                    {acc.isDefault ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-apron-gold/15 text-apron-gold border border-apron-gold/30 px-2 py-0.5 text-[10px] uppercase">
                        <Star size={10} fill="currentColor" /> Default
                      </span>
                    ) : null}
                    {acc.verified ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 text-green-300 border border-green-400/30 px-2 py-0.5 text-[10px] uppercase">
                        <ShieldCheck size={10} /> Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/15 text-yellow-300 border border-yellow-400/30 px-2 py-0.5 text-[10px] uppercase">
                        <AlertCircle size={10} /> Pending
                      </span>
                    )}
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-white/60 flex items-center gap-1">
                        <Building2 size={12} /> Bank
                      </span>
                      <span className="text-white">{acc.bankName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60 flex items-center gap-1">
                        <CreditCard size={12} /> Account
                      </span>
                      <span className="text-white font-mono">{acc.accountNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Account name</span>
                      <span className="text-white">{acc.accountName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/50">Added</span>
                      <span className="text-white/60">{formatDateTime(acc.addedAt)}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 justify-end">
                {!acc.isDefault && acc.verified ? (
                  <Button
                    size="sm"
                    variant="outline"
                    loading={busyAccId === acc.id}
                    onClick={() => setDefault(acc.id)}
                  >
                    <Star size={13} /> Set default
                  </Button>
                ) : null}
                {acc.id !== "legacy-default" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-400/40 text-red-300 hover:bg-red-500/10"
                    loading={busyAccId === acc.id}
                    onClick={() => removeAccount(acc.id)}
                  >
                    <Trash2 size={13} /> Remove
                  </Button>
                ) : null}
              </div>
            </div>
          ))}

          {showAdd ? (
            <form
              className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-3"
              onSubmit={handleSubmit(
                accounts.length === 0 && !user.bankDetails
                  ? saveLegacyBank
                  : addAccount,
              )}
            >
              <div className="text-xs font-medium text-white/70">
                {accounts.length === 0 && !user.bankDetails
                  ? "Add your first bank account"
                  : `Add another bank account (${accounts.length}/${MAX_BANK_ACCOUNTS})`}
              </div>
              <Input
                label="Nickname (optional)"
                placeholder="e.g. Main salary account"
                error={errors.nickname?.message}
                {...register("nickname")}
              />
              <Input
                label="Bank name"
                placeholder="e.g. Access Bank"
                error={errors.bankName?.message}
                {...register("bankName")}
              />
              <Input
                label="Account number"
                placeholder="10 digits"
                error={errors.accountNumber?.message}
                {...register("accountNumber")}
              />
              <Input
                label="Account name"
                placeholder="As written on bank account"
                error={errors.accountName?.message}
                {...register("accountName")}
              />
              <Button
                type="submit"
                loading={pending || busyAccId === "new" || busyAccId === "legacy"}
              >
                <Plus size={16} /> Save bank account
              </Button>
            </form>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-end justify-between gap-3">
          <div>
            <CardTitle>Recent withdrawals</CardTitle>
            <p className="mt-0.5 text-xs text-white/60">
              {paidWd.length} paid · {pendingWd} pending
            </p>
          </div>
          <Link href="/wallet/history" className="text-xs text-apron-gold hover:underline flex items-center gap-1">
            All <ArrowRight size={12} />
          </Link>
        </CardHeader>
        <CardContent className="space-y-2">
          {withdrawals.length === 0 ? (
            <div className="text-sm text-white/60 text-center py-6">
              No withdrawals yet.
            </div>
          ) : (
            withdrawals.slice(0, 5).map((w) => (
              <Link
                key={w.id}
                href={`/wallet/receipt/${w.id}`}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 hover:bg-white/10 transition"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-apron-gold">
                  <Banknote size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-white flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-[10px] uppercase",
                        w.status === "paid" && "bg-green-500/15 text-green-300 border border-green-400/30",
                        w.status === "pending" && "bg-apron-gold/15 text-apron-gold border border-apron-gold/30",
                        w.status === "rejected" && "bg-red-500/15 text-red-300 border border-red-400/30",
                      )}
                    >
                      {w.status}
                    </span>
                    <span className="text-white/80 font-normal text-xs">
                      {formatDateTime(w.createdAt)}
                    </span>
                  </div>
                  <div className="text-xs text-white/50 mt-0.5 truncate">
                    {w.bankDetails?.bankName ?? "Bank"} · {w.bankDetails?.accountNumber ?? "—"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-white">
                    {formatNaira(w.netAmount)}
                  </div>
                  <div className="text-[11px] text-white/50">
                    Gross {formatNaira(w.amount)}
                  </div>
                </div>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
