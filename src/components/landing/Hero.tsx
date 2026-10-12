import Link from "next/link";
import Section from "./Section";

/**
 * Landing page hero.
 * Centered two-tone headline, supporting subtext, gold gradient CTA,
 * and a small trust line. Server component — no client state needed.
 */
export default function Hero() {
  return (
    <Section
      className="relative z-10 flex min-h-screen flex-col items-center justify-center px-5 pt-28 pb-16 text-center sm:px-8"
      aria-label="Introduction"
    >
      <h1 className="max-w-3xl text-4xl-plus font-extrabold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl-plus">
        <span className="text-white">Earn every day.</span>{" "}
        <span className="text-gradient-gold">Learn. Share. Grow.</span>
      </h1>

      <p className="mt-5 max-w-xl text-base text-white/60 sm:text-lg">
        Complete daily tasks, take quick quizzes, and invite friends to earn
        real rewards. Join thousands of members growing their income every
        single day.
      </p>

      <div className="mt-9">
        <Link
          href="/register"
          className="btn-primary px-8 py-4 text-base shadow-gold sm:text-lg"
        >
          Join us today — it&apos;s free
        </Link>
      </div>

      <p className="mt-5 text-sm text-white/50">
        Already <span className="font-semibold text-white/80">12,000+ members</span> earning
      </p>
    </Section>
  );
}
