"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Theme = "light" | "dark" | "bunt" | "esv";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

interface ThemeProviderProps {
  children: ReactNode;
}

const THEME_STORAGE_KEY = "s5evo-theme";
const LEGACY_THEME_KEYS = ["theme", "app-theme", "color-theme"];

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark" || value === "bunt" || value === "esv";
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "light";
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (isTheme(savedTheme)) return savedTheme;
    for (const key of LEGACY_THEME_KEYS) {
      const legacyTheme = localStorage.getItem(key);
      if (isTheme(legacyTheme)) return legacyTheme;
    }
    return "light";
  });

  useEffect(() => {
    // Theme speichern und auf DOM anwenden
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    for (const key of LEGACY_THEME_KEYS) {
      localStorage.setItem(key, theme);
    }
    document.documentElement.setAttribute("data-theme", theme);
    
    // Set dark class for shadcn
    if (theme === "dark" || theme === "bunt") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  const contextValue: ThemeContextType = {
    theme,
    setTheme,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
