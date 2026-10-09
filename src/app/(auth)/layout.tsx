import type { Metadata } from "next";
import Link from "next/link";
import { ApronIcon } from "@/components/icons/ApronIcon";

export const metadata: Metadata = {
  title: "Sign in · Apron",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full bg-apron-gradient px-4 py-8">
      <div className="mx-auto flex w-full max-w-[430px] flex-col">
        <Link
          href="/"
          className="mb-6 flex items-center justify-center gap-3 self-start"
        >
          <ApronIcon size={36} />
          <div className="leading-tight">
            <div className="text-xl font-bold text-gradient-gold">APRON</div>
            <div className="text-xs text-white/60">Rewards Platform</div>
          </div>
        </Link>
        <div className="glass p-6 animate-fade-in">{children}</div>
        <div className="mt-6 text-center text-xs text-white/40">
          © {new Date().getFullYear()} Apron. All rights reserved.
        </div>
      </div>
    </div>
  );
}
