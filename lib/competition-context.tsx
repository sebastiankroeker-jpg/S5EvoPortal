"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { usePrivacyConsent } from "@/lib/privacy-consent-context";

type CompetitionInfo = {
  id: string;
  name: string;
  year: number;
  status: string;
  teamCount: number;
  teamOwnerFilterVisibleForTeamchef: boolean;
  participantsCanViewAllTeams: boolean;
  spectatorsCanViewAllTeams: boolean;
  hideForeignTeams: boolean;
  marketplaceGlobalVisibility: "SELECTIVE" | "OFFLINE";
};

type CompetitionContextType = {
  /** Currently active competition */
  active: CompetitionInfo | null;
  /** All available competitions */
  all: CompetitionInfo[];
  /** Switch to a different competition (admin only) */
  switchTo: (id: string) => void;
  /** Loading state */
  loading: boolean;
};

type AdminCompetitionResponseItem = {
  id: string;
  name: string;
  year: number;
  status: string;
  _count?: { teams?: number };
  teamOwnerFilterVisibleForTeamchef?: boolean;
  participantsCanViewAllTeams?: boolean;
  spectatorsCanViewAllTeams?: boolean;
  hideForeignTeams?: boolean;
  marketplaceGlobalVisibility?: "SELECTIVE" | "OFFLINE";
};

const CompetitionContext = createContext<CompetitionContextType>({
  active: null,
  all: [],
  switchTo: () => {},
  loading: true,
});

export function useCompetition() {
  return useContext(CompetitionContext);
}

const STORAGE_KEY = "s5evo-active-competition";

export function CompetitionProvider({ children }: { children: ReactNode }) {
  const { hasConsent } = usePrivacyConsent();
  const functionalStorageAllowed = hasConsent("FUNCTIONAL_STORAGE");
  const [all, setAll] = useState<CompetitionInfo[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load competitions on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/competitions", { cache: "no-store" });
        if (!res.ok) {
          const publicRes = await fetch("/api/competition", { cache: "no-store" });
          if (!publicRes.ok) {
            setLoading(false);
            return;
          }

          const data = await publicRes.json();
          const competition = data.competition;
          const comps: CompetitionInfo[] = competition
            ? [{
                id: competition.id,
                name: competition.name,
                year: competition.year,
                status: competition.status,
                teamCount: competition.teamCount ?? 0,
                teamOwnerFilterVisibleForTeamchef: competition.teamOwnerFilterVisibleForTeamchef ?? false,
                participantsCanViewAllTeams: competition.participantsCanViewAllTeams ?? false,
                spectatorsCanViewAllTeams: competition.spectatorsCanViewAllTeams ?? false,
                hideForeignTeams: competition.hideForeignTeams ?? false,
                marketplaceGlobalVisibility: competition.marketplaceGlobalVisibility ?? "SELECTIVE",
              }]
            : [];

          setAll(comps);
          setActiveId(comps[0]?.id ?? null);
          setLoading(false);
          return;
        }
        const data = await res.json();
        const comps: CompetitionInfo[] = ((data.competitions || []) as AdminCompetitionResponseItem[]).map((c) => ({
          id: c.id,
          name: c.name,
          year: c.year,
          status: c.status,
          teamCount: c._count?.teams ?? 0,
          teamOwnerFilterVisibleForTeamchef: c.teamOwnerFilterVisibleForTeamchef ?? false,
          participantsCanViewAllTeams: c.participantsCanViewAllTeams ?? false,
          spectatorsCanViewAllTeams: c.spectatorsCanViewAllTeams ?? false,
          hideForeignTeams: c.hideForeignTeams ?? false,
          marketplaceGlobalVisibility: c.marketplaceGlobalVisibility ?? "SELECTIVE",
        }));
        setAll(comps);

        // Restore from localStorage, or default to first OPEN competition
        const stored = typeof window !== "undefined" && functionalStorageAllowed ? localStorage.getItem(STORAGE_KEY) : null;
        const storedValid = stored && comps.some((c) => c.id === stored);
        
        if (storedValid) {
          setActiveId(stored);
        } else {
          // Default: first OPEN, or latest by year
          const open = comps.find((c) => c.status === "OPEN");
          const fallback = comps[0]; // sorted by year desc from API
          setActiveId(open?.id ?? fallback?.id ?? null);
        }
      } catch (err) {
        console.error("Failed to load competitions:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [functionalStorageAllowed]);

  const switchTo = useCallback(
    (id: string) => {
      setActiveId(id);
      if (typeof window !== "undefined" && functionalStorageAllowed) {
        localStorage.setItem(STORAGE_KEY, id);
      }
    },
    [functionalStorageAllowed]
  );

  const active = all.find((c) => c.id === activeId) ?? null;

  return (
    <CompetitionContext.Provider value={{ active, all, switchTo, loading }}>
      {children}
    </CompetitionContext.Provider>
  );
}
