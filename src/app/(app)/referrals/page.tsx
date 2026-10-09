import Link from "next/link";
import { UserPlus, Gift, ArrowRight, Coins } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { formatAPN, formatDateTime } from "@/lib/utils";
import { SITE_URL } from "@/lib/constants";
import { getCurrentUserDataAction } from "@/server/actions/userActions";

export const dynamic = "force-dynamic";

export default async function ReferralsPage() {
  const { user, earnings } = await getCurrentUserDataAction();
  if (!user) return null;

  const refEarnings = earnings.filter((e) => e.source === "referral");
  const totalRefBonus = refEarnings.reduce((s, e) => s + e.amount, 0);
  const referralLink = `${SITE_URL}/register?ref=${user.referralCode}`;
  const waLink = `https://wa.me/?text=${encodeURIComponent(`Join Apron & earn APN coins! Use my referral link: ${referralLink}`)}`;
  const twLink = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Join Apron & earn APN coins with my referral link: ${referralLink}`)}`;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
          <UserPlus size={22} className="text-apron-gold" /> Referrals
        </h1>
        <p className="mt-1 text-sm text-white/60">
          Share your link. Earn APN when friends join & verify their email.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Referrals earned"
          value={formatAPN(totalRefBonus)}
          icon={Gift}
          iconColor="text-apron-gold"
        />
        <StatCard
          label="My code"
          value={user.referralCode}
          icon={Coins}
          valueClassName="font-mono text-apron-gold text-base"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Share your link</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm break-all text-white/90">
            {referralLink}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <a href={waLink} target="_blank" rel="noreferrer noopener">
              <Button variant="outline" className="w-full">
                WhatsApp
              </Button>
            </a>
            <a href={twLink} target="_blank" rel="noreferrer noopener">
              <Button variant="secondary" className="w-full">
                Twitter
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent referrals</CardTitle>
        </CardHeader>
        <CardContent>
          {refEarnings.length === 0 ? (
            <div className="text-sm text-white/60 text-center py-4">
              No referral earnings yet. Share your link to invite friends!
              <div className="mt-3">
                <Link href="/dashboard">
                  <Button size="sm">
                    Back to dashboard <ArrowRight size={14} />
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <ul className="space-y-3">
              {refEarnings.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-apron-gold/15 border border-apron-gold/30 text-apron-gold">
                    <Gift size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-white">
                      Referral bonus
                    </div>
                    <div className="text-xs text-white/50">
                      {formatDateTime(e.createdAt)}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-apron-gold">
                    +{formatAPN(e.amount)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
