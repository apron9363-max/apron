import Link from "next/link";
import { Trophy, Rocket, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function ContestPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
          <Trophy size={22} className="text-apron-gold" /> Contests
        </h1>
        <p className="mt-1 text-sm text-white/60">
          Win big with weekly leaderboards and tournaments.
        </p>
      </div>

      <Card className="!border-apron-gold/30 !bg-gradient-to-br from-apron-gold/10 via-apron-pink/10 to-apron-bg-dark">
        <CardContent className="pt-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs uppercase tracking-wide text-apron-gold font-semibold">
                Live now
              </div>
              <div className="mt-1 text-2xl font-bold text-white">
                Weekly Top Earner
              </div>
              <div className="mt-1 text-sm text-white/70">
                Ends in 4 days · Top 10 share the reward pool.
              </div>
            </div>
            <Trophy className="text-apron-gold" size={32} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-white/60">Prize pool</div>
              <div className="mt-1 text-lg font-bold text-gradient-gold">
                100,000 APN
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-white/60">Participants</div>
              <div className="mt-1 text-lg font-bold text-white">248</div>
            </div>
          </div>
          <Link href="/tasks" className="mt-4 block">
            <Button className="w-full">
              <Rocket size={16} /> Start earning to join
              <ArrowRight size={16} />
            </Button>
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upcoming contests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-white">
                  Referral Rush
                </div>
                <div className="text-xs text-white/60">
                  Starts Monday · Invite 3+ friends to qualify
                </div>
              </div>
              <div className="text-xs uppercase tracking-wide text-apron-gold font-semibold">
                50k APN
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-white">
                  Quiz Master
                </div>
                <div className="text-xs text-white/60">
                  High score on daily quizzes wins
                </div>
              </div>
              <div className="text-xs uppercase tracking-wide text-apron-gold font-semibold">
                25k APN
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
