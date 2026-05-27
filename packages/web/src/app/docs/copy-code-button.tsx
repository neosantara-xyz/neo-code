"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopyCodeButton({ code }: { code: string }) {
	const [copied, setCopied] = useState(false);

	async function copyCode() {
		await navigator.clipboard.writeText(code);
		setCopied(true);
		window.setTimeout(() => setCopied(false), 1400);
	}

	return (
		<button
			aria-label="Copy code"
			className="absolute right-2 top-2 z-10 inline-flex h-8 items-center gap-1.5 border-2 border-border bg-card px-2 font-mono text-[10px] uppercase text-muted-foreground opacity-100 transition-colors hover:border-primary hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100"
			data-copy-code={code}
			onClick={copyCode}
			type="button"
		>
			{copied ? <Check aria-hidden="true" className="size-3" /> : <Copy aria-hidden="true" className="size-3" />}
			{copied ? "Copied" : "Copy"}
		</button>
	);
}
