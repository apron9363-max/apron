"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApronIcon } from "@/components/icons/ApronIcon";

/**
 * Sticky landing page header.
 * - Transparent over the hero
 * - Gains a subtle dark blur background when scrolled down
 * - Apron logo (left) + white "Sign in" pill (right → /login)
 * Client component — needs scroll listener state.
 */
export default function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-black/40 backdrop-blur-md border-b border-white/10"
          : "bg-transparent"
      }`}
    >
      <nav
        className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8"
        aria-label="Primary"
      >
        <Link
          href="/"
          className="flex items-center gap-2.5 text-white"
          aria-label="Apron home"
        >
          <ApronIcon size={32} />
          <span className="text-lg font-bold tracking-tight">Apron</span>
        </Link>

        <Link
          href="/login"
          className="inline-flex items-center justify-center rounded-full border border-white/30 bg-white/10 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/20 active:scale-[0.98]"
        >
          Sign in
        </Link>
      </nav>
    </header>
  );
}
