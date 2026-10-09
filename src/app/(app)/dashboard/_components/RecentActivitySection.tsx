import Link from "next/link";
import { History as HistoryIcon, Coins, Banknote } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { formatAPN, formatNaira, formatDateTime } from "@/lib/utils";

interface ActivityItemBase {
  id: string;
  createdAt?: number;
}

interface EarningItem extends ActivityItemBase {
  source: string;
  amount: number;
}

interface WithdrawalItem extends ActivityItemBase {
  status: string;
  netAmount: number;
}

interface RecentActivitySectionProps {
  earnings: EarningItem[];
  withdrawals: WithdrawalItem[];
}

export function RecentActivitySection({
  earnings,
  withdrawals,
}: RecentActivitySectionProps) {
  const items = [...earnings, ...withdrawals]
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
    .slice(0, 6);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white/70">
          Recent activity
        </h2>
        <Link
          href="/history"
          className="text-xs text-apron-gold hover:underline flex items-center gap-1"
        >
          All <HistoryIcon size={12} />
        </Link>
      </div>
      <div className="flex flex-col gap-2">
        {items.length === 0 ? (
          <Card>
            <CardContent className="text-center text-sm text-white/60">
              No activity yet. Complete a task to earn APN coins.
            </CardContent>
          </Card>
        ) : (
          items.map((item) => {
            const isEarning = "source" in item;
            const title = isEarning
              ? `${item.source.charAt(0).toUpperCase()}${item.source.slice(1)} earnings`
              : `Withdrawal · ${(item as WithdrawalItem).status}`;
            const amount = isEarning
              ? `+${formatAPN((item as EarningItem).amount)}`
              : `-${formatNaira((item as WithdrawalItem).netAmount)}`;
            const color = isEarning ? "text-apron-gold" : "text-white/80";
            return (
              <div
                key={item.id + title}
                className="glass !p-3 flex items-center gap-3"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-apron-gold">
                  {isEarning ? (
                    <Coins size={16} />
                  ) : (
                    <Banknote size={16} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-white">
                    {title}
                  </div>
                  <div className="text-xs text-white/50">
                    {formatDateTime(item.createdAt as number)}
                  </div>
                </div>
                <div className={`text-sm font-semibold ${color}`}>
                  {amount}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

export default RecentActivitySection;
