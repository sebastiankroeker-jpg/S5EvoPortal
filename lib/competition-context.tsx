"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { usePrivacyConsent } from "@/lib/privacy-consent-context";
import { readOfflineCache, writeOfflineCache } from "@/lib/pwa-offline-cache";

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
  liveTeamsVisibility: "ADMINS" | "PORTAL_USERS" | "SPECTATORS";
  liveStartlistsVisibility: "ADMINS" | "PORTAL_USERS" | "SPECTATORS";
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
  liveTeamsVisibility?: "ADMINS" | "PORTAL_USERS" | "SPECTATORS";
  liveStartlistsVisibility?: "ADMINS" | "PORTAL_USERS" | "SPECTATORS";
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
const COMPETITIONS_CACHE_KEY = "s5evo.offline.competitions.v1";

export function CompetitionProvider({ children }: { children: ReactNode }) {
  const { hasConsent } = usePrivacyConsent();
  const functionalStorageAllowed = hasConsent("FUNCTIONAL_STORAGE");
  const [all, setAll] = useState<CompetitionInfo[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load competitions on mount
  useEffect(() => {
    (async () => {
      const applyCompetitions = (comps: CompetitionInfo[], preferredActiveId?: string | null) => {
        setAll(comps);

        const stored = typeof window !== "undefined" && functionalStorageAllowed ? localStorage.getItem(STORAGE_KEY) : null;
        const candidateId = preferredActiveId ?? stored;
        const storedValid = candidateId && comps.some((c) => c.id === candidateId);

        if (storedValid) {
          setActiveId(candidateId);
        } else {
          const open = comps.find((c) => c.status === "OPEN");
          const fallback = comps[0];
          setActiveId(open?.id ?? fallback?.id ?? null);
        }
      };

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
                liveTeamsVisibility: competition.liveTeamsVisibility ?? "ADMINS",
                liveStartlistsVisibility: competition.liveStartlistsVisibility ?? "ADMINS",
                marketplaceGlobalVisibility: competition.marketplaceGlobalVisibility ?? "SELECTIVE",
              }]
            : [];

          applyCompetitions(comps);
          writeOfflineCache(COMPETITIONS_CACHE_KEY, { competitions: comps, activeId: comps[0]?.id ?? null });
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
          liveTeamsVisibility: c.liveTeamsVisibility ?? "ADMINS",
          liveStartlistsVisibility: c.liveStartlistsVisibility ?? "ADMINS",
          marketplaceGlobalVisibility: c.marketplaceGlobalVisibility ?? "SELECTIVE",
        }));
        applyCompetitions(comps);
        const activeCompetitionId = typeof window !== "undefined" && functionalStorageAllowed
          ? localStorage.getItem(STORAGE_KEY)
          : null;
        writeOfflineCache(COMPETITIONS_CACHE_KEY, { competitions: comps, activeId: activeCompetitionId });
      } catch (err) {
        console.error("Failed to load competitions:", err);
        const cached = readOfflineCache<{ competitions: CompetitionInfo[]; activeId?: string | null }>(COMPETITIONS_CACHE_KEY);
        if (cached?.data.competitions?.length) {
          applyCompetitions(cached.data.competitions, cached.data.activeId ?? null);
        }
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
