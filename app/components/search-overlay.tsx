"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { usePermissions } from "@/lib/permissions-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, Search } from "lucide-react";
import { getPermittedNavigationMenuItems, isClaimNavigationPath, type NavigationMenuItem } from "@/lib/navigation-menu";
import { navigateFromExternalBottomTab } from "@/lib/bottom-tab-navigation";
import { openTeamDashboard } from "@/lib/admin-routing";
import { useCompetition } from "@/lib/competition-context";
import { canRoleViewAllTeams } from "@/lib/team-access-config";
import { buildSearchResults, groupSearchResults, type SearchResult } from "@/lib/search-results";

interface SearchTeamResult {
  id?: string;
  name: string;
  discipline?: string | null;
  participants?: Array<{ id?: string; firstName?: string; lastName?: string; email?: string | null }>;
}

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SearchOverlay({ isOpen, onClose }: SearchOverlayProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { status } = useSession();
  const { can, roles, activeRole } = usePermissions();
  const { active: activeCompetition, loading: competitionLoading } = useCompetition();
  const activeCompetitionId = activeCompetition?.id ?? null;
  const canBrowseAllTeams = can("team.view.all") || canRoleViewAllTeams(activeRole, activeCompetition);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const isClaimPath = isClaimNavigationPath(pathname);

  const switchToTab = (tabId: string, detail?: Record<string, string>) => {
    if (pathname !== "/") {
      navigateFromExternalBottomTab(router, tabId, detail);
      return;
    }
    const event = new CustomEvent("switchTab", { detail: { tabId, ...detail } });
    window.dispatchEvent(event);
  };

  const permittedMenuItems = getPermittedNavigationMenuItems({
    authenticated: status === "authenticated",
    can,
    roles,
    pathname,
  });

  const handleMenuSelection = (item: NavigationMenuItem) => {
    switch (item.id) {
      case "home":
        switchToTab("home");
        break;
      case "registration":
        if (status === "authenticated") {
          window.sessionStorage.setItem("s5evo-team-view", "register");
          switchToTab("registration", { teamView: "register" });
        } else {
          router.push("/anmeldung");
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
        router.push("/teilnehmer");
        break;
      case "changes":
        router.push("/aenderungen");
        break;
      case "claim-links":
        router.push("/claim-links");
        break;
      case "admin-competition":
        router.push("/admin?tab=competition");
        break;
      case "admin-users":
        router.push("/admin?tab=users");
        break;
      case "admin-archive":
        router.push("/admin?tab=restore");
        break;
      case "live":
        switchToTab("live");
        break;
      case "profile":
        router.push("/profile");
        break;
      case "administration":
        router.push("/admin");
        break;
      case "architecture":
        window.open("/architecture", "_blank", "noopener,noreferrer");
        break;
      case "infrastructure":
        router.push("/tech");
        break;
      case "changelog":
        router.push("/changelog");
        break;
      case "sign-out":
        router.push("/logout");
        break;
      default:
        break;
    }
  };

  const handleClose = () => {
    setSearchQuery("");
    setSearchResults([]);
    onClose();
  };

  // Search implementation
  const performSearch = useCallback(async (query: string) => {
    const lowerQuery = query.toLowerCase().trim();
    let teams: SearchTeamResult[] = [];

    if (lowerQuery.length >= 2 && !competitionLoading && activeCompetitionId) {
      try {
        const params = new URLSearchParams({
          q: query,
          competitionId: activeCompetitionId,
          roleContext: activeRole,
        });
        if (canBrowseAllTeams) params.set("scope", "all");
        const response = await fetch(`/api/teams?${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          teams = Array.isArray(data) ? data : data.teams || [];
        }
      } catch (error) {
        console.error("Search error:", error);
      }
    }

    setSearchResults(buildSearchResults({
      query,
      permittedMenuItems,
      teams,
    }));
  }, [activeCompetitionId, activeRole, canBrowseAllTeams, competitionLoading, permittedMenuItems]);

  useEffect(() => {
    if (!isOpen) return;

    const debounce = setTimeout(() => {
      void performSearch(searchQuery);
    }, searchQuery ? 200 : 0);

    return () => clearTimeout(debounce);
  }, [isOpen, pathname, performSearch, searchQuery, roles, status]);

  // Close overlay with ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setSearchQuery("");
        setSearchResults([]);
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const resultSections = groupSearchResults(searchResults);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
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
                  onClick={handleClose}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              {(searchResults.length > 0 || searchQuery.trim().length >= 2) && (
                <div className="min-h-0 space-y-1 overflow-y-auto overscroll-contain pr-1">
                  {searchResults.length > 0 ? (
                    resultSections.map((section) => (
                      <div key={section.key} className="space-y-1 pb-2 last:pb-0">
                        <div className="px-2 pt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {section.label}
                        </div>
                        {section.results.map((result) => (
                          <div
                            key={`${result.type}-${result.id}`}
                            className="rounded-md p-2 hover:bg-accent cursor-pointer"
                            onClick={() => {
                              if (result.type === "menu") {
                                const item = permittedMenuItems.find((candidate) => candidate.id === result.id);
                                if (item) {
                                  handleMenuSelection(item);
                                }
                              }
                              if (result.type === "team") {
                                openTeamDashboard({ teamId: result.id, search: result.name });
                              }
                              if (result.type === "participant") {
                                openTeamDashboard({ teamId: result.teamId, search: result.name });
                              }
                              handleClose();
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-base">{result.icon}</span>
                              <div className="flex-1">
                                <div className="font-medium">
                                  {result.type === "menu" ? result.label : result.name}
                                </div>
                                {result.type === "team" && (
                                  <div className="text-sm text-muted-foreground">
                                    {(result.discipline || "Offen") + " • " + (result.participants?.length || 0) + " Teilnehmer"}
                                  </div>
                                )}
                                {result.type === "participant" && (
                                  <div className="text-sm text-muted-foreground">
                                    {result.teamName}
                                    {result.discipline ? ` • ${result.discipline}` : ""}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-muted-foreground py-4">
                      Keine Treffer fuer Team, Teilnehmer oder Navigation
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
