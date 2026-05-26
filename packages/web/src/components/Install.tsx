"use client";

import { useState } from "react";

const INSTALL_COMMAND = "curl -fsSL https://code.neosantara.xyz/install.sh | sh";

export default function Install() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(INSTALL_COMMAND);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for environments without clipboard API
      const textarea = document.createElement("textarea");
      textarea.value = INSTALL_COMMAND;
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand("copy");
      document.body.removeChild(textarea);
      if (success) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  return (
    <section id="install" style={{ padding: "4rem 1rem" }}>
      <div className="container">
        <h2
          className="nes-text is-success"
          style={{ textAlign: "center", marginBottom: "2rem", fontSize: "clamp(1.2rem, 4vw, 2rem)" }}
        >
          Installation
        </h2>
        <div
          className="nes-container is-dark"
          style={{
            maxWidth: "700px",
            margin: "0 auto",
            position: "relative",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
              flexWrap: "wrap",
            }}
          >
            <code
              style={{
                color: "#00ff41",
                fontSize: "clamp(0.7rem, 2vw, 1rem)",
                wordBreak: "break-all",
                flex: 1,
              }}
            >
              $ {INSTALL_COMMAND}
            </code>
            <button
              type="button"
              className="nes-btn is-primary"
              onClick={handleCopy}
              style={{ flexShrink: 0, fontSize: "0.8rem" }}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
