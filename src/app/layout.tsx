import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const SITE_URL = "https://apron.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Apron — Earn daily with tasks, quizzes & referrals",
    template: "%s | Apron",
  },
  description:
    "Complete daily tasks, take quizzes, and invite friends to earn APN coins on Apron. Join 12,000+ members earning every day. Free to start, withdraw anytime.",
  applicationName: "Apron",
  keywords: [
    "earn money online",
    "daily tasks",
    "online quizzes",
    "referral program",
    "APN coins",
    "side income",
    "Nigeria earning app",
    "make money daily",
  ],
  authors: [{ name: "Apron" }],
  creator: "Apron",
  category: "finance",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    title: "Apron — Earn daily with tasks, quizzes & referrals",
    description:
      "Complete daily tasks, take quizzes, and invite friends to earn APN coins on Apron. Join 12,000+ members earning every day.",
    url: SITE_URL,
    siteName: "Apron",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Apron — Earn daily with tasks, quizzes & referrals",
    description:
      "Complete daily tasks, take quizzes, and invite friends to earn APN coins. Join 12,000+ members earning every day.",
    creator: "@apron",
  },
  icons: {
    icon: [
      {
        url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='0' y2='1'%3E%3Cstop offset='0%25' stop-color='%23FFE066'/%3E%3Cstop offset='100%25' stop-color='%23FFC400'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='48' height='48' rx='10' fill='%232E0C4E'/%3E%3Cpath fill='url(%23g)' d='M16 6h16v4a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6V6zM12 12h24v6c0 4-2 10-3 14l-3 12H15l-3-12C11 28 9 22 9 18v-6h3z' stroke='%23E0AE00' stroke-width='1.5' stroke-linejoin='round'/%3E%3C/svg%3E",
        type: "image/svg+xml",
      },
    ],
    shortcut: [
      {
        url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='0' y2='1'%3E%3Cstop offset='0%25' stop-color='%23FFE066'/%3E%3Cstop offset='100%25' stop-color='%23FFC400'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='48' height='48' rx='10' fill='%232E0C4E'/%3E%3Cpath fill='url(%23g)' d='M16 6h16v4a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6V6zM12 12h24v6c0 4-2 10-3 14l-3 12H15l-3-12C11 28 9 22 9 18v-6h3z' stroke='%23E0AE00' stroke-width='1.5' stroke-linejoin='round'/%3E%3C/svg%3E",
        type: "image/svg+xml",
      },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#2E0C4E",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans bg-apron-gradient`}>
        {children}
      </body>
    </html>
  );
}
