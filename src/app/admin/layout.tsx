import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import {
  LayoutDashboard,
  Users,
  Banknote,
  Crown,
  ClipboardList,
  Settings,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { verifySessionCookie } from "@/lib/server/session";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin · Apron",
};

const nav = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/withdrawals", label: "Withdrawals", icon: Banknote },
  { href: "/admin/plans", label: "Plans", icon: Crown },
  { href: "/admin/tasks", label: "Tasks", icon: ClipboardList },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const h = headers();
  const pathname = h.get("x-pathname") ?? "";
  const isAdminLogin = pathname === "/admin/login";

  if (!isAdminLogin) {
    const session = await verifySessionCookie();
    if (!session) {
      redirect("/admin/login");
    }
    if (session.role !== "admin") {
      redirect("/dashboard");
    }
  }

  if (isAdminLogin) {
    return (
      <div className="min-h-screen w-full bg-apron-gradient px-4 py-8">
        <div className="mx-auto flex w-full max-w-[430px] flex-col">
          {children}
        </div>
      </div>
    );
  }

  return (
    <AppShell variant="admin">
      <div className="mb-6 flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Console</h1>
          <p className="text-sm text-white/60">Manage users, withdrawals, plans, and tasks.</p>
        </div>
        <Link
          href="/dashboard"
          className="btn-outline h-10 px-4 text-sm"
        >
          ← Back to App
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="glass p-3 lg:sticky lg:top-4 lg:self-start">
          <nav className="flex flex-row gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
            {nav.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition",
                  "text-white/70 hover:bg-white/10 hover:text-white",
                )}
              >
                <Icon size={16} />
                {label}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="min-w-0 animate-fade-in">{children}</div>
      </div>
    </AppShell>
  );
}
