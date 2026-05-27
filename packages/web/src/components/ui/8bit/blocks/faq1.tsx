import { cn } from "@/lib/utils";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/8bit/accordion";

import "@/components/ui/8bit/styles/retro.css";

export interface FAQItem {
  answer: string;
  question: string;
}

interface FAQ1Props {
  className?: string;
  description?: string;
  items?: FAQItem[];
  title?: string;
}

const defaultItems: FAQItem[] = [
  {
    question: "What is Neo Code?",
    answer:
      "Neo Code is a keyboard-driven coding agent that runs in your terminal and works with the Neosantara OpenAI-compatible API.",
  },
  {
    question: "How do I start?",
    answer:
      "Install Neo Code, authenticate with `neo login` or `NEOSANTARA_API_KEY`, then run `neo` inside a project directory.",
  },
  {
    question: "Where do I find pricing?",
    answer:
      "Pricing is balance-based and shown in IDR on the Pricing page. Usage is deducted per token from your Neosantara balance.",
  },
  {
    question: "Does it support Termux?",
    answer:
      "Yes. Termux is supported as a first-class target, including install paths, touch keys, notifications, and mobile-friendly TUI defaults.",
  },
  {
    question: "Can I customize models?",
    answer:
      "Yes. You can configure OpenAI-compatible endpoints through extensions or `~/.neo-code/agent/models.json` while the built-in provider remains Neosantara.",
  },
];

export default function FAQ1({
  title = "Frequently Asked Questions",
  description = "Got questions? We've got answers.",
  items = defaultItems,
  className,
}: FAQ1Props) {
  return (
    <section className={cn("w-full px-4 py-16", className)}>
      <div className="mx-auto max-w-2xl">
        {(title || description) && (
          <div className="mb-10 text-center">
            {title && (
              <h2 className="retro mb-3 font-bold text-2xl tracking-tight md:text-3xl">
                {title}
              </h2>
            )}
            {description && (
              <p className="retro mx-auto max-w-xl text-muted-foreground text-[9px]">
                {description}
              </p>
            )}
          </div>
        )}

        <Accordion type="single" collapsible>
          {items.map((item, idx) => (
            <AccordionItem key={item.question} value={`faq-${idx}`}>
              <AccordionTrigger className="retro text-left text-xs">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="retro text-[9px] leading-relaxed text-muted-foreground">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
