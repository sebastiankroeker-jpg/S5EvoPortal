"use client";

import { Button } from "@/components/ui/button";

type Theme = "light" | "dark" | "psychedelic" | "sysadmin";

interface ThemeSwitcherProps {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export default function ThemeSwitcher({ theme, setTheme }: ThemeSwitcherProps) {
  const themes: { id: Theme; label: string; icon: string }[] = [
    { id: "light", label: "Light", icon: "☀️" },
    { id: "dark", label: "Dark", icon: "🌙" },
    { id: "psychedelic", label: "Psychedelic", icon: "🍄" },
    { id: "sysadmin", label: "Sys-Admin", icon: "🖥️" },
  ];

  return (
    <div className="flex gap-2 justify-center flex-wrap">
      {themes.map((t) => (
        <Button
          key={t.id}
          variant={theme === t.id ? "default" : "outline"}
          size="sm"
          onClick={() => setTheme(t.id)}
          className={theme === t.id ? "ring-2 ring-offset-2" : ""}
        >
          {t.icon} {t.label}
        </Button>
      ))}
    </div>
  );
}
