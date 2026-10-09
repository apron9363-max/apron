"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Banknote, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatDateTime, formatNaira } from "@/lib/utils";
import { listMyWithdrawalsAction } from "@/server/actions/taskActions";
import type { WithdrawalDoc } from "@/types";
import { cn } from "@/lib/utils";

export default function WithdrawalHistoryClient() {
  const router = useRouter();
  const [withdrawals, setWithdrawals] = useState<WithdrawalDoc[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [, startTx] = useTransition();
  const [filter, setFilter] = useState<"all" | "pending" | "paid" | "rejected">("all");

  function load() {
    startTx(async () => {
      listMyWithdrawalsAction()
        .then((r: any) => setWithdrawals(r.withdrawals ?? []))
        .finally(() => setLoaded(true));
    });
  }
  useEffect(load, []);

  const filtered = withdrawals.filter((w) => filter === "all" || w.status === filter);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-apron-gold">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
            <Clock size={22} className="text-apron-gold" /> Withdrawal History
          </h1>
          <p className="text-sm text-white/60 mt-1">{withdrawals.length} total</p>
        </div>
      </div>

      <Card>
        <CardContent className="!py-3">
          <div className="grid grid-cols-4 gap-1 text-xs">
            {(["all", "pending", "paid", "rejected"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded-xl px-2 py-2 capitalize transition",
                  filter === f
                    ? "bg-apron-gold/15 text-apron-gold border border-apron-gold/30"
                    : "text-white/70 hover:text-white/90 border border-transparent",
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {!loaded ? (
        <Card>
          <CardContent className="text-sm text-white/70 text-center py-8">
            Loading…
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="text-sm text-white/70 text-center py-8">
            No {filter === "all" ? "" : filter} withdrawals yet.
            <div className="mt-3">
              <Link href="/wallet/withdraw" className="text-apron-gold underline text-xs">
                Request a withdrawal
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((w) => (
            <Link
              key={w.id}
              href={`/wallet/receipt/${w.id}`}
              className="glass !p-4 flex items-center gap-3"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-apron-gold">
                <Banknote size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 truncate text-sm font-medium text-white">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-[10px] uppercase",
                      w.status === "paid" &&
                        "bg-green-500/15 text-green-300 border border-green-400/30",
                      w.status === "pending" &&
                        "bg-apron-gold/15 text-apron-gold border border-apron-gold/30",
                      w.status === "rejected" &&
                        "bg-red-500/15 text-red-300 border border-red-400/30",
                    )}
                  >
                    {w.status}
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-white/60 truncate">
                  {w.bankDetails?.bankName} · {w.bankDetails?.accountNumber}
                </div>
                <div className="mt-0.5 text-[11px] text-white/45">
                  {formatDateTime(w.createdAt)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-white">{formatNaira(w.netAmount)}</div>
                <div className="text-[11px] text-white/50">Gross {formatNaira(w.amount)}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
