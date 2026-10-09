import Link from "next/link";
import { HandCoins, Banknote, Clock, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatNaira } from "@/lib/utils";
import { getCurrentUserDataAction } from "@/server/actions/userActions";

export const dynamic = "force-dynamic";

export default async function LoansPage() {
  const { user } = await getCurrentUserDataAction();
  if (!user) return null;
  const eligibility = Math.min(
    50_000,
    Math.max(5_000, Math.round(user.balance * 2 + user.taskBalance * 3)),
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
          <HandCoins size={22} className="text-apron-gold" /> Loans
        </h1>
        <p className="mt-1 text-sm text-white/60">
          Borrow against your APN balance and repay later.
        </p>
      </div>

      <Card className="!border-apron-gold/30 !bg-gradient-to-br from-apron-bg-dark via-apron-gold/10 to-apron-pink/10">
        <CardContent className="pt-4">
          <div className="text-xs uppercase tracking-wide text-white/60">
            Your maximum eligibility
          </div>
          <div className="mt-1 text-4xl font-bold text-gradient-gold">
            {formatNaira(eligibility)}
          </div>
          <div className="mt-2 text-xs text-white/60">
            Based on your current balance of {formatNaira(Math.max(0, user.balance))}.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Loan offers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { amount: 10000, term: "30 days", rate: "5%" },
            { amount: 25000, term: "60 days", rate: "8%" },
            { amount: 50000, term: "90 days", rate: "12%" },
          ].map((offer) => (
            <div
              key={offer.amount}
              className="rounded-xl border border-white/10 bg-white/5 p-4 flex items-center justify-between gap-3"
            >
              <div>
                <div className="text-lg font-semibold text-white">
                  {formatNaira(offer.amount)}
                </div>
                <div className="text-xs text-white/60">
                  {offer.term} · Interest {offer.rate}
                </div>
              </div>
              <Button size="sm" variant="outline">Apply</Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How it works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-apron-gold/15 border border-apron-gold/30 text-apron-gold">
              <Clock size={16} />
            </span>
            <div>
              <div className="text-sm font-semibold text-white">Instant decision</div>
              <div className="text-xs text-white/60">Approved in under 5 minutes.</div>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-apron-gold/15 border border-apron-gold/30 text-apron-gold">
              <Banknote size={16} />
            </span>
            <div>
              <div className="text-sm font-semibold text-white">Fast disbursement</div>
              <div className="text-xs text-white/60">Sent directly to your saved bank.</div>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-apron-gold/15 border border-apron-gold/30 text-apron-gold">
              <ShieldCheck size={16} />
            </span>
            <div>
              <div className="text-sm font-semibold text-white">Flexible repay</div>
              <div className="text-xs text-white/60">Settle from your APN balance anytime.</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
