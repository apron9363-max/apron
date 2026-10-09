import Link from "next/link";
import { Settings, User2, Phone, Mail, Shield, Crown, Bell, LogOut } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { logoutAction } from "@/server/actions/authActions";
import { getCurrentUserDataAction } from "@/server/actions/userActions";
import { formatAPN, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { user } = await getCurrentUserDataAction();
  if (!user) return null;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
          <Settings size={22} className="text-apron-gold" /> Account Settings
        </h1>
        <p className="mt-1 text-sm text-white/60">
          Manage your profile and preferences.
        </p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-apron-gold/15 border border-apron-gold/30 text-apron-gold font-bold text-xl">
            {user.name.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <CardTitle>{user.name}</CardTitle>
            <div className="mt-0.5 text-xs text-white/60">
              Joined {formatDateTime(user.createdAt)}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row icon={Mail} label="Email" value={user.email} />
          <Row icon={Phone} label="Phone" value={user.phone || "—"} />
          <Row icon={Shield} label="Status" value={user.status} />
          <Row icon={Crown} label="Plan" value={user.plan} />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2">
        {[
          { href: "/plans", icon: Crown, title: "Plans", desc: "Upgrade or change your plan" },
          { href: "/referrals", icon: User2, title: "Referrals", desc: "Share your referral link" },
          { href: "/wallet", icon: Settings, title: "Bank details", desc: "Edit payout bank details" },
        ].map(({ href, icon: Icon, title, desc }) => (
          <Link
            key={href}
            href={href}
            className="glass !p-4 flex items-center gap-3"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-apron-gold">
              <Icon size={18} />
            </span>
            <div className="flex-1">
              <div className="text-sm font-semibold text-white">{title}</div>
              <div className="text-xs text-white/60">{desc}</div>
            </div>
            <span className="text-apron-gold">›</span>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Danger zone</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={logoutAction}>
            <Button variant="secondary" className="w-full">
              <LogOut size={16} /> Sign out
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5">
      <div className="flex items-center gap-2 text-white/60">
        <Icon size={15} className="text-apron-gold" />
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <span className="text-sm text-white">{value}</span>
    </div>
  );
}
