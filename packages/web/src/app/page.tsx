import fs from "node:fs";
import path from "node:path";
import { SiteFooter } from "@/components/site-footer";
import { Separator } from "@/components/ui/8bit/separator";
import Hero1 from "@/components/ui/8bit/blocks/hero1";
import Timeline3 from "@/components/ui/8bit/blocks/timeline3";
import { PageSkeleton } from "@/components/page-skeleton";
import FAQ1 from "@/components/ui/8bit/blocks/faq1";
import Team2 from "@/components/ui/8bit/blocks/team2";
import Advanced1 from "@/components/ui/8bit/blocks/advanced1";
import Feature2 from "@/components/ui/8bit/blocks/feature2";
import { Kbd } from "@/components/ui/8bit/kbd";
import { loadLatestReleaseEntries } from "./releases";

const FAQ_ITEMS = [
  {
    question: "How do I install Neo Code?",
    answer:
      "Run `curl -fsSL https://code.neosantara.xyz/install.sh | sh`, then start it with `neo`. The installer is self-hosted for this Neosantara build and supports macOS, Linux, and Termux.",
  },
  {
    question: "Do I need a Neosantara account?",
    answer:
      "Use `neo login` for device authorization, or set `NEOSANTARA_API_KEY` when you want API-key based auth. Both paths talk to the same Neosantara OpenAI-compatible API.",
  },
  {
    question: "How does pricing work?",
    answer:
      "Neo Code uses your Neosantara balance. Usage is billed per token in IDR, and cumulative top-ups unlock higher RPM, input-token, and output-token limits on the Pricing page.",
  },
  {
    question: "Does it work on Termux/Android?",
    answer:
      "Yes. Termux is a first-class target with installer paths, touch keys, notifications, clipboard image paste, and mobile-friendly TUI defaults built in.",
  },
  {
    question: "Can I use a custom endpoint?",
    answer:
      "Yes, through extensions or `~/.neo-code/agent/models.json` for OpenAI-compatible endpoints. The built-in runtime stays Neosantara-first and does not ship vendor SDK providers.",
  },
  {
    question: "Where are docs, source, and updates?",
    answer:
      "Docs live on this site, source lives on GitHub, and updates come through the self-hosted installer. `neo update` checks the latest published Neo Code version explicitly.",
  },
];

function readVersion(): string {
  try {
    const pkgPath = path.resolve(process.cwd(), "../coding-agent/package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

export default function Home() {
  const releaseEntries = loadLatestReleaseEntries(4);
  const version = readVersion();

  return (
    <PageSkeleton>
      <main className="crt-on mx-auto max-w-3xl px-4 py-12">
        {/* Hero */}
        <Hero1
          title="NEO CODE"
          subtitle="A NEOSANTARA-FIRST CODING AGENT FOR THE TERMINAL"
          description="Open a project, run neo, ship code. Keyboard-driven, OpenAI-compatible, billed in IDR, runs on macOS, Linux, and Termux."
          badges={[
            { label: `v${version}`, variant: "secondary" },
            {
              href: "https://github.com/neosantara-xyz/neo-code",
              label: "OPEN SOURCE",
              variant: "outline",
            },
          ]}
          actions={[
            { href: "#install", label: "INSTALL", variant: "default" },
            { href: "/docs", label: "DOCS", variant: "outline" },
            { href: "/pricing", label: "PRICING", variant: "outline" },
          ]}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mascot.svg" alt="Neo Kanci" className="mx-auto mt-8 h-28 w-28 pixel-lift" />
        </Hero1>

        <section className="mb-16 grid gap-3 border-y-2 border-border py-6 text-center sm:grid-cols-3">
          {[
            ["NEOSANTARA", "First-class provider, no vendor SDKs"],
            ["IDR BILLING", "All model prices in rupiah"],
            ["OPENAI SDK", "Responses + completions transports"],
          ].map(([label, text]) => (
            <div key={label}>
              <div className="retro mb-1 text-xs font-bold text-foreground">{label}</div>
              <p className="text-xs leading-5 text-muted-foreground">{text}</p>
            </div>
          ))}
        </section>

        {/* Install */}
        <Separator className="mb-16" />
        <div id="install">
          <Advanced1
            title="neo-code"
            lines={[
              { type: "comment", text: "# Install" },
              { type: "input", text: "curl -fsSL https://code.neosantara.xyz/install.sh | sh" },
              { type: "output", text: "neo installed to ~/.local/bin/neo" },
              { type: "comment", text: "" },
              { type: "comment", text: "# Authenticate (device flow)" },
              { type: "input", text: "neo login" },
              { type: "output", text: "device authorization complete" },
              { type: "comment", text: "" },
              { type: "comment", text: "# Or use an API key directly" },
              { type: "input", text: "export NEOSANTARA_API_KEY=nsk_..." },
              { type: "comment", text: "" },
              { type: "comment", text: "# Start coding" },
              { type: "input", text: "cd my-project && neo" },
              { type: "output", text: "ready: neosantara provider, openai-compatible transport" },
            ]}
          />
        </div>

        {/* Shortcuts */}
        <Separator className="mb-16" />
        <section className="mb-16 text-center">
          <h2 className="retro mb-3 text-sm font-bold">KEYBOARD DRIVEN</h2>
          <p className="mx-auto mb-6 max-w-xl text-xs leading-5 text-muted-foreground">
            Terminal-safe defaults. Every binding is configurable in{" "}
            <code className="border border-border bg-background px-1">~/.neo-code/agent/keybindings.json</code>.
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
            <span><Kbd>Shift+Tab</Kbd> cycle mode</span>
            <span><Kbd>Esc</Kbd> interrupt</span>
            <span><Kbd>Ctrl+T</Kbd> transcript</span>
            <span><Kbd>Ctrl+O</Kbd> expand output</span>
            <span><Kbd>Alt+Enter</Kbd> follow-up</span>
            <span><Kbd>Ctrl+L</Kbd> model selector</span>
          </div>
        </section>

        {/* Features */}
        <Feature2
          title="WHAT NEO CODE DOES"
          description="Tools that hold up across long coding sessions"
          items={[
            {
              icon: "01",
              title: "Neosantara Runtime",
              description: "OpenAI-compatible transports talking to Neosantara. No vendor SDKs, no extra adapters.",
            },
            {
              icon: "02",
              title: "Code Intelligence",
              description: "LSP-backed symbol search, definitions, references, and diagnostics across TS, Python, Go, Rust, Java, Ruby, and C/C++.",
              badge: "CORE",
            },
            {
              icon: "03",
              title: "Session Trees",
              description: "Resume, fork, clone, name, export, and navigate conversation history with auto branch summaries.",
            },
            {
              icon: "04",
              title: "Memory + Skills",
              description: "Project memory and installable skills carry conventions across sessions without manual prompt stuffing.",
            },
            {
              icon: "05",
              title: "Subagents + Review",
              description: "Dispatch parallel agents, then review uncommitted changes, branches, commits, or PRs from inside the TUI.",
            },
            {
              icon: "06",
              title: "Termux Integration",
              description: "Android-first install, touch keys, notifications, clipboard image paste, and mobile TUI defaults.",
            },
          ]}
        />

        {/* Workflow */}
        <Separator className="mb-16" />
        <Timeline3
          title="WORKFLOW"
          description="A coding loop tuned for long terminal sessions"
          events={[
            {
              icon: "01",
              title: "Start With Context",
              description: "AGENTS.md, project memory, prompt templates, and selected files shape the first request.",
              badge: "INPUT",
            },
            {
              icon: "02",
              title: "Work In The TUI",
              description: "Stream edits, inspect tools, queue follow-ups, run background shell tasks, switch modes from the keyboard.",
            },
            {
              icon: "03",
              title: "Keep Context Healthy",
              description: "Auto-compaction and branch summaries preserve the useful trail when sessions get long.",
            },
            {
              icon: "04",
              title: "Scale The Task",
              description: "Reach for skills, extensions, MCP servers, and subagents when one chat turn is not enough.",
              badge: "EXTEND",
            },
            {
              icon: "05",
              title: "Export Or Share",
              description: "Export sessions to HTML or JSONL, share through gist or OS share sheet, then resume later.",
            },
          ]}
        />

        {/* Releases */}
        <Separator className="mb-16" />
        <Team2
          title="RECENT RELEASES"
          description="Latest user-facing changes"
          entries={releaseEntries}
        />

        {/* FAQ */}
        <Separator className="mb-16" />
        <FAQ1
          title="FAQ"
          description="Common questions about Neo Code"
          items={FAQ_ITEMS}
        />

        {/* CTA */}
        <Separator className="mb-16" />
        <section className="mb-16 border-2 border-border bg-card p-6 text-center">
          <h2 className="retro mb-3 text-sm font-bold">READY WHEN YOU ARE</h2>
          <p className="mx-auto mb-5 max-w-xl text-xs leading-6 text-muted-foreground">
            Three commands away from a coding agent in your terminal.
          </p>
          <div className="flex flex-wrap justify-center gap-3 text-xs">
            <a
              href="/docs/getting-started"
              className="border-2 border-border bg-background px-4 py-2 text-foreground hover:border-primary"
            >
              Read the Quickstart
            </a>
            <a
              href="https://github.com/neosantara-xyz/neo-code"
              className="border-2 border-border bg-background px-4 py-2 text-muted-foreground hover:border-primary hover:text-foreground"
            >
              View on GitHub
            </a>
          </div>
        </section>

        <SiteFooter />
      </main>
    </PageSkeleton>
  );
}
