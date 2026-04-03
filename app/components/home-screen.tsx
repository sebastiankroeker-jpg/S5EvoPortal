"use client";

import { useSession, signIn } from "next-auth/react";
import { useState, useEffect } from "react";
import { useCompetition } from "@/lib/competition-context";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/lib/permissions-context";
import { useTheme } from "@/lib/theme-context";

interface CompetitionInfo {
  name: string;
  location: string;
  date: string;
  dateEnd?: string;
  status: string;
}

interface TeamStats {
  totalTeams: number;
  totalParticipants: number;
  totalClasses: number;
}

export default function HomeScreen() {
  const { data: session, status } = useSession();
  const { can } = usePermissions();
  const { theme } = useTheme();
  const [competitionInfo, setCompetitionInfo] = useState<CompetitionInfo | null>(null);
  const [teamStats, setTeamStats] = useState<TeamStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { active: activeCompetition } = useCompetition();

  // Load competition info and stats
  useEffect(() => {
    // Wait until context has loaded (avoid race condition with null → real ID)
    if (!activeCompetition?.id) return;

    const loadData = async () => {
      try {
        // Load competition info for selected competition
        const compResponse = await fetch(`/api/admin/competition?id=${activeCompetition.id}`);
        if (compResponse.ok) {
          const compData = await compResponse.json();
          setCompetitionInfo(compData.competition || compData);
        }

        // Load team stats (scope=all to count all teams, not just own)
        const params = new URLSearchParams({
          competitionId: activeCompetition.id,
          scope: 'all',
        });
        const teamsResponse = await fetch(`/api/teams?${params}`);
        if (teamsResponse.ok) {
          const teamsData = await teamsResponse.json();
          const teams = teamsData.teams || [];
          const stats = {
            totalTeams: teams.length,
            totalParticipants: teams.reduce((sum: number, team: any) => sum + (team.participants?.length || 0), 0),
            totalClasses: new Set(teams.map((team: any) => team.category).filter(Boolean)).size
          };
          setTeamStats(stats);
        }
      } catch (error) {
        console.error('Error loading competition data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [activeCompetition?.id]);

  const handleQuickAction = (tabId: string, additionalData?: any) => {
    const event = new CustomEvent('switchTab', { detail: { tabId, ...additionalData } });
    window.dispatchEvent(event);
  };

  // Not authenticated - show login
  if (status === "unauthenticated") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center space-y-8 py-8"
      >
        <div className="space-y-4">
          <span className="text-6xl">🏆</span>
          <h1 className="text-2xl font-bold">Mannschafts-5-Kampf</h1>
          <p className="text-muted-foreground">📍 Bad Bayersoien · Ammertal</p>
        </div>

        <Card className={theme === "bunt" ? "bunt-card max-w-md mx-auto" : "max-w-md mx-auto"}>
          <CardContent className="space-y-4 pt-6">
            <Button
              size="lg"
              onClick={() => signIn("authentik")}
              className={`w-full ${theme === "bunt" ? "bunt-btn" : ""}`}
            >
              🔐 Anmelden
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => window.location.href = 'https://auth.s5evo.de/if/flow/s5-evo-registration/'}
              className="w-full"
            >
              📝 Account erstellen
            </Button>
            <div className="text-xs text-center text-muted-foreground">
              <p>auth.s5evo.de</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  // Loading
  if (status === "loading" || isLoading) {
    return (
      <div className="text-center py-16">
        <div className="animate-spin inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        <p className="mt-4 text-muted-foreground">Lade...</p>
      </div>
    );
  }

  // Authenticated - show competition overview
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 py-4"
    >
      {/* Competition Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold flex items-center justify-center gap-2">
          🏆 Mannschafts-5-Kampf
        </h1>
        <p className="text-lg text-muted-foreground">2026</p>
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>📍 {competitionInfo?.location || "Bad Bayersoien · Ammertal"}</p>
          {competitionInfo?.date ? (
            <p>📅 {new Date(competitionInfo.date).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long' })}
            {competitionInfo.dateEnd && ` – ${new Date(competitionInfo.dateEnd).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}`}
            </p>
          ) : (
            <p>📅 Termin wird noch bekanntgegeben</p>
          )}
          <p className="font-medium">
            📊 Status: <span className="text-green-600">OPEN</span>
          </p>
        </div>
      </div>

      {/* Stats Overview */}
      {teamStats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-center text-sm">── Auf einen Blick ──</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-primary">{teamStats.totalTeams}</div>
                <div className="text-xs text-muted-foreground">Teams</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-primary">{teamStats.totalParticipants}</div>
                <div className="text-xs text-muted-foreground">Teilnehmer</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-primary">{teamStats.totalClasses}</div>
                <div className="text-xs text-muted-foreground">Klassen</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="space-y-3">
        {can("team.create") && (
          <Button
            variant="outline"
            size="lg"
            onClick={() => handleQuickAction("registration")}
            className="w-full justify-start"
          >
            📋 Mannschaft anmelden
            <span className="ml-auto">→</span>
          </Button>
        )}
        
        {can("team.view.own") && (
          <Button
            variant="outline"
            size="lg"
            onClick={() => handleQuickAction("dashboard", { ownerFilter: session?.user?.email })}
            className="w-full justify-start"
          >
            📊 Meine Teams
            <span className="ml-auto">→</span>
          </Button>
        )}
      </div>
    </motion.div>
  );
}