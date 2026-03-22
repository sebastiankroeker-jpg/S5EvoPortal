// ThemeSwitcher.tsx – erweiterter Theme-Switcher mit ESV-Mode & Login-Check
import React, { useState } from "react";

interface ThemeSwitcherProps {
  isLoggedIn: boolean;
}

const themes = [
  { key: "light", label: "🌞 Standard" },
  { key: "dark", label: "🌙 Dark" },
  { key: "esv", label: "🏅 ESV-Mode" }
];

const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ isLoggedIn }) => {
  const [theme, setTheme] = useState<string>("light");

  const switchTheme = (key: string) => {
    setTheme(key);
    document.documentElement.setAttribute("data-theme", key);
  };

  return (
    <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
      {themes.map(({ key, label }) => (
        <button
          key={key}
          style={{
            padding: "0.5em 1em",
            borderRadius: "0.4em",
            border: theme === key ? "2px solid var(--color-primary)" : "1px solid #bbb",
            background: theme === key ? "var(--color-background)" : "#eee",
            fontWeight: theme === key ? 700 : 400,
            cursor: key === "esv" && !isLoggedIn ? "not-allowed" : "pointer",
            opacity: key === "esv" && !isLoggedIn ? 0.6 : 1
          }}
          onClick={() => key === "esv" && !isLoggedIn ? null : switchTheme(key)}
          disabled={key === "esv" && !isLoggedIn}
        >
          {label}
        </button>
      ))}
    </div>
  );
};

export default ThemeSwitcher;
