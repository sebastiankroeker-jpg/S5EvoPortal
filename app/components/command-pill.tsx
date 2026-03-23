"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { usePermissions } from "@/lib/permissions-context";
import { useTheme } from "@/lib/theme-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { X, Search, Menu, ExternalLink } from "lucide-react";

export default function CommandPill() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const { can, activeRole, roles, simulatedRole, setSimulatedRole, isSimulating } = usePermissions();
  const { theme, setTheme } = useTheme();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isBurgerOpen, setIsBurgerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // Search implementation
  const performSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await fetch(`/api/teams?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const results = await response.json();
        setSearchResults(results);
      }
    } catch (error) {
      console.error("Search error:", error);
      setSearchResults([]);
    }
  };

  useEffect(() => {
    const debounce = setTimeout(() => {
      performSearch(searchQuery);
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

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

  const switchToTab = (tabId: string) => {
    if (pathname === "/") {
      const event = new CustomEvent("switchTab", { detail: { tabId } });
      window.dispatchEvent(event);
    }
    closeBurger();
  };

  const navigateAndClose = (path: string) => {
    router.push(path);
    closeBurger();
  };

  // Theme options
  const themes = [
    { id: "light", label: "Light", icon: "☀️" },
    { id: "dark", label: "Dark", icon: "🌙" },
    { id: "esv", label: "ESV", icon: "🏔️" },
    { id: "bunt", label: "Bunt", icon: "🎨" },
    { id: "sysadmin", label: "Sys-Admin", icon: "🖥️" },
  ];

  return (
    <>
      {/* Command Pill */}
      <motion.div
        className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50"
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <div className="bg-card/90 backdrop-blur-md border border-border rounded-full px-6 py-3 shadow-lg max-w-[280px]">
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
              className="fixed top-20 left-1/2 transform -translate-x-1/2 w-full max-w-lg mx-4"
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -50, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-card border border-border rounded-lg shadow-xl p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Teams oder Teilnehmer suchen..."
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
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {searchResults.length > 0 ? (
                      searchResults.map((result: any) => (
                        <div
                          key={result.id}
                          className="p-2 rounded-md hover:bg-accent cursor-pointer"
                          onClick={() => {
                            closeSearch();
                          }}
                        >
                          <div className="font-medium">{result.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {result.discipline} • {result.participants?.length || 0} Teilnehmer
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
              <div className="bg-card border border-border rounded-lg shadow-xl p-6 space-y-6">
                {session?.user && (
                  <>
                    {/* Navigation Section */}
                    <div>
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                        ── Navigation ──────────────
                      </div>
                      <div className="space-y-2">
                        {can("team.create") && (
                          <Button
                            variant="ghost"
                            className="w-full justify-start h-9 px-2 text-sm"
                            onClick={() => switchToTab("register")}
                          >
                            📋 Anmeldung
                          </Button>
                        )}
                        {(can("team.view.own") || can("team.view.all")) && (
                          <Button
                            variant="ghost"
                            className="w-full justify-start h-9 px-2 text-sm"
                            onClick={() => switchToTab("dashboard")}
                          >
                            📊 Meine Teams
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          className="w-full justify-start h-9 px-2 text-sm"
                          onClick={() => {
                            alert("Ergebnisse werden hier angezeigt sobald der Wettkampf läuft");
                            closeBurger();
                          }}
                        >
                          🏆 Ergebnisse
                        </Button>
                        <Button
                          variant="ghost"
                          className="w-full justify-start h-9 px-2 text-sm"
                          onClick={() => {
                            alert("Ranglisten werden hier angezeigt sobald der Wettkampf läuft");
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
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                          ──────────────────────────
                        </div>
                        <div className="space-y-2">
                          {can("team.view.all") && (
                            <Button
                              variant="ghost"
                              className="w-full justify-start h-9 px-2 text-sm"
                              onClick={() => switchToTab("dashboard")}
                            >
                              👥 Alle Teams
                            </Button>
                          )}
                          {can("results.edit") && (
                            <Button
                              variant="ghost"
                              className="w-full justify-start h-9 px-2 text-sm"
                              onClick={() => {
                                alert("Ergebnis-Erfassung wird hier implementiert");
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
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                        ── Einstellungen ───────────
                      </div>
                      <div className="space-y-2">
                        {can("config.edit") && (
                          <Button
                            variant="ghost"
                            className="w-full justify-start h-9 px-2 text-sm"
                            onClick={() => navigateAndClose("/admin")}
                          >
                            ⚙️ Administration
                          </Button>
                        )}
                        {can("team.view.all") && (
                          <Button
                            variant="ghost"
                            className="w-full justify-start h-9 px-2 text-sm"
                            onClick={() => {
                              window.open("/architecture", "_blank");
                              closeBurger();
                            }}
                          >
                            🔗 Referenzarchitektur
                            <ExternalLink className="h-3 w-3 ml-1" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Role Simulation */}
                    {roles.includes("ADMIN") && (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
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
                              {role}
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
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                        ── Darstellung ─────────────
                      </div>
                      <div className="flex gap-1 justify-center">
                        {themes.map((t) => (
                          <Button
                            key={t.id}
                            variant={theme === t.id ? "default" : "ghost"}
                            size="sm"
                            className="h-8 w-8 p-0 text-base"
                            onClick={() => setTheme(t.id as any)}
                            title={t.label}
                          >
                            {t.icon}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Account Section */}
                    <div>
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                        ── Konto ───────────────────
                      </div>
                      <div className="space-y-2">
                        <Button
                          variant="ghost"
                          className="w-full justify-start h-9 px-2 text-sm"
                          onClick={() => navigateAndClose("/profile")}
                        >
                          👤 Profil
                        </Button>
                        <Button
                          variant="ghost"
                          className="w-full justify-start h-9 px-2 text-sm"
                          onClick={() => navigateAndClose("/changelog")}
                        >
                          📋 Changelog
                        </Button>
                        <Button
                          variant="ghost"
                          className="w-full justify-start h-9 px-2 text-sm"
                          onClick={() => {
                            signOut();
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
                    className="w-full h-8 text-xs text-muted-foreground"
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