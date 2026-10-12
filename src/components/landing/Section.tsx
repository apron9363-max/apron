"use client";

import type { ReactNode } from "react";
import { useReveal } from "@/hooks/useReveal";

interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  children: ReactNode;
}

/**
 * Shared section wrapper with reveal-on-scroll animation.
 * Uses IntersectionObserver via useReveal + CSS transitions.
 * Respects prefers-reduced-motion (handled inside useReveal).
 *
 * Rendered as a semantic <section> element.
 */
export default function Section({
  children,
  className = "",
  ...rest
}: SectionProps) {
  const { ref, visible } = useReveal<HTMLElement>();

  return (
    <section
      ref={ref}
      className={`transition-all duration-700 ease-out motion-reduce:transition-none ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      } ${className}`}
      {...rest}
    >
      {children}
    </section>
  );
}
