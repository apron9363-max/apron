import Starfield from "@/components/landing/Starfield";
import Header from "@/components/landing/Header";
import Hero from "@/components/landing/Hero";
import ProductShowcase from "@/components/landing/ProductShowcase";
import StatsStrip from "@/components/landing/StatsStrip";
import HowItWorks from "@/components/landing/HowItWorks";
import WaysToEarn from "@/components/landing/WaysToEarn";
import FinalCta from "@/components/landing/FinalCta";
import Footer from "@/components/landing/Footer";

/**
 * Apron marketing landing page.
 * Single route at "/". Composes landing sections.
 * Server component — only Header (scroll) and Footer (reveal) need client interactivity.
 */
export default function LandingPage() {
  return (
    <>
      <Starfield />
      <Header />
      <main className="relative z-10 min-h-screen w-full overflow-x-hidden bg-apron-gradient">
        <Hero />
        <ProductShowcase />
        <StatsStrip />
        <HowItWorks />
        <WaysToEarn />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
