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
  year: number;
  location: string;
  date: string;
  dateEnd: string | null;
  status: string;
}

interface TeamStats {
  totalTeams: number;
  totalParticipants: number;
  totalClasses: number;
}

const FLYER_INFO_2026 = {
  registrationDeadline: "22.07.2026",
  registrationUrl: "www.esv-bad-bayersoien.de",
  registrationNotes: [
    "Anmeldung nur über die Website des ESV Bad Bayersoien",
    "Die Anmeldung gilt erst mit Überweisung der Startgebühr als verbindlich",
  ],
  fees: [
    { label: "Schüler", value: "55 €" },
    { label: "Jugend", value: "65 €" },
    { label: "Damen / Herren", value: "80 €" },
  ],
  schedule: [
    { day: "Freitag, 24. Juli", items: ["16:30 Laufen am Soier See", "18:30 Bankdrücken im Bierzelt"] },
    { day: "Samstag, 25. Juli", items: ["08:00 Stock-Zielschießen", "12:30 Rennrad-Einzelzeitfahren", "15:30 Mountainbike-Rennen", "20:00 Siegerehrung im Bierzelt"] },
  ],
  teamRules: [
    "Eine Mannschaft besteht aus genau 5 Mitgliedern",
    "Keine Doppelfunktion innerhalb einer Mannschaft oder in einer anderen Mannschaft",
    "Für die Altersberechnung zählt der Jahrgang, nicht das aktuelle Alter",
  ],
  eventNotes: [
    "Rennrad und Mountainbike nur mit Helm",
    "Teilnahme auf eigene Gefahr",
    "Während der Veranstaltung werden Fotos für Berichterstattung und Werbung gemacht",
  ],
};

function FlyerInfoCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-center text-base">📣 Digitale Ausschreibung 2026</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
          <p className="text-base font-semibold">33. Bayersoier Fünfkampf für Mannschaften</p>
          <div className="space-y-1 text-muted-foreground">
            <p><span className="font-medium text-foreground">📅 Termin:</span> 24. + 25.07.2026</p>
            <p><span className="font-medium text-foreground">📍 Ort:</span> Bad Bayersoien</p>
            <p><span className="font-medium text-foreground">📝 Anmeldung bis:</span> {FLYER_INFO_2026.registrationDeadline}</p>
            <p><span className="font-medium text-foreground">🌐 Anmeldung:</span> {FLYER_INFO_2026.registrationUrl}</p>
          </div>
          <a
            href={`https://${FLYER_INFO_2026.registrationUrl}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow hover:opacity-90 transition-opacity"
          >
            Zur Anmeldung ↗
          </a>
        </div>

        <div className="space-y-2">
          <p className="font-medium">Anmeldung</p>
          <div className="rounded-md border border-border/50 p-3 space-y-1 text-muted-foreground">
            {FLYER_INFO_2026.registrationNotes.map((note) => (
              <p key={note}>• {note}</p>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="font-medium">Startgebühr pro Mannschaft</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {FLYER_INFO_2026.fees.map((fee) => (
              <div key={fee.label} className="rounded-md border border-border/50 px-3 py-2 text-center">
                <div className="text-xs text-muted-foreground">{fee.label}</div>
                <div className="font-semibold text-primary">{fee.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="font-medium">Mannschaft & Regeln</p>
          <div className="rounded-md border border-border/50 p-3 space-y-1 text-muted-foreground">
            {FLYER_INFO_2026.teamRules.map((rule) => (
              <p key={rule}>• {rule}</p>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <p className="font-medium">Ablauf</p>
          {FLYER_INFO_2026.schedule.map((day) => (
            <div key={day.day} className="rounded-md border border-border/50 p-3">
              <p className="font-medium mb-2">{day.day}</p>
              <ul className="space-y-1 text-muted-foreground">
                {day.items.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <p className="font-medium">Wichtige Hinweise</p>
          <div className="rounded-md border border-border/50 p-3 space-y-1 text-muted-foreground">
            {FLYER_INFO_2026.eventNotes.map((note) => (
              <p key={note}>• {note}</p>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
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

        <div className="max-w-3xl mx-auto">
          <FlyerInfoCard />
        </div>
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
          🏆 {competitionInfo?.name || "Mannschafts-Fünfkampf"}
        </h1>
        <p className="text-lg text-muted-foreground">{competitionInfo?.year || ""}</p>
        <div className="space-y-1 text-sm text-muted-foreground">
          {competitionInfo?.location && <p>📍 {competitionInfo.location}</p>}
          {competitionInfo?.date ? (
            <p>📅 {(() => {
              const d1 = new Date(competitionInfo.date);
              const f1 = d1.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric' });
              if (competitionInfo.dateEnd) {
                const d2 = new Date(competitionInfo.dateEnd);
                const f2 = d2.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
                return `${f1}. - ${f2}`;
              }
              return d1.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
            })()}
            </p>
          ) : (
            <p>📅 Termin wird noch bekanntgegeben</p>
          )}
          <p className="font-medium">
            📊 Status: <span className={competitionInfo?.status === "OPEN" ? "text-green-600" : "text-muted-foreground"}>{competitionInfo?.status || "..."}</span>
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

      <FlyerInfoCard />

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
