import Section from "./Section";

/**
 * Product showcase: a pure-CSS phone mockup floating over the hero,
 * containing a simplified dashboard preview, surrounded by decorative
 * gold ₦ coin circles with gentle float animations.
 *
 * Reveal-on-scroll via the Section wrapper.
 */
export default function ProductShowcase() {
  return (
    <Section
      className="relative z-10 mx-auto -mt-10 max-w-md px-6 pb-16 sm:-mt-16"
      aria-label="Apron app preview"
    >
      {/* Floating decorative ₦ coins */}
      <Coin className="left-0 top-8 h-10 w-10 animate-float-slow opacity-90 sm:h-14 sm:w-14" aria-hidden />
      <Coin
        className="right-2 top-20 h-7 w-7 animate-float opacity-80 sm:h-10 sm:w-10"
        style={{ animationDelay: "1.2s" }}
        aria-hidden
      />
      <Coin
        className="left-4 bottom-24 h-6 w-6 animate-float opacity-70 sm:h-8 sm:w-8"
        style={{ animationDelay: "0.6s" }}
        aria-hidden
      />
      <Coin
        className="right-6 bottom-10 h-9 w-9 animate-float-slow opacity-85 sm:h-12 sm:w-12"
        style={{ animationDelay: "0.3s" }}
        aria-hidden
      />
      <Coin
        className="left-1/2 top-2 h-5 w-5 animate-float opacity-60"
        style={{ animationDelay: "1.8s" }}
        aria-hidden
      />

      {/* Phone mockup frame */}
      <div className="relative mx-auto w-[280px] rounded-[2.5rem] border border-white/20 bg-black/50 p-3 shadow-2xl backdrop-blur-xl sm:w-[320px]">
        {/* Notch */}
        <div className="absolute left-1/2 top-3 z-10 h-6 w-24 -translate-x-1/2 rounded-full bg-black/80" />

        {/* Screen */}
        <div className="overflow-hidden rounded-[2rem] bg-apron-gradient">
          <DashboardPreview />
        </div>
      </div>
    </Section>
  );
}

/** A single gold ₦ coin circle. */
function Coin({
  className = "",
  style,
  "aria-hidden": ariaHidden,
}: {
  className?: string;
  style?: React.CSSProperties;
  "aria-hidden"?: boolean;
}) {
  return (
    <div
      aria-hidden={ariaHidden}
      className={`pointer-events-none absolute flex items-center justify-center rounded-full bg-gradient-to-br from-yellow-200 via-apron-gold to-yellow-600 text-[10px] font-extrabold text-primary-950 shadow-[0_4px_12px_rgba(255,196,0,0.4)] ring-1 ring-yellow-300/50 ${className}`}
      style={style}
    >
      ₦
    </div>
  );
}

/** Simplified dashboard preview shown inside the phone screen. */
function DashboardPreview() {
  return (
    <div className="space-y-3 px-3 pb-4 pt-9">
      {/* Balance header */}
      <div className="rounded-2xl bg-white/10 p-3">
        <p className="text-[10px] uppercase tracking-wider text-white/50">
          Available balance
        </p>
        <p className="text-lg font-extrabold text-gradient-gold">
          ₦ 24,580.00
        </p>
        <div className="mt-1 flex items-center gap-1 text-[10px] text-apron-gold">
          <span>▲ +₦320 today</span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Tasks" value="18" />
        <Stat label="APN" value="1,240" />
        <Stat label="Referrals" value="7" />
      </div>

      {/* Referral link bar */}
      <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
        <span className="truncate text-[10px] text-white/60">
          apron.app/r/AP7K2M
        </span>
        <span className="rounded-md bg-apron-gold px-2 py-0.5 text-[9px] font-bold text-primary-950">
          COPY
        </span>
      </div>

      {/* Task list rows */}
      <div className="space-y-2">
        <TaskRow title="Daily quiz" reward="+₦50" done />
        <TaskRow title="Watch video" reward="+₦30" />
        <TaskRow title="Share on social" reward="+₦80" />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/10 px-2 py-2 text-center">
      <p className="text-sm font-bold text-white">{value}</p>
      <p className="text-[9px] text-white/50">{label}</p>
    </div>
  );
}

function TaskRow({
  title,
  reward,
  done = false,
}: {
  title: string;
  reward: string;
  done?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
      <div className="flex items-center gap-2">
        <span
          className={`h-3 w-3 rounded-full ${
            done ? "bg-apron-gold" : "bg-white/20"
          }`}
        />
        <span className="text-[11px] text-white/80">{title}</span>
      </div>
      <span className="text-[10px] font-semibold text-apron-gold">{reward}</span>
    </div>
  );
}
