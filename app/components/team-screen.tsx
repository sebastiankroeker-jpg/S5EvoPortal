"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/lib/permissions-context";
import { useCompetition } from "@/lib/competition-context";
import { canRoleViewAllTeams } from "@/lib/team-access-config";
import Dashboard from "./dashboard";
import TeamRegistration from "./team-registration";

type TeamView = "mannschaften" | "register" | "watchlist";

const TEAM_VIEW_STORAGE_KEY = "s5evo-team-view";

function isTeamView(value: string | null): value is TeamView {
  return value === "mannschaften" || value === "register" || value === "watchlist";
}

export default function TeamScreen() {
  const { data: session } = useSession();
  const { can, activeRole } = usePermissions();
  const { active: activeCompetition } = useCompetition();
  const [view, setView] = useState<TeamView>(() => {
    if (typeof window === "undefined") return "mannschaften";
    const storedView = window.sessionStorage.getItem(TEAM_VIEW_STORAGE_KEY);
    return isTeamView(storedView) ? storedView : "mannschaften";
  });
  const [hasOwnTeams, setHasOwnTeams] = useState<boolean | null>(null);
  const canBrowseAllTeams = can("team.view.all") || canRoleViewAllTeams(activeRole, activeCompetition);

  const selectView = (nextView: TeamView) => {
    setView(nextView);
    window.sessionStorage.setItem(TEAM_VIEW_STORAGE_KEY, nextView);
  };

  useEffect(() => {
    const handleSwitchTab = (event: Event) => {
      const detail = (event as CustomEvent<{ tabId?: string; teamView?: string }>).detail;
      if (detail?.tabId !== "registration") return;
      const requestedView = detail.teamView ?? null;
      selectView(isTeamView(requestedView) ? requestedView : "mannschaften");
    };

    window.addEventListener("switchTab", handleSwitchTab as EventListener);
    return () => window.removeEventListener("switchTab", handleSwitchTab as EventListener);
  }, []);

  // Check if user has teams → default to Mannschaften tab with owner filter
  useEffect(() => {
    if (!session?.user?.email) return;
    (async () => {
      try {
        const res = await fetch('/api/teams');
        if (res.ok) {
          const data = await res.json();
          const owns = (data.teams || []).length > 0;
          setHasOwnTeams(owns);
        }
      } catch {}
    })();
  }, [session?.user?.email]);

  if (!session?.user) return null;

  // Zuschauer:in sieht nur Watchlist/Anmelde-CTA
  if (activeRole === "ZUSCHAUER") {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 py-4">
        <div className="text-center space-y-4 py-8">
          <span className="text-5xl">👀</span>
          <h2 className="text-xl font-semibold">Watchlist</h2>
          <p className="text-muted-foreground text-sm max-w-xs mx-auto">
            Hier kannst du bald deine Lieblingsmannschaften verfolgen.
          </p>
          {can("team.create") && (
            <Button onClick={() => selectView("register")} className="mt-4">
              📋 Mannschaft anmelden
            </Button>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {/* Sub-Navigation */}
      <div className="flex items-center gap-1 bg-muted/30 rounded-md p-0.5 w-fit">
        <button
          onClick={() => selectView("mannschaften")}
          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
            view === "mannschaften" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          📊 Mannschaften
        </button>
        <button
          onClick={() => selectView("watchlist")}
          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
            view === "watchlist" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          👀 Watchlist
        </button>
      </div>

      {/* Content */}
      {view === "mannschaften" && (
        <Dashboard ownerFilter={!canBrowseAllTeams && hasOwnTeams ? (session.user.email || undefined) : undefined} />
      )}
      {view === "register" && <TeamRegistration />}
      {view === "watchlist" && (
        <div className="text-center space-y-4 py-8">
          <span className="text-5xl">👀</span>
          <h2 className="text-lg font-semibold">Watchlist</h2>
          <p className="text-muted-foreground text-sm max-w-xs mx-auto">
            Hier kannst du bald Lieblingsmannschaften hinzufügen und deren Ergebnisse verfolgen.
          </p>
        </div>
      )}
    </motion.div>
  );
}
