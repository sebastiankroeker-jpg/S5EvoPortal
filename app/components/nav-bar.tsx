"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { APP_VERSION } from "@/lib/version";
import { useTheme } from "@/lib/theme-context";

const THEMES = [
  { id: "light", icon: "☀️", label: "Light" },
  { id: "dark", icon: "🌙", label: "Dark" },
  { id: "esv", icon: "🏔️", label: "ESV" },
  { id: "bunt", icon: "🎨", label: "Bunt" },
  { id: "sysadmin", icon: "🖥️", label: "Sys-Admin" },
];

export default function NavBar() {
  const { data: session, status } = useSession();
  const { theme, setTheme } = useTheme();
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem("sidebar-collapsed");
      if (saved) setIsCollapsed(JSON.parse(saved));
    };
    handleStorageChange();
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("sidebar-toggle", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("sidebar-toggle", handleStorageChange);
    };
  }, []);

  return (
    <nav 
      className={`flex items-center justify-between px-4 py-1 border-b border-border/30 bg-card/80 backdrop-blur-sm sticky top-0 z-30 lg:transition-all lg:duration-200 ${
        isCollapsed ? "lg:ml-12" : "lg:ml-52"
      }`}
    >
      {/* Left: Logo + Version (mobile only, Desktop hat Sidebar) */}
      <div className="flex items-center gap-2 lg:hidden">
        <span className="text-lg">🏅</span>
        <span className="font-semibold text-sm">S5Evo</span>
        <Link href="/changelog">
          <Badge variant="secondary" className="text-[10px] hover:bg-primary/20 cursor-pointer">{APP_VERSION}</Badge>
        </Link>
      </div>

      {/* Center: Theme-Dots (Desktop) */}
      <div className="hidden lg:flex items-center gap-0.5">
        {THEMES.map((t) => (
          <button
            key={t.id}
            onClick={() => setTheme(t.id as any)}
            className={`w-6 h-6 rounded-full text-xs flex items-center justify-center transition-all hover:scale-110 ${
              theme === t.id ? "ring-1 ring-primary ring-offset-1 ring-offset-background scale-110" : "opacity-50 hover:opacity-100"
            }`}
            title={t.label}
          >
            {t.icon}
          </button>
        ))}
      </div>

      {/* Right: User + Abmelden */}
      {status === "authenticated" && session?.user && (
        <div className="flex items-center gap-2">
          <Link href="/profile" className="text-xs text-muted-foreground hover:text-foreground transition-colors hidden sm:inline">
            👤 {session.user.name}
          </Link>
          <Button variant="ghost" size="sm" onClick={() => signOut()} className="text-xs text-muted-foreground h-6 px-2">
            Abmelden
          </Button>
        </div>
      )}
    </nav>
  );
}
