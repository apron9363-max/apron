"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Trophy,
  History,
  UserCog,
  Crown,
  Banknote,
  GraduationCap,
  Share2,
  LogOut,
  X,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { getSideMenuProfileAction } from "@/server/actions/userActions";
import type { PlanId } from "@/types";

interface SideMenuProps {
  open: boolean;
  onClose: () => void;
  onOpen?: () => void;
  triggerRef?: React.RefObject<HTMLElement>;
}

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/contest", label: "Contest", icon: Trophy },
  { href: "/history", label: "History", icon: History },
  { href: "/plans", label: "Plans", icon: Crown },
  { href: "/loans", label: "Loans", icon: Banknote },
  { href: "/skill-academy", label: "Skill Academy", icon: GraduationCap },
  { href: "/social-monetization", label: "Social Monetization", icon: Share2 },
];

function planColors(plan: PlanId): string {
  switch (plan) {
    case "elite":
      return "bg-pink-500/20 text-pink-300 border-pink-500/30";
    case "pro":
      return "bg-apron-gold/20 text-apron-gold border-apron-gold/30";
    default:
      return "bg-white/10 text-white/70 border-white/15";
  }
}

type SwipeState = {
  pointerId: number;
  startX: number;
  startY: number;
  tracking: boolean;
  mode: "open" | "close";
} | null;

export function SideMenu({ open, onClose, onOpen, triggerRef }: SideMenuProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = React.useState(false);
  const [profile, setProfile] = React.useState<{
    name: string;
    email: string;
    plan: PlanId;
    balance: number;
  } | null>(null);

  const drawerRef = React.useRef<HTMLElement>(null);
  const swipeStateRef = React.useRef<SwipeState>(null);

  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  React.useEffect(() => {
    if (!open) return;
    void (async () => {
      const r = await getSideMenuProfileAction();
      if (r.ok) {
        const d = r.data as { name: string; email: string; plan: PlanId; balance?: number };
        setProfile({
          name: d.name,
          email: d.email,
          plan: d.plan,
          balance: d.balance ?? 0,
        });
      }
    })();
  }, [open]);

  const focusableSelector =
    'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

  React.useEffect(() => {
    if (open) {
      const drawer = drawerRef.current;
      if (drawer) {
        const focusable = drawer.querySelectorAll<HTMLElement>(focusableSelector);
        const first = focusable[0] ?? drawer;
        const timer = setTimeout(() => first.focus(), 0);
        return () => clearTimeout(timer);
      }
      return undefined;
    }
    if (triggerRef?.current) {
      triggerRef.current.focus();
    }
    return undefined;
  }, [open, triggerRef]);

  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      const drawer = drawerRef.current;
      if (!drawer) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Tab") {
        const focusable = drawer.querySelectorAll<HTMLElement>(focusableSelector);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  React.useEffect(() => {
    if (reduceMotion) return;

    function setCapture(el: EventTarget | null, pid: number) {
      try {
        (el as Element).setPointerCapture?.(pid);
      } catch {
        /* noop */
      }
    }
    function releaseCapture(el: EventTarget | null, pid: number) {
      try {
        (el as Element).releasePointerCapture?.(pid);
      } catch {
        /* noop */
      }
    }

    function onDocPointerDown(e: PointerEvent) {
      if (open) return;
      if (e.clientX < 0 || e.clientX > 32) return;
      setCapture(e.target, e.pointerId);
      swipeStateRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        tracking: true,
        mode: "open",
      };
    }

    function onDocPointerMove(e: PointerEvent) {
      const s = swipeStateRef.current;
      if (!s || !s.tracking) return;
      if (s.pointerId !== e.pointerId) return;
      const dx = e.clientX - s.startX;
      const dy = e.clientY - s.startY;
      if (Math.abs(dy) > Math.abs(dx)) {
        releaseCapture(e.target, s.pointerId);
        swipeStateRef.current = null;
      }
    }

    function onDocPointerUp(e: PointerEvent) {
      const s = swipeStateRef.current;
      if (!s || s.pointerId !== e.pointerId) return;
      const dx = e.clientX - s.startX;
      const dy = e.clientY - s.startY;
      releaseCapture(e.target, s.pointerId);
      swipeStateRef.current = null;
      if (Math.abs(dy) > Math.abs(dx)) return;
      if (!open && dx >= 80) {
        onOpen?.();
      }
    }

    document.addEventListener("pointerdown", onDocPointerDown);
    document.addEventListener("pointermove", onDocPointerMove);
    document.addEventListener("pointerup", onDocPointerUp);
    document.addEventListener("pointercancel", onDocPointerUp);

    return () => {
      document.removeEventListener("pointerdown", onDocPointerDown);
      document.removeEventListener("pointermove", onDocPointerMove);
      document.removeEventListener("pointerup", onDocPointerUp);
      document.removeEventListener("pointercancel", onDocPointerUp);
    };
  }, [reduceMotion, open, onOpen]);

  function setCapture(el: EventTarget | null, pid: number) {
    try {
      (el as Element).setPointerCapture?.(pid);
    } catch {
      /* noop */
    }
  }
  function releaseCapture(el: EventTarget | null, pid: number) {
    try {
      (el as Element).releasePointerCapture?.(pid);
    } catch {
      /* noop */
    }
  }

  function onDrawerPointerDown(e: React.PointerEvent) {
    if (reduceMotion || !open) return;
    setCapture(e.target, e.pointerId);
    swipeStateRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      tracking: true,
      mode: "close",
    };
  }
  function onDrawerPointerMove(e: React.PointerEvent) {
    const s = swipeStateRef.current;
    if (!s || !s.tracking || s.pointerId !== e.pointerId) return;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    if (Math.abs(dy) > Math.abs(dx)) {
      releaseCapture(e.target, s.pointerId);
      swipeStateRef.current = null;
    }
  }
  function onDrawerPointerUp(e: React.PointerEvent) {
    const s = swipeStateRef.current;
    if (!s || s.pointerId !== e.pointerId) return;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    releaseCapture(e.target, s.pointerId);
    swipeStateRef.current = null;
    if (Math.abs(dy) > Math.abs(dx)) return;
    if (open && dx <= -80) {
      onClose();
    }
  }

  async function handleLogout() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
    } finally {
      setSigningOut(false);
      onClose();
    }
  }

  const plan = profile?.plan ?? "starter";
  const initial = profile?.name?.[0]?.toUpperCase() ?? "A";

  return (
    <div
      className={cn(
        "fixed inset-0 z-40 pointer-events-none transition-opacity",
        open ? "pointer-events-auto opacity-100" : "opacity-0",
      )}
      aria-hidden={!open}
    >
      <div
        className={cn(
          "absolute inset-0 bg-black/60 backdrop-blur-sm",
          open ? "animate-fade-in" : "",
        )}
        onClick={onClose}
      />
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Side menu"
        tabIndex={-1}
        onPointerDown={onDrawerPointerDown}
        onPointerMove={onDrawerPointerMove}
        onPointerUp={onDrawerPointerUp}
        onPointerCancel={onDrawerPointerUp}
        className={cn(
          "absolute left-0 top-0 h-full w-[82%] max-w-xs glass !rounded-none !rounded-r-3xl !bg-black/40 p-5 shadow-glass transition-transform duration-200",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-apron-gold/15 border border-apron-gold/30 text-apron-gold font-bold">
              A
            </span>
            <div>
              <div className="text-lg font-semibold text-white">Apron</div>
              <div className="text-xs text-white/60">Rewards Platform</div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={onClose}
            aria-label="Close menu"
          >
            <X size={18} />
          </Button>
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white font-semibold">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-white">
                {profile?.name ?? "Loading…"}
              </div>
              <div className="truncate text-xs text-white/60">
                {profile?.email ?? "\u00A0"}
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                planColors(plan),
              )}
            >
              {plan}
            </span>
            {profile != null && (
              <span className="text-xs font-semibold text-white/80">
                {profile.balance.toFixed(2)} APN
              </span>
            )}
          </div>
        </div>

        <nav className="mt-6 flex flex-col gap-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active =
              pathname === href || pathname?.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                tabIndex={open ? 0 : -1}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition",
                  active
                    ? "bg-white/10 text-white border border-white/15"
                    : "text-white/70 hover:bg-white/5 hover:text-white",
                )}
              >
                <Icon size={18} />
                {label}
              </Link>
            );
          })}

          <Link
            href="/account-settings"
            onClick={onClose}
            tabIndex={open ? 0 : -1}
            className={cn(
              "flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition",
              pathname === "/account-settings" || pathname?.startsWith("/account-settings/")
                ? "bg-white/10 text-white border border-white/15"
                : "text-white/70 hover:bg-white/5 hover:text-white",
            )}
          >
            <UserCog size={18} />
            Account Settings
          </Link>

          <Link
            href="/settings"
            onClick={onClose}
            tabIndex={open ? 0 : -1}
            className={cn(
              "flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition",
              pathname === "/settings" || pathname?.startsWith("/settings/")
                ? "bg-white/10 text-white border border-white/15"
                : "text-white/70 hover:bg-white/5 hover:text-white",
            )}
          >
            <Settings size={18} />
            Settings
          </Link>

          <div className="my-3 h-px w-full bg-white/10" />

          <button
            onClick={handleLogout}
            disabled={signingOut}
            tabIndex={open ? 0 : -1}
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium text-red-300 hover:bg-red-500/10 transition disabled:opacity-60"
          >
            <LogOut size={18} />
            {signingOut ? "Signing out…" : "Logout"}
          </button>
        </nav>
      </aside>
    </div>
  );
}
