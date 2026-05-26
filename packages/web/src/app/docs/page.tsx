import { SiteFooter } from "@/components/site-footer";
import "@/components/ui/8bit/styles/retro.css";
import { getDocGroups, loadDocs } from "./data";

export default function DocsPage() {
  const docs = loadDocs();
  const groups = getDocGroups(docs);

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

      <div className="mb-16 space-y-10">
        {groups.map((group) => (
          <section key={group.title}>
            <div className="mb-3 flex items-end justify-between gap-3 border-b-2 border-border pb-2">
              <h2 className="retro text-xs font-bold text-foreground">{group.title}</h2>
              <span className="text-xs text-muted-foreground">{group.docs.length} pages</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {group.docs.map((doc) => (
                <a
                  key={doc.slug}
                  href={`/docs/${doc.slug}`}
                  className="block min-h-32 border-2 border-border bg-card p-4 transition-colors hover:border-primary hover:bg-muted/40"
                >
                  <span className="mb-3 block font-mono text-[10px] uppercase text-muted-foreground">{doc.slug}</span>
                  <h3 className="retro mb-2 text-xs font-bold leading-relaxed text-foreground">{doc.title}</h3>
                  <p className="text-xs leading-5 text-muted-foreground">{doc.description}</p>
                </a>
              ))}
            </div>
          </section>
        ))}
      </div>

      <SiteFooter />
    </main>
  );
}
