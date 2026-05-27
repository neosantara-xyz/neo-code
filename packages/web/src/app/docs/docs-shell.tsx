import type { DocEntry } from "./data";

export function DocsSideNav({ docs, currentSlug }: { docs: DocEntry[]; currentSlug: string }) {
  const items = <DocsNavItems docs={docs} currentSlug={currentSlug} />;

  return (
    <nav aria-label="Documentation pages" className="min-w-0 border-2 border-border bg-card p-4">
      <h2 className="retro mb-3 text-[10px] font-bold text-foreground">DOCS</h2>
      {items}
    </nav>
  );
}

export function DocsMobileNav({ docs, currentSlug }: { docs: DocEntry[]; currentSlug: string }) {
  return (
    <details className="min-w-0 border-2 border-border bg-card p-4">
      <summary className="retro cursor-pointer text-[10px] font-bold text-foreground">DOCS</summary>
      <div className="mt-3 border-t border-border pt-3">
        <DocsNavItems docs={docs} currentSlug={currentSlug} />
      </div>
    </details>
  );
}

function DocsNavItems({ docs, currentSlug }: { docs: DocEntry[]; currentSlug: string }) {
  return (
    <ol className="min-w-0 space-y-1.5">
      {docs.map((doc) => {
        const active = doc.slug === currentSlug;
        return (
          <li key={doc.slug}>
            <a
              href={`/docs/${doc.slug}`}
              aria-current={active ? "page" : undefined}
              className={[
                "block min-w-0 break-words border-l-2 py-1.5 pl-3 text-xs leading-relaxed transition-colors",
                active
                  ? "border-primary bg-muted/60 text-foreground"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
              ].join(" ")}
            >
              {doc.title}
            </a>
          </li>
        );
      })}
    </ol>
  );
}
