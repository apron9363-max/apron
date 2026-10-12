"use client";

import Link from "next/link";
import { ApronIcon } from "@/components/icons/ApronIcon";
import { useReveal } from "@/hooks/useReveal";
import { Twitter, Instagram, Facebook, Youtube } from "lucide-react";

interface FooterLink {
  label: string;
  href: string;
}

const PRODUCT_LINKS: FooterLink[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Tasks", href: "/tasks" },
  { label: "Referrals", href: "/referrals" },
  { label: "Plans", href: "/plans" },
  { label: "Quiz", href: "/quiz" },
];

const COMPANY_LINKS: FooterLink[] = [
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Blog", href: "/blog" },
  { label: "Careers", href: "/careers" },
];

const LEGAL_LINKS: FooterLink[] = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Cookies", href: "/cookies" },
];

const SOCIAL_LINKS = [
  { label: "Twitter", href: "https://twitter.com", Icon: Twitter },
  { label: "Instagram", href: "https://instagram.com", Icon: Instagram },
  { label: "Facebook", href: "https://facebook.com", Icon: Facebook },
  { label: "YouTube", href: "https://youtube.com", Icon: Youtube },
];

/**
 * Landing page footer — multi-column layout with brand, product/company/legal
 * link groups, social icons, and a copyright bar. Reveal-on-scroll via useReveal.
 * Client component (needs IntersectionObserver + lucide icons).
 */
export default function Footer() {
  const { ref, visible } = useReveal<HTMLElement>();

  return (
    <footer
      ref={ref}
      className={`relative z-10 border-t border-white/10 px-6 pt-14 pb-8 transition-all duration-700 ease-out motion-reduce:transition-none ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      }`}
      aria-label="Site footer"
    >
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-2 md:grid-cols-4">
          {/* Brand column */}
          <div className="col-span-2 sm:col-span-2 md:col-span-1">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-white"
              aria-label="Apron home"
            >
              <ApronIcon size={28} />
              <span className="text-base font-bold">Apron</span>
            </Link>
            <p className="mt-3 max-w-xs text-sm text-white/50">
              Earn every day. Complete tasks, take quizzes, and invite friends
              to grow your income.
            </p>
          </div>

          {/* Product */}
          <FooterColumn title="Product" links={PRODUCT_LINKS} />

          {/* Company */}
          <FooterColumn title="Company" links={COMPANY_LINKS} />

          {/* Legal */}
          <FooterColumn title="Legal" links={LEGAL_LINKS} />
        </div>

        {/* Social icons */}
        <nav aria-label="Social media" className="mt-10 flex items-center gap-3">
          {SOCIAL_LINKS.map(({ label, href, Icon }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/60 transition hover:border-apron-gold/50 hover:bg-apron-gold/10 hover:text-apron-gold"
            >
              <Icon size={16} aria-hidden />
            </a>
          ))}
        </nav>

        {/* Copyright bar */}
        <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 sm:flex-row">
          <p className="text-sm text-white/50">
            © {new Date().getFullYear()} Apron. All rights reserved.
          </p>
          <p className="text-xs text-white/40">
            earn • learn • grow
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      <ul className="mt-3 space-y-2.5">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              className="text-sm text-white/60 transition hover:text-apron-gold"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
