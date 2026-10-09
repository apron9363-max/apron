import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      screens: {
        sm: "320px",
        md: "768px",
        lg: "1024px",
        xl: "1440px",
      },
      colors: {
        apron: {
          bgDeep: "#2E0C4E",
          bgDark: "#100422",
          gold: "#FFC400",
          goldDark: "#E0AE00",
          pink: "#FF3CBE",
          pinkDark: "#D62DA0",
          glass: "rgba(255, 255, 255, 0.10)",
          glassBorder: "rgba(255, 255, 255, 0.20)",
        },
        primary: {
          50:  "#F5E9FF",
          100: "#E9D3FF",
          200: "#D4A8FF",
          300: "#BC79FF",
          400: "#A14BFF",
          500: "#7E22CE",
          600: "#5E17A8",
          700: "#4B1187",
          800: "#3A0E67",
          900: "#2E0C4E",
          950: "#100422",
        },
        secondary: {
          50:  "#FFF5CC",
          100: "#FFEC99",
          200: "#FFDF5C",
          300: "#FFD32B",
          400: "#FFC400",
          500: "#E0AE00",
          600: "#B38800",
          700: "#866300",
          800: "#5A4200",
          900: "#2E2100",
        },
        accent: {
          50:  "#FFE6F4",
          100: "#FFC2E3",
          200: "#FF8FD0",
          300: "#FF5CBE",
          400: "#FF3CBE",
          500: "#D62DA0",
          600: "#A31D7C",
          700: "#761158",
          800: "#4A0936",
          900: "#25041B",
        },
        neutral: {
          50:  "#FBF7FF",
          100: "#F3EAFF",
          200: "#E6D6FF",
          300: "#CBB6F0",
          400: "#A48BCF",
          500: "#7B62A8",
          600: "#5A4486",
          700: "#3E2E63",
          800: "#271B45",
          900: "#150E28",
          950: "#0A0615",
        },
      },
      spacing: {
        "18": "4.5rem",
        "88": "22rem",
        "128": "32rem",
        "144": "36rem",
      },
      fontSize: {
        "xs-plus": ["0.78rem", { lineHeight: "1.25rem" }],
        "sm-plus": ["0.9rem",  { lineHeight: "1.5rem" }],
        "2xl-plus": ["1.7rem", { lineHeight: "2.1rem" }],
        "3xl-plus": ["2rem",   { lineHeight: "2.4rem" }],
        "4xl-plus": ["2.5rem", { lineHeight: "3rem" }],
      },
      letterSpacing: {
        widerPlus: "0.08em",
      },
      backgroundImage: {
        "apron-gradient": "linear-gradient(180deg, #2E0C4E 0%, #100422 100%)",
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(0, 0, 0, 0.36)",
        gold: "0 4px 16px 0 rgba(255, 196, 0, 0.35)",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.25rem",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-left": {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
        "slide-in-right": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(0)" },
        },
        "slide-in-up": {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
        "slide-in-down": {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.25s ease-out both",
        "slide-in-left": "slide-in-left 0.22s ease-out both",
        "slide-in-right": "slide-in-right 0.22s ease-out both",
        "slide-in-up": "slide-in-up 0.22s ease-out both",
        "slide-in-down": "slide-in-down 0.22s ease-out both",
        shimmer: "shimmer 2s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
