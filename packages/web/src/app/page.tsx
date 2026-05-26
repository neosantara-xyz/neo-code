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

export default function Home() {
  return (
    <PageSkeleton>
    <main className="crt-on mx-auto max-w-3xl px-4 py-12">
      {/* Hero */}
      <Hero1
        title="NEO CODE"
        subtitle="NEOSANTARA-FIRST TERMINAL CODING AGENT"
        description="OpenAI-compatible transport, Neosantara identity, IDR billing, memory, LSP, sessions, subagents, and Termux-ready workflows in one keyboard-driven CLI."
        badges={[{ label: "v0.76", variant: "secondary" }, { label: "OpenAI SDK", variant: "outline" }, { label: "Termux Ready", variant: "outline" }]}
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
          ["neosantara", "Built-in provider identity"],
          ["IDR", "Model pricing follows Neosantara billing"],
          ["openai", "Responses and completions transports"],
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
          { type: "comment", text: "# Authenticate" },
          { type: "input", text: "neo login" },
          { type: "output", text: "device authorization complete" },
          { type: "comment", text: "" },
          { type: "comment", text: "# Or use an API key" },
          { type: "input", text: "export NEOSANTARA_API_KEY=nsk_..." },
          { type: "comment", text: "" },
          { type: "input", text: "neo" },
          { type: "output", text: "ready: neosantara provider, OpenAI-compatible transport" },
        ]}
      />
      </div>

      {/* Features */}
      <Separator className="mb-16" />

      {/* Shortcuts */}
      <section className="mb-16 text-center">
        <h2 className="retro mb-3 text-sm font-bold">KEYBOARD DRIVEN</h2>
        <p className="mx-auto mb-6 max-w-xl text-xs leading-5 text-muted-foreground">
          Defaults are terminal-safe and configurable in <code className="border border-border bg-background px-1">keybindings.json</code>.
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

      <Feature2
        title="WHAT SHIPS TODAY"
        description="Focused capabilities for real coding sessions"
        items={[
          { icon: "01", title: "Neosantara Runtime", description: "Built-in provider identity is neosantara, with OpenAI-compatible responses and completions transports." },
          { icon: "02", title: "Code Intelligence", description: "LSP-backed symbol lookup, definitions, references, and diagnostics for common project stacks.", badge: "CORE" },
          { icon: "03", title: "Session Trees", description: "Resume, fork, clone, name, export, and navigate conversation history with branch summaries." },
          { icon: "04", title: "Memory + Skills", description: "Project memory and installable skills preserve conventions without stuffing every prompt manually." },
          { icon: "05", title: "Subagents + Review", description: "Dispatch specialized agents, inspect diffs, and review uncommitted changes, branches, commits, or PRs." },
          { icon: "06", title: "Termux Integration", description: "Android-friendly install path, touch-key helpers, notifications, clipboard image paste, and mobile TUI defaults." },
        ]}
      />

      {/* Footer */}
      <Separator className="mb-16" />
      <Timeline3
        title="WORKFLOW"
        description="A coding loop designed for long terminal sessions"
        events={[
          { icon: "01", title: "Start With Context", description: "AGENTS.md, memories, prompt templates, and selected files shape the first request.", badge: "INPUT" },
          { icon: "02", title: "Work In The TUI", description: "Stream edits, inspect tools, queue follow-ups, background shell tasks, and switch modes from the keyboard." },
          { icon: "03", title: "Keep Context Healthy", description: "Auto-compaction and branch summaries preserve the useful trail when sessions get long." },
          { icon: "04", title: "Scale The Task", description: "Use skills, extensions, MCP servers, and subagents when a single chat turn is not enough.", badge: "EXTEND" },
          { icon: "05", title: "Export Or Share", description: "Export sessions to HTML or JSONL, share through gist or local OS share sheet, then resume later." },
        ]}
      />

      <Separator className="mb-16" />
      <Team2
        title="RECENT RELEASES"
        description="Recent user-facing changes"
        entries={[
          { date: "May 2026", title: "v0.76 - Docs, Skills, Tree UI", description: "Expanded documentation, token-budgeted skills, session tree polish, and streaming-aware tool activity.", badge: "LATEST" },
          { date: "May 2026", title: "Memory System", description: "Cross-session memory extraction, consolidation, injection, pruning, and search." },
          { date: "Apr 2026", title: "LSP Integration", description: "Language Server Protocol support for TypeScript, Python, Rust, Go, C/C++, Java, and Ruby." },
          { date: "Mar 2026", title: "Termux Support", description: "Android install path, touch keyboard configuration, notifications, and mobile-friendly terminal behavior." },
        ]}
      />

      <Separator className="mb-16" />
      <FAQ1
        title="FAQ"
        description="Common questions about Neo Code"
        items={[
          { question: "What provider does Neo Code use?", answer: "This build is Neosantara-first. The built-in provider identity is neosantara and credentials prefer NEOSANTARA_API_KEY or neo login." },
          { question: "Does it add vendor SDK providers?", answer: "No. The built-in runtime stays OpenAI-SDK compatible through openai-responses and openai-completions transports." },
          { question: "How is pricing shown?", answer: "CLI model prices follow Neosantara billing and are represented in IDR." },
          { question: "Does it work on Termux/Android?", answer: "Yes. The installer and TUI include Termux-oriented paths, touch keyboard helpers, notifications, and clipboard support." },
          { question: "Can I use a normal API key?", answer: "Yes. Set NEOSANTARA_API_KEY in your environment, or run neo login for device authorization." },
        ]}
      />

      <Separator className="mb-16" />
      <section className="mb-16 border-2 border-border bg-card p-6 text-center">
        <h2 className="retro mb-3 text-sm font-bold">START WITH NEO CODE</h2>
        <p className="mx-auto mb-5 max-w-xl text-xs leading-6 text-muted-foreground">
          Install the CLI, authenticate with Neosantara, then open a project and run <code className="border border-border bg-background px-1">neo</code>.
        </p>
        <div className="flex flex-wrap justify-center gap-3 text-xs">
          <a href="#install" className="border-2 border-border bg-background px-4 py-2 text-foreground hover:border-primary">Install</a>
          <a href="/docs/getting-started" className="border-2 border-border bg-background px-4 py-2 text-muted-foreground hover:border-primary hover:text-foreground">Getting Started</a>
          <a href="/pricing" className="border-2 border-border bg-background px-4 py-2 text-muted-foreground hover:border-primary hover:text-foreground">Pricing</a>
        </div>
      </section>

      <SiteFooter />
    </main>
    </PageSkeleton>
  );
}
