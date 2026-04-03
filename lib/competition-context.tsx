"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

type CompetitionInfo = {
  id: string;
  name: string;
  year: number;
  status: string;
  teamCount: number;
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
  const [all, setAll] = useState<CompetitionInfo[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load competitions on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/competitions");
        if (!res.ok) {
          setLoading(false);
          return;
        }
        const data = await res.json();
        const comps: CompetitionInfo[] = (data.competitions || []).map((c: any) => ({
          id: c.id,
          name: c.name,
          year: c.year,
          status: c.status,
          teamCount: c._count?.teams ?? 0,
        }));
        setAll(comps);

        // Restore from localStorage, or default to first OPEN competition
        const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
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
  }, []);

  const switchTo = useCallback(
    (id: string) => {
      setActiveId(id);
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, id);
      }
    },
    []
  );

  const active = all.find((c) => c.id === activeId) ?? null;

  return (
    <CompetitionContext.Provider value={{ active, all, switchTo, loading }}>
      {children}
    </CompetitionContext.Provider>
  );
}
