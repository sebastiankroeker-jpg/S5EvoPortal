"use client";

import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";

type Theme = "light" | "dark" | "psychedelic" | "sysadmin" | "esv";

interface ThemeSwitcherProps {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export default function ThemeSwitcher({ theme, setTheme }: ThemeSwitcherProps) {
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";

  // Base themes available to all users
  const baseThemes: { id: Theme; label: string; icon: string }[] = [
    { id: "light", label: "Light", icon: "☀️" },
    { id: "dark", label: "Dark", icon: "🌙" },
    { id: "esv", label: "ESV", icon: "🏔️" },
  ];

  // Advanced themes only for authenticated users
  const advancedThemes: { id: Theme; label: string; icon: string }[] = [
    { id: "psychedelic", label: "Psychedelic", icon: "🍄" },
    { id: "sysadmin", label: "Sys-Admin", icon: "🖥️" },
  ];

  const availableThemes = isAuthenticated 
    ? [...baseThemes, ...advancedThemes]
    : baseThemes;

  return (
    <div className="flex gap-2 justify-center flex-wrap">
      {availableThemes.map((t) => (
        <Button
          key={t.id}
          variant={theme === t.id ? "default" : "outline"}
          size="sm"
          onClick={() => setTheme(t.id)}
          className={`${theme === t.id ? "ring-2 ring-offset-2" : ""} ${
            theme === "esv" && t.id === theme ? "bg-[#dc2626] hover:bg-[#b91c1c] text-white border-[#dc2626]" : ""
          }`}
        >
          {t.icon} {t.label}
        </Button>
      ))}
    </div>
  );
}