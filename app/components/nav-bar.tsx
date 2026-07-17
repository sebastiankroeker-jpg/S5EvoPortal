"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { fullSignOut } from "@/lib/auth-helpers";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { APP_VERSION } from "@/lib/version";
import { useTheme, type Theme } from "@/lib/theme-context";
import { usePermissions } from "@/lib/permissions-context";
import { getSimulatableRoles } from "@/lib/permissions";
import type { Role } from "@/lib/permissions";
import { Check, EllipsisVertical, FlaskConical, LogOut, MessageCircle, Search, Sparkles, UserCircle2 } from "lucide-react";
import SearchOverlay from "./search-overlay";
import { FIVE_KAMPF_BRAND } from "@/lib/brand-assets";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  MODERATOR: "Moderator:in",
  ZEITNAHME: "Zeitnahme",
  TEAMCHEF: "Teamchef:in",
  TEILNEHMER: "Teilnehmer:in",
  ZUSCHAUER: "Zuschauer:in",
};

export default function NavBar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const { theme, setTheme, sparkleEnabled, toggleSparkle } = useTheme();
  const { activeRole, roles, setSimulatedRole, isSimulating } = usePermissions();
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const THEMES: Array<{ id: Theme; icon: string; label: string }> = [
    { id: "light", icon: "☀️", label: "Light" },
    { id: "dark", icon: "🌙", label: "Dark" },
    { id: "esv", icon: "🏔️", label: "ESV" },
    { id: "bunt", icon: "🎨", label: "Bunt" },
  ];
  const activeTheme = THEMES.find((t) => t.id === theme) || THEMES[0];
  const realRole = roles.length > 0 ? roles[0] : "ZUSCHAUER";
  const simulatable = getSimulatableRoles(realRole as Role);
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

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    let cancelled = false;
    const loadUnreadMessages = async () => {
      try {
        const response = await fetch("/api/messages/unread-count");
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) setUnreadMessages(Number(data.unreadCount) || 0);
      } catch {}
    };

    void loadUnreadMessages();
    const interval = window.setInterval(loadUnreadMessages, 60_000);
    const handleFocus = () => void loadUnreadMessages();
    window.addEventListener("focus", handleFocus);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [status]);

  const renderUnreadBadge = () => unreadMessages > 0 ? (
    <span className="absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-4 text-white shadow-sm ring-2 ring-background">
      {unreadMessages > 99 ? "99+" : unreadMessages}
    </span>
  ) : null;

  return (
    <nav
      className={`flex items-center justify-between gap-2 px-3 py-1.5 border-b border-border/30 bg-card/85 backdrop-blur-sm sticky top-0 z-30 lg:transition-all lg:duration-200 ${
        showDesktopOffset ? (isCollapsed ? "lg:ml-12" : "lg:ml-52") : ""
      }`}
    >
      {/* Left: Logo + Theme + Version */}
      <div className="flex items-center gap-1.5 min-w-0">
        <Link href="/" className="relative block h-8 w-28 shrink-0 overflow-hidden rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 sm:w-36">
          <Image
            src={FIVE_KAMPF_BRAND.banner}
            alt="5Kampf Bad Bayersoien"
            fill
            sizes="(min-width: 640px) 144px, 112px"
            className="object-contain"
            priority
          />
        </Link>
        <div className="relative flex items-center">
          <button
            onClick={() => setShowThemeMenu(!showThemeMenu)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/60 bg-background/95 text-foreground transition-colors hover:bg-accent/60 md:hidden"
            aria-label="Theme-Menü öffnen"
            title="Theme-Menü öffnen"
          >
            <span className="text-[12px] leading-none">{activeTheme.icon}</span>
          </button>
          <label htmlFor="theme-dropdown" className="sr-only">Theme wählen</label>
          <select
            id="theme-dropdown"
            value={theme}
            onChange={(e) => setTheme(e.target.value as Theme)}
            className="hidden md:inline-flex h-7 min-w-[84px] rounded-full border border-border/60 bg-background/95 px-1 text-[11px] font-medium text-foreground outline-none transition-colors focus:border-primary/60 focus:ring-2 focus:ring-primary/30"
            aria-label="Theme auswählen"
            title="Theme auswählen"
          >
            {THEMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.icon} {t.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={toggleSparkle}
            className={`ml-1 hidden h-7 items-center gap-1 rounded-full border px-2 text-[11px] font-medium transition-colors md:inline-flex ${
              sparkleEnabled
                ? "border-amber-400 bg-amber-400/10 text-amber-700 dark:text-amber-200"
                : "border-border/50 text-muted-foreground hover:text-foreground"
            }`}
            aria-label={sparkleEnabled ? "Sparkle-Effekt deaktivieren" : "Sparkle-Effekt aktivieren"}
            title={sparkleEnabled ? "Sparkle-Effekt für dieses Theme deaktivieren" : "Sparkle-Effekt für dieses Theme aktivieren"}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Sparkle</span>
          </button>
          {showThemeMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowThemeMenu(false)} />
              <div className="absolute left-0 top-full mt-1 w-40 bg-popover border border-border/50 rounded-md shadow-lg py-1 z-50 md:hidden">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    className={`flex w-full items-center justify-between rounded-sm px-3 py-1.5 text-left text-xs transition-colors hover:bg-accent ${
                      theme === t.id
                        ? "bg-primary/15 text-primary font-medium"
                        : "text-muted-foreground"
                    }`}
                    onClick={() => {
                      setTheme(t.id);
                      setShowThemeMenu(false);
                    }}
                  >
                    <span>{t.icon} {t.label}</span>
                    {theme === t.id && <Check className="h-3.5 w-3.5" />}
                  </button>
                ))}
                <button
                  type="button"
                  className={`mt-1 flex w-full items-center justify-between border-t border-border/50 px-3 py-1.5 text-left text-xs transition-colors hover:bg-accent ${
                    sparkleEnabled ? "text-amber-700 dark:text-amber-200" : "text-muted-foreground"
                  }`}
                  onClick={() => {
                    toggleSparkle();
                    setShowThemeMenu(false);
                  }}
                >
                  <span className="inline-flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5" />
                    Sparkle
                  </span>
                  {sparkleEnabled && <Check className="h-3.5 w-3.5" />}
                </button>
              </div>
            </>
          )}
        </div>
        <Link
          href="/changelog"
          aria-label="Projektstand und Changelog öffnen"
          className="inline-flex shrink-0"
          title="Projektstand und Changelog öffnen"
        >
          <Badge variant="secondary" className="h-6 gap-1 px-1.5 text-[10px] hover:bg-primary/20 cursor-pointer whitespace-nowrap">
            <span className="hidden lg:inline">Projektstand</span>
            <span>{APP_VERSION}</span>
          </Badge>
        </Link>
      </div>

      {/* Right: Search + Role-Switcher + User + Abmelden */}
      <div className="flex items-center gap-1.5 min-w-0">
        {/* Search */}
        <button
          onClick={() => setSearchOpen(true)}
          className="inline-flex h-8 min-w-[42px] items-center justify-center rounded-full border-2 border-primary/70 bg-primary px-2 text-primary-foreground shadow-md transition-transform hover:scale-[1.03] hover:shadow-lg active:scale-[0.98] md:h-auto md:w-auto md:gap-2 md:px-3 md:py-1.5"
          title="Suchen (Strg+K)"
          aria-label="Suche öffnen"
        >
          <Search className="h-4 w-4" />
          <span className="hidden text-[12px] font-semibold tracking-wide md:inline">Suche</span>
          <span className="hidden md:inline rounded-full bg-primary-foreground/20 px-1.5 py-0.5 text-[10px] font-medium tracking-wide">Strg+K</span>
        </button>

        {status === "authenticated" && session?.user && (
          <>
            {/* Role-Switcher (nur wenn simulierbar) */}
            {simulatable.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowRoleMenu(!showRoleMenu)}
                  className={`hidden md:inline-flex h-7 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition-colors ${
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
                          className={`w-full rounded-sm px-3 py-1.5 text-left text-xs hover:bg-accent transition-colors ${
                            activeRole === role
                              ? "bg-primary/15 text-primary font-medium"
                              : "text-muted-foreground"
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
            )}
            <Link
              href="/profile"
              className="relative hidden h-7 items-center gap-1 rounded-full px-2 text-xs text-muted-foreground transition-colors hover:text-foreground md:inline-flex"
              title="Profil"
              aria-label="Profil öffnen"
            >
              <UserCircle2 className="h-4 w-4" />
              <span className="hidden md:inline truncate max-w-32">{session.user.name}</span>
              {renderUnreadBadge()}
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fullSignOut()}
              className="hidden md:inline-flex h-7 px-2 text-xs text-muted-foreground"
              title="Abmelden"
              aria-label="Abmelden"
            >
              <LogOut className="h-4 w-4 md:hidden" />
              <span className="hidden md:inline">Abmelden</span>
            </Button>

            <div className="relative md:hidden">
              <button
                onClick={() => setShowAccountMenu(!showAccountMenu)}
                className="relative inline-flex h-8 items-center gap-1 rounded-full border border-border/60 bg-background/95 px-2 text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
                aria-label="Konto-Menü öffnen"
                title="Konto-Menü öffnen"
              >
                <UserCircle2 className="h-4 w-4" />
                <EllipsisVertical className="h-4 w-4" />
                {renderUnreadBadge()}
              </button>
              {showAccountMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowAccountMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 w-44 bg-popover border border-border/50 rounded-md shadow-lg py-1 z-50">
                    <p className="px-3 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">Konto</p>
                    <Link
                      href="/profile"
                      className={`flex items-center gap-2 rounded-sm px-3 py-1.5 text-xs transition-colors ${
                        pathname === "/profile"
                          ? "bg-primary/15 text-primary font-medium"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      }`}
                      onClick={() => setShowAccountMenu(false)}
                    >
                      <UserCircle2 className="h-3.5 w-3.5" />
                      Profil
                    </Link>
                    <Link
                      href="/nachrichten"
                      className={`flex items-center gap-2 rounded-sm px-3 py-1.5 text-xs transition-colors ${
                        pathname === "/nachrichten"
                          ? "bg-primary/15 text-primary font-medium"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      }`}
                      onClick={() => setShowAccountMenu(false)}
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      <span className="flex-1">Nachrichten</span>
                      {unreadMessages > 0 && (
                        <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                          {unreadMessages > 99 ? "99+" : unreadMessages}
                        </span>
                      )}
                    </Link>
                    <div className="my-1 border-t border-border/40" />
                    {simulatable.length > 0 && (
                      <>
                        <p className="px-3 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">Rolle</p>
                        {isSimulating && (
                          <button
                            className="w-full px-3 py-1.5 text-left text-xs hover:bg-accent text-amber-600 dark:text-amber-300"
                            onClick={() => {
                              setSimulatedRole(null);
                              setShowAccountMenu(false);
                            }}
                          >
                            ✕ Reset ({ROLE_LABELS[realRole] || realRole})
                          </button>
                        )}
                        {simulatable.map((role) => (
                          <button
                            key={role}
                            className={`w-full rounded-sm px-3 py-1.5 text-left text-xs hover:bg-accent transition-colors ${
                              activeRole === role
                                ? "bg-primary/15 text-primary font-medium"
                                : "text-muted-foreground"
                            }`}
                            onClick={() => {
                              setSimulatedRole(role);
                              setShowAccountMenu(false);
                            }}
                          >
                            {ROLE_LABELS[role] || role}
                          </button>
                        ))}
                        <div className="my-1 border-t border-border/40" />
                      </>
                    )}
                    <button
                      className="flex w-full items-center gap-2 rounded-sm px-3 py-1.5 text-left text-xs text-red-500 transition-colors hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
                      onClick={() => {
                        setShowAccountMenu(false);
                        fullSignOut();
                      }}
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Abmelden
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Search Overlay */}
      <SearchOverlay isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </nav>
  );
}
