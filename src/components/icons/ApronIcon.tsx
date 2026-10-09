import * as React from "react";

interface ApronIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
}

export function ApronIcon({ size = 32, ...rest }: ApronIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      width={size}
      height={size}
      aria-label="Apron Logo"
      {...rest}
    >
      <defs>
        <linearGradient id="apron-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFE066" />
          <stop offset="100%" stopColor="#FFC400" />
        </linearGradient>
      </defs>
      <g fill="url(#apron-gold)">
        <path
          d="M16 6h16v4a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6V6z"
          stroke="#E0AE00"
          strokeWidth="1.5"
        />
        <path
          d="M12 12h24v6c0 4-2 10-3 14l-3 12H15l-3-12C11 28 9 22 9 18v-6h3z"
          stroke="#E0AE00"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M9 18h30M16 34h16M19 40h10"
          stroke="#2E0C4E"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.25"
        />
      </g>
    </svg>
  );
}
