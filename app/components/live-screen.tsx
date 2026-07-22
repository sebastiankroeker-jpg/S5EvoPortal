"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useCompetition } from "@/lib/competition-context";
import { usePermissions } from "@/lib/permissions-context";
import { canRoleViewAllTeams } from "@/lib/team-access-config";
import { formatOfflineCacheTimestamp, readOfflineCache, writeOfflineCache } from "@/lib/pwa-offline-cache";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DISCIPLINES } from "@/lib/domain/team";
import { compareClassificationCodes } from "@/lib/domain/classification";
import { readTeamWatchlist, writeTeamWatchlist } from "@/lib/pwa-watchlist";
import { Star } from "lucide-react";
import ResultsView from "./results-view";
import ParticipantPublicationPreferenceIcon from "./participant-publication-preference-icon";

const SEGMENTS = ["watchlist", "teams", "start", "ergebnis"] as const;
type Segment = typeof SEGMENTS[number];

interface Team {
  id: string;
  name: string;
  startNumber?: string | null;
  teamPublicationLevel?: "TEAM_ANONYM" | "TEAMNAME_OEFFENTLICH" | "ALLES_OEFFENTLICH";
  category: string;
  contactName: string;
  contactEmail: string;
  participants?: Participant[];
}

interface Participant {
  firstName: string;
  lastName: string;
  gender: string;
  birthDate: string;
  discipline?: string;
  participantPublicationPreference?: "NAME_VERBERGEN" | "NAME_VEROEFFENTLICHEN" | null;
}

const categoryEmojis: Record<string, string> = {
  "schueler-a": "SA",
  "schueler-b": "SB",
  "jugend": "J",
  "damen-a": "DA",
  "damen-b": "DB",
  "jungsters": "HA",
  "herren": "HB",
  "masters": "HC",
};

const categoryLabels: Record<string, string> = {
  "schueler-a": "Schüler A",
  "schueler-b": "Schüler B",
  jugend: "Jugend",
  jungsters: "Jungsters",
  herren: "Herren",
  masters: "Masters",
  "damen-a": "Damen A",
  "damen-b": "Damen B",
};

// Helper function to get discipline display
const getDisciplineDisplay = (disciplineCode?: string) => {
  if (!disciplineCode || disciplineCode === "TBD") {
    return { label: "Noch offen", icon: "❓" };
  }
  const discipline = DISCIPLINES.find(d => d.id === disciplineCode);
  return discipline ? { label: discipline.label, icon: discipline.icon } : { label: disciplineCode, icon: "🏃" };
};

function formatStartNumber(startNumber?: string | null) {
  return startNumber ? `#${startNumber}` : "";
}

export default function LiveScreen() {
  const [activeSegment, setActiveSegment] = useState<Segment>("teams");
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cacheState, setCacheState] = useState<{ storedAt: string | null; fallback: boolean } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [watchedTeamIds, setWatchedTeamIds] = useState<string[]>([]);
  const { active: activeCompetition } = useCompetition();
  const { activeRole } = usePermissions();
  const canViewTeamLists = canRoleViewAllTeams(activeRole, activeCompetition);
  const cacheKey = useMemo(
    () => activeCompetition?.id ? `s5evo.offline.liveTeams.v1.${activeCompetition.id}.${activeRole}` : null,
    [activeCompetition?.id, activeRole],
  );
  const availableSegments = useMemo<Segment[]>(
    () => canViewTeamLists ? [...SEGMENTS] : ["ergebnis"],
    [canViewTeamLists],
  );
  const watchedTeamIdSet = useMemo(() => new Set(watchedTeamIds), [watchedTeamIds]);
  const watchedTeams = useMemo(
    () => teams.filter((team) => watchedTeamIdSet.has(team.id)),
    [teams, watchedTeamIdSet],
  );

  useEffect(() => {
    setWatchedTeamIds(activeCompetition?.id ? readTeamWatchlist(activeCompetition.id) : []);
  }, [activeCompetition?.id]);

  // Fetch teams data
  const fetchTeams = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (!canViewTeamLists) {
      setTeams([]);
      setLoading(false);
      return;
    }

    if (mode === "initial") setLoading(true);
    if (mode === "refresh") setRefreshing(true);

    try {
      // Fetch all teams for live view
      const params = new URLSearchParams({ scope: 'all', roleContext: activeRole });
      if (activeCompetition?.id) params.set('competitionId', activeCompetition.id);
      const response = await fetch(`/api/teams?${params}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Live-Daten konnten nicht geladen werden.");
      }
      setTeams(data.teams || []);
      if (cacheKey) {
        const stored = writeOfflineCache(cacheKey, { teams: data.teams || [] });
        setCacheState({ storedAt: stored?.storedAt ?? new Date().toISOString(), fallback: false });
      }
    } catch (error) {
      console.error('Failed to fetch teams:', error);
      const cached = cacheKey ? readOfflineCache<{ teams: Team[] }>(cacheKey) : null;
      if (cached) {
        setTeams(cached.data.teams || []);
        setCacheState({ storedAt: cached.storedAt, fallback: true });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeCompetition?.id, activeRole, cacheKey, canViewTeamLists]);

  useEffect(() => {
    void fetchTeams("initial");
  }, [fetchTeams]);

  useEffect(() => {
    if (!availableSegments.includes(activeSegment)) {
      setActiveSegment(availableSegments[0]);
    }
  }, [activeSegment, availableSegments]);

  // Toggle section expansion
  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleWatchedTeam = (teamId: string) => {
    if (!activeCompetition?.id) return;

    setWatchedTeamIds((current) => {
      const next = current.includes(teamId)
        ? current.filter((id) => id !== teamId)
        : [...current, teamId];
      return writeTeamWatchlist(activeCompetition.id, next);
    });
  };

  // Segment content rendering
  const renderTeamsSegment = () => {
    // Group teams by category
    const groupedTeams = teams.reduce((groups, team) => {
      const category = team.category;
      if (!groups[category]) groups[category] = [];
      groups[category].push(team);
      return groups;
    }, {} as Record<string, Team[]>);

    // Apply search filter
    const filteredGroupedTeams = Object.entries(groupedTeams).reduce((filtered, [category, categoryTeams]) => {
      const matchingTeams = categoryTeams.filter(team => {
        const matchesSearch = searchQuery === "" || 
          team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (team.contactName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
          (team.participants?.some(p => 
            `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
          ) ?? false);
        return matchesSearch;
      });
      
      if (matchingTeams.length > 0) {
        filtered[category] = matchingTeams;
      }
      return filtered;
    }, {} as Record<string, Team[]>);

    return (
      <div className="space-y-4">
        {/* Search */}
        <Input
          placeholder="Teams und Teilnehmer:innen durchsuchen..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
        />

        {/* Team Groups */}
        {Object.entries(filteredGroupedTeams).sort(([a], [b]) => compareClassificationCodes(a, b)).map(([category, categoryTeams]) => {
          const isExpanded = expandedSections[`teams-${category}`];
          
          return (
            <Card key={category}>
              <CardHeader 
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => toggleSection(`teams-${category}`)}
              >
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    {isExpanded ? "▼" : "▶"} {categoryEmojis[category] || "🏆"} {categoryLabels[category] || category}
                  </span>
                  <Badge variant="outline">
                    {categoryTeams.length} Team{categoryTeams.length !== 1 ? 's' : ''}
                  </Badge>
                </CardTitle>
              </CardHeader>
              
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <CardContent className="space-y-3">
                      {categoryTeams.map(team => (
                        <div key={team.id} className="border border-border/40 rounded p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="min-w-0 font-medium">
                              {team.startNumber ? (
                                <span className="mr-1.5 font-mono text-sm text-muted-foreground tabular-nums">
                                  {formatStartNumber(team.startNumber)}
                                </span>
                              ) : null}
                              {team.name}
                            </h4>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">
                                {team.participants?.length || 0}/5
                              </span>
                              {(team.participants?.length || 0) === 5 ? "✅" : "⏳"}
                              <Button
                                type="button"
                                variant={watchedTeamIdSet.has(team.id) ? "secondary" : "ghost"}
                                size="sm"
                                title={watchedTeamIdSet.has(team.id) ? "Von Watchlist entfernen" : "Zur Watchlist hinzufügen"}
                                aria-label={watchedTeamIdSet.has(team.id) ? `${team.name} von Watchlist entfernen` : `${team.name} zur Watchlist hinzufügen`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggleWatchedTeam(team.id);
                                }}
                              >
                                <Star className={watchedTeamIdSet.has(team.id) ? "fill-current" : ""} />
                                <span className="hidden sm:inline">
                                  {watchedTeamIdSet.has(team.id) ? "Gemerkt" : "Merken"}
                                </span>
                              </Button>
                            </div>
                          </div>
                          
                          {team.participants && team.participants.length > 0 && (
                            <div className="space-y-1">
                              {team.participants.map((p, i) => {
                                const disc = getDisciplineDisplay(p.discipline);
                                return (
                                  <div key={i} className="text-sm text-muted-foreground flex items-center justify-between">
                                    <span className="inline-flex min-w-0 items-center gap-1.5">
                                      <span className="truncate">{p.firstName} {p.lastName}</span>
                                      <ParticipantPublicationPreferenceIcon
                                        preference={p.participantPublicationPreference}
                                        teamPublicationLevel={team.teamPublicationLevel}
                                      />
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <span title={disc.label}>{disc.icon}</span>
                                      <span>{p.gender === "M" ? "♂" : "♀"}</span>
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          
                          {team.contactName ? (
                            <div className="text-xs text-muted-foreground border-t pt-2">
                              ⭐ {team.contactName} (Team Manager:in)
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </CardContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          );
        })}

        {Object.keys(filteredGroupedTeams).length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">
                {searchQuery ? "Keine Teams gefunden." : "Noch keine Teams angemeldet."}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const renderStartSegment = (sourceTeams: Team[] = teams) => {
    // Group participants by discipline, then by class
    const disciplineGroups = DISCIPLINES.reduce((groups, discipline) => {
      groups[discipline.id] = {};
      return groups;
    }, {} as Record<string, Record<string, Array<{ participant: Participant; teamName: string; startNumber?: string | null }>>>);

    // Populate groups
    sourceTeams.forEach(team => {
      team.participants?.forEach(participant => {
        const disciplineCode = participant.discipline || "TBD";
        if (!disciplineGroups[disciplineCode]) disciplineGroups[disciplineCode] = {};
        if (!disciplineGroups[disciplineCode][team.category]) {
          disciplineGroups[disciplineCode][team.category] = [];
        }
        disciplineGroups[disciplineCode][team.category].push({
          participant,
          teamName: team.name,
          startNumber: team.startNumber,
        });
      });
    });

    return (
      <div className="space-y-4">
        {DISCIPLINES.map(discipline => {
          const disciplineData = disciplineGroups[discipline.id] || {};
          const totalParticipants = Object.values(disciplineData).reduce((sum, participants) => sum + participants.length, 0);
          
          if (totalParticipants === 0) return null;

          const isDisciplineExpanded = expandedSections[`start-${discipline.id}`];

          return (
            <Card key={discipline.id}>
              <CardHeader 
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => toggleSection(`start-${discipline.id}`)}
              >
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    {isDisciplineExpanded ? "▼" : "▶"} {discipline.icon} {discipline.label}
                  </span>
                  <Badge variant="outline">
                    {totalParticipants} Starter:innen
                  </Badge>
                </CardTitle>
              </CardHeader>

              <AnimatePresence>
                {isDisciplineExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <CardContent className="space-y-4">
                      {Object.entries(disciplineData).sort(([a], [b]) => compareClassificationCodes(a, b)).map(([category, participants]) => {
                        if (participants.length === 0) return null;

                        const isClassExpanded = expandedSections[`start-${discipline.id}-${category}`];

                        return (
                          <div key={category} className="border border-border/40 rounded">
                            <div 
                              className="p-3 cursor-pointer hover:bg-muted/30 transition-colors flex items-center justify-between"
                              onClick={() => toggleSection(`start-${discipline.id}-${category}`)}
                            >
                              <span className="flex items-center gap-2">
                                {isClassExpanded ? "▼" : "▶"} {categoryEmojis[category] || "🏆"} {categoryLabels[category] || category}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {participants.length} Starter:innen
                              </Badge>
                            </div>

                            <AnimatePresence>
                              {isClassExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.15 }}
                                >
                                  <div className="px-3 pb-3 space-y-1 border-t border-border/40 pt-2">
                                    {participants.map(({ participant, teamName, startNumber }, i) => (
                                      <div key={i} className="text-sm flex items-center justify-between py-1">
                                        <span className="inline-flex min-w-0 items-center gap-1.5">
                                          <span className="font-mono text-xs font-medium text-muted-foreground tabular-nums">
                                            {formatStartNumber(startNumber) || `${i + 1}.`}
                                          </span>
                                          <span className="truncate">{participant.firstName} {participant.lastName}</span>
                                          <ParticipantPublicationPreferenceIcon
                                            preference={participant.participantPublicationPreference}
                                          />
                                        </span>
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                          <span>—</span>
                                          <span className="text-xs">{teamName}</span>
                                          <span>{participant.gender === "M" ? "♂" : "♀"}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </CardContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          );
        })}
      </div>
    );
  };

  const renderWatchlistSegment = () => {
    if (watchedTeamIds.length === 0) {
      return (
        <Card>
          <CardContent className="p-8 text-center">
            <Star className="mx-auto mb-3 size-8 text-muted-foreground" />
            <p className="font-medium">Noch keine Mannschaften auf der Watchlist.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Markiere Teams mit dem Stern, dann hast du Starts und Ergebnisse schneller im Blick.
            </p>
            <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => setActiveSegment("teams")}>
              <Star />
              Teams auswählen
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (watchedTeams.length === 0) {
      return (
        <Card>
          <CardContent className="p-8 text-center">
            <Star className="mx-auto mb-3 size-8 fill-current text-muted-foreground" />
            <p className="font-medium">Watchlist gespeichert.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Die gemerkten Teams sind in den aktuell geladenen Live-Daten nicht sichtbar.
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm">
          <p className="font-medium">{watchedTeams.length} Watchlist-Team{watchedTeams.length !== 1 ? "s" : ""}</p>
          <p className="text-xs text-muted-foreground">
            Lokal in dieser PWA gespeichert. Ergebnisse kannst du im Tab Ergebnis auf die Watchlist filtern.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {watchedTeams.map((team) => (
            <Card key={team.id}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{team.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {categoryLabels[team.category] || team.category} · {team.participants?.length || 0}/5 Starter:innen
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon-sm"
                    title="Von Watchlist entfernen"
                    aria-label={`${team.name} von Watchlist entfernen`}
                    onClick={() => toggleWatchedTeam(team.id)}
                  >
                    <Star className="fill-current" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {renderStartSegment(watchedTeams)}
      </div>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          <p className="mt-4 text-muted-foreground">Lade Live-Daten...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {canViewTeamLists && (
        <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-card px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">Start- und Mannschaftsdaten</p>
            <p className={`text-xs ${cacheState?.fallback ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"}`}>
              {cacheState?.fallback ? "Lokaler Stand" : "Datenstand"}: {formatOfflineCacheTimestamp(cacheState?.storedAt)}
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void fetchTeams("refresh")} disabled={refreshing}>
            {refreshing ? "Aktualisiere..." : "Daten aktualisieren"}
          </Button>
        </div>
      )}

      {/* Segment Tabs */}
      <div className="flex space-x-1 bg-muted/50 p-1 rounded-lg">
        {availableSegments.map((segment) => {
          const isActive = activeSegment === segment;
          const labels: Record<Segment, string> = {
            watchlist: `⭐ Watchlist${watchedTeamIds.length > 0 ? ` (${watchedTeamIds.length})` : ""}`,
            teams: "📋 Teams",
            start: "🏁 Start",
            ergebnis: "🏆 Ergebnis",
          };
          
          return (
            <button
              key={segment}
              onClick={() => setActiveSegment(segment)}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all ${
                isActive 
                  ? "bg-background text-primary shadow-sm" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
              }`}
            >
              {labels[segment]}
            </button>
          );
        })}
      </div>

      {/* Segment Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSegment}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
        >
          {activeSegment === "watchlist" && renderWatchlistSegment()}
          {activeSegment === "teams" && renderTeamsSegment()}
          {activeSegment === "start" && renderStartSegment()}
          {activeSegment === "ergebnis" && <ResultsView watchlistTeamIds={watchedTeamIds} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
