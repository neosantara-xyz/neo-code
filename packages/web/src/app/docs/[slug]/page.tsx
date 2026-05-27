import { notFound } from "next/navigation";
import { DocsContent } from "../content";
import { DocsMobileNav, DocsSideNav } from "../docs-shell";
import { DocsTableOfContents } from "../docs-toc";
import { loadDoc, loadDocs } from "../data";
import { extractTableOfContents } from "../toc";
import { SiteFooter } from "@/components/site-footer";
import { buildDocMetadata } from "../../seo";

export async function generateStaticParams() {
  return loadDocs().map((doc) => ({ slug: doc.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const current = loadDoc(slug);
  if (!current) return {};

  return buildDocMetadata(current.entry);
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const current = loadDoc(slug);
  if (!current) notFound();

  const { content } = current;
  const toc = extractTableOfContents(content);
  const docs = loadDocs();
  const currentIdx = docs.findIndex((doc) => doc.slug === slug);
  const prev = currentIdx > 0 ? docs[currentIdx - 1] : null;
  const next = currentIdx >= 0 && currentIdx < docs.length - 1 ? docs[currentIdx + 1] : null;

  return (
    <main className="py-4">
      <div className="mb-8">
        <a href="/docs" className="text-sm text-muted-foreground hover:text-foreground">
          &larr; All docs
        </a>
      </div>

      <div className="mb-12 grid min-w-0 gap-6 xl:grid-cols-[13rem_minmax(0,1fr)_14rem] xl:items-start">
        <aside className="sticky top-6 hidden max-h-[calc(100vh-3rem)] min-w-0 overflow-y-auto xl:block">
          <DocsSideNav docs={docs} currentSlug={slug} />
        </aside>

        <div className="min-w-0 xl:hidden">
          <DocsMobileNav docs={docs} currentSlug={slug} />
        </div>

        <div className="min-w-0 lg:hidden">
          <DocsTableOfContents items={toc} variant="mobile" />
        </div>

        <article className="min-w-0 overflow-hidden border-2 border-border bg-card px-4 py-6 sm:px-6 lg:px-8">
          <DocsContent content={content} />
        </article>

        <aside className="sticky top-6 hidden max-h-[calc(100vh-3rem)] min-w-0 overflow-y-auto lg:block">
          <DocsTableOfContents items={toc} />
        </aside>
      </div>

      <div className="mb-16 grid gap-3 text-sm sm:grid-cols-2">
        {prev ? (
          <a href={`/docs/${prev.slug}`} className="border-2 border-border bg-card p-4 text-muted-foreground hover:text-foreground">
            <span className="block text-xs">Previous</span>
            <span className="retro mt-1 block text-[10px] text-foreground">&larr; {prev.title}</span>
          </a>
        ) : <span />}
        {next ? (
          <a href={`/docs/${next.slug}`} className="border-2 border-border bg-card p-4 text-right text-muted-foreground hover:text-foreground">
            <span className="block text-xs">Next</span>
            <span className="retro mt-1 block text-[10px] text-foreground">{next.title} &rarr;</span>
          </a>
        ) : <span />}
      </div>

      <SiteFooter />
    </main>
  );
}
