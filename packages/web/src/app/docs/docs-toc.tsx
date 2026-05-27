"use client";

import { useEffect, useMemo, useState } from "react";
import type { TableOfContentsItem } from "./toc";

function TocList({ items, activeId }: { items: TableOfContentsItem[]; activeId?: string }) {
  return (
    <ol className="min-w-0 space-y-2">
      {items.map((item) => {
        const active = activeId === item.id;
        return (
          <li key={item.id} className={item.depth === 3 ? "pl-3" : undefined}>
            <a
              href={`#${item.id}`}
              className={[
                "block min-w-0 break-words border-l-2 py-0.5 pl-2 text-xs leading-relaxed transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
              ].join(" ")}
            >
              {item.title}
            </a>
          </li>
        );
      })}
    </ol>
  );
}

export function DocsTableOfContents({
  items,
  variant = "desktop",
}: {
  items: TableOfContentsItem[];
  variant?: "desktop" | "mobile";
}) {
  const [activeId, setActiveId] = useState<string | undefined>(items[0]?.id);
  const [open, setOpen] = useState(false);
  const ids = useMemo(() => items.map((item) => item.id), [items]);

  useEffect(() => {
    if (ids.length === 0) return;

    const headings = ids.map((id) => document.getElementById(id)).filter((node): node is HTMLElement => !!node);
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible?.target.id) {
          setActiveId(visible.target.id);
        }
      },
      { rootMargin: "0px 0px -70% 0px", threshold: [0, 1] },
    );

    for (const heading of headings) observer.observe(heading);
    return () => observer.disconnect();
  }, [ids]);

  if (items.length === 0) return null;

  if (variant === "mobile") {
    return (
      <details className="min-w-0 border-2 border-border bg-card p-4" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
        <summary className="retro cursor-pointer text-[10px] font-bold text-foreground">ON THIS PAGE</summary>
        <div className="mt-3 border-t border-border pt-3">
          <TocList items={items} activeId={activeId} />
        </div>
      </details>
    );
  }

  return (
    <nav aria-label="Table of contents" className="min-w-0 border-2 border-border bg-card p-4">
      <h2 className="retro mb-3 text-[10px] font-bold text-foreground">ON THIS PAGE</h2>
      <TocList items={items} activeId={activeId} />
    </nav>
  );
}
