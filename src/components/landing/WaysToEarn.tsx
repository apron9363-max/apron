import Section from "./Section";

/**
 * Ways to earn — a responsive grid of six glassmorphic cards.
 * 2 columns on mobile, 3 columns on desktop. Each card has a title
 * and a gold reward line. Reveal-on-scroll via the Section wrapper.
 */
const CARDS = [
  { title: "Hourly coins", reward: "Claim every hour" },
  { title: "Daily quiz", reward: "₦50 per quiz" },
  { title: "Referrals", reward: "₦500 per friend" },
  { title: "Social tasks", reward: "Up to ₦200 each" },
  { title: "Reward rush", reward: "Bonus boosts" },
  { title: "Contests", reward: "Win big prizes" },
];

export default function WaysToEarn() {
  return (
    <Section
      className="relative z-10 mx-auto max-w-5xl px-6 py-16 sm:py-20"
      aria-label="Ways to earn"
    >
      <h2 className="text-center text-2xl font-extrabold text-white sm:text-3xl md:text-4xl">
        Ways to earn
      </h2>
      <p className="mx-auto mt-3 max-w-md text-center text-sm text-white/60 sm:text-base">
        Pick from many earning activities and grow your balance daily.
      </p>

      <div className="mt-10 grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3">
        {CARDS.map((card) => (
          <article
            key={card.title}
            className="glass glass-hover flex flex-col justify-between rounded-2xl p-5"
          >
            <h3 className="text-base font-bold text-white sm:text-lg">
              {card.title}
            </h3>
            <p className="mt-2 text-sm font-semibold text-apron-gold">
              {card.reward}
            </p>
          </article>
        ))}
      </div>
    </Section>
  );
}
