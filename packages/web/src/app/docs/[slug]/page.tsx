import fs from "node:fs";
import path from "node:path";
import { notFound } from "next/navigation";
import { DocsContent } from "../content";
import { SiteFooter } from "@/components/site-footer";

const DOCS_DIR = path.resolve(process.cwd(), "../../docs");
const ORDER = ["getting-started", "configuration", "tools", "sessions", "subagents", "extensions", "themes", "memory", "skills", "lsp", "termux", "env"];

function getAllSlugs(): string[] {
  if (!fs.existsSync(DOCS_DIR)) return [];
  return fs.readdirSync(DOCS_DIR).filter((f) => f.endsWith(".md")).map((f) => f.replace(/\.md$/, ""));
}

export async function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export default function DocPage({ params }: { params: { slug: string } }) {
  const filePath = path.join(DOCS_DIR, `${params.slug}.md`);
  if (!fs.existsSync(filePath)) notFound();

  const content = fs.readFileSync(filePath, "utf-8");
  const sorted = getAllSlugs().sort((a, b) => {
    const ai = ORDER.indexOf(a);
    const bi = ORDER.indexOf(b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
  const currentIdx = sorted.indexOf(params.slug);
  const prev = currentIdx > 0 ? sorted[currentIdx - 1] : null;
  const next = currentIdx < sorted.length - 1 ? sorted[currentIdx + 1] : null;

  return (
    <main className="py-4">
      <div className="mb-8">
        <a href="/docs" className="text-sm text-muted-foreground hover:text-foreground">
          &larr; All docs
        </a>
      </div>

      <article className="mb-12 border-2 border-border bg-card p-6">
        <DocsContent content={content} />
      </article>

      <div className="mb-16 flex justify-between text-sm">
        {prev ? (
          <a href={`/docs/${prev}`} className="text-muted-foreground hover:text-foreground">&larr; {prev}</a>
        ) : <span />}
        {next ? (
          <a href={`/docs/${next}`} className="text-muted-foreground hover:text-foreground">{next} &rarr;</a>
        ) : <span />}
      </div>

      <SiteFooter />
    </main>
  );
}
