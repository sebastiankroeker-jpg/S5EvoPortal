"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { fullSignOut } from "@/lib/auth-helpers";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { APP_VERSION } from "@/lib/version";
import { useTheme, type Theme } from "@/lib/theme-context";
import { usePermissions } from "@/lib/permissions-context";
import { getSimulatableRoles } from "@/lib/permissions";
import type { Role } from "@/lib/permissions";
import { FlaskConical, LogOut, Search, UserCircle2 } from "lucide-react";
import SearchOverlay from "./search-overlay";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  MODERATOR: "Moderator:in",
  TEAMCHEF: "Teamchef:in",
  TEILNEHMER: "Teilnehmer:in",
  ZUSCHAUER: "Zuschauer:in",
};

export default function NavBar() {
  const { data: session, status } = useSession();
  const { theme, setTheme } = useTheme();
  const { activeRole, roles, setSimulatedRole, isSimulating } = usePermissions();
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const THEMES: Array<{ id: Theme; icon: string; label: string }> = [
    { id: "light", icon: "☀️", label: "Light" },
    { id: "dark", icon: "🌙", label: "Dark" },
    { id: "esv", icon: "🏔️", label: "ESV" },
    { id: "bunt", icon: "🎨", label: "Bunt" },
  ];
  const [isCollapsed, setIsCollapsed] = useState(false);
  const showDesktopOffset = status === "authenticated";

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
      className={`flex items-center justify-between gap-2 px-3 py-1.5 border-b border-border/30 bg-card/85 backdrop-blur-sm sticky top-0 z-30 lg:transition-all lg:duration-200 ${
        showDesktopOffset ? (isCollapsed ? "lg:ml-12" : "lg:ml-52") : ""
      }`}
    >
      {/* Left: Logo + Version */}
      <div className="flex items-center gap-1.5 min-w-0">
        <Link href="/" className="flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60">
          <span className="text-lg">🏅</span>
          <span className="font-semibold text-sm">S5Evo</span>
        </Link>
        <Link href="/changelog" aria-label="Projektstand und Changelog öffnen" className="hidden sm:inline-flex">
          <Badge variant="secondary" className="gap-1 text-[10px] hover:bg-primary/20 cursor-pointer whitespace-nowrap">
            <span className="hidden sm:inline">Projektstand</span>
            <span>{APP_VERSION}</span>
          </Badge>
        </Link>
      </div>

      {/* Center: Theme-Switcher + Dropdown */}
      <div className="flex items-center gap-1 rounded-full border border-primary/30 bg-card/90 p-0.5 shadow-sm">
        <div className="hidden md:flex items-center gap-px">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={`inline-flex h-7 items-center justify-center gap-0.5 rounded-full px-1 text-[10px] leading-none transition-all ${
                theme === t.id
                  ? "bg-primary text-primary-foreground ring-1 ring-primary/60 scale-[1.02] shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/80"
              }`}
              title={t.label}
              aria-label={`Theme ${t.label}`}
              aria-pressed={theme === t.id}
            >
              <span className="text-[12px] leading-none">{t.icon}</span>
              <span className="hidden md:inline whitespace-nowrap font-medium leading-none">{t.label}</span>
            </button>
          ))}
        </div>
        <label htmlFor="theme-dropdown" className="sr-only">Theme wählen</label>
        <select
          id="theme-dropdown"
          value={theme}
          onChange={(e) => setTheme(e.target.value as Theme)}
          className="h-7 min-w-[92px] rounded-full border border-border/60 bg-background/95 px-1.5 text-[11px] font-medium text-foreground outline-none transition-colors focus:border-primary/60 focus:ring-2 focus:ring-primary/30"
          aria-label="Theme auswählen"
          title="Theme auswählen"
        >
          {THEMES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.icon} {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Right: Search + Role-Switcher + User + Abmelden */}
      <div className="flex items-center gap-1.5 min-w-0">
        {/* Search */}
        <button
          onClick={() => setSearchOpen(true)}
          className="inline-flex items-center gap-2 rounded-full border-2 border-primary/50 bg-primary px-3 py-1.5 text-primary-foreground shadow-md transition-transform hover:scale-[1.03] hover:shadow-lg active:scale-[0.98]"
          title="Suchen (Strg+K)"
          aria-label="Suche öffnen"
        >
          <Search className="h-4 w-4" />
          <span className="text-[12px] font-semibold tracking-wide">Suche</span>
          <span className="hidden md:inline rounded-full bg-primary-foreground/20 px-1.5 py-0.5 text-[10px] font-medium tracking-wide">Strg+K</span>
        </button>

        {status === "authenticated" && session?.user && (
          <>
            {/* Role-Switcher (nur wenn simulierbar) */}
            {(() => {
            const realRole = roles.length > 0 ? roles[0] : "ZUSCHAUER";
            const simulatable = getSimulatableRoles(realRole as Role);
            if (simulatable.length === 0) return null;
            return (
              <div className="relative">
                <button
                  onClick={() => setShowRoleMenu(!showRoleMenu)}
                  className={`inline-flex h-7 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition-colors ${
                    isSimulating
                      ? "border-amber-400 bg-amber-400/10 text-amber-600 dark:text-amber-300"
                      : "border-border/50 text-muted-foreground hover:text-foreground"
                  }`}
                  aria-label="Rollenansicht wechseln"
                  title="Rollenansicht wechseln"
                >
                  <FlaskConical className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">{ROLE_LABELS[activeRole] || activeRole}</span>
                </button>
                {showRoleMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowRoleMenu(false)} />
                    <div className="absolute right-0 top-full mt-1 w-40 bg-popover border border-border/50 rounded-md shadow-lg py-1 z-50">
                      {isSimulating && (
                        <button
                          className="w-full px-3 py-1.5 text-left text-xs hover:bg-accent text-amber-600 dark:text-amber-300"
                          onClick={() => { setSimulatedRole(null); setShowRoleMenu(false); }}
                        >
                          ✕ Reset ({ROLE_LABELS[realRole] || realRole})
                        </button>
                      )}
                      {simulatable.map((role) => (
                        <button
                          key={role}
                          className={`w-full px-3 py-1.5 text-left text-xs hover:bg-accent transition-colors ${
                            activeRole === role ? "text-primary font-medium" : "text-muted-foreground"
                          }`}
                          onClick={() => { setSimulatedRole(role); setShowRoleMenu(false); }}
                        >
                          {ROLE_LABELS[role] || role}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })()}
            <Link
              href="/profile"
              className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
              title="Profil"
              aria-label="Profil öffnen"
            >
              <UserCircle2 className="h-4 w-4" />
              <span className="hidden md:inline truncate max-w-32">{session.user.name}</span>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fullSignOut()}
              className="h-7 px-2 text-xs text-muted-foreground"
              title="Abmelden"
              aria-label="Abmelden"
            >
              <LogOut className="h-4 w-4 md:hidden" />
              <span className="hidden md:inline">Abmelden</span>
            </Button>
          </>
        )}
      </div>

      {/* Search Overlay */}
      <SearchOverlay isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </nav>
  );
}
