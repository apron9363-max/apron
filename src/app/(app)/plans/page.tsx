import Link from "next/link";
import { Crown, Check, ArrowRight, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { formatAPN, formatNaira } from "@/lib/utils";
import {
  getCurrentUserDataAction,
  getPlansAction,
  upgradeUserPlanAction,
} from "@/server/actions/userActions";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const [{ user }, plans] = await Promise.all([
    getCurrentUserDataAction(),
    getPlansAction(),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Choose a plan</h1>
        <p className="mt-1 text-sm text-white/60">
          Higher plans unlock higher hourly APN rates and premium features.
        </p>
      </div>

      {user ? (
        <StatCard
          label="Your current plan"
          value={<span className="capitalize">{user.plan}</span>}
          icon={Crown}
          sublabel={
            user.planExpiresAt && user.planExpiresAt > Date.now()
              ? `Expires ${new Date(user.planExpiresAt).toLocaleDateString()}`
              : "Active (free tier)"
          }
        />
      ) : null}

      <div className="flex flex-col gap-4">
        {plans.map((plan) => {
          const isCurrent = user?.plan === plan.id;
          const isPaid = plan.price > 0;
          return (
            <Card
              key={plan.id}
              className={cn(
                "relative overflow-hidden",
                isCurrent && "ring-2 ring-apron-gold/60",
              )}
            >
              {isCurrent ? (
                <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-apron-gold text-apron-bg-dark px-3 py-1 text-[11px] font-bold uppercase">
                  Current
                </span>
              ) : null}
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Crown size={20} className="text-apron-gold" />
                  <CardTitle>{plan.name}</CardTitle>
                </div>
                <div className="mt-2 flex items-end gap-2">
                  <div className="text-3xl font-bold text-white">
                    {plan.price === 0 ? "Free" : formatNaira(plan.price)}
                  </div>
                  {isPaid ? (
                    <span className="pb-1 text-sm text-white/60">/ month</span>
                  ) : null}
                </div>
                <div className="mt-2 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm">
                  Earns{" "}
                  <span className="font-semibold text-gradient-gold">
                    {formatAPN(plan.hourlyRate)}
                  </span>{" "}
                  per hour
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <ul className="space-y-2 text-sm text-white/85">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-apron-gold/20 text-apron-gold">
                        <Check size={12} />
                      </span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="pt-3">
                  {isCurrent ? (
                    <Button size="lg" variant="outline" disabled className="w-full">
                      Your active plan
                    </Button>
                  ) : (
                    <form action={async () => { void upgradeUserPlanAction(plan.id); }}>
                      <Button size="lg" className="w-full">
                        <Sparkles size={16} />
                        {isPaid ? `Upgrade to ${plan.name}` : "Downgrade"}
                        <ArrowRight size={14} />
                      </Button>
                    </form>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="pt-2 text-center text-xs text-white/50">
        Plan activation is handled by support/admin. Questions?{" "}
        <Link href="/settings" className="text-apron-gold hover:underline">
          Open settings
        </Link>
        .
      </p>
    </div>
  );
}
