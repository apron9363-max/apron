import Section from "./Section";

/**
 * How it works — heading + three numbered steps.
 * Each step has a gold circle with a number, bold title, and one-line description.
 * Reveal-on-scroll via the Section wrapper.
 */
const STEPS = [
  {
    number: "1",
    title: "Create your free account",
    description: "Sign up in seconds with your email or Google account.",
  },
  {
    number: "2",
    title: "Complete tasks & quizzes",
    description: "Finish daily tasks, quizzes, and social activities to earn.",
  },
  {
    number: "3",
    title: "Withdraw to your bank",
    description: "Cash out your earnings directly to your bank account.",
  },
];

export default function HowItWorks() {
  return (
    <Section
      className="relative z-10 mx-auto max-w-5xl px-6 py-16 sm:py-20"
      aria-label="How Apron works"
    >
      <h2 className="text-center text-2xl font-extrabold text-white sm:text-3xl md:text-4xl">
        How it works
      </h2>
      <p className="mx-auto mt-3 max-w-md text-center text-sm text-white/60 sm:text-base">
        Three simple steps to start earning every day.
      </p>

      <div className="mt-12 grid gap-8 md:grid-cols-3">
        {STEPS.map((step) => (
          <div key={step.number} className="flex flex-col items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-yellow-200 via-apron-gold to-yellow-600 text-lg font-extrabold text-primary-950 shadow-gold ring-1 ring-yellow-300/50 sm:h-14 sm:w-14 sm:text-xl">
              {step.number}
            </div>
            <h3 className="mt-4 text-lg font-bold text-white">{step.title}</h3>
            <p className="mt-2 text-sm text-white/60">{step.description}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
