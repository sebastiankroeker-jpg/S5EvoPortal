// ESVHero.tsx – Highlight-Komponente für ESV-Mode
import React from "react";

/**
 * Hero/Highlight-Sektion für den ESV-Mode
 * Nutzt die im globals.css definierten CSS-Variablen
 */
const ESVHero = () => (
  <section
    style={{
      minHeight: "24vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--color-hero-gradient)",
      color: "var(--color-text)",
      borderRadius: "1.2rem",
      margin: "2rem 0",
      boxShadow: "0 3px 16px #e3061348"
    }}
  >
    <div style={{ textAlign: "center" }}>
      <h1 style={{ fontSize: "2.5rem", fontWeight: 800, margin: 0, letterSpacing: "1px" }}>
        ESV Modern Sports Mode 🏅
      </h1>
      <p style={{ fontSize: "1.15rem", marginTop: "0.875em" }}>
        Spezieller Farbmodus und eigene Sektionen für den ESV Cup/Challenge!
      </p>
    </div>
  </section>
);

export default ESVHero;
