"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import { usePrivacyConsent } from "@/lib/privacy-consent-context";
import { readOfflineCache, writeOfflineCache } from "@/lib/pwa-offline-cache";
import type { CompetitionClassification } from "@/lib/competition-classifications";
import { selectDefaultCompetitionId, type CompetitionLifecycleStatus } from "@/lib/competition-visibility";

type CompetitionInfo = {
  id: string;
  name: string;
  year: number;
  status: CompetitionLifecycleStatus;
  portalVisibility?: "PRIVATE" | "PORTAL_USERS" | "PUBLIC";
  registrationVisibility?: "CLOSED" | "PORTAL_USERS" | "PUBLIC";
  teamCount: number;
  teamOwnerFilterVisibleForTeamchef: boolean;
  participantsCanViewAllTeams: boolean;
  spectatorsCanViewAllTeams: boolean;
  hideForeignTeams: boolean;
  liveTeamsVisibility: "ADMINS" | "PORTAL_USERS" | "SPECTATORS";
  liveStartlistsVisibility: "ADMINS" | "PORTAL_USERS" | "SPECTATORS";
  liveResultsVisibility: "ADMINS" | "PORTAL_USERS" | "SPECTATORS";
  marketplaceGlobalVisibility: "SELECTIVE" | "OFFLINE";
  classifications?: CompetitionClassification[];
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

type VisibleCompetitionResponseItem = {
  id: string;
  name: string;
  year: number;
  status: CompetitionLifecycleStatus;
  portalVisibility?: "PRIVATE" | "PORTAL_USERS" | "PUBLIC";
  registrationVisibility?: "CLOSED" | "PORTAL_USERS" | "PUBLIC";
  teamCount?: number;
  teamOwnerFilterVisibleForTeamchef?: boolean;
  participantsCanViewAllTeams?: boolean;
  spectatorsCanViewAllTeams?: boolean;
  hideForeignTeams?: boolean;
  liveTeamsVisibility?: "ADMINS" | "PORTAL_USERS" | "SPECTATORS";
  liveStartlistsVisibility?: "ADMINS" | "PORTAL_USERS" | "SPECTATORS";
  liveResultsVisibility?: "ADMINS" | "PORTAL_USERS" | "SPECTATORS";
  marketplaceGlobalVisibility?: "SELECTIVE" | "OFFLINE";
  classifications?: CompetitionClassification[];
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

const STORAGE_KEY_PREFIX = "s5evo-active-competition.v2";
const COMPETITIONS_CACHE_KEY_PREFIX = "s5evo.offline.competitions.v2";

export function CompetitionProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const { hasConsent } = usePrivacyConsent();
  const functionalStorageAllowed = hasConsent("FUNCTIONAL_STORAGE");
  const cacheSubject = session?.user?.email ? encodeURIComponent(session.user.email.toLowerCase()) : "anonymous";
  const storageKey = `${STORAGE_KEY_PREFIX}.${cacheSubject}`;
  const competitionsCacheKey = `${COMPETITIONS_CACHE_KEY_PREFIX}.${cacheSubject}`;
  const [all, setAll] = useState<CompetitionInfo[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load competitions on mount
  useEffect(() => {
    (async () => {
      const applyCompetitions = (comps: CompetitionInfo[], preferredActiveId?: string | null) => {
        setAll(comps);

        const stored = typeof window !== "undefined" && functionalStorageAllowed ? localStorage.getItem(storageKey) : null;
        const candidateId = preferredActiveId ?? stored;
        const storedValid = candidateId && comps.some((c) => c.id === candidateId);

        if (storedValid) {
          setActiveId(candidateId);
        } else {
          setActiveId(selectDefaultCompetitionId(comps));
        }
      };

      try {
        const res = await fetch("/api/competitions", { cache: "no-store" });
        if (!res.ok) throw new Error("Visible competitions could not be loaded");
        const data = await res.json();
        const comps: CompetitionInfo[] = ((data.competitions || []) as VisibleCompetitionResponseItem[]).map((c) => ({
          id: c.id,
          name: c.name,
          year: c.year,
          status: c.status,
          portalVisibility: c.portalVisibility,
          registrationVisibility: c.registrationVisibility,
          teamCount: c.teamCount ?? 0,
          teamOwnerFilterVisibleForTeamchef: c.teamOwnerFilterVisibleForTeamchef ?? false,
          participantsCanViewAllTeams: c.participantsCanViewAllTeams ?? false,
          spectatorsCanViewAllTeams: c.spectatorsCanViewAllTeams ?? false,
          hideForeignTeams: c.hideForeignTeams ?? false,
          liveTeamsVisibility: c.liveTeamsVisibility ?? "ADMINS",
          liveStartlistsVisibility: c.liveStartlistsVisibility ?? "ADMINS",
          liveResultsVisibility: c.liveResultsVisibility ?? "ADMINS",
          marketplaceGlobalVisibility: c.marketplaceGlobalVisibility ?? "SELECTIVE",
          classifications: c.classifications ?? [],
        }));
        applyCompetitions(comps);
        const activeCompetitionId = typeof window !== "undefined" && functionalStorageAllowed
          ? localStorage.getItem(storageKey)
          : null;
        if (functionalStorageAllowed) {
          localStorage.removeItem("s5evo-active-competition");
          localStorage.removeItem("s5evo.offline.competitions.v1");
          writeOfflineCache(competitionsCacheKey, { competitions: comps, activeId: activeCompetitionId });
        }
      } catch (err) {
        console.error("Failed to load competitions:", err);
        const cached = readOfflineCache<{ competitions: CompetitionInfo[]; activeId?: string | null }>(competitionsCacheKey);
        if (cached?.data.competitions?.length) {
          applyCompetitions(cached.data.competitions, cached.data.activeId ?? null);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [competitionsCacheKey, functionalStorageAllowed, storageKey]);

  const switchTo = useCallback(
    (id: string) => {
      setActiveId(id);
      if (typeof window !== "undefined" && functionalStorageAllowed) {
        localStorage.setItem(storageKey, id);
      }
    },
    [functionalStorageAllowed, storageKey]
  );

  const active = all.find((c) => c.id === activeId) ?? null;

  return (
    <CompetitionContext.Provider value={{ active, all, switchTo, loading }}>
      {children}
    </CompetitionContext.Provider>
  );
}
