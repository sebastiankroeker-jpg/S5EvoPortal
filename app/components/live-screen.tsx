"use client";

import { useState, useEffect, useMemo, useCallback, type Dispatch, type SetStateAction } from "react";
import { useCompetition } from "@/lib/competition-context";
import { usePermissions } from "@/lib/permissions-context";
import { canRoleViewAllTeams } from "@/lib/team-access-config";
import { formatOfflineCacheTimestamp, readOfflineCache, writeOfflineCache } from "@/lib/pwa-offline-cache";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DISCIPLINES } from "@/lib/domain/team";
import { compareClassificationCodes } from "@/lib/domain/classification";
import { readTeamWatchlist, writeTeamWatchlist } from "@/lib/pwa-watchlist";
import { SlidersHorizontal, Star, XCircle } from "lucide-react";
import ResultsView from "./results-view";
import ParticipantPublicationPreferenceIcon from "./participant-publication-preference-icon";
import {
  DashboardControlsCard,
  DashboardPanel,
  DashboardSearchField,
  DashboardToolbar,
  DashboardToolbarButton,
} from "./dashboard-controls";

const SEGMENTS = ["teams", "start", "ergebnis"] as const;
type Segment = typeof SEGMENTS[number];

interface Team {
  id: string;
  name: string;
  startNumber?: string | null;
  teamPublicationLevel?: "TEAM_ANONYM" | "TEAMNAME_OEFFENTLICH" | "ALLES_OEFFENTLICH";
  category: string;
  contactName: string;
  contactEmail: string;
  registrationMode?: "TEAM" | "MARKETPLACE" | null;
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

type OverallClassFilter = "damen-gesamt" | "herren-gesamt";
type LiveClassFilter = string | OverallClassFilter;

const overallClassFilters: Array<{ code: OverallClassFilter; label: string; shortLabel: string; sourceClassCodes: string[] }> = [
  { code: "damen-gesamt", label: "Damen Gesamt", shortLabel: "DG", sourceClassCodes: ["damen-a", "damen-b"] },
  { code: "herren-gesamt", label: "Herren Gesamt", shortLabel: "HG", sourceClassCodes: ["jungsters", "herren", "masters"] },
];

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

function isCompetitionTeam(team: Team) {
  return team.registrationMode !== "MARKETPLACE" && team.category !== "sportlerboerse";
}

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase();
}

function teamMatchesSearch(team: Team, query: string, includeManager: boolean) {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) return true;

  const searchable = [
    team.name,
    team.startNumber,
    ...(includeManager ? [team.contactName, team.contactEmail] : []),
    ...(team.participants ?? []).flatMap((participant) => [
      participant.firstName,
      participant.lastName,
      `${participant.firstName} ${participant.lastName}`,
      `${participant.lastName} ${participant.firstName}`,
    ]),
  ];

  return searchable.some((value) => value?.toLowerCase().includes(normalizedQuery));
}

function participantMatchesSearch(participant: Participant, query: string) {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) return true;

  return [
    participant.firstName,
    participant.lastName,
    `${participant.firstName} ${participant.lastName}`,
    `${participant.lastName} ${participant.firstName}`,
  ].some((value) => value.toLowerCase().includes(normalizedQuery));
}

function teamMetaMatchesSearch(team: Team, query: string, includeManager: boolean) {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) return true;

  return [
    team.name,
    team.startNumber,
    ...(includeManager ? [team.contactName, team.contactEmail] : []),
  ].some((value) => value?.toLowerCase().includes(normalizedQuery));
}

function getClassFilterSourceCodes(filter: LiveClassFilter) {
  return overallClassFilters.find((group) => group.code === filter)?.sourceClassCodes ?? [filter];
}

function teamMatchesClassFilters(team: Team, classFilters: LiveClassFilter[]) {
  if (classFilters.length === 0) return true;
  return classFilters.some((filter) => getClassFilterSourceCodes(filter).includes(team.category));
}

function uniqueSortedCategories(teams: Team[]) {
  return [...new Set(teams.map((team) => team.category).filter(Boolean))].sort(compareClassificationCodes);
}

export default function LiveScreen() {
  const [activeSegment, setActiveSegment] = useState<Segment>("teams");
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cacheState, setCacheState] = useState<{ storedAt: string | null; fallback: boolean } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [teamsFavoritesOnly, setTeamsFavoritesOnly] = useState(false);
  const [startsFavoritesOnly, setStartsFavoritesOnly] = useState(false);
  const [teamsFiltersOpen, setTeamsFiltersOpen] = useState(false);
  const [startsFiltersOpen, setStartsFiltersOpen] = useState(false);
  const [teamsClassFilters, setTeamsClassFilters] = useState<LiveClassFilter[]>([]);
  const [startsClassFilters, setStartsClassFilters] = useState<LiveClassFilter[]>([]);
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
  const canSearchTeamManagers = activeRole === "ADMIN";
  const availableCategories = useMemo(() => uniqueSortedCategories(teams), [teams]);

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
      const liveTeams = (data.teams || []).filter(isCompetitionTeam);
      setTeams(liveTeams);
      if (cacheKey) {
        const stored = writeOfflineCache(cacheKey, { teams: liveTeams });
        setCacheState({ storedAt: stored?.storedAt ?? new Date().toISOString(), fallback: false });
      }
    } catch (error) {
      console.error('Failed to fetch teams:', error);
      const cached = cacheKey ? readOfflineCache<{ teams: Team[] }>(cacheKey) : null;
      if (cached) {
        setTeams((cached.data.teams || []).filter(isCompetitionTeam));
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

  const toggleClassFilter = (
    filter: LiveClassFilter,
    setter: Dispatch<SetStateAction<LiveClassFilter[]>>,
  ) => {
    setter((current) =>
      current.includes(filter)
        ? current.filter((entry) => entry !== filter)
        : [...current, filter],
    );
  };

  const classFilterActiveCount = (filters: LiveClassFilter[], favoritesOnly: boolean) =>
    filters.length + (favoritesOnly ? 1 : 0);

  const renderLiveControls = ({
    filterLabel,
    filtersOpen,
    setFiltersOpen,
    classFilters,
    setClassFilters,
    favoritesOnly,
    setFavoritesOnly,
    favoriteLabel,
    matchingCount,
    totalCount,
  }: {
    filterLabel: string;
    filtersOpen: boolean;
    setFiltersOpen: Dispatch<SetStateAction<boolean>>;
    classFilters: LiveClassFilter[];
    setClassFilters: Dispatch<SetStateAction<LiveClassFilter[]>>;
    favoritesOnly: boolean;
    setFavoritesOnly: Dispatch<SetStateAction<boolean>>;
    favoriteLabel: string;
    matchingCount: number;
    totalCount: number;
  }) => {
    const activeFilterCount = classFilterActiveCount(classFilters, favoritesOnly);
    const hasResettableState = Boolean(searchQuery.trim()) || activeFilterCount > 0;

    return (
      <DashboardControlsCard className="space-y-2">
        <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <DashboardSearchField
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={canSearchTeamManagers ? "Team, Teilnehmer:in, Startnummer oder Teammanager" : "Team, Teilnehmer:in oder Startnummer"}
          />
          <DashboardToolbar>
            <DashboardToolbarButton
              icon={<SlidersHorizontal className="size-3.5" />}
              label={filterLabel}
              open={filtersOpen}
              badge={activeFilterCount || null}
              onClick={() => setFiltersOpen((open) => !open)}
            />
            <DashboardToolbarButton
              icon={<XCircle className="size-3.5" />}
              label="Filter zurücksetzen"
              variant={hasResettableState ? "default" : "outline"}
              disabled={!hasResettableState}
              onClick={() => {
                setSearchQuery("");
                setClassFilters([]);
                setFavoritesOnly(false);
              }}
            />
          </DashboardToolbar>
        </div>
        <div className="text-xs text-muted-foreground">
          {matchingCount} von {totalCount} {favoriteLabel}
        </div>
        {filtersOpen && (
          <DashboardPanel className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">Klassen</p>
                <Button size="xs" variant={classFilters.length === 0 ? "default" : "outline"} onClick={() => setClassFilters([])}>
                  Alle Klassen
                </Button>
              </div>
              <div className="flex min-w-0 flex-wrap gap-1.5">
                {overallClassFilters.map((group) => (
                  <Button
                    key={group.code}
                    size="xs"
                    variant={classFilters.includes(group.code) ? "default" : "outline"}
                    onClick={() => toggleClassFilter(group.code, setClassFilters)}
                    aria-pressed={classFilters.includes(group.code)}
                  >
                    {group.shortLabel} {group.label}
                  </Button>
                ))}
                {availableCategories.map((category) => (
                  <Button
                    key={category}
                    size="xs"
                    variant={classFilters.includes(category) ? "default" : "outline"}
                    onClick={() => toggleClassFilter(category, setClassFilters)}
                    aria-pressed={classFilters.includes(category)}
                  >
                    <span>{categoryEmojis[category] || "🏆"}</span>
                    {categoryLabels[category] || category}
                  </Button>
                ))}
              </div>
            </div>
            {watchedTeamIds.length > 0 && (
              <div className="space-y-2 border-t border-border/50 pt-3">
                <p className="text-xs font-medium text-muted-foreground">Favoriten</p>
                <Button
                  type="button"
                  variant={favoritesOnly ? "default" : "outline"}
                  size="xs"
                  onClick={() => setFavoritesOnly((value) => !value)}
                  aria-pressed={favoritesOnly}
                >
                  <Star className={favoritesOnly ? "fill-current" : ""} />
                  Nur Favoriten ({watchedTeamIds.length})
                </Button>
              </div>
            )}
          </DashboardPanel>
        )}
      </DashboardControlsCard>
    );
  };

  // Segment content rendering
  const renderTeamsSegment = () => {
    const visibleTeams = teams.filter((team) =>
      teamMatchesSearch(team, searchQuery, canSearchTeamManagers) &&
      teamMatchesClassFilters(team, teamsClassFilters) &&
      (!teamsFavoritesOnly || watchedTeamIdSet.has(team.id))
    );
    // Group teams by category
    const filteredGroupedTeams = visibleTeams.reduce((groups, team) => {
      const category = team.category;
      if (!groups[category]) groups[category] = [];
      groups[category].push(team);
      return groups;
    }, {} as Record<string, Team[]>);

    return (
      <div className="space-y-4">
        {renderLiveControls({
          filterLabel: "Team-Filter",
          filtersOpen: teamsFiltersOpen,
          setFiltersOpen: setTeamsFiltersOpen,
          classFilters: teamsClassFilters,
          setClassFilters: setTeamsClassFilters,
          favoritesOnly: teamsFavoritesOnly,
          setFavoritesOnly: setTeamsFavoritesOnly,
          favoriteLabel: "Teams",
          matchingCount: visibleTeams.length,
          totalCount: teams.length,
        })}

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

  const renderStartSegment = () => {
    const sourceTeams = teams.filter((team) =>
      teamMatchesClassFilters(team, startsClassFilters) &&
      (!startsFavoritesOnly || watchedTeamIdSet.has(team.id)) &&
      teamMatchesSearch(team, searchQuery, canSearchTeamManagers)
    );
    const normalizedQuery = normalizeSearchValue(searchQuery);

    // Group participants by discipline, then by class
    const disciplineGroups = DISCIPLINES.reduce((groups, discipline) => {
      groups[discipline.id] = {};
      return groups;
    }, {} as Record<string, Record<string, Array<{ participant: Participant; teamName: string; startNumber?: string | null }>>>);

    // Populate groups
    sourceTeams.forEach(team => {
      const teamWideSearchMatch = teamMetaMatchesSearch(team, normalizedQuery, canSearchTeamManagers);
      team.participants?.forEach(participant => {
        if (!teamWideSearchMatch && !participantMatchesSearch(participant, normalizedQuery)) return;
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
    const visibleStarterCount = Object.values(disciplineGroups).reduce(
      (disciplineSum, classGroups) =>
        disciplineSum + Object.values(classGroups).reduce((classSum, participants) => classSum + participants.length, 0),
      0,
    );

    return (
      <div className="space-y-4">
        {renderLiveControls({
          filterLabel: "Startlisten-Filter",
          filtersOpen: startsFiltersOpen,
          setFiltersOpen: setStartsFiltersOpen,
          classFilters: startsClassFilters,
          setClassFilters: setStartsClassFilters,
          favoritesOnly: startsFavoritesOnly,
          setFavoritesOnly: setStartsFavoritesOnly,
          favoriteLabel: "Teams",
          matchingCount: sourceTeams.length,
          totalCount: teams.length,
        })}
        {visibleStarterCount === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">
                {searchQuery || startsClassFilters.length > 0 || startsFavoritesOnly
                  ? "Keine Starter:innen für die aktuelle Auswahl."
                  : "Noch keine Starter:innen vorhanden."}
              </p>
            </CardContent>
          </Card>
        ) : DISCIPLINES.map(discipline => {
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
            teams: "📋 Teams",
            start: "🏁 Startlisten",
            ergebnis: "🏆 Ergebnisse",
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
          {activeSegment === "teams" && renderTeamsSegment()}
          {activeSegment === "start" && renderStartSegment()}
          {activeSegment === "ergebnis" && <ResultsView watchlistTeamIds={watchedTeamIds} teamSearchContext={teams} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
