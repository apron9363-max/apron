import Section from "./Section";

/**
 * Stats strip — three centered stats divided by thin white/20 lines.
 * Gold numbers, white labels. Reveal-on-scroll via the Section wrapper.
 */
const STATS = [
  { value: "12k+", label: "Members" },
  { value: "₦8.2M", label: "Paid out" },
  { value: "40+", label: "Daily tasks" },
];

export default function StatsStrip() {
  return (
    <Section
      className="relative z-10 mx-auto max-w-4xl px-6 py-10 sm:py-12"
      aria-label="Platform statistics"
    >
      <div className="grid grid-cols-3 items-center divide-x divide-white/20">
        {STATS.map((stat) => (
          <div key={stat.label} className="px-4 text-center">
            <p className="text-2xl font-extrabold text-gradient-gold sm:text-3xl md:text-4xl">
              {stat.value}
            </p>
            <p className="mt-1 text-xs text-white/60 sm:text-sm">{stat.label}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
