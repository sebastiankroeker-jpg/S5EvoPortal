"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { usePermissions } from "@/lib/permissions-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, Search, ArrowLeft } from "lucide-react";

interface MenuItem {
  id: string;
  icon: string;
  label: string;
  action: () => void;
  permission?: string;
  requiresAuth?: boolean;
}

export default function CommandPill() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const { can } = usePermissions();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // Navigation actions
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const switchToTab = (tabId: string) => {
    // Für Hauptseite: trigger tab switch
    if (pathname === "/") {
      const event = new CustomEvent("switchTab", { detail: { tabId } });
      window.dispatchEvent(event);
    }
  };

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

  // Menu items
  const menuItems: MenuItem[] = [
    {
      id: "home",
      icon: "🏠",
      label: "Home",
      action: () => {
        if (pathname === "/") {
          scrollToTop();
        } else {
          router.push("/");
        }
      },
    },
    {
      id: "register",
      icon: "📋",
      label: "Anmeldung",
      action: () => {
        if (pathname === "/") {
          switchToTab("register");
        } else {
          router.push("/?tab=register");
        }
      },
      permission: "team.create",
      requiresAuth: true,
    },
    {
      id: "dashboard",
      icon: "📊",
      label: "Dashboard",
      action: () => {
        if (pathname === "/") {
          switchToTab("dashboard");
        } else {
          router.push("/?tab=dashboard");
        }
      },
      permission: "team.view.own",
      requiresAuth: true,
    },
    {
      id: "results",
      icon: "🏆",
      label: "Ergebnisse",
      action: () => {
        alert("Ergebnisse werden hier angezeigt sobald der Wettkampf läuft");
      },
      permission: "results.view",
      requiresAuth: true,
    },
    {
      id: "admin",
      icon: "⚙️",
      label: "Admin",
      action: () => router.push("/admin"),
      permission: "config.edit",
      requiresAuth: true,
    },
    {
      id: "search",
      icon: "🔍",
      label: "Suche",
      action: openSearch,
      requiresAuth: true,
    },
  ];

  // Add back button for non-home pages
  if (pathname !== "/") {
    menuItems.unshift({
      id: "back",
      icon: "←",
      label: "Zurück",
      action: () => router.push("/"),
    });
  }

  // Filter items based on permissions
  const visibleItems = menuItems.filter((item) => {
    if (item.requiresAuth && !session) return false;
    if (item.permission && !can(item.permission)) return false;
    return true;
  });

  if (visibleItems.length === 0) return null;

  return (
    <>
      {/* Command Pill */}
      <motion.div
        className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50"
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <div className="bg-card/90 backdrop-blur-md border border-border rounded-full px-4 py-2 shadow-lg">
          <div className="flex items-center gap-3">
            {visibleItems.map((item) => (
              <Button
                key={item.id}
                variant="ghost"
                size="sm"
                className="h-10 w-10 p-0 rounded-full hover:bg-primary/10 transition-all duration-200"
                onClick={item.action}
                title={item.label}
              >
                <span className="text-lg">{item.icon}</span>
              </Button>
            ))}
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
                            // Handle search result click
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
    </>
  );
}