"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/8bit/table";

export function DocsContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <h1 className="retro mb-4 mt-6 text-lg font-bold text-foreground">{children}</h1>,
        h2: ({ children }) => <h2 className="retro mb-3 mt-8 text-sm font-bold text-foreground">{children}</h2>,
        h3: ({ children }) => <h3 className="retro mb-2 mt-6 text-xs font-bold text-foreground">{children}</h3>,
        p: ({ children }) => <p className="mb-3 text-sm leading-relaxed text-muted-foreground">{children}</p>,
        a: ({ href, children }) => (
          <a href={href} className="text-primary underline hover:text-foreground">{children}</a>
        ),
        code: ({ className, children }) => {
          const isBlock = className?.includes("language-");
          if (isBlock) {
            return <code className="block text-xs text-primary">{children}</code>;
          }
          return (
            <code className="border border-border bg-background px-1.5 py-0.5 text-xs text-primary">{children}</code>
          );
        },
        pre: ({ children }) => (
          <pre className="mb-4 overflow-x-auto border-2 border-border bg-background p-4">{children}</pre>
        ),
        table: ({ children }) => (
          <div className="mb-4 overflow-x-auto max-w-full">
            <Table variant="default" font="retro">
              {children}
            </Table>
          </div>
        ),
        thead: ({ children }) => <TableHeader>{children}</TableHeader>,
        tbody: ({ children }) => <TableBody>{children}</TableBody>,
        tr: ({ children }) => <TableRow>{children}</TableRow>,
        th: ({ children }) => <TableHead className="text-xs">{children}</TableHead>,
        td: ({ children }) => <TableCell className="text-sm text-muted-foreground">{children}</TableCell>,
        ul: ({ children }) => <ul className="mb-3 ml-4 list-disc space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="mb-3 ml-4 list-decimal space-y-1">{children}</ol>,
        li: ({ children }) => <li className="text-sm text-muted-foreground">{children}</li>,
        hr: () => <hr className="my-6 border-border" />,
        strong: ({ children }) => <strong className="text-foreground">{children}</strong>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
