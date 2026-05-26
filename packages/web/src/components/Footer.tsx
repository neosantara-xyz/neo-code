export default function Footer() {
  return (
    <footer
      style={{
        borderTop: "4px solid #333333",
        padding: "2rem 1rem",
        textAlign: "center",
      }}
    >
      <div className="container">
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "2rem",
            marginBottom: "1rem",
            flexWrap: "wrap",
          }}
        >
          <a
            href="https://github.com/ErRickow/neo-code"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
          <a
            href="https://code.neosantara.xyz/docs"
            target="_blank"
            rel="noopener noreferrer"
          >
            Docs
          </a>
        </div>
        <p style={{ color: "#666666", fontSize: "0.8rem" }}>
          {new Date().getFullYear()} Neosantara. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
