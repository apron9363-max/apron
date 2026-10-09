"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  FileDown,
  History,
  Home,
  Printer,
  ShieldCheck,
  XCircle,
  Building2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatNaira, formatDateTime, formatAPN } from "@/lib/utils";
import { getWithdrawalAction } from "@/server/actions/taskActions";
import type { WithdrawalDoc } from "@/types";
import { cn } from "@/lib/utils";

export default function WalletReceiptPage() {
  const params = useParams<{ wdId: string }>();
  const router = useRouter();
  const wdId = params?.wdId as string;
  const [withdrawal, setWithdrawal] = useState<WithdrawalDoc | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedTx, setCopiedTx] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const receiptRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async (id: string) => {
    const res = (await getWithdrawalAction(id)) as any;
    if (!res) {
      setError("Withdrawal record not found");
      setLoaded(true);
      return;
    }
    if ("ok" in res) {
      if (!res.ok) {
        setError(res.error ?? "Unable to load receipt");
        setLoaded(true);
        return;
      }
      setWithdrawal(res.withdrawal ?? null);
    } else {
      setWithdrawal(res as WithdrawalDoc);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!wdId) return;
    load(wdId).catch(() => setError("Unable to load receipt"));
  }, [wdId, load]);

  async function copy(text: string, type: "tx" | "id") {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      if (type === "tx") {
        setCopiedTx(true);
        setTimeout(() => setCopiedTx(false), 2000);
      } else {
        setCopiedId(true);
        setTimeout(() => setCopiedId(false), 2000);
      }
    } catch {
      // noop
    }
  }

  function printReceipt() {
    if (!receiptRef.current) return;
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) return;
    const content = receiptRef.current.innerHTML;
    w.document.write(`<!doctype html><html><head><title>Apron — Withdrawal Receipt</title>
      <style>
        body { font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; color:#111; margin: 32px; }
        .hdr { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
        .sub { color: #555; font-size: 13px; margin-bottom: 24px; }
        .row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #ddd; font-size: 14px; }
        .row b { font-weight: 600; }
        .total { border-top: 2px solid #111; padding-top: 12px; margin-top: 12px; font-size: 18px; font-weight: 800; }
        .badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; }
        .p { background: #FEF3C7; color: #92400E; }
        .ok { background: #D1FAE5; color: #065F46; }
        .bad { background: #FEE2E2; color: #991B1B; }
        .tx { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background:#F5F5F5; padding: 6px 8px; border-radius: 6px; display:inline-block; }
      </style></head><body>
        <div class="hdr">Apron — Withdrawal Receipt</div>
        <div class="sub">Thank you for using Apron. Keep this receipt for your records.</div>
        ${content}
      </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  }

  function saveReceipt() {
    if (!receiptRef.current || !withdrawal) return;
    const title = `withdrawal-receipt-${withdrawal.transactionId ?? wdId}.txt`;
    const lines: string[] = [];
    lines.push("Apron — Withdrawal Receipt");
    lines.push("============================");
    lines.push(`Transaction ID : ${withdrawal.transactionId ?? "N/A"}`);
    lines.push(`Receipt ID     : ${withdrawal.id}`);
    lines.push(`Status         : ${withdrawal.status.toUpperCase()}`);
    lines.push(`Submitted at   : ${formatDateTime(withdrawal.createdAt)}`);
    if (withdrawal.processedAt) lines.push(`Processed at   : ${formatDateTime(withdrawal.processedAt)}`);
    lines.push("");
    lines.push(`Bank           : ${withdrawal.bankDetails?.bankName ?? "—"}`);
    lines.push(`Account number : ${withdrawal.bankDetails?.accountNumber ?? "—"}`);
    lines.push(`Account name   : ${withdrawal.bankDetails?.accountName ?? "—"}`);
    lines.push("");
    lines.push(`Gross amount   : ${formatNaira(withdrawal.amount)}`);
    lines.push(`Platform fee   : -${formatNaira(withdrawal.fee)}`);
    lines.push(`Net deposit    : ${formatNaira(withdrawal.netAmount)}`);
    if (withdrawal.note) lines.push(`\nNote: ${withdrawal.note}`);
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = title;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (!loaded) {
    return (
      <Card>
        <CardContent className="text-sm text-white/70 py-8 text-center">
          Loading receipt…
        </CardContent>
      </Card>
    );
  }

  if (error || !withdrawal) {
    return (
      <Card>
        <CardContent className="py-8 text-center space-y-4">
          <div className="text-lg font-semibold text-white">
            {error ?? "Receipt not found"}
          </div>
          <Link href="/wallet/history">
            <Button variant="outline">
              <History size={16} /> View history
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const statusBadge =
    withdrawal.status === "paid"
      ? { cls: "bg-green-500/15 text-green-300 border border-green-400/30", icon: <CheckCircle2 size={12} />, text: "Paid" }
      : withdrawal.status === "rejected"
      ? { cls: "bg-red-500/15 text-red-300 border border-red-400/30", icon: <XCircle size={12} />, text: "Rejected" }
      : { cls: "bg-apron-gold/15 text-apron-gold border border-apron-gold/30", icon: <Clock size={12} />, text: "Pending" };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Link href="/wallet" className="text-white/60 hover:text-white">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Banknote size={20} className="text-apron-gold" /> Withdrawal receipt
          </h1>
          <p className="text-xs text-white/60 mt-0.5">
            {formatDateTime(withdrawal.createdAt)}
          </p>
        </div>
      </div>

      <Card className="!border-apron-gold/40 !bg-gradient-to-br from-apron-gold/10 to-apron-pink/5 overflow-hidden">
        <CardHeader className="border-b border-white/10 !pb-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide border backdrop-blur-sm" style={{ display: "inline-flex" }}>
                <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] uppercase border", statusBadge.cls)}>
                  {statusBadge.icon} {statusBadge.text}
                </span>
              </div>
              <div className="text-[11px] text-white/60">
                Processing is complete after review
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-white/50">
                Net amount
              </div>
              <div className="text-2xl font-extrabold text-gradient-gold">
                {formatNaira(withdrawal.netAmount)}
              </div>
              <div className="text-[11px] text-white/60 mt-0.5">
                ≈ {formatAPN(withdrawal.netAmount)} APN
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div ref={receiptRef} className="space-y-4 text-sm">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] uppercase tracking-wider text-white/50">
                    Transaction ID
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex items-center rounded-lg border border-apron-gold/40 bg-apron-gold/5 px-2 py-1 font-mono text-xs text-apron-gold">
                      {withdrawal.transactionId ?? `WDL-${withdrawal.id}`}
                    </span>
                    <button
                      onClick={() => copy(withdrawal.transactionId ?? `WDL-${withdrawal.id}`, "tx")}
                      className="inline-flex items-center gap-1 text-[11px] text-white/60 hover:text-apron-gold"
                    >
                      {copiedTx ? (
                        <><CheckCircle2 size={12} /> Copied</>
                      ) : (
                        <><Copy size={12} /> Copy</>
                      )}
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-white/50">
                    Receipt ID
                  </div>
                  <div className="mt-0.5 inline-flex items-center gap-1.5">
                    <span className="font-mono text-xs text-white/80">{withdrawal.id}</span>
                    <button
                      onClick={() => copy(withdrawal.id, "id")}
                      className="inline-flex items-center gap-1 text-[11px] text-white/50 hover:text-apron-gold"
                    >
                      {copiedId ? (
                        <><CheckCircle2 size={11} /></>
                      ) : (
                        <><Copy size={11} /></>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div className="col-span-2 h-px bg-white/10" />
              <div className="text-white/60">Gross amount</div>
              <div className="text-right text-white">{formatNaira(withdrawal.amount)}</div>

              <div className="text-white/60 flex items-center gap-1">
                Platform fee
              </div>
              <div className="text-right text-white/80">
                -{formatNaira(withdrawal.fee)}
              </div>

              <div className="col-span-2 h-px bg-white/10" />
              <div className="text-white/80 font-semibold text-sm">Net deposit</div>
              <div className="text-right text-apron-gold font-extrabold text-sm">
                {formatNaira(withdrawal.netAmount)}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2 text-xs">
              <div className="text-[11px] uppercase tracking-wider text-white/60 flex items-center gap-1">
                <ShieldCheck size={12} className="text-apron-gold" /> Destination account
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-white/60 flex items-center gap-1">
                  <Building2 size={12} /> Bank
                </span>
                <span className="text-white text-right">{withdrawal.bankDetails?.bankName ?? "—"}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-white/60 flex items-center gap-1">
                  <CreditCard size={12} /> Account number
                </span>
                <span className="text-white text-right font-mono">{withdrawal.bankDetails?.accountNumber ?? "—"}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-white/60">Account name</span>
                <span className="text-white text-right">{withdrawal.bankDetails?.accountName ?? "—"}</span>
              </div>
            </div>

            <div className="text-xs text-white/60 space-y-1.5">
              <div className="flex justify-between">
                <span>Submitted</span>
                <span className="text-white/80 text-right">{formatDateTime(withdrawal.createdAt)}</span>
              </div>
              {withdrawal.processedAt ? (
                <div className="flex justify-between">
                  <span>{withdrawal.status === "paid" ? "Paid at" : "Processed at"}</span>
                  <span className="text-white/80 text-right">{formatDateTime(withdrawal.processedAt)}</span>
                </div>
              ) : null}
              {withdrawal.rejectReason ? (
                <div className="mt-2 rounded-lg border border-red-400/30 bg-red-500/10 p-2 text-[11px] text-red-200">
                  Rejection note: {withdrawal.rejectReason}
                </div>
              ) : null}
              {withdrawal.note ? (
                <div className="mt-2 rounded-lg border border-white/10 bg-white/5 p-2 text-[11px] text-white/70">
                  {withdrawal.note}
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={printReceipt}>
              <Printer size={14} /> Print
            </Button>
            <Button variant="outline" onClick={saveReceipt}>
              <FileDown size={14} /> Save .txt
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Link href="/wallet/history">
          <Button variant="outline" className="w-full justify-start">
            <History size={16} /> View in transaction history
          </Button>
        </Link>
        <Link href="/wallet">
          <Button variant="outline" className="w-full justify-start">
            <Home size={16} /> Return to wallet
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Link href="/">
          <Button variant="ghost" className="w-full justify-start">
            <Home size={14} /> Dashboard
          </Button>
        </Link>
        <Link href="/wallet/withdraw">
          <Button className="w-full justify-end">
            New withdrawal <ArrowRight size={14} />
          </Button>
        </Link>
      </div>

      <p className="text-[11px] text-white/40 text-center leading-relaxed">
        Pending withdrawals are reviewed internally. If approved, the net amount will be deposited into the bank account listed above.
        Keep your transaction ID safe for future reference.
      </p>
    </div>
  );
}
