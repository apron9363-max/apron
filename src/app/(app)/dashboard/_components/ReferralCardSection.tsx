import Link from "next/link";
import { ArrowRight, UserPlus, MousePointerClick, UserCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { SITE_URL } from "@/lib/constants";
import type { UserDoc } from "@/types";
import {
  CopyReferral,
  ReferralShareWhatsApp,
  ReferralShareTwitter,
} from "./ReferralTools";

interface ReferralCardSectionProps {
  user: UserDoc;
  referralSignupsCount: number;
}

export function ReferralCardSection({
  user,
  referralSignupsCount,
}: ReferralCardSectionProps) {
  const referralLink = `${SITE_URL}/register?ref=${user.referralCode}`;

  return (
    <section>
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>My referral link & stats</CardTitle>
            <p className="mt-0.5 text-sm text-white/60">
              Invite friends, earn bonus APN when they verify.
            </p>
          </div>
          <UserPlus size={20} className="text-apron-gold" />
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-3">
            <div className="glass inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-white/90">
              <MousePointerClick size={16} className="text-apron-gold" />
              <span className="text-white/60 text-xs">Clicks:</span>
              <span className="font-semibold text-white">
                {user.referralClicks ?? 0}
              </span>
            </div>
            <div className="glass inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-white/90">
              <UserCheck size={16} className="text-emerald-400" />
              <span className="text-white/60 text-xs">Sign-ups:</span>
              <span className="font-semibold text-white">
                {referralSignupsCount}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
            <span className="flex-1 truncate text-sm text-white/90">
              {referralLink}
            </span>
            <CopyReferral text={referralLink} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-apron-gold/10 border border-apron-gold/20 px-3 py-2">
            <div className="flex items-center gap-3 text-xs text-white/80">
              <span>
                Your code:{" "}
                <span className="font-mono font-semibold text-apron-gold">
                  {user.referralCode}
                </span>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ReferralShareWhatsApp text={referralLink} />
              <ReferralShareTwitter text={referralLink} />
              <Link
                href="/referrals"
                className="text-xs flex items-center gap-1 text-apron-gold hover:underline ml-1"
              >
                View referrals <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

export default ReferralCardSection;
