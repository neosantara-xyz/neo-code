"use client";

import Footer1 from "@/components/ui/8bit/blocks/footer1";
import { useState } from "react";

function CopyInstallButton() {
  const [copied, setCopied] = useState(false);
  const cmd = "curl -fsSL https://code.neosantara.xyz/install.sh | sh";

  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(cmd);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="mt-2 border-2 border-border bg-background px-3 py-1.5 text-xs text-muted-foreground hover:border-foreground hover:text-foreground transition-colors"
    >
      {copied ? "Copied!" : "$ curl ... install.sh | sh"}
    </button>
  );
}

export function SiteFooter() {
  return (
    <div>
      <div className="mb-6 flex justify-center">
        <CopyInstallButton />
      </div>
      <Footer1
        title="Neo Code"
        description="Neosantara-first AI coding agent for your terminal."
        copyright={`${new Date().getFullYear()} Neosantara. All rights reserved.`}
        columns={[
          {
            title: "Product",
            links: [
              { label: "Docs", href: "/docs" },
              { label: "Pricing", href: "/pricing" },
              { label: "GitHub", href: "https://github.com/neosantara-xyz/neo-code" },
            ],
          },
          {
            title: "Neosantara",
            links: [
              { label: "Dashboard", href: "https://app.neosantara.xyz" },
              { label: "API", href: "https://api.neosantara.xyz" },
            ],
          },
          {
            title: "Legal",
            links: [
              { label: "Terms", href: "https://www.neosantara.xyz/terms" },
              { label: "Privacy", href: "https://www.neosantara.xyz/privacy" },
            ],
          },
        ]}
      />
    </div>
  );
}
