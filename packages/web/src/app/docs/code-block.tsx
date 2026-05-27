import { cn } from "@/lib/utils";
import { CopyCodeButton } from "./copy-code-button";
import { highlightCodeBlock } from "./syntax-highlight";

export function DocsCodeBlock({ code, language }: { code: string; language?: string }) {
	const highlighted = highlightCodeBlock(code, language);

	return (
		<span className="group relative block">
			<CopyCodeButton code={code} />
			<code
				className={cn(
					"hljs block min-w-max pr-20 text-xs leading-6",
					highlighted.language && `language-${highlighted.language}`,
				)}
				dangerouslySetInnerHTML={{ __html: highlighted.html }}
			/>
		</span>
	);
}
