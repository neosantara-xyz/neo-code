import Pricing1 from "@/components/ui/8bit/blocks/pricing1";
import { Badge } from "@/components/ui/8bit/badge";
import FAQ1 from "@/components/ui/8bit/blocks/faq1";
import { SiteFooter } from "@/components/site-footer";

export default function PricingPage() {
  return (
    <main className="py-4">
      <div className="mb-4 flex justify-center">
        <Badge variant="outline" font="retro">Beta</Badge>
      </div>
      <Pricing1
        title="Pricing"
        description="Neo Code uses your Neosantara balance. No subscription — pay per token. Tiers unlock automatically based on cumulative top-up amount."
        tiers={[
          {
            name: "Free",
            price: "Rp 0",
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
            price: "Rp 85K",
            period: "cumulative top-up",
            description: "For personal projects and daily coding.",
            cta: "Top Up",
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
            name: "Pro",
            price: "Rp 3.35M",
            period: "cumulative top-up",
            description: "Production-grade for professional developers.",
            badge: "Popular",
            highlighted: true,
            cta: "Top Up",
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
            price: "Rp 6.7M",
            period: "cumulative top-up",
            description: "Maximum throughput for teams and heavy workloads.",
            cta: "Top Up",
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
              answer: "Neo Code uses your Neosantara balance (saldo). You top up at app.neosantara.xyz and usage is deducted per token consumed. No monthly subscription, no daily caps — just pay for what you use.",
            },
            {
              question: "What are RPM, ITPM, and OTPM?",
              answer: "RPM is requests per minute — how many API calls you can make. ITPM is input tokens per minute — throughput for prompts you send. OTPM is output tokens per minute — throughput for responses you receive. These are rate limits, not quotas.",
            },
            {
              question: "What are tiers?",
              answer: "Tiers determine your rate limits (RPM/ITPM/OTPM) and feature access. They unlock automatically based on your cumulative top-up amount — not current balance. Once unlocked, you never lose your tier.",
            },
            {
              question: "What happens when my balance runs out?",
              answer: "Requests will be rejected until you top up again. Your tier stays the same — it's based on cumulative deposits, not current balance.",
            },
            {
              question: "What payment methods are accepted?",
              answer: "Bank transfer, e-wallets (GoPay, OVO, DANA), QRIS, and credit/debit cards via Mayar payment gateway.",
            },
            {
              question: "What models are available?",
              answer: "All non-deprecated text models with function calling support from the Neosantara API, including DeepSeek, Qwen, and other models routed through our infrastructure.",
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
