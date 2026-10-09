import Link from "next/link";
import { getCurrentUserDataAction } from "@/server/actions/userActions";
import {
  computeBalanceTrend,
  computeHistoricalTrend,
  buildBalanceSparklineData,
} from "@/lib/utils";
import { DashboardHero } from "./_components/DashboardHero";
import { HourlyRateCard } from "./_components/HourlyRateCard";
import { BalanceCardsSection } from "./_components/BalanceCardsSection";
import { ReferralCardSection } from "./_components/ReferralCardSection";
import { QuickLinksSection } from "./_components/QuickLinksSection";
import { RecentActivitySection } from "./_components/RecentActivitySection";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const {
    user,
    earnings,
    withdrawals,
    pendingBalanceSum,
    historicalSum30d,
    referralSignupsCount,
    quickLinks,
    balanceHistory,
    planDoc,
  } = await getCurrentUserDataAction();

  if (!user) {
    return (
      <div className="p-10 text-center text-white/70">
        Loading user… if stuck, please{" "}
        <Link href="/login" className="text-apron-gold underline">
          sign in
        </Link>
        .
      </div>
    );
  }

  const availableTrend = computeBalanceTrend(balanceHistory);
  const historicalTrend = computeHistoricalTrend(balanceHistory, historicalSum30d);
  const sparklineData = buildBalanceSparklineData(balanceHistory);

  return (
    <div className="flex flex-col gap-5 pb-4">
      <DashboardHero
        user={user}
        apnRate={user.apnRate}
        planDoc={planDoc}
      />

      <HourlyRateCard initialRate={user.apnRate} planDoc={planDoc ?? undefined} />

      <BalanceCardsSection
        balance={user.balance}
        taskBalance={user.taskBalance}
        pendingBalanceSum={pendingBalanceSum}
        historicalSum30d={historicalSum30d}
        availableTrend={availableTrend}
        historicalTrend={historicalTrend}
        sparklineData={sparklineData}
      />

      <ReferralCardSection
        user={user}
        referralSignupsCount={referralSignupsCount}
      />

      <QuickLinksSection initial={quickLinks} userId={user.uid} />

      <RecentActivitySection
        earnings={earnings}
        withdrawals={withdrawals}
      />
    </div>
  );
}
