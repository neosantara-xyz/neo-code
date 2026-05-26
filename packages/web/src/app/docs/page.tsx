import fs from "node:fs";
import path from "node:path";
import { SiteFooter } from "@/components/site-footer";
import "@/components/ui/8bit/styles/retro.css";

interface DocEntry {
  slug: string;
  title: string;
  description: string;
}

function extractTitle(content: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1] : "Untitled";
}

function extractDescription(content: string): string {
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && !trimmed.startsWith("---")) {
      return trimmed.slice(0, 120);
    }
  }
  return "";
}

function loadDocs(): DocEntry[] {
  const docsDir = path.resolve(process.cwd(), "../../docs");
  if (!fs.existsSync(docsDir)) return [];
  const order = ["getting-started", "configuration", "tools", "sessions", "subagents", "extensions", "themes", "memory", "skills", "lsp", "termux", "env"];
  const files = fs.readdirSync(docsDir).filter((f) => f.endsWith(".md"));
  const docs = files.map((f) => {
    const content = fs.readFileSync(path.join(docsDir, f), "utf-8");
    return { slug: f.replace(/\.md$/, ""), title: extractTitle(content), description: extractDescription(content) };
  });
  return docs.sort((a, b) => {
    const ai = order.indexOf(a.slug);
    const bi = order.indexOf(b.slug);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
}

export default function DocsPage() {
  const docs = loadDocs();

  return (
    <main className="py-4">
      <div className="mb-8">
        <a href="/" className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Home
        </a>
      </div>

      <div className="mb-12 text-center">
        <h1 className="retro mb-2 text-2xl font-bold">DOCUMENTATION</h1>
        <p className="text-sm text-muted-foreground">Everything you need to use Neo Code</p>
      </div>

      <div className="mb-16 grid gap-3 sm:grid-cols-2">
        {docs.map((doc) => (
          <a
            key={doc.slug}
            href={`/docs/${doc.slug}`}
            className="block border-2 border-border bg-card p-4 transition-colors hover:border-primary"
          >
            <h2 className="retro mb-1 text-xs font-bold text-foreground">{doc.title}</h2>
            <p className="text-xs text-muted-foreground">{doc.description}</p>
          </a>
        ))}
      </div>

      <SiteFooter />
    </main>
  );
}
