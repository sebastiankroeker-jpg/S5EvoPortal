"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { usePermissions } from "@/lib/permissions-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, Search } from "lucide-react";

interface SearchItem {
  type: "menu" | "team";
  label?: string;
  name?: string;
  keywords?: string[];
  action?: () => void;
  permission?: string;
  icon: string;
  discipline?: string;
  participants?: any[];
}

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SearchOverlay({ isOpen, onClose }: SearchOverlayProps) {
  const router = useRouter();
  const { can } = usePermissions();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchItem[]>([]);

  // Menu items for search
  const MENU_ITEMS = [
    { 
      label: "Home", 
      keywords: ["home", "start", "hauptseite"], 
      action: () => switchToTab("home"), 
      icon: "🏠"
    },
    { 
      label: "Anmeldung", 
      keywords: ["anmeldung", "registrierung", "team anmelden", "mannschaft"], 
      action: () => switchToTab("registration"), 
      permission: "team.create",
      icon: "📋"
    },
    { 
      label: "Meine Teams", 
      keywords: ["teams", "dashboard", "meine teams", "übersicht"], 
      action: () => switchToTab("registration"), 
      permission: "team.view.own",
      icon: "📋"
    },
    { 
      label: "Live", 
      keywords: ["live", "ergebnisse", "resultate", "punkte"], 
      action: () => switchToTab("live"), 
      icon: "🏆"
    },
    { 
      label: "Profil", 
      keywords: ["profil", "konto", "account", "benutzername"], 
      action: () => router.push("/profile"),
      icon: "👤"
    },
    { 
      label: "Alle Teams", 
      keywords: ["alle teams", "admin teams"], 
      action: () => switchToTab("dashboard"), 
      permission: "team.view.all",
      icon: "👥"
    },
    { 
      label: "Administration", 
      keywords: ["admin", "einstellungen", "konfiguration", "config"], 
      action: () => router.push("/admin"), 
      permission: "config.edit",
      icon: "🏢"
    },
    { 
      label: "Architektur", 
      keywords: ["architektur", "referenz", "technik"], 
      action: () => window.open("/architecture", "_blank"),
      icon: "🔗"
    },
    { 
      label: "Infrastruktur", 
      keywords: ["infrastruktur", "system", "sysadmin"], 
      action: () => router.push("/tech"),
      icon: "🖥️"
    },
    { 
      label: "Changelog", 
      keywords: ["changelog", "version", "historie", "änderungen"], 
      action: () => router.push("/changelog"),
      icon: "📋"
    },
  ];

  const switchToTab = (tabId: string) => {
    const event = new CustomEvent("switchTab", { detail: { tabId } });
    window.dispatchEvent(event);
  };

  // Get all permitted menu items
  const permittedMenuItems = MENU_ITEMS.filter(item => {
    if (item.permission && !can(item.permission as any)) return false;
    return true;
  });

  // Search implementation
  const performSearch = async (query: string) => {
    const lowerQuery = query.toLowerCase().trim();
    
    // Filter menu items (show all if no query)
    const menuResults = permittedMenuItems
      .filter(item => {
        if (!lowerQuery) return true; // show all when empty
        return item.label.toLowerCase().includes(lowerQuery) ||
               item.keywords.some(keyword => keyword.toLowerCase().includes(lowerQuery));
      })
      .map(item => ({ type: 'menu' as const, ...item }));

    // Search teams via API (only if query)
    let teamResults: SearchItem[] = [];
    if (lowerQuery.length >= 2) {
      try {
        const response = await fetch(`/api/teams?q=${encodeURIComponent(query)}`);
        if (response.ok) {
          const teams = await response.json();
          teamResults = teams.map((team: any) => ({
            type: 'team' as const,
            name: team.name,
            discipline: team.discipline,
            participants: team.participants || [],
            icon: "🏅",
            action: () => switchToTab("registration"),
          }));
        }
      } catch (error) {
        console.error("Search error:", error);
      }
    }

    setSearchResults([...menuResults, ...teamResults]);
  };

  // Initial load: show all menu items
  useEffect(() => {
    if (isOpen) performSearch("");
  }, [isOpen]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      performSearch(searchQuery);
    }, 200);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  // Close overlay with ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Reset search when closing
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setSearchResults([]);
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="fixed top-20 left-1/2 transform -translate-x-1/2 w-full max-w-lg mx-4"
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-card border border-border/50 rounded-md shadow-xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Teams, Navigation oder Teilnehmer suchen..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1"
                  autoFocus
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              {searchResults.length > 0 && (
                <div className="space-y-1 max-h-72 overflow-y-auto thin-scrollbar">
                  {searchResults.length > 0 ? (
                    searchResults.map((result, index) => (
                      <div
                        key={`${result.type}-${index}`}
                        className="p-2 rounded-md hover:bg-accent cursor-pointer"
                        onClick={() => {
                          if (result.action) {
                            result.action();
                          }
                          onClose();
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
  );
}