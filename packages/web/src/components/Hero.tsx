export default function Hero() {
  return (
    <section
      style={{
        textAlign: "center",
        padding: "6rem 1rem 4rem",
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div className="nes-container is-dark" style={{ display: "inline-block", marginBottom: "2rem" }}>
        <h1
          style={{
            fontSize: "clamp(2rem, 8vw, 4rem)",
            color: "#00ff41",
            letterSpacing: "0.05em",
          }}
        >
          Neo Code<span className="cursor-blink">_</span>
        </h1>
      </div>
      <p
        style={{
          fontSize: "clamp(1rem, 3vw, 1.5rem)",
          color: "#cccccc",
          marginBottom: "2rem",
        }}
      >
        AI coding agent for your terminal
      </p>
      <a href="#install" className="nes-btn is-primary">
        Get Started
      </a>
    </section>
  );
}
