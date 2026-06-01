"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { fullSignOut } from "@/lib/auth-helpers";
import { usePermissions } from "@/lib/permissions-context";
import { useNotifications } from "@/lib/notification-context";
import { useTheme, type Theme } from "@/lib/theme-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { X, Search, Menu } from "lucide-react";
import { getPermittedNavigationMenuItems, isClaimNavigationPath, type NavigationMenuItem } from "@/lib/navigation-menu";
import { navigateFromExternalBottomTab } from "@/lib/bottom-tab-navigation";
import { openTeamDashboard } from "@/lib/admin-routing";
import { useCompetition } from "@/lib/competition-context";
import { canRoleViewAllTeams } from "@/lib/team-access-config";

type SearchResult =
  | {
      type: "menu";
      id: string;
      label: string;
      icon: NavigationMenuItem["icon"];
    }
  | {
      type: "team";
      id: string;
      name?: string;
      label?: string;
      discipline?: string | null;
      participants?: unknown[];
      icon: string;
    };

type TeamsSearchResponse = {
  teams?: Array<{
    id: string;
    name?: string;
    label?: string;
    discipline?: string | null;
    participants?: unknown[];
  }>;
};

export default function CommandPill() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const { can, activeRole, roles, simulatedRole, setSimulatedRole, isSimulating } = usePermissions();
  const notifications = useNotifications();
  const { theme, setTheme } = useTheme();
  const { active: activeCompetition, loading: competitionLoading } = useCompetition();
  const activeCompetitionId = activeCompetition?.id ?? null;
  const canBrowseAllTeams = can("team.view.all") || canRoleViewAllTeams(activeRole, activeCompetition);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isBurgerOpen, setIsBurgerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const isClaimPath = isClaimNavigationPath(pathname);

  const permittedMenuItems = getPermittedNavigationMenuItems({
    authenticated: Boolean(session?.user),
    can,
    roles,
    pathname,
  });

  // Search implementation
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    const lowerQuery = query.toLowerCase();
    
    // Search menu items first
    const menuResults: SearchResult[] = permittedMenuItems
      .filter(item => {
        // Check if query matches label or keywords
        return item.label.toLowerCase().includes(lowerQuery) ||
               item.keywords.some(keyword => keyword.toLowerCase().includes(lowerQuery));
      })
      .map(item => ({
        type: 'menu' as const,
        id: item.id,
        label: item.label,
        icon: item.icon,
      }));

    // Search teams via API
    let teamResults: SearchResult[] = [];
    if (lowerQuery.trim().length >= 2 && !competitionLoading && activeCompetitionId) {
      try {
        const params = new URLSearchParams({
          q: query,
          competitionId: activeCompetitionId,
          roleContext: activeRole,
        });
        if (canBrowseAllTeams) params.set("scope", "all");
        const response = await fetch(`/api/teams?${params.toString()}`);
        if (response.ok) {
          const teamsData = (await response.json()) as TeamsSearchResponse;
          teamResults = (teamsData.teams ?? []).map((team) => ({
            type: 'team',
            ...team,
            icon: "🏅"
          }));
        }
      } catch (error) {
        console.error("Search error:", error);
      }
    }

    // Combine results: menu items first, then teams
    setSearchResults([...menuResults, ...teamResults]);
  }, [activeCompetitionId, activeRole, canBrowseAllTeams, competitionLoading, permittedMenuItems]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      performSearch(searchQuery);
    }, 300);
    return () => clearTimeout(debounce);
  }, [performSearch, searchQuery]);

  // Close overlays with ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsSearchOpen(false);
        setIsBurgerOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const openSearch = () => {
    setIsSearchOpen(true);
    setSearchQuery("");
    setSearchResults([]);
  };

  const closeSearch = () => {
    setIsSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  const openBurger = () => {
    setIsBurgerOpen(true);
  };

  const closeBurger = () => {
    setIsBurgerOpen(false);
  };

  const switchToTab = (tabId: string, detail?: Record<string, string>) => {
    if (pathname === "/") {
      const event = new CustomEvent("switchTab", { detail: { tabId, ...detail } });
      window.dispatchEvent(event);
    } else {
      navigateFromExternalBottomTab(router, tabId, detail);
    }
    closeBurger();
  };

  const handleMenuSelection = (item: NavigationMenuItem) => {
    switch (item.id) {
      case "home":
        switchToTab("home");
        break;
      case "registration":
        if (session?.user) {
          window.sessionStorage.setItem("s5evo-team-view", "register");
          switchToTab("registration", { teamView: "register" });
        } else {
          router.push("/anmeldung");
          closeBurger();
        }
        break;
      case "my-teams":
      case "all-teams":
        switchToTab("dashboard");
        break;
      case "orga":
        switchToTab("orga");
        break;
      case "participants":
        navigateAndClose("/teilnehmer");
        break;
      case "changes":
        navigateAndClose("/aenderungen");
        break;
      case "claim-links":
        navigateAndClose("/claim-links");
        break;
      case "admin-competition":
        navigateAndClose("/admin?tab=competition");
        break;
      case "admin-users":
        navigateAndClose("/admin?tab=users");
        break;
      case "admin-archive":
        navigateAndClose("/admin?tab=restore");
        break;
      case "live":
        switchToTab("live");
        break;
      case "profile":
        navigateAndClose("/profile");
        break;
      case "administration":
        navigateAndClose("/admin");
        break;
      case "architecture":
        window.open("/architecture", "_blank", "noopener,noreferrer");
        closeBurger();
        break;
      case "infrastructure":
        navigateAndClose("/tech");
        break;
      case "changelog":
        navigateAndClose("/changelog");
        break;
      case "sign-out":
        closeBurger();
        fullSignOut();
        break;
      default:
        break;
    }
  };

  const navigateAndClose = (path: string) => {
    router.push(path);
    closeBurger();
  };

  // Theme options
  const themes: Array<{ id: Theme; label: string; icon: string }> = [
    { id: "light", label: "Light", icon: "☀️" },
    { id: "dark", label: "Dark", icon: "🌙" },
    { id: "esv", label: "ESV", icon: "🏔️" },
    { id: "bunt", label: "Bunt", icon: "🎨" },
  ];

  return (
    <>
      {/* Command Pill - Hidden on mobile, visible on desktop */}
      <motion.div
        className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 hidden lg:block"
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <div className="bg-card/90 backdrop-blur-md border border-border/50 rounded-full px-6 py-3 shadow-lg max-w-[280px]">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-3 text-sm hover:bg-primary/10 transition-all duration-200"
              onClick={openSearch}
            >
              <Search className="h-4 w-4 mr-1.5" />
              Find...
            </Button>
            
            <Separator orientation="vertical" className="h-4" />
            
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-primary/10 transition-all duration-200"
              onClick={openBurger}
            >
              <Menu className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Search Overlay */}
      <AnimatePresence>
        {isSearchOpen && (
          <motion.div
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeSearch}
          >
            <motion.div
              className="fixed inset-x-4 top-20 mx-auto w-auto max-w-lg"
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -50, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex max-h-[min(75vh,40rem)] flex-col overflow-hidden rounded-md border border-border/50 bg-card p-4 shadow-xl">
                <div className="flex items-center gap-2 mb-4">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={isClaimPath ? "Navigation oder mein Team suchen..." : "Teams, Navigation oder Teilnehmer suchen..."}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1"
                    autoFocus
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={closeSearch}
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                
                {searchQuery && (
                  <div className="min-h-0 space-y-2 overflow-y-auto overscroll-contain pr-1">
                    {searchResults.length > 0 ? (
                      searchResults.map((result, index) => (
                        <div
                          key={`${result.type}-${result.id || index}`}
                        className="p-2 rounded-md hover:bg-accent cursor-pointer"
                        onClick={() => {
                          if (result.type === 'menu') {
                              const item = permittedMenuItems.find((candidate) => candidate.id === result.id);
                              if (item) {
                                handleMenuSelection(item);
                              }
                          }
                          if (result.type === "team" && result.id) {
                            openTeamDashboard({ teamId: result.id, search: result.name });
                          }
                          closeSearch();
                        }}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-base">{result.icon}</span>
                            <div className="flex-1">
                              <div className="font-medium">
                                {result.type === 'menu' ? result.label : result.name}
                              </div>
                              {result.type === 'team' && (
                                <div className="text-sm text-muted-foreground">
                                  {result.discipline} • {result.participants?.length || 0} Teilnehmer
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center text-muted-foreground py-4">
                        Keine Ergebnisse gefunden
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Burger Menu */}
      <AnimatePresence>
        {isBurgerOpen && (
          <motion.div
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeBurger}
          >
            <motion.div
              className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-md mx-4 mb-4"
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-card border border-border/50 rounded-md shadow-xl p-4 max-h-[80vh] overflow-y-auto thin-scrollbar">
                {session?.user && (
                  <>
                    {/* Navigation Section */}
                    <div>
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                        ── Navigation ──────────────
                      </div>
                      <div className="space-y-1">
                        {can("team.create") && (
                          <Button
                            variant="ghost"
                            className="w-full justify-start h-7 px-2 text-sm"
                            onClick={() => {
                              window.sessionStorage.setItem("s5evo-team-view", "register");
                              switchToTab("registration", { teamView: "register" });
                            }}
                          >
                            📋 Anmeldung
                          </Button>
                        )}
                        {(can("team.view.own") || can("team.view.all")) && (
                          <Button
                            variant="ghost"
                            className="w-full justify-start h-7 px-2 text-sm"
                            onClick={() => switchToTab("dashboard")}
                          >
                            📊 Meine Teams
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          className="w-full justify-start h-7 px-2 text-sm"
                          onClick={() => {
                            notifications.info("Ergebnisse", "Ergebnisse werden hier angezeigt, sobald der Wettkampf läuft.");
                            closeBurger();
                          }}
                        >
                          🏆 Ergebnisse
                        </Button>
                        <Button
                          variant="ghost"
                          className="w-full justify-start h-7 px-2 text-sm"
                          onClick={() => {
                            notifications.info("Ranglisten", "Ranglisten werden hier angezeigt, sobald der Wettkampf läuft.");
                            closeBurger();
                          }}
                        >
                          📈 Ranglisten
                        </Button>
                      </div>
                    </div>

                    {/* Admin Section */}
                    {(can("team.view.all") || can("results.edit") || can("config.edit")) && (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                          ──────────────────────────
                        </div>
                        <div className="space-y-1">
                          {can("team.view.all") && (
                            <Button
                              variant="ghost"
                              className="w-full justify-start h-7 px-2 text-sm"
                              onClick={() => switchToTab("dashboard")}
                            >
                              👥 Alle Teams
                            </Button>
                          )}
                          {can("results.edit") && (
                            <Button
                              variant="ghost"
                              className="w-full justify-start h-7 px-2 text-sm"
                              onClick={() => {
                                notifications.info("Ergebnis-Erfassung", "Die Ergebnis-Erfassung wird hier als Nächstes angebunden.");
                                closeBurger();
                              }}
                            >
                              ✏️ Ergebnis-Erfassung
                            </Button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Settings Section */}
                    <div>
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                        ── Einstellungen ───────────
                      </div>
                      <div className="space-y-1">
                        {can("config.edit") && (
                          <Button
                            variant="ghost"
                            className="w-full justify-start h-7 px-2 text-sm"
                            onClick={() => navigateAndClose("/admin")}
                          >
                            ⚙️ Administration
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          className="w-full justify-start h-7 px-2 text-sm"
                          onClick={() => {
                            window.open("/architecture", "_blank");
                            closeBurger();
                          }}
                        >
                          🔗 Architektur
                        </Button>
                        <Button
                          variant="ghost"
                          className="w-full justify-start h-7 px-2 text-sm"
                          onClick={() => navigateAndClose("/tech")}
                        >
                          🖥️ Infrastruktur
                        </Button>
                      </div>
                    </div>

                    {/* Role Simulation */}
                    {roles.includes("ADMIN") && (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                          🔬 Rolle simulieren
                        </div>
                        <div className="space-y-1">
                          {(["ZUSCHAUER", "TEAMCHEF", "ADMIN"] as const).map((role) => (
                            <Button
                              key={role}
                              variant={activeRole === role ? "default" : "ghost"}
                              size="sm"
                              className="w-full justify-start text-xs h-7"
                              onClick={() => {
                                setSimulatedRole(activeRole === role ? null : role);
                              }}
                            >
                              {role === "TEAMCHEF" ? "Teamchef:in" : role}
                              {isSimulating && simulatedRole === role && (
                                <Badge variant="secondary" className="ml-2 text-xs">
                                  Aktiv
                                </Badge>
                              )}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Theme Section */}
                    <div>
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                        ── Darstellung ─────────────
                      </div>
                      <div className="flex gap-1 justify-center">
                        {themes.map((t) => (
                          <Button
                            key={t.id}
                            variant={theme === t.id ? "default" : "ghost"}
                            size="sm"
                            className="h-8 w-8 p-0 text-base"
                            onClick={() => setTheme(t.id)}
                            title={t.label}
                          >
                            {t.icon}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Account Section */}
                    <div>
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                        ── Konto ───────────────────
                      </div>
                      <div className="space-y-1">
                        <Button
                          variant="ghost"
                          className="w-full justify-start h-7 px-2 text-sm"
                          onClick={() => navigateAndClose("/profile")}
                        >
                          👤 Profil
                        </Button>
                        <Button
                          variant="ghost"
                          className="w-full justify-start h-7 px-2 text-sm"
                          onClick={() => navigateAndClose("/changelog")}
                        >
                          📋 Changelog
                        </Button>
                        <Button
                          variant="ghost"
                          className="w-full justify-start h-7 px-2 text-sm"
                          onClick={() => {
                            fullSignOut();
                            closeBurger();
                          }}
                        >
                          🚪 Abmelden
                        </Button>
                      </div>
                    </div>
                  </>
                )}

                {/* Close Button */}
                <div className="pt-2 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={closeBurger}
                    className="w-full h-7 text-xs text-muted-foreground"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Schließen
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
