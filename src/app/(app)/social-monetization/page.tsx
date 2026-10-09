import Link from "next/link";
import { Share2, Users, Rocket, Instagram, Twitter, Youtube, Zap, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function SocialMonetizationPage() {
  const socials = [
    { icon: Instagram, label: "Instagram", followers: "≥ 1,000", payout: "200 APN/task" },
    { icon: Twitter, label: "X / Twitter", followers: "≥ 500", payout: "150 APN/task" },
    { icon: Youtube, label: "YouTube", followers: "≥ 500 subs", payout: "400 APN/task" },
    { icon: Share2, label: "TikTok", followers: "≥ 1,000", payout: "250 APN/task" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
          <Rocket size={22} className="text-apron-gold" /> Social Monetization
        </h1>
        <p className="mt-1 text-sm text-white/60">
          Monetize your social audience with easy promo tasks.
        </p>
      </div>

      <Card className="!border-apron-pink/40 !bg-gradient-to-br from-apron-pink/15 via-apron-bg-dark to-apron-gold/10">
        <CardContent className="pt-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-apron-pink font-semibold">
                Creator program
              </div>
              <div className="mt-1 text-2xl font-bold text-white">
                Turn followers into APN
              </div>
              <div className="mt-1 text-sm text-white/70">
                Share, post, review — get paid per task.
              </div>
            </div>
            <Zap className="text-apron-pink" size={32} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
              <div className="text-white/60">Total payouts</div>
              <div className="mt-1 text-lg font-bold text-gradient-gold">
                2.4M APN
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
              <div className="text-white/60">Creators</div>
              <div className="mt-1 text-lg font-bold text-white">1,205</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
              <div className="text-white/60">Avg / task</div>
              <div className="mt-1 text-lg font-bold text-apron-pink">
                220 APN
              </div>
            </div>
          </div>
          <Link href="/tasks" className="mt-4 block">
            <Button className="w-full">
              <Users size={16} /> Connect my socials
              <ArrowRight size={16} />
            </Button>
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Platforms</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {socials.map(({ icon: Icon, label, followers, payout }) => (
            <div
              key={label}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-apron-gold/15 border border-apron-gold/30 text-apron-gold">
                <Icon size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-white">{label}</div>
                <div className="text-xs text-white/60">
                  Requirement: {followers}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-white/60">Payout</div>
                <div className="text-sm font-semibold text-gradient-gold">
                  {payout}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
