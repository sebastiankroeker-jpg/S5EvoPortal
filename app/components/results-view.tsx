"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { RefreshCw, SlidersHorizontal, Star, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCompetition } from "@/lib/competition-context";
import { CLASSIFICATION_DISPLAY_ORDER, compareClassificationCodes } from "@/lib/domain/classification";
import { DISCIPLINES } from "@/lib/domain/team";
import { usePermissions } from "@/lib/permissions-context";
import { formatOfflineCacheTimestamp, readOfflineCache, writeOfflineCache } from "@/lib/pwa-offline-cache";
import { DisciplineBrandIcon } from "./discipline-brand";
import {
  DashboardControlsCard,
  DashboardPanel,
  DashboardSearchField,
  DashboardToolbar,
  DashboardToolbarButton,
} from "./dashboard-controls";

type DisciplineCode = "RUN" | "BENCH" | "STOCK" | "ROAD" | "MTB";
type DisciplineFilter = DisciplineCode | "all";
type ResultTab = "overall" | "discipline";
type ResultClassFilter = string;

interface RankedEntry {
  teamId: string;
  teamName: string;
  startNumber?: string | null;
  participantName: string;
  rawValue: number | null;
  rawValueText?: string | null;
  classCode: string;
  rank: number;
  points: number;
}

interface TeamScore {
  teamId: string;
  teamName: string;
  startNumber?: string | null;
  classCode: string;
  disciplinePoints: Record<DisciplineCode, number>;
  totalPoints: number;
  rank: number;
}

interface ClassResult {
  classCode: string;
  className: string;
  classType: string;
  teamScores: TeamScore[];
  disciplineRankings: Record<DisciplineCode, RankedEntry[]>;
}

interface ResultsData {
  competition: { id: string; name: string; year: number; status: string };
  results: ClassResult[];
  totalTeams: number;
  totalClasses: number;
}

interface ResultsViewProps {
  watchlistTeamIds?: string[];
  teamSearchContext?: ResultsTeamSearchContext[];
}

interface ResultsTeamSearchContext {
  id: string;
  name?: string | null;
  startNumber?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  participants?: Array<{
    firstName?: string | null;
    lastName?: string | null;
  }>;
}

const DISCIPLINE_CODES: DisciplineCode[] = ["RUN", "BENCH", "STOCK", "ROAD", "MTB"];

const DISC_LABELS: Record<DisciplineCode, string> = {
  RUN: "Laufen",
  BENCH: "Bank",
  STOCK: "Stock",
  ROAD: "Rennrad",
  MTB: "MTB",
};

const SOURCE_CLASS_ORDER = new Map<string, number>(
  CLASSIFICATION_DISPLAY_ORDER.map((code, index) => [code, index]),
);

function formatValue(val: number | null, disc: DisciplineCode): string {
  if (val === null || val === -999) return "-";
  if (disc === "RUN" || disc === "ROAD" || disc === "MTB") {
    const mins = Math.floor(val / 60);
    const secs = val % 60;
    return mins > 0 ? `${mins}:${secs.toFixed(2).padStart(5, "0")}` : secs.toFixed(2);
  }
  if (disc === "BENCH") return `${val.toFixed(1)} kg`;
  if (disc === "STOCK") return `${val}`;
  return String(val);
}

function StartNumberCell({ startNumber, showHash = true }: { startNumber?: string | null; showHash?: boolean }) {
  return (
    <span className="font-mono text-xs font-semibold text-muted-foreground tabular-nums">
      {startNumber ? `${showHash ? "#" : ""}${startNumber}` : "-"}
    </span>
  );
}

function VerticalHeader({ children }: { children: string }) {
  return (
    <span className="inline-flex h-24 items-center justify-center text-[11px] leading-none [writing-mode:vertical-rl] rotate-180">
      {children}
    </span>
  );
}

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase();
}

function resultClassLabel(result: ClassResult) {
  return result.className || result.classCode;
}

function compareResultClassCodes(left: string, right: string) {
  const leftOrder = SOURCE_CLASS_ORDER.get(left);
  const rightOrder = SOURCE_CLASS_ORDER.get(right);
  if (leftOrder !== undefined && rightOrder !== undefined && leftOrder !== rightOrder) return leftOrder - rightOrder;
  if (leftOrder !== undefined && rightOrder === undefined) return -1;
  if (leftOrder === undefined && rightOrder !== undefined) return 1;
  return compareClassificationCodes(left, right);
}

function getDisciplineLabel(disciplineCode: DisciplineCode) {
  return DISCIPLINES.find((discipline) => discipline.id === disciplineCode)?.label ?? DISC_LABELS[disciplineCode];
}

function entryMatchesSearch(entry: Pick<RankedEntry, "teamName" | "participantName" | "startNumber">, query: string) {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) return true;

  return [entry.teamName, entry.participantName, entry.startNumber]
    .some((value) => value?.toLowerCase().includes(normalizedQuery));
}

function teamContextMatchesSearch(team: ResultsTeamSearchContext | undefined, query: string, includeManager: boolean) {
  const normalizedQuery = normalizeSearchValue(query);
  if (!team || !normalizedQuery) return false;

  const searchable = [
    team.name,
    team.startNumber,
    ...(includeManager ? [team.contactName, team.contactEmail] : []),
    ...(team.participants ?? []).flatMap((participant) => [
      participant.firstName,
      participant.lastName,
      `${participant.firstName ?? ""} ${participant.lastName ?? ""}`,
      `${participant.lastName ?? ""} ${participant.firstName ?? ""}`,
    ]),
  ];

  return searchable.some((value) => value?.toLowerCase().includes(normalizedQuery));
}

function teamScoreMatchesSearch(
  team: TeamScore,
  result: ClassResult,
  query: string,
  teamSearchContext: Map<string, ResultsTeamSearchContext>,
  includeManager: boolean,
) {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) return true;

  if ([team.teamName, team.startNumber].some((value) => value?.toLowerCase().includes(normalizedQuery))) {
    return true;
  }
  if (teamContextMatchesSearch(teamSearchContext.get(team.teamId), normalizedQuery, includeManager)) {
    return true;
  }

  return DISCIPLINE_CODES.some((discipline) =>
    (result.disciplineRankings[discipline] ?? []).some((entry) =>
      entry.teamId === team.teamId && entryMatchesSearch(entry, normalizedQuery),
    ),
  );
}

function filterResultRows(result: ClassResult, options: {
  query: string;
  favoritesOnly: boolean;
  watchlistTeamIdSet: Set<string>;
  teamSearchContext: Map<string, ResultsTeamSearchContext>;
  includeManager: boolean;
}): ClassResult {
  const teamScores = result.teamScores.filter((team) =>
    teamScoreMatchesSearch(team, result, options.query, options.teamSearchContext, options.includeManager) &&
    (!options.favoritesOnly || options.watchlistTeamIdSet.has(team.teamId)),
  );
  const visibleTeamIds = new Set(teamScores.map((team) => team.teamId));
  const normalizedQuery = normalizeSearchValue(options.query);
  const disciplineRankings = Object.fromEntries(
    DISCIPLINE_CODES.map((discipline) => [
      discipline,
      (result.disciplineRankings[discipline] ?? []).filter((entry) => {
        if (!visibleTeamIds.has(entry.teamId)) return false;
        if (options.favoritesOnly && !options.watchlistTeamIdSet.has(entry.teamId)) return false;
        if (!normalizedQuery) return true;
        return entryMatchesSearch(entry, normalizedQuery) ||
          teamContextMatchesSearch(options.teamSearchContext.get(entry.teamId), normalizedQuery, options.includeManager) ||
          entry.teamName.toLowerCase().includes(normalizedQuery) ||
          (entry.startNumber ?? "").toLowerCase().includes(normalizedQuery);
      }),
    ]),
  ) as Record<DisciplineCode, RankedEntry[]>;

  return {
    ...result,
    teamScores,
    disciplineRankings,
  };
}

export default function ResultsView({ watchlistTeamIds = [], teamSearchContext = [] }: ResultsViewProps) {
  const { active: activeCompetition } = useCompetition();
  const { activeRole } = usePermissions();
  const [data, setData] = useState<ResultsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cacheState, setCacheState] = useState<{ storedAt: string | null; fallback: boolean } | null>(null);
  const [activeTab, setActiveTab] = useState<ResultTab>("overall");
  const [searchQuery, setSearchQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedClassFilters, setSelectedClassFilters] = useState<ResultClassFilter[]>([]);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [selectedDiscipline, setSelectedDiscipline] = useState<DisciplineFilter>("all");
  const [showStagingTestData, setShowStagingTestData] = useState(false);
  const canUseStagingTestMode = activeRole === "ADMIN";
  const cacheKey = useMemo(
    () => activeCompetition?.id ? `s5evo.offline.results.v1.${activeCompetition.id}.${showStagingTestData ? "staging-test" : "official"}` : null,
    [activeCompetition?.id, showStagingTestData],
  );

  const applyResultsData = useCallback((json: ResultsData) => {
    setData(json);
  }, []);

  const loadResults = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (!activeCompetition?.id || !cacheKey) return;
    if (mode === "initial") setLoading(true);
    if (mode === "refresh") setRefreshing(true);

    try {
      const params = new URLSearchParams({ competitionId: activeCompetition.id });
      if (canUseStagingTestMode && showStagingTestData) params.set("includeStagingTest", "true");
      const res = await fetch(`/api/results?${params.toString()}`);
      const json = await res.json().catch(() => null) as ResultsData | { error?: string } | null;
      if (!res.ok || !json || !("results" in json)) {
        throw new Error((json as { error?: string } | null)?.error || "Ergebnisse konnten nicht geladen werden.");
      }

      applyResultsData(json);
      const stored = writeOfflineCache(cacheKey, json);
      setCacheState({ storedAt: stored?.storedAt ?? new Date().toISOString(), fallback: false });
    } catch (err) {
      console.error("Failed to load results:", err);
      const cached = readOfflineCache<ResultsData>(cacheKey);
      if (cached) {
        applyResultsData(cached.data);
        setCacheState({ storedAt: cached.storedAt, fallback: true });
      }
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setLoading(false);
    setRefreshing(false);
  }, [activeCompetition?.id, applyResultsData, cacheKey, canUseStagingTestMode, showStagingTestData]);

  useEffect(() => {
    void loadResults("initial");
  }, [loadResults]);

  const watchlistTeamIdSet = useMemo(() => new Set(watchlistTeamIds), [watchlistTeamIds]);
  const teamSearchContextById = useMemo(
    () => new Map(teamSearchContext.map((team) => [team.id, team])),
    [teamSearchContext],
  );
  const canSearchTeamManagers = activeRole === "ADMIN";
  const availableResults = useMemo(
    () => [...(data?.results ?? [])].sort((left, right) => compareResultClassCodes(left.classCode, right.classCode)),
    [data?.results],
  );
  const selectedResults = useMemo(
    () => availableResults
      .filter((result) => selectedClassFilters.length === 0 || selectedClassFilters.includes(result.classCode))
      .map((result) => filterResultRows(result, {
        query: searchQuery,
        favoritesOnly,
        watchlistTeamIdSet,
        teamSearchContext: teamSearchContextById,
        includeManager: canSearchTeamManagers,
      }))
      .filter((result) => result.teamScores.length > 0 || DISCIPLINE_CODES.some((discipline) => result.disciplineRankings[discipline].length > 0)),
    [availableResults, canSearchTeamManagers, favoritesOnly, searchQuery, selectedClassFilters, teamSearchContextById, watchlistTeamIdSet],
  );
  const favoriteCountByClass = useMemo(() => {
    return Object.fromEntries(
      availableResults.map((result) => [
        result.classCode,
        result.teamScores.filter((team) => watchlistTeamIdSet.has(team.teamId)).length,
      ]),
    ) as Record<string, number>;
  }, [availableResults, watchlistTeamIdSet]);

  const visibleResultTeamCount = useMemo(
    () => selectedResults.reduce((sum, result) => sum + result.teamScores.length, 0),
    [selectedResults],
  );
  const totalResultTeamCount = useMemo(
    () => availableResults.reduce((sum, result) => sum + result.teamScores.length, 0),
    [availableResults],
  );
  const activeFilterCount = selectedClassFilters.length + (favoritesOnly ? 1 : 0) + (activeTab === "discipline" && selectedDiscipline !== "all" ? 1 : 0);
  const hasResettableState = Boolean(searchQuery.trim()) || activeFilterCount > 0;

  const toggleClassFilter = (classCode: ResultClassFilter) => {
    setSelectedClassFilters((current) =>
      current.includes(classCode)
        ? current.filter((code) => code !== classCode)
        : [...current, classCode],
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!data || data.results.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <span className="text-4xl">📊</span>
          <p className="mt-4 text-muted-foreground">
            Noch keine Ergebnisse für diesen Wettkampf vorhanden.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-md border border-border/60 bg-card px-3 py-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Live-Ergebnisse</h2>
          <p className="text-xs text-muted-foreground">
            {data.totalTeams} Teams · {visibleResultTeamCount} von {totalResultTeamCount} Ergebniszeilen
          </p>
          <p className={`mt-1 text-xs ${cacheState?.fallback ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"}`}>
            {cacheState?.fallback ? "Lokaler Stand" : "Datenstand"}: {formatOfflineCacheTimestamp(cacheState?.storedAt)}
          </p>
          {showStagingTestData && (
            <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">
              Admin-Testmodus: gestagte Produktionstest-Daten
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          {canUseStagingTestMode && (
            <Button
              type="button"
              variant={showStagingTestData ? "secondary" : "outline"}
              size="sm"
              onClick={() => setShowStagingTestData((value) => !value)}
            >
              {showStagingTestData ? "Testdaten sichtbar" : "Staging-Testdaten"}
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => void loadResults("refresh")} disabled={refreshing}>
            <RefreshCw className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Aktualisiere..." : "Aktualisieren"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 rounded-lg bg-muted/50 p-1">
        {[
          { id: "overall" as const, label: "Gesamtergebnisse" },
          { id: "discipline" as const, label: "Einzelergebnisse" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`h-9 rounded-md px-2 text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-background text-primary shadow-sm"
                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

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
              label="Ergebnis-Filter"
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
                setSelectedClassFilters([]);
                setFavoritesOnly(false);
                setSelectedDiscipline("all");
              }}
            />
          </DashboardToolbar>
        </div>
        <div className="text-xs text-muted-foreground">
          {visibleResultTeamCount} von {totalResultTeamCount} Ergebniszeilen
        </div>
        {filtersOpen && (
          <DashboardPanel className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">Klassen</p>
                <Button size="xs" variant={selectedClassFilters.length === 0 ? "default" : "outline"} onClick={() => setSelectedClassFilters([])}>
                  Alle Klassen
                </Button>
              </div>
              <div className="flex min-w-0 flex-wrap gap-1.5">
                {availableResults.map((result) => {
                  const selected = selectedClassFilters.includes(result.classCode);
                  const favoriteCount = favoriteCountByClass[result.classCode] ?? 0;

                  return (
                    <Button
                      key={result.classCode}
                      type="button"
                      variant={selected ? "default" : "outline"}
                      size="xs"
                      onClick={() => toggleClassFilter(result.classCode)}
                      aria-pressed={selected}
                    >
                      <span>{resultClassLabel(result)}</span>
                      <Badge variant={selected ? "secondary" : "outline"} className="h-5 px-1.5 text-[10px]">
                        {result.teamScores.length}
                      </Badge>
                      {favoriteCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                          <Star className="size-3 fill-current" />
                          {favoriteCount}
                        </span>
                      )}
                    </Button>
                  );
                })}
                <Button
                  type="button"
                  variant={favoritesOnly ? "default" : "outline"}
                  size="xs"
                  onClick={() => setFavoritesOnly((value) => !value)}
                  aria-pressed={favoritesOnly}
                >
                  <Star className={favoritesOnly ? "fill-current" : ""} />
                  Nur Favoriten ({watchlistTeamIds.length})
                </Button>
              </div>
            </div>
            {activeTab === "discipline" && (
              <div className="space-y-2 border-t border-border/50 pt-3">
                <p className="text-xs font-medium text-muted-foreground">Disziplinen</p>
                <div className="flex min-w-0 flex-wrap gap-1.5">
                  <Button
                    type="button"
                    variant={selectedDiscipline === "all" ? "default" : "outline"}
                    size="xs"
                    onClick={() => setSelectedDiscipline("all")}
                    aria-pressed={selectedDiscipline === "all"}
                  >
                    Alle Disziplinen
                  </Button>
                  {DISCIPLINE_CODES.map((discipline) => (
                    <Button
                      key={discipline}
                      type="button"
                      variant={selectedDiscipline === discipline ? "default" : "outline"}
                      size="xs"
                      onClick={() => setSelectedDiscipline(discipline)}
                      aria-pressed={selectedDiscipline === discipline}
                    >
                      <DisciplineBrandIcon code={discipline} label={getDisciplineLabel(discipline)} className="size-5 rounded" />
                      <span>{getDisciplineLabel(discipline)}</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </DashboardPanel>
        )}
      </DashboardControlsCard>

      {selectedResults.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Keine Ergebnisse für die aktuelle Auswahl.
          </CardContent>
        </Card>
      ) : activeTab === "overall" ? (
        <OverallResultsTables results={selectedResults} watchlistTeamIdSet={watchlistTeamIdSet} />
      ) : (
        <DisciplineResultsTables
          results={selectedResults}
          selectedDiscipline={selectedDiscipline}
          watchlistTeamIdSet={watchlistTeamIdSet}
        />
      )}
    </div>
  );
}

function OverallResultsTables({
  results,
  watchlistTeamIdSet,
}: {
  results: ClassResult[];
  watchlistTeamIdSet: Set<string>;
}) {
  return (
    <div className="space-y-4">
      {results.map((classResult) => (
        <motion.div
          key={classResult.classCode}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
        >
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="flex items-center gap-2 text-base">
                {classResult.className}
                <Badge variant="secondary" className="text-xs">
                  {classResult.teamScores.length} Teams
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="w-16 py-2 pr-2 text-left align-bottom">Platz</th>
                      <th className="w-20 px-2 py-2 text-left align-bottom">STRNR</th>
                      <th className="py-2 text-left align-bottom">Team</th>
                      {DISCIPLINE_CODES.map((discipline) => (
                        <th key={discipline} className="min-w-[48px] px-1 py-2 text-center align-bottom">
                          <VerticalHeader>{DISC_LABELS[discipline].replace(/^\S+\s+/, "")}</VerticalHeader>
                        </th>
                      ))}
                      <th className="w-16 py-2 pl-2 text-right align-bottom font-bold">
                        <VerticalHeader>Gesamt</VerticalHeader>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {classResult.teamScores.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-6 text-center text-sm text-muted-foreground">
                          Noch keine Gesamtergebnisse für diese Klasse.
                        </td>
                      </tr>
                    )}
                    {classResult.teamScores.map((team) => {
                      const watched = watchlistTeamIdSet.has(team.teamId);

                      return (
                        <tr key={team.teamId} className="border-b border-border/30 transition-colors hover:bg-muted/30">
                          <td className="py-2 pr-2 font-semibold tabular-nums">{team.rank}</td>
                          <td className="px-2 py-2">
                            <StartNumberCell startNumber={team.startNumber} showHash={false} />
                          </td>
                          <td className="max-w-[180px] truncate py-2 font-medium">
                            <span className="inline-flex min-w-0 items-center gap-1.5">
                              {watched && <Star className="size-3.5 shrink-0 fill-current text-primary" aria-label="Favorit" />}
                              <span className="truncate">{team.teamName}</span>
                            </span>
                          </td>
                          {DISCIPLINE_CODES.map((discipline) => (
                            <td key={discipline} className="px-1 py-2 text-center text-muted-foreground tabular-nums">
                              {team.disciplinePoints[discipline] || "-"}
                            </td>
                          ))}
                          <td className="py-2 pl-2 text-right font-bold tabular-nums">{team.totalPoints}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

function DisciplineResultsTables({
  results,
  selectedDiscipline,
  watchlistTeamIdSet,
}: {
  results: ClassResult[];
  selectedDiscipline: DisciplineFilter;
  watchlistTeamIdSet: Set<string>;
}) {
  const visibleDisciplines = selectedDiscipline === "all" ? DISCIPLINE_CODES : [selectedDiscipline];

  return (
    <div className="space-y-4">
      {results.flatMap((classResult) =>
        visibleDisciplines.map((discipline) => {
          const entries = classResult.disciplineRankings[discipline] ?? [];
          const disciplineLabel = getDisciplineLabel(discipline);

          return (
          <motion.div
            key={`${classResult.classCode}-${discipline}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
          >
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <DisciplineBrandIcon code={discipline} label={disciplineLabel} className="size-6 rounded" />
                  {disciplineLabel} - {classResult.className}
                  <Badge variant="secondary" className="text-xs">
                    {entries.length} Starter:innen
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {entries.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Keine Einzelergebnisse für diese Auswahl.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] table-fixed text-sm">
                      <thead>
                        <tr className="border-b text-xs text-muted-foreground">
                          <th className="w-12 py-2 pr-2 text-left">Platz</th>
                          <th className="w-16 px-2 py-2 text-left">STRNR</th>
                          <th className="w-[32%] px-2 py-2 text-left">Name</th>
                          <th className="px-2 py-2 text-left">Mannschaft</th>
                          <th className="w-24 py-2 pl-2 text-right">Wert</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((entry, index) => {
                          const watched = watchlistTeamIdSet.has(entry.teamId);

                          return (
                            <tr
                              key={`${entry.teamId}-${discipline}-${index}`}
                              className="border-b border-border/30 transition-colors hover:bg-muted/30"
                            >
                              <td className="py-2 pr-2 font-semibold tabular-nums">
                                {entry.rank}
                              </td>
                              <td className="px-2 py-2">
                                <StartNumberCell startNumber={entry.startNumber} showHash={false} />
                              </td>
                              <td className="truncate px-2 py-2 font-medium">{entry.participantName}</td>
                              <td className="truncate px-2 py-2 text-muted-foreground">
                                <span className="inline-flex min-w-0 items-center gap-1.5">
                                  {watched && <Star className="size-3.5 shrink-0 fill-current text-primary" aria-label="Favorit" />}
                                  <span className="truncate">{entry.teamName}</span>
                                </span>
                              </td>
                              <td className="py-2 pl-2 text-right font-mono tabular-nums">
                                {entry.rawValueText || formatValue(entry.rawValue, discipline)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
          );
        }),
      )}
    </div>
  );
}
