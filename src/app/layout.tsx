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
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: [{ url: "/favicon.ico", type: "image/x-icon" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
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
