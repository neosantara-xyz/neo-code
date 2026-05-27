import Pricing1 from "@/components/ui/8bit/blocks/pricing1";
import { Badge } from "@/components/ui/8bit/badge";
import FAQ1 from "@/components/ui/8bit/blocks/faq1";
import { SiteFooter } from "@/components/site-footer";
import { buildSiteMetadata } from "../seo";
import { PUBLIC_PRICING_CTA, PUBLIC_PRICING_PRICES } from "./pricing-prices";

export const metadata = buildSiteMetadata({
  description: "Neo Code pricing for Neosantara balance, IDR token billing, and automatic usage tiers.",
  imagePath: "/opengraph-image",
  path: "/pricing",
  title: "Pricing - Neo Code",
});

export default function PricingPage() {
  return (
    <main className="py-4">
      <div className="mb-4 flex justify-center">
        <Badge variant="outline" font="retro">Beta</Badge>
      </div>
      <Pricing1
        title="Pricing"
        description="Neo Code uses your Neosantara balance. No subscription — pay per token. Tiers unlock automatically based on cumulative top-up amount. Pricing is in beta and subject to change."
        tiers={[
          {
            name: "Free",
            price: PUBLIC_PRICING_PRICES.free,
            description: "No deposit required. Try Neo Code instantly.",
            cta: "Get Started",
            features: [
              { text: "3 RPM", included: true },
              { text: "15K ITPM (input tokens/min)", included: true },
              { text: "2K OTPM (output tokens/min)", included: true },
              { text: "Balance-based usage", included: true },
              { text: "Priority routing", included: false },
              { text: "Concurrent jobs", included: false },
            ],
          },
          {
            name: "Basic",
            price: PUBLIC_PRICING_PRICES.basic,
            period: "cumulative top-up",
            description: "For personal projects and daily coding.",
            cta: PUBLIC_PRICING_CTA,
            features: [
              { text: "50 RPM", included: true },
              { text: "50K ITPM", included: true },
              { text: "10K OTPM", included: true },
              { text: "Balance-based usage", included: true },
              { text: "MCP access (20 RPM)", included: true },
              { text: "Priority routing", included: false },
            ],
          },
          {
            name: "Standard",
            price: PUBLIC_PRICING_PRICES.standard,
            period: "cumulative top-up",
            description: "More throughput for heavier coding sessions.",
            cta: PUBLIC_PRICING_CTA,
            features: [
              { text: "1,000 RPM", included: true },
              { text: "450K ITPM", included: true },
              { text: "90K OTPM", included: true },
              { text: "Balance-based usage", included: true },
              { text: "Full MCP access", included: true },
              { text: "Priority routing", included: true },
            ],
          },
          {
            name: "Pro",
            price: PUBLIC_PRICING_PRICES.pro,
            period: "cumulative top-up",
            description: "Production-grade for professional developers.",
            badge: "Popular",
            highlighted: true,
            cta: PUBLIC_PRICING_CTA,
            features: [
              { text: "2,000 RPM", included: true },
              { text: "1M ITPM", included: true },
              { text: "200K OTPM", included: true },
              { text: "Balance-based usage", included: true },
              { text: "Full MCP access", included: true },
              { text: "Priority routing", included: true },
            ],
          },
          {
            name: "Enterprise",
            price: PUBLIC_PRICING_PRICES.enterprise,
            period: "cumulative top-up",
            description: "Maximum throughput for teams and heavy workloads.",
            cta: PUBLIC_PRICING_CTA,
            features: [
              { text: "4,000 RPM", included: true },
              { text: "4M ITPM", included: true },
              { text: "800K OTPM", included: true },
              { text: "Balance-based usage", included: true },
              { text: "Highest priority routing", included: true },
              { text: "Dedicated support", included: true },
            ],
          },
        ]}
      />

      <div className="mt-16">
        <FAQ1
          title="FAQ"
          description="Common questions about Neo Code pricing."
          items={[
            {
              question: "How does billing work?",
              answer: <>Neo Code uses your Neosantara balance. Top up at <a href="https://app.neosantara.xyz" className="underline">app.neosantara.xyz</a>, and usage is deducted per token. No subscription, no daily caps. Billing is in beta — pricing may change.</>,
            },
            {
              question: "Is pricing final?",
              answer: "No. Pricing is in beta. Token rates, tier thresholds, and rate limits may change as we scale. Your balance and tier progress are always preserved.",
            },
            {
              question: "What are RPM, ITPM, and OTPM?",
              answer: "RPM = requests per minute. ITPM = input tokens per minute. OTPM = output tokens per minute. These are rate limits, not quotas.",
            },
            {
              question: "What are tiers?",
              answer: "Tiers set your rate limits and feature access. They unlock based on cumulative top-up amount (not current balance). Once unlocked, you keep your tier permanently.",
            },
            {
              question: "What happens when my balance runs out?",
              answer: "Requests are rejected until you top up. Your tier stays — it's based on total deposits, not current balance.",
            },
            {
              question: "Can I use my balance outside Neo Code?",
              answer: <>Yes. Your balance works across all <a href="https://api.neosantara.xyz" className="underline">Neosantara API</a> services. Neo Code is one client that consumes from the same balance.</>,
            },
            {
              question: "What payment methods are accepted?",
              answer: "Bank transfer, e-wallets (GoPay, OVO, DANA), QRIS, and credit/debit cards.",
            },
            {
              question: "What models are available?",
              answer: <>All non-deprecated text models with function calling from the Neosantara API. See <a href="/docs/models" className="underline">models documentation</a> for the full list.</>,
            },
          ]}
        />
      </div>

      <div className="mt-16">
        <SiteFooter />
      </div>
    </main>
  );
}
