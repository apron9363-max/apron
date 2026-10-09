"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  ClipboardList,
  History,
  Wallet,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/tasks", label: "Tasks", icon: ClipboardList },
  { href: "/history", label: "History", icon: History },
  { href: "/wallet", label: "Wallet", icon: Wallet },
  { href: "/referrals", label: "Referrals", icon: UserPlus },
];

export function BottomNav() {
  const pathname = usePathname();
  const isHidden =
    pathname?.startsWith("/auth") || pathname?.startsWith("/admin");

  const ulRef = React.useRef<HTMLUListElement>(null);
  const liRefs = React.useRef<(HTMLLIElement | null)[]>([]);
  const [pillStyle, setPillStyle] = React.useState<{
    transform: string;
    width: number;
    transitionDuration: string;
  } | null>(null);

  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const activeIndex = items.findIndex(
    ({ href }) => pathname === href || pathname?.startsWith(href + "/"),
  );

  React.useLayoutEffect(() => {
    if (isHidden || activeIndex < 0) return;

    const ul = ulRef.current;
    if (!ul) return;

    const measure = () => {
      const activeLi = liRefs.current[activeIndex];
      if (!activeLi) return;
      const ulRect = ul.getBoundingClientRect();
      const liRect = activeLi.getBoundingClientRect();
      setPillStyle({
        transform: `translateX(${liRect.left - ulRect.left}px)`,
        width: liRect.width,
        transitionDuration: reduceMotion ? "0ms" : "250ms",
      });
    };

    measure();

    const ro = new ResizeObserver(() => measure());
    ro.observe(ul);
    window.addEventListener("resize", measure);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [activeIndex, isHidden, reduceMotion]);

  if (isHidden) return null;

  return (
    <nav
      className="fixed bottom-0 left-1/2 z-30 w-full max-w-[430px] md:max-w-md -translate-x-1/2 pl-[max(12px,env(safe-area-inset-left))] pr-[max(12px,env(safe-area-inset-right))] pb-[max(12px,env(safe-area-inset-bottom))] pt-1 lg:hidden"
      aria-label="Bottom navigation"
    >
      <div className="glass !rounded-3xl px-2 py-2 shadow-glass md:px-4 md:py-3">
        <div className="relative">
          {pillStyle && activeIndex >= 0 ? (
            <div
              aria-hidden
              className="pointer-events-none absolute top-0 h-full rounded-xl bg-apron-gold/20 border border-apron-gold/30 transition-transform ease-[cubic-bezier(0.4,0,0.2,1)] transition-width"
              style={{
                transform: pillStyle.transform,
                width: pillStyle.width,
                transitionDuration: pillStyle.transitionDuration,
              }}
            />
          ) : null}
          <ul ref={ulRef} className="grid grid-cols-5 items-center relative">
            {items.map(({ href, label, icon: Icon }, i) => {
              const active = pathname === href || pathname?.startsWith(href + "/");
              return (
                <li
                  key={href}
                  ref={(el) => {
                    liRefs.current[i] = el;
                  }}
                >
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1 rounded-2xl px-1 md:px-2 py-2 md:py-2.5 text-[11px] md:text-sm font-medium transition relative z-10",
                      active
                        ? "text-apron-gold"
                        : "text-white/60 hover:text-white",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-8 w-8 md:h-11 md:w-11 items-center justify-center rounded-xl md:rounded-2xl transition",
                      )}
                    >
                      <Icon size={17} strokeWidth={active ? 2.25 : 1.75} className="md:size-[20px]" />
                    </span>
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </nav>
  );
}
