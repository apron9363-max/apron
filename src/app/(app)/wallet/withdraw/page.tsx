"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  ChevronDown,
  Building2,
  CreditCard,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Lock,
  Info,
  Star,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { formatNaira, formatAPN } from "@/lib/utils";
import { getCurrentUserDataAction, listMyBankAccountsAction } from "@/server/actions/userActions";
import { requestWithdrawalAction } from "@/server/actions/taskActions";
import type { UserDoc, VerifiedBankAccount } from "@/types";
import { cn } from "@/lib/utils";
import {
  MIN_WITHDRAWAL,
  MAX_WITHDRAWAL,
  WITHDRAWAL_FEE_PCT,
  WITHDRAWAL_PROCESSING_FEE_PCT,
} from "@/lib/constants";

const chipAmounts = [1000, 2500, 5000, 10000, 25000, 50000];

export default function WithdrawPageClient() {
  const router = useRouter();
  const [user, setUser] = useState<UserDoc | null>(null);
  const [accounts, setAccounts] = useState<VerifiedBankAccount[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [amountInput, setAmountInput] = useState<string>("");
  const [bankAccountId, setBankAccountId] = useState<string>("");
  const [customAmountError, setCustomAmountError] = useState<string>("");
  const [submitError, setSubmitError] = useState<string>("");
  const [submitOk, setSubmitOk] = useState<null | {
    withdrawalId: string;
    wdId?: string;
  }>(null);

  const [, startTx] = useTransition();
  const [submitting, startSubmit] = useTransition();
  const [submittedOnce, setSubmittedOnce] = useState(false);

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === bankAccountId) ?? null,
    [accounts, bankAccountId],
  );

  const numericAmount = useMemo(() => {
    const v = Number(amountInput);
    return Number.isFinite(v) && v > 0 ? v : 0;
  }, [amountInput]);

  const { platformFee, processingFee, fee, net } = useMemo(() => {
    const a = numericAmount;
    const p = Math.round(a * WITHDRAWAL_FEE_PCT);
    const pr = Math.round(a * WITHDRAWAL_PROCESSING_FEE_PCT);
    return {
      platformFee: p,
      processingFee: pr,
      fee: p + pr,
      net: Math.max(0, a - (p + pr)),
    };
  }, [numericAmount]);

  const load = useCallback(function load() {
    startTx(async () => {
      const [uRes, aRes] = await Promise.all([
        getCurrentUserDataAction() as any,
        listMyBankAccountsAction(),
      ]);
      const u: UserDoc | null = uRes?.user ?? null;
      const accs: VerifiedBankAccount[] = aRes.ok ? aRes.accounts : [];
      if (u?.bankDetails && accs.length === 0) {
        accs.push({
          id: "legacy-default",
          bankName: u.bankDetails.bankName,
          accountNumber: u.bankDetails.accountNumber,
          accountName: u.bankDetails.accountName,
          nickname: "Default",
          verified: true,
          addedAt: u.createdAt ?? Date.now(),
          verifiedAt: u.createdAt ?? Date.now(),
          isDefault: true,
        });
      }
      setUser(u);
      setAccounts(accs);
      if (accs.length > 0 && !bankAccountId) {
        const def = accs.find((a) => a.isDefault) ?? accs[0];
        if (def?.verified) setBankAccountId(def.id);
      }
      setLoaded(true);
    });
  }, [startTx, bankAccountId]);

  useEffect(() => {
    load();
  }, [load]);

  const balance = user?.balance ?? 0;

  useEffect(() => {
    if (!amountInput) {
      setCustomAmountError("");
      return;
    }
    if (!Number.isFinite(Number(amountInput))) {
      setCustomAmountError("Enter a valid number");
      return;
    }
    if (Number(amountInput) < MIN_WITHDRAWAL) {
      setCustomAmountError(`Minimum amount is ${formatNaira(MIN_WITHDRAWAL)}`);
      return;
    }
    if (Number(amountInput) > MAX_WITHDRAWAL) {
      setCustomAmountError(`Maximum amount is ${formatNaira(MAX_WITHDRAWAL)}`);
      return;
    }
    if (Number(amountInput) > balance) {
      setCustomAmountError("Amount exceeds your wallet balance");
      return;
    }
    if (!Number.isInteger(Number(amountInput))) {
      setCustomAmountError("Amount must be a whole number");
      return;
    }
    setCustomAmountError("");
  }, [amountInput, balance]);

  function selectChip(v: number) {
    setAmountInput(String(v));
    setSubmitError("");
    setSubmitOk(null);
  }

  function onAmountChange(v: string) {
    if (v === "") {
      setAmountInput("");
      return;
    }
    const cleaned = v.replace(/[^\d]/g, "");
    setAmountInput(cleaned);
    setSubmitError("");
    setSubmitOk(null);
  }

  const canSubmit = useMemo(() => {
    if (submitting) return false;
    if (submittedOnce) return false;
    if (!numericAmount) return false;
    if (customAmountError) return false;
    if (!selectedAccount || !selectedAccount.verified) return false;
    if (net <= 0) return false;
    return true;
  }, [submitting, submittedOnce, numericAmount, customAmountError, selectedAccount, net]);

  function submit() {
    if (!canSubmit) return;
    setSubmitError("");
    setSubmittedOnce(true);
    startSubmit(async () => {
      const res: any = await requestWithdrawalAction({
        amount: numericAmount,
        bankAccountId: selectedAccount!.id,
      });
      if (res.ok) {
        setSubmitOk({
          withdrawalId: res.withdrawalId ?? res.wdId,
          wdId: res.wdId ?? res.withdrawalId,
        });
        const target = res.wdId ?? res.withdrawalId;
        if (target) {
          router.replace(`/wallet/receipt/${target}`);
        }
      } else {
        setSubmitError(res.error ?? "Unable to process withdrawal. Please try again.");
        if (!res?.duplicate) {
          setSubmittedOnce(false);
        }
      }
    });
  }

  if (!loaded || !user) {
    return (
      <Card>
        <CardContent className="text-sm text-white/70 py-8 text-center">
          Loading…
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Link href="/wallet" className="text-white/60 hover:text-white">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Banknote size={20} className="text-apron-gold" /> Withdraw
          </h1>
          <p className="text-xs text-white/60 mt-0.5">
            Available: <span className="text-white font-semibold">{formatAPN(balance)} · {formatNaira(balance)}</span>
          </p>
        </div>
      </div>

      <Card className="!border-apron-gold/30 !bg-gradient-to-br from-apron-purple/40 to-apron-pink/10">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Lock size={14} className="text-apron-gold" /> Secure withdrawal
            <span className="ml-auto text-[11px] font-normal text-white/60 flex items-center gap-1">
              <Info size={12} /> Min {formatNaira(MIN_WITHDRAWAL)} · Max {formatNaira(MAX_WITHDRAWAL)}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-xs text-white/70 mb-2 block">Quick amount</label>
            <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
              {chipAmounts.map((v) => {
                const disabled = v > balance;
                const selected = Number(amountInput) === v && amountInput !== "";
                return (
                  <button
                    type="button"
                    key={v}
                    onClick={() => !disabled && selectChip(v)}
                    disabled={disabled}
                    className={cn(
                      "rounded-xl border px-2 py-2 text-sm transition",
                      selected
                        ? "border-apron-gold bg-apron-gold/15 text-apron-gold"
                        : disabled
                        ? "border-white/5 bg-white/5 text-white/30 cursor-not-allowed"
                        : "border-white/10 bg-white/5 text-white hover:bg-white/10",
                    )}
                  >
                    {formatNaira(v)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="relative">
            <Input
              label="Withdrawal amount (APN)"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder={`e.g. ${MIN_WITHDRAWAL}`}
              value={amountInput}
              error={customAmountError}
              className="pr-14"
              onChange={(e) => onAmountChange(e.target.value)}
            />
            <div className="pointer-events-none absolute right-3 bottom-[10px] text-xs text-white/50">
              APN
            </div>
          </div>

          {numericAmount > 0 ? (
            <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-white/70">Gross amount</span>
                <span className="text-white">{formatNaira(numericAmount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60 flex items-center gap-1">
                  Platform fee ({(WITHDRAWAL_FEE_PCT * 100).toFixed(0)}%)
                </span>
                <span className="text-white/80">-{formatNaira(platformFee)}</span>
              </div>
              {WITHDRAWAL_PROCESSING_FEE_PCT > 0 ? (
                <div className="flex items-center justify-between">
                  <span className="text-white/60 flex items-center gap-1">
                    Processing fee ({(WITHDRAWAL_PROCESSING_FEE_PCT * 100).toFixed(2)}%)
                  </span>
                  <span className="text-white/80">-{formatNaira(processingFee)}</span>
                </div>
              ) : null}
              <div className="h-px bg-white/10 my-1" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/80 font-medium">You receive</span>
                <span className={cn(
                  "font-bold",
                  net > 0 ? "text-apron-gold" : "text-red-300",
                )}>
                  {formatNaira(net)}
                </span>
              </div>
              {numericAmount > balance ? (
                <div className="mt-2 rounded-lg border border-red-400/30 bg-red-500/10 text-red-200 p-2 text-[11px] flex items-center gap-1.5">
                  <AlertCircle size={12} />
                  Insufficient balance. Your current balance is {formatNaira(balance)}.
                </div>
              ) : null}
              {net <= 0 && numericAmount > 0 ? (
                <div className="mt-2 rounded-lg border border-yellow-400/30 bg-yellow-500/10 text-yellow-200 p-2 text-[11px] flex items-center gap-1.5">
                  <Info size={12} />
                  Fees exceed the amount. Please increase the withdrawal amount.
                </div>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <ShieldCheck size={14} className="text-apron-gold" /> Destination bank account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {accounts.length === 0 ? (
            <div className="text-sm text-white/70 text-center py-4 space-y-3">
              <div>No verified bank accounts found.</div>
              <Link href="/wallet">
                <Button variant="outline" size="sm">
                  <Building2 size={14} /> Add bank account
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <Select
                value={bankAccountId}
                onChange={(v) => setBankAccountId(v)}
                placeholder="Select a verified bank account"
                label="Verified bank account"
                className="w-full"
                options={accounts.filter((a) => a.verified).map((acc) => ({
                  value: acc.id,
                  label: `${acc.isDefault ? "★ " : ""}${acc.nickname ?? acc.bankName} — ${acc.accountNumber}`,
                }))}
              />

              {selectedAccount ? (
                <div className="rounded-xl border border-apron-gold/30 bg-apron-gold/5 p-3 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-white/60 flex items-center gap-1">
                      <Star size={12} className="text-apron-gold" /> Nickname
                    </span>
                    <span className="text-white">{selectedAccount.nickname ?? "—"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/60 flex items-center gap-1">
                      <Building2 size={12} /> Bank
                    </span>
                    <span className="text-white">{selectedAccount.bankName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/60 flex items-center gap-1">
                      <CreditCard size={12} /> Account number
                    </span>
                    <span className="text-white font-mono">{selectedAccount.accountNumber}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">Account name</span>
                    <span className="text-white">{selectedAccount.accountName}</span>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      {submitOk ? (
        <div className="rounded-xl border border-green-400/40 bg-green-500/10 text-green-200 p-3 text-sm flex items-center gap-2">
          <CheckCircle2 size={16} />
          Withdrawal request submitted. Redirecting to receipt…
        </div>
      ) : null}

      {submitError ? (
        <div className="rounded-xl border border-red-400/40 bg-red-500/10 text-red-200 p-3 text-sm flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <div>{submitError}</div>
        </div>
      ) : null}

      <Button
        size="lg"
        loading={submitting || !!(submitOk && submitOk.withdrawalId)}
        onClick={submit}
        disabled={!canSubmit || !!submitOk}
      >
        {submitting ? "Submitting…" : submitOk ? "Processing…" : "Request withdrawal"}
        <ArrowRight size={16} />
      </Button>

      <p className="text-[11px] text-white/50 text-center leading-relaxed px-2">
        Funds are deducted immediately. Approved withdrawals are processed within 24 hours.
        By submitting you confirm the destination account belongs to you.
      </p>
    </div>
  );
}
