"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { usePrivacyConsent } from "@/lib/privacy-consent-context";

export type Theme = "light" | "dark" | "bunt" | "esv";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  sparkleEnabled: boolean;
  setSparkleEnabled: (enabled: boolean) => void;
  toggleSparkle: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

interface ThemeProviderProps {
  children: ReactNode;
}

const THEME_STORAGE_KEY = "s5evo-theme";
const THEME_EFFECTS_STORAGE_KEY = "s5evo-theme-effects";
const LEGACY_THEME_KEYS = ["theme", "app-theme", "color-theme"];

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark" || value === "bunt" || value === "esv";
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { hasConsent } = usePrivacyConsent();
  const functionalStorageAllowed = hasConsent("FUNCTIONAL_STORAGE");
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "light";
    const rawConsent = localStorage.getItem("s5evo-privacy-consent-v1");
    const consentAllowsFunctional = rawConsent?.includes("\"FUNCTIONAL_STORAGE\":true") ?? false;
    if (!consentAllowsFunctional) return "light";
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (isTheme(savedTheme)) return savedTheme;
    for (const key of LEGACY_THEME_KEYS) {
      const legacyTheme = localStorage.getItem(key);
      if (isTheme(legacyTheme)) return legacyTheme;
    }
    return "light";
  });
  const [sparkleByTheme, setSparkleByTheme] = useState<Partial<Record<Theme, boolean>>>(() => {
    if (typeof window === "undefined") return {};
    const rawConsent = localStorage.getItem("s5evo-privacy-consent-v1");
    const consentAllowsFunctional = rawConsent?.includes("\"FUNCTIONAL_STORAGE\":true") ?? false;
    if (!consentAllowsFunctional) return {};
    try {
      const parsed = JSON.parse(localStorage.getItem(THEME_EFFECTS_STORAGE_KEY) || "{}");
      return typeof parsed === "object" && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    // Theme speichern und auf DOM anwenden
    if (functionalStorageAllowed) {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
      for (const key of LEGACY_THEME_KEYS) {
        localStorage.setItem(key, theme);
      }
    }
    document.documentElement.setAttribute("data-theme", theme);
    
    // Set dark class for shadcn
    if (theme === "dark" || theme === "bunt") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [functionalStorageAllowed, theme]);

  useEffect(() => {
    if (!functionalStorageAllowed) return;
    localStorage.setItem(THEME_EFFECTS_STORAGE_KEY, JSON.stringify(sparkleByTheme));
  }, [functionalStorageAllowed, sparkleByTheme]);

  const sparkleEnabled = Boolean(sparkleByTheme[theme]);
  const setSparkleEnabled = (enabled: boolean) => {
    setSparkleByTheme((current) => ({ ...current, [theme]: enabled }));
  };

  const contextValue: ThemeContextType = {
    theme,
    setTheme,
    sparkleEnabled,
    setSparkleEnabled,
    toggleSparkle: () => setSparkleEnabled(!sparkleEnabled),
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
