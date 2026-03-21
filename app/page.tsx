"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useState, useEffect } from "react";

type Theme = "light" | "dark" | "psychedelic";

export default function Home() {
  const { data: session, status } = useSession();
  const [theme, setTheme] = useState<Theme>("light");
  const [teamName, setTeamName] = useState("");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <div className="container">
      <div className="theme-switcher">
        <button
          className={`theme-btn ${theme === "light" ? "active" : ""}`}
          onClick={() => setTheme("light")}
        >
          ☀️ Light
        </button>
        <button
          className={`theme-btn ${theme === "dark" ? "active" : ""}`}
          onClick={() => setTheme("dark")}
        >
          🌙 Dark
        </button>
        <button
          className={`theme-btn ${theme === "psychedelic" ? "active" : ""}`}
          onClick={() => setTheme("psychedelic")}
        >
          🍄 Psychedelic
        </button>
      </div>

      <h1>🏅 S5Evo Portal</h1>
      <p className="subtitle">Mannschaftsfünfkampf – Anmeldung</p>

      {status === "loading" && (
        <div className="card">
          <p>Lade...</p>
        </div>
      )}

      {status === "unauthenticated" && (
        <div className="card">
          <h2>Willkommen!</h2>
          <p style={{ margin: "1rem 0" }}>
            Bitte melde dich an, um deine Mannschaft zu registrieren.
          </p>
          <button className="btn btn-primary" onClick={() => signIn("authentik")}>
            🔐 Mit Authentik anmelden
          </button>
        </div>
      )}

      {status === "authenticated" && session?.user && (
        <>
          <div className="card">
            <div className="user-info">
              {session.user.image && (
                <img src={session.user.image} alt="Avatar" />
              )}
              <div>
                <strong>{session.user.name}</strong>
                <br />
                <small>{session.user.email}</small>
              </div>
            </div>
            <button className="btn btn-danger" onClick={() => signOut()}>
              Abmelden
            </button>
          </div>

          <div className="card">
            <h2>Mannschaft anmelden</h2>
            <div className="field">
              <label>Teamchef (aus Authentik)</label>
              <span>{session.user.name}</span>
            </div>
            <div className="field">
              <label>E-Mail (aus Authentik)</label>
              <span>{session.user.email}</span>
            </div>
            <div className="field">
              <label htmlFor="teamName">Mannschaftsname</label>
              <input
                id="teamName"
                type="text"
                placeholder="z.B. Die Bergziegen"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="category">Kategorie</label>
              <select id="category">
                <option value="">Bitte wählen...</option>
                <option value="herren">Herren</option>
                <option value="damen">Damen</option>
                <option value="mixed">Mixed</option>
                <option value="senioren">Senioren</option>
                <option value="jugend">Jugend</option>
              </select>
            </div>
            <div className="actions">
              <button
                className="btn btn-primary"
                onClick={() => alert(`Mannschaft "${teamName}" angemeldet! 🎉`)}
                disabled={!teamName}
              >
                Mannschaft anmelden
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
