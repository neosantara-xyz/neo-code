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
import { DocsCodeBlock } from "./code-block";
import { createHeadingSlugger, reactNodeToText } from "./toc";

export function DocsContent({ content }: { content: string }) {
  const headingId = createHeadingSlugger();

  return (
    <div className="mx-auto min-w-0 max-w-3xl overflow-hidden break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="retro mb-5 mt-2 break-words text-xl font-bold leading-relaxed text-foreground">{children}</h1>,
          h2: ({ children }) => {
            const id = headingId(reactNodeToText(children));
            return (
              <h2 id={id} className="retro group mb-3 mt-10 scroll-mt-6 break-words text-sm font-bold leading-relaxed text-foreground">
                <a href={`#${id}`} aria-label={`Link to ${reactNodeToText(children)}`} className="mr-2 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                  #
                </a>
                {children}
              </h2>
            );
          },
          h3: ({ children }) => {
            const id = headingId(reactNodeToText(children));
            return (
              <h3 id={id} className="retro group mb-2 mt-7 scroll-mt-6 break-words text-xs font-bold leading-relaxed text-foreground">
                <a href={`#${id}`} aria-label={`Link to ${reactNodeToText(children)}`} className="mr-2 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                  #
                </a>
                {children}
              </h3>
            );
          },
          p: ({ children }) => <p className="mb-4 min-w-0 break-words text-sm leading-7 text-muted-foreground">{children}</p>,
          a: ({ href, children }) => (
            <a href={href} className="break-words text-primary underline decoration-dotted underline-offset-4 hover:text-foreground">
              {children}
            </a>
          ),
          code: ({ className, children }) => {
            const isBlock = className?.includes("language-");
            if (isBlock) {
              const language = className?.match(/language-(\S+)/)?.[1];
              const code = String(children).replace(/\n$/, "");
              return <DocsCodeBlock code={code} language={language} />;
            }
            return (
              <code className="break-words border border-border bg-background px-1.5 py-0.5 text-xs text-primary">{children}</code>
            );
          },
          pre: ({ children }) => (
            <pre className="mb-5 max-w-full overflow-x-auto border-2 border-border bg-background p-4">{children}</pre>
          ),
          table: ({ children }) => (
            <div className="mb-5 max-w-full overflow-x-auto border-2 border-border">
              <Table variant="default" font="retro">
                {children}
              </Table>
            </div>
          ),
          thead: ({ children }) => <TableHeader>{children}</TableHeader>,
          tbody: ({ children }) => <TableBody>{children}</TableBody>,
          tr: ({ children }) => <TableRow>{children}</TableRow>,
          th: ({ children }) => <TableHead className="whitespace-nowrap text-xs">{children}</TableHead>,
          td: ({ children }) => <TableCell className="align-top text-sm text-muted-foreground">{children}</TableCell>,
          ul: ({ children }) => <ul className="mb-4 ml-4 list-disc space-y-1.5">{children}</ul>,
          ol: ({ children }) => <ol className="mb-4 ml-4 list-decimal space-y-1.5">{children}</ol>,
          li: ({ children }) => <li className="text-sm leading-7 text-muted-foreground">{children}</li>,
          hr: () => <hr className="my-8 border-border" />,
          strong: ({ children }) => <strong className="text-foreground">{children}</strong>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
