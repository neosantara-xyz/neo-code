import { PageSkeleton } from "@/components/page-skeleton";
import { Separator } from "@/components/ui/8bit/separator";
import Hero1 from "@/components/ui/8bit/blocks/hero1";
import Timeline3 from "@/components/ui/8bit/blocks/timeline3";
import Footer1 from "@/components/ui/8bit/blocks/footer1";
import FAQ1 from "@/components/ui/8bit/blocks/faq1";
import Team2 from "@/components/ui/8bit/blocks/team2";
import Advanced1 from "@/components/ui/8bit/blocks/advanced1";
import Feature2 from "@/components/ui/8bit/blocks/feature2";
import { Kbd } from "@/components/ui/8bit/kbd";

export default function Home() {
  return (
    <PageSkeleton>
    <main className="crt-on mx-auto max-w-2xl px-4 py-12">
      {/* Hero */}
      <Hero1
        title="NEO CODE"
        subtitle="NEOSANTARA-FIRST AI CODING AGENT"
        description="Cross-session memory, code intelligence, subagents, and 12+ built-in capabilities. Built for your terminal."
        badges={[{ label: "v0.76", variant: "secondary" }, { label: "Open Source", variant: "outline" }]}
        actions={[
          { href: "#install", label: "INSTALL", variant: "default" },
          { href: "/docs", label: "DOCS", variant: "outline" },
        ]}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mascot.svg" alt="Neo Kanci" className="mx-auto mt-8 h-28 w-28 pixel-lift" />
      </Hero1>

      {/* Install */}
      <Separator className="mb-16" />
      <div id="install">
      <Advanced1
        title="neo-code"
        lines={[
          { type: "comment", text: "# Install Neo Code" },
          { type: "input", text: "curl -fsSL https://code.neosantara.xyz/install.sh | sh" },
          { type: "output", text: "Downloading neo-code v0.76..." },
          { type: "output", text: "Installing to ~/.local/bin/neo" },
          { type: "output", text: "Done in 3.2s" },
          { type: "comment", text: "" },
          { type: "comment", text: "# Login with your Neosantara account" },
          { type: "input", text: "neo login" },
          { type: "output", text: "Opening browser for device auth..." },
          { type: "output", text: "Authenticated as user@neosantara.xyz" },
          { type: "comment", text: "" },
          { type: "comment", text: "# Start coding" },
          { type: "input", text: "neo" },
          { type: "output", text: "Neo Code v0.76 ready. Model: deepseek-v4-0324" },
        ]}
      />
      </div>

      {/* Features */}
      <Separator className="mb-16" />

      {/* Shortcuts */}
      <section className="mb-16 text-center">
        <h2 className="retro mb-6 text-sm font-bold">KEYBOARD DRIVEN</h2>
        <div className="flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
          <span><Kbd>Shift+Tab</Kbd> cycle mode</span>
          <span><Kbd>Esc</Kbd> interrupt</span>
          <span><Kbd>Ctrl+T</Kbd> transcript</span>
          <span><Kbd>Ctrl+E</Kbd> expand output</span>
          <span><Kbd>Ctrl+J</Kbd> new session</span>
          <span><Kbd>Ctrl+R</Kbd> resume</span>
        </div>
      </section>

      <Feature2
        title="FEATURES"
        description="Everything you need in a coding agent"
        items={[
          { icon: "01", title: "Memory System", description: "Persistent context across sessions. Remembers project patterns, decisions, and conventions automatically." },
          { icon: "02", title: "Code Intelligence", description: "LSP integration for symbol search, go-to-definition, and find-references across TypeScript, Python, Rust, Go, and more.", badge: "NEW" },
          { icon: "03", title: "Skills", description: "Installable skill packages that teach the agent specialized workflows, tools, and domain knowledge." },
          { icon: "04", title: "Subagents", description: "Dispatch parallel agents for complex tasks. Each subagent runs with isolated context and reports back." },
          { icon: "05", title: "Code Review", description: "Review uncommitted changes, branches, commits, or pull requests with structured feedback." },
          { icon: "06", title: "MCP Servers", description: "Connect external tools via Model Context Protocol. Extend capabilities without writing extensions." },
          { icon: "07", title: "Auto-Compaction", description: "Intelligent context management with branch summarization. Long sessions stay fast and focused." },
          { icon: "08", title: "Background Tasks", description: "Run long shell commands in background. Get notified on completion while continuing to work." },
          { icon: "09", title: "Session Export", description: "Export conversations to HTML or JSONL. Share sessions via gist or local share sheet." },
          { icon: "10", title: "Apply-Patch", description: "Efficient code modifications using unified diff patches instead of full file rewrites." },
          { icon: "11", title: "Extensions", description: "Custom tools, slash commands, event hooks, and autocomplete providers via JavaScript extensions." },
          { icon: "12", title: "Termux:API", description: "Native Android integration — notifications, vibration, clipboard, and touch keyboard configuration." },
        ]}
      />

      {/* Footer */}
      <Separator className="mb-16" />
      <Timeline3
        title="ROADMAP"
        description="Building the Neosantara-first coding agent"
        events={[
          { icon: "01", title: "Core Agent", description: "OpenAI-compatible transport, tool system, TUI with shimmer animations.", badge: "DONE" },
          { icon: "02", title: "Memory + LSP", description: "Cross-session memory persistence and Language Server Protocol integration.", badge: "DONE" },
          { icon: "03", title: "Skills System", description: "Installable skill packages with progressive disclosure and token budgets.", badge: "NOW" },
          { icon: "04", title: "Extensions", description: "Custom tools, MCP servers, and community plugin ecosystem." },
          { icon: "05", title: "Multi-Agent", description: "Parallel subagents for complex tasks with isolated contexts." },
        ]}
      />

      <Separator className="mb-16" />
      <Team2
        title="CHANGELOG"
        description="Recent updates and releases"
        entries={[
          { date: "May 2026", title: "v0.76 — Skills + Tree UI", description: "Token-budgeted skill system, shimmer animations, directory detail rows, streaming-aware tool activity groups.", badge: "LATEST" },
          { date: "May 2026", title: "v0.75 — Memory System", description: "Cross-session memory extraction, consolidation, and injection. Automatic pruning and search." },
          { date: "Apr 2026", title: "v0.74 — LSP Integration", description: "Language Server Protocol support for TypeScript, Python, Rust, Go, C/C++, Java, and Ruby." },
          { date: "Mar 2026", title: "v0.73 — Termux Support", description: "First-class Android/Termux installer, touch keyboard configuration, and mobile-optimized TUI." },
        ]}
      />

      <Separator className="mb-16" />
      <FAQ1
        title="FAQ"
        description="Common questions about Neo Code"
        items={[
          { question: "What models does Neo Code support?", answer: "Neo Code uses the Neosantara API which provides access to various models. It's OpenAI-SDK compatible, so any model available through the Neosantara platform works out of the box." },
          { question: "Is it free?", answer: "Neo Code CLI is open source and free. You need a Neosantara API key for the AI features — pricing is based on token usage in IDR." },
          { question: "Does it work on Termux/Android?", answer: "Yes! Neo Code has first-class Termux support. The installer detects Termux and builds from source with Node.js. Touch keyboard extra keys are configurable via /termux-keys." },
          { question: "How is it different from Claude Code?", answer: "Neo Code is Neosantara-first — built for the Indonesian developer ecosystem with IDR billing, local API endpoints, and Termux-optimized TUI. It shares architectural patterns but is independently maintained." },
          { question: "Can I use my own API key?", answer: "Yes. Set NEOSANTARA_API_KEY in your environment or run neo login for device authentication." },
        ]}
      />

      <Footer1
        title="Neo Code"
        description="Neosantara-first AI coding agent for your terminal."
        copyright={`${new Date().getFullYear()} Neosantara. All rights reserved.`}
        columns={[
          {
            title: "Product",
            links: [
              { label: "Install", href: "#install" },
              { label: "Documentation", href: "/docs" },
              { label: "GitHub", href: "https://github.com/ErRickow/neo-code" },
            ],
          },
          {
            title: "Neosantara",
            links: [
              { label: "Dashboard", href: "https://app.neosantara.xyz" },
              { label: "API", href: "https://api.neosantara.xyz" },
            ],
          },
          {
            title: "Legal",
            links: [
              { label: "Terms", href: "https://www.neosantara.xyz/terms" },
              { label: "Privacy", href: "https://www.neosantara.xyz/privacy" },
            ],
          },
        ]}
      />
    </main>
    </PageSkeleton>
  );
}
