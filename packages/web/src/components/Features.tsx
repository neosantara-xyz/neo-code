interface Feature {
  title: string;
  description: string;
  icon: string;
}

const features: Feature[] = [
  {
    title: "Memory System",
    icon: "[*]",
    description: "Persistent context across sessions. Your agent remembers project patterns and decisions.",
  },
  {
    title: "LSP Integration",
    icon: "[>]",
    description: "Full Language Server Protocol support for intelligent code navigation and diagnostics.",
  },
  {
    title: "Tool Activity Tree",
    icon: "[+]",
    description: "Visual tree of agent actions. See exactly what your agent is doing in real-time.",
  },
  {
    title: "Auto-Compaction",
    icon: "[~]",
    description: "Intelligent context management. Long conversations stay fast and focused.",
  },
  {
    title: "Extensions",
    icon: "[x]",
    description: "Extend agent capabilities with custom tools and integrations.",
  },
  {
    title: "Apply-Patch",
    icon: "[%]",
    description: "Efficient code modifications using patch-based edits instead of full file rewrites.",
  },
];

export default function Features() {
  return (
    <section style={{ padding: "4rem 1rem" }}>
      <div className="container">
        <h2
          className="nes-text is-success"
          style={{ textAlign: "center", marginBottom: "3rem", fontSize: "clamp(1.2rem, 4vw, 2rem)" }}
        >
          Features
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "1.5rem",
          }}
        >
          {features.map((feature) => (
            <div key={feature.title} className="nes-container is-dark with-title">
              <p className="title" style={{ color: "#00ff41" }}>
                {feature.icon} {feature.title}
              </p>
              <p style={{ color: "#cccccc", fontSize: "0.9rem", lineHeight: "1.6" }}>
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
