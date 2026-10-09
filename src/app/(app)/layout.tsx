import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { verifySessionCookie } from "@/lib/server/session";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Apron · Your Dashboard",
};

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await verifySessionCookie();
  if (!session) redirect("/login");
  if (session.status === "banned") redirect("/blocked");
  if (!session.emailVerified) redirect("/verify");

  return <AppShell variant="app">{children}</AppShell>;
}
