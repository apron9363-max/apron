import Link from "next/link";
import Section from "./Section";

/**
 * Final CTA banner — a rounded glassmorphic card with a purple glow border,
 * heading, supporting copy, a gold "Create free account" button → /register,
 * and a low-commitment trust line. Reveal-on-scroll via the Section wrapper.
 * Server component (Section is the only client part).
 */
export default function FinalCta() {
  return (
    <Section
      className="relative z-10 mx-auto max-w-4xl px-6 py-16 sm:py-20"
      aria-label="Call to action"
    >
      <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-white/5 p-8 text-center shadow-[0_0_60px_-15px_rgba(168,85,247,0.6)] sm:p-12 md:p-14">
        {/* Glow accents */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-apron-pink/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-20 right-0 h-40 w-40 rounded-full bg-apron-gold/10 blur-3xl"
        />

        <h2 className="relative text-2xl font-extrabold text-white sm:text-3xl md:text-4xl">
          Ready to start earning?
        </h2>
        <p className="relative mx-auto mt-3 max-w-md text-sm text-white/60 sm:text-base">
          Join thousands of members earning daily with Apron. It&apos;s free to
          get started — no credit card required.
        </p>

        <div className="relative mt-8">
          <Link
            href="/register"
            className="btn-primary px-8 py-4 text-base shadow-gold sm:text-lg"
          >
            Create free account
          </Link>
        </div>

        <p className="relative mt-5 text-xs text-white/40">
          Free forever • Withdraw anytime • Bank-grade security
        </p>
      </div>
    </Section>
  );
}
