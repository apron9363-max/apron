import {
  Coins,
  Wallet,
  Clock,
  History as HistoryIcon,
} from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { formatAPN, formatNaira } from "@/lib/utils";

interface Trend {
  value: number;
  direction: "up" | "down" | "flat";
}

interface BalanceCardsSectionProps {
  balance: number;
  taskBalance: number;
  pendingBalanceSum: number;
  historicalSum30d: number;
  availableTrend: Trend;
  historicalTrend: Trend;
  sparklineData: { label: string; value: number }[];
}

export function BalanceCardsSection({
  balance,
  taskBalance,
  pendingBalanceSum,
  historicalSum30d,
  availableTrend,
  historicalTrend,
  sparklineData,
}: BalanceCardsSectionProps) {
  return (
    <section>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Available Balance"
          value={formatAPN(balance)}
          icon={Wallet}
          sublabel={`≈ ${formatNaira(Math.max(0, balance))}`}
          valueClassName="text-gradient-gold"
          trend={availableTrend}
          tooltip="Spendable APN coins. Use for tasks & withdrawals."
          sparklineData={sparklineData}
          sparklineColor="#FFC400"
        />
        <StatCard
          label="Task Balance"
          value={formatAPN(taskBalance)}
          icon={Coins}
          iconColor="text-apron-pink"
          sublabel="Available for tasks"
          tooltip="Reserved for task submissions."
        />
        <StatCard
          label="Pending (Unpaid)"
          value={formatAPN(pendingBalanceSum)}
          icon={Clock}
          iconColor="text-white/70"
          tooltip="Submitted earnings pending admin approval."
        />
        <StatCard
          label="30-Day Earned"
          value={formatAPN(historicalSum30d)}
          icon={HistoryIcon}
          iconColor="text-apron-gold"
          tooltip="Total APN earned in the last 30 days."
          trend={historicalTrend}
        />
      </div>
    </section>
  );
}

export default BalanceCardsSection;
