"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Info, Printer, RefreshCw, SlidersHorizontal, Star, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCompetition } from "@/lib/competition-context";
import { CLASSIFICATIONS, CLASSIFICATION_DISPLAY_ORDER, compareClassificationCodes } from "@/lib/domain/classification";
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
  participantId?: string | null;
  participantName: string;
  rawValue: number | null;
  rawValueText?: string | null;
  stockBwz?: string | null;
  stockDropped?: number | null;
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
  hasAnyResult?: boolean;
}

interface ClassResult {
  classCode: string;
  className: string;
  classType: string;
  teamScores: TeamScore[];
  disciplineRankings: Record<DisciplineCode, RankedEntry[]>;
}

interface ResultsData {
  competition: { id: string; name: string; year: number; status: string; liveResultsDisciplines?: DisciplineCode[] };
  results: ClassResult[];
  totalTeams: number;
  totalClasses: number;
}

interface ResultsViewProps {
  watchlistTeamIds?: string[];
  teamSearchContext?: ResultsTeamSearchContext[];
  focusRequest?: ResultsFocusRequest | null;
  onFocusTeam?: (teamId: string) => void;
  onResultTargetMissing?: (request: ResultsFocusRequest) => void;
}

export type ResultsFocusRequest = {
  id: number;
  teamId: string;
  participantId?: string | null;
  discipline?: DisciplineCode;
  classCode?: string | null;
  view?: ResultTab;
};

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
const DEFAULT_LIVE_RESULT_DISCIPLINES: DisciplineCode[] = ["RUN", "BENCH", "STOCK"];

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

function formatDurationMs(ms: number): string {
  const totalCentiseconds = Math.round(ms / 10);
  const centiseconds = totalCentiseconds % 100;
  const totalSeconds = Math.floor(totalCentiseconds / 100);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  const centisecondText = String(centiseconds).padStart(2, "0");
  const secondText = String(seconds).padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${secondText}.${centisecondText}`;
  }

  return `${totalMinutes}:${secondText}.${centisecondText}`;
}

function formatValue(val: number | null, disc: DisciplineCode): string {
  if (val === null || val === -999) return "-";
  if (disc === "RUN" || disc === "ROAD" || disc === "MTB") {
    return formatDurationMs(val);
  }
  if (disc === "BENCH") return `${val.toFixed(1)} kg`;
  if (disc === "STOCK") return `${val}`;
  return String(val);
}

function StockTieBreakerLine({ entry, align = "right" }: { entry: RankedEntry; align?: "left" | "right" }) {
  if (!entry.stockBwz && entry.stockDropped === null && entry.stockDropped === undefined) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          className={`mt-1 inline-flex max-w-full items-center gap-1 text-[11px] leading-tight text-muted-foreground underline decoration-dotted underline-offset-2 ${
            align === "right" ? "justify-end" : "justify-start"
          }`}
          aria-label="Stock-Bewertungsdetails anzeigen"
        >
          <span className="truncate">
            {entry.stockBwz ? `BWZ ${entry.stockBwz}` : null}
            {entry.stockBwz && entry.stockDropped !== null && entry.stockDropped !== undefined ? " · " : null}
            {entry.stockDropped !== null && entry.stockDropped !== undefined ? `Streicher ${entry.stockDropped}` : null}
          </span>
          <Info className="size-3 shrink-0" aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent side="left" align="end" className="max-w-72 text-left">
          Bewertungszahl und Streichergebnis entscheiden beim Stockschießen über die Reihenfolge, wenn die Ringsumme gleich ist.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function StartNumberCell({ startNumber, showHash = true }: { startNumber?: string | null; showHash?: boolean }) {
  return (
    <span className="font-mono text-xs font-semibold text-muted-foreground tabular-nums">
      {startNumber ? `${showHash ? "#" : ""}${startNumber}` : "-"}
    </span>
  );
}

function StickyTabLabel({ children }: { children: string }) {
  return (
    <span className="pointer-events-none inline-flex shrink-0 items-center justify-center px-1 text-xs font-semibold text-primary sm:text-sm">
      {children}
    </span>
  );
}

function VerticalHeader({ children }: { children: string }) {
  return (
    <span className="absolute bottom-1 left-1 inline-flex items-start justify-start text-left text-[10px] leading-none [writing-mode:vertical-rl] rotate-180">
      {children}
    </span>
  );
}

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase();
}

function resultClassLabel(result: ClassResult) {
  return CLASSIFICATIONS[result.classCode]?.label ?? result.className ?? result.classCode;
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

function getOverallDisciplineHeader(disciplineCode: DisciplineCode) {
  return disciplineCode === "BENCH" ? "Bank" : getDisciplineLabel(disciplineCode);
}

function normalizeVisibleDisciplines(value: unknown): DisciplineCode[] {
  if (!Array.isArray(value)) return DEFAULT_LIVE_RESULT_DISCIPLINES;
  const selected = value.filter((item): item is DisciplineCode => DISCIPLINE_CODES.includes(item as DisciplineCode));
  return selected.length > 0 ? [...new Set(selected)] : [];
}

function getResultEntryElementId(input: {
  classCode: string;
  discipline: DisciplineCode;
  teamId: string;
  participantId?: string | null;
}) {
  const stableParticipantId = input.participantId?.trim();
  return [
    "live-result",
    input.classCode,
    input.discipline,
    input.teamId,
    stableParticipantId || "participant",
  ].join("-");
}

function getOverallTeamElementId(input: {
  classCode: string;
  teamId: string;
}) {
  return ["live-overall", input.classCode, input.teamId].join("-");
}

function formatPrintTimestamp() {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());
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

export default function ResultsView({
  watchlistTeamIds = [],
  teamSearchContext = [],
  focusRequest = null,
  onFocusTeam,
  onResultTargetMissing,
}: ResultsViewProps) {
  const { active: activeCompetition } = useCompetition();
  const { activeRole, isLoading: permissionsLoading } = usePermissions();
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
  const [focusedResultElementId, setFocusedResultElementId] = useState<string | null>(null);
  const pendingFocusElementIdRef = useRef<string | null>(null);
  const focusRequestIdRef = useRef(0);
  const handledExternalFocusRequestIdRef = useRef<number | null>(null);
  const canUseStagingTestMode = activeRole === "ADMIN";
  const cacheKey = useMemo(
    () => activeCompetition?.id ? `s5evo.offline.results.v1.${activeCompetition.id}.${showStagingTestData ? "staging-test" : "official"}` : null,
    [activeCompetition?.id, showStagingTestData],
  );

  const applyResultsData = useCallback((json: ResultsData) => {
    setData(json);
  }, []);

  const loadResults = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (permissionsLoading) return;
    if (!activeCompetition?.id || !cacheKey) return;
    if (mode === "initial") setLoading(true);
    if (mode === "refresh") setRefreshing(true);

    try {
      const params = new URLSearchParams({ competitionId: activeCompetition.id });
      if (canUseStagingTestMode && showStagingTestData) params.set("includeStagingTest", "true");
      const res = await fetch(`/api/results?${params.toString()}`, { cache: "no-store" });
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
  }, [activeCompetition?.id, applyResultsData, cacheKey, canUseStagingTestMode, permissionsLoading, showStagingTestData]);

  useEffect(() => {
    void loadResults("initial");
  }, [loadResults]);

  const watchlistTeamIdSet = useMemo(() => new Set(watchlistTeamIds), [watchlistTeamIds]);
  const teamSearchContextById = useMemo(
    () => new Map(teamSearchContext.map((team) => [team.id, team])),
    [teamSearchContext],
  );
  const canSearchTeamManagers = activeRole === "ADMIN";
  const activeDisciplineCodes = useMemo(
    () => normalizeVisibleDisciplines(data?.competition.liveResultsDisciplines),
    [data?.competition.liveResultsDisciplines],
  );
  useEffect(() => {
    if (selectedDiscipline !== "all" && !activeDisciplineCodes.includes(selectedDiscipline)) {
      setSelectedDiscipline("all");
    }
  }, [activeDisciplineCodes, selectedDiscipline]);
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
      .filter((result) => result.teamScores.length > 0 || activeDisciplineCodes.some((discipline) => result.disciplineRankings[discipline].length > 0)),
    [activeDisciplineCodes, availableResults, canSearchTeamManagers, favoritesOnly, searchQuery, selectedClassFilters, teamSearchContextById, watchlistTeamIdSet],
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
  const canPrintResults = activeRole === "ADMIN";
  const selectedClassLabels = selectedClassFilters
    .map((classCode) => resultClassLabel(availableResults.find((result) => result.classCode === classCode) ?? {
      classCode,
      className: classCode,
      classType: "",
      teamScores: [],
      disciplineRankings: { RUN: [], BENCH: [], STOCK: [], ROAD: [], MTB: [] },
    }))
    .join(", ");
  const selectedDisciplineLabel = selectedDiscipline === "all" ? "Alle" : getDisciplineLabel(selectedDiscipline);

  const toggleClassFilter = (classCode: ResultClassFilter) => {
    setSelectedClassFilters((current) =>
      current.includes(classCode)
        ? current.filter((code) => code !== classCode)
        : [...current, classCode],
    );
  };

  const focusElement = useCallback((elementId: string) => {
    pendingFocusElementIdRef.current = elementId;
    const requestId = focusRequestIdRef.current + 1;
    focusRequestIdRef.current = requestId;
    const startedAt = window.performance.now();

    const scroll = () => {
      if (pendingFocusElementIdRef.current !== elementId || focusRequestIdRef.current !== requestId) return;

      const element = document.getElementById(elementId);
      const elapsed = window.performance.now() - startedAt;

      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        if (element instanceof HTMLElement) {
          element.focus({ preventScroll: true });
        }

        if (elapsed >= 900) {
          if (focusRequestIdRef.current === requestId) {
            pendingFocusElementIdRef.current = null;
          }
          return;
        }

        window.setTimeout(scroll, 120);
        return;
      }

      if (elapsed < 1400) {
        window.setTimeout(scroll, 80);
      }
    };

    window.requestAnimationFrame(() => {
      scroll();
    });
  }, []);

  const findResultEntryTarget = useCallback((request: ResultsFocusRequest) => {
    if (!request.discipline) return null;

    const candidateResults = availableResults.filter((result) =>
      !request.classCode || result.classCode === request.classCode,
    );

    for (const result of candidateResults) {
      const entries = result.disciplineRankings[request.discipline] ?? [];
      const entry = entries.find((candidate) => {
        if (request.participantId) return candidate.participantId === request.participantId;
        return candidate.teamId === request.teamId;
      });

      if (entry) {
        return { result, entry };
      }
    }

    return null;
  }, [availableResults]);

  const focusResultEntry = useCallback((request: ResultsFocusRequest) => {
    if (!request.discipline) return false;

    const target = findResultEntryTarget(request);
    if (!target) return false;

    const elementId = getResultEntryElementId({
      classCode: target.result.classCode,
      discipline: request.discipline,
      teamId: target.entry.teamId,
      participantId: target.entry.participantId,
    });

    setActiveTab("discipline");
    setSelectedDiscipline(request.discipline);
    setFocusedResultElementId(elementId);
    setSearchQuery("");
    setSelectedClassFilters((current) =>
      current.length > 0 && !current.includes(target.result.classCode) ? [] : current,
    );
    setFavoritesOnly((current) =>
      current && !watchlistTeamIdSet.has(target.entry.teamId) ? false : current,
    );
    focusElement(elementId);
    return true;
  }, [findResultEntryTarget, focusElement, watchlistTeamIdSet]);

  const focusOverallTeam = useCallback((request: ResultsFocusRequest) => {
    const result = availableResults.find((candidate) =>
      (!request.classCode || candidate.classCode === request.classCode) &&
      candidate.teamScores.some((team) => team.teamId === request.teamId),
    );
    if (!result) return false;

    const elementId = getOverallTeamElementId({
      classCode: result.classCode,
      teamId: request.teamId,
    });

    setActiveTab("overall");
    setFocusedResultElementId(elementId);
    setSearchQuery("");
    setSelectedClassFilters((current) =>
      current.length > 0 && !current.includes(result.classCode) ? [] : current,
    );
    setFavoritesOnly((current) =>
      current && !watchlistTeamIdSet.has(request.teamId) ? false : current,
    );
    focusElement(elementId);
    return true;
  }, [availableResults, focusElement, watchlistTeamIdSet]);

  useEffect(() => {
    if (!focusRequest || handledExternalFocusRequestIdRef.current === focusRequest.id) return;
    if (!data) return;

    handledExternalFocusRequestIdRef.current = focusRequest.id;
    const handled = focusRequest.view === "overall"
      ? focusOverallTeam(focusRequest)
      : focusResultEntry(focusRequest);
    if (!handled) {
      onResultTargetMissing?.(focusRequest);
    }
  }, [data, focusOverallTeam, focusRequest, focusResultEntry, onResultTargetMissing]);

  useEffect(() => {
    const elementId = pendingFocusElementIdRef.current;
    if (!elementId) return;

    focusElement(elementId);
  }, [activeTab, focusElement, focusedResultElementId, selectedClassFilters, selectedDiscipline]);

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
          {canPrintResults && (
            <Button type="button" variant="outline" size="sm" onClick={() => window.print()} disabled={selectedResults.length === 0}>
              <Printer className="size-4" />
              Auswahl drucken
            </Button>
          )}
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
          { id: "discipline" as const, label: "Einzelergebnisse" },
          { id: "overall" as const, label: "Gesamtergebnisse" },
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
              showLabel
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
                  {activeDisciplineCodes.map((discipline) => (
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
            <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setFiltersOpen(false)}>
              Filter Ausblenden
            </Button>
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
        <OverallResultsTables
          results={selectedResults}
          visibleDisciplines={activeDisciplineCodes}
          watchlistTeamIdSet={watchlistTeamIdSet}
          focusedResultElementId={focusedResultElementId}
          onFocusTeam={onFocusTeam}
          onFocusResultEntry={focusResultEntry}
        />
      ) : (
        <DisciplineResultsTables
          results={selectedResults}
          visibleDisciplines={activeDisciplineCodes}
          selectedDiscipline={selectedDiscipline}
          watchlistTeamIdSet={watchlistTeamIdSet}
          focusedResultElementId={focusedResultElementId}
          onFocusTeam={onFocusTeam}
          onFocusOverallTeam={focusOverallTeam}
        />
      )}
      <div className="print-only live-print-sheet">
        <div className="live-print-header">
          <h1>{activeTab === "overall" ? "Gesamtergebnisse" : "Einzelergebnisse"}</h1>
          <p>
            {data.competition.name} {data.competition.year} · {visibleResultTeamCount} Ergebniszeilen · Druck: {formatPrintTimestamp()}
          </p>
          <p>
            Klassen: {selectedClassLabels || "Alle"} · Disziplinen: {activeTab === "discipline" ? selectedDisciplineLabel : "Alle"}
            {searchQuery.trim() ? ` · Suche: ${searchQuery.trim()}` : ""}
            {favoritesOnly ? " · Nur Favoriten" : ""}
            {showStagingTestData ? " · Staging-Testdaten" : ""}
          </p>
        </div>
        {activeTab === "overall" ? (
          selectedResults.map((classResult) => (
            <section key={classResult.classCode}>
              <h2>{resultClassLabel(classResult)}</h2>
              <table>
                <thead>
                  <tr>
                    <th>Platz</th>
                    <th>Strnr</th>
                    <th>Mannschaft</th>
                    {activeDisciplineCodes.map((discipline) => (
                      <th key={discipline}>{getOverallDisciplineHeader(discipline)}</th>
                    ))}
                    <th>Gesamt</th>
                  </tr>
                </thead>
                <tbody>
                  {classResult.teamScores.map((team) => (
                    <tr key={team.teamId}>
                      <td>{team.hasAnyResult === false ? "" : team.rank}</td>
                      <td>{team.startNumber || ""}</td>
                      <td>{team.teamName}</td>
                      {activeDisciplineCodes.map((discipline) => (
                        <td key={discipline}>{team.hasAnyResult === false ? "" : team.disciplinePoints[discipline]}</td>
                      ))}
                      <td>{team.hasAnyResult === false ? "" : team.totalPoints}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))
        ) : (
          selectedResults.flatMap((classResult) => {
            const visibleDisciplines = selectedDiscipline === "all" ? activeDisciplineCodes : [selectedDiscipline];
            return visibleDisciplines.map((discipline) => {
              const entries = classResult.disciplineRankings[discipline] ?? [];
              if (entries.length === 0) return null;

              return (
                <section key={`${classResult.classCode}-${discipline}`}>
                  <h2>{getDisciplineLabel(discipline)} - {resultClassLabel(classResult)}</h2>
                  <table>
                    <thead>
                      <tr>
                        <th>Platz</th>
                        <th>Strnr</th>
                        <th>Teilnehmer</th>
                        <th>Mannschaft</th>
                        <th>Wert</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry, index) => (
                        <tr key={`${entry.teamId}-${discipline}-${index}`}>
                          <td>{entry.rank}</td>
                          <td>{entry.startNumber || ""}</td>
                          <td>{entry.participantName}</td>
                          <td>{entry.teamName}</td>
                          <td>{entry.rawValueText || formatValue(entry.rawValue, discipline)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              );
            });
          })
        )}
      </div>
    </div>
  );
}

function OverallResultsTables({
  results,
  visibleDisciplines,
  watchlistTeamIdSet,
  focusedResultElementId,
  onFocusTeam,
  onFocusResultEntry,
}: {
  results: ClassResult[];
  visibleDisciplines: DisciplineCode[];
  watchlistTeamIdSet: Set<string>;
  focusedResultElementId: string | null;
  onFocusTeam?: (teamId: string) => void;
  onFocusResultEntry: (request: ResultsFocusRequest) => boolean;
}) {
  return (
    <div className="space-y-4">
      {results.map((classResult) => (
        <OverallResultTable
          key={classResult.classCode}
          classResult={classResult}
          visibleDisciplines={visibleDisciplines}
          watchlistTeamIdSet={watchlistTeamIdSet}
          focusedResultElementId={focusedResultElementId}
          onFocusTeam={onFocusTeam}
          onFocusResultEntry={onFocusResultEntry}
        />
      ))}
    </div>
  );
}

function getOverallResultColumns(visibleDisciplines: DisciplineCode[]) {
  return `2.75rem 3.25rem minmax(11rem,1fr) repeat(${visibleDisciplines.length},2.65rem) 3rem`;
}
const disciplineResultColumns = "2.5rem 3.25rem minmax(9rem,1.1fr) minmax(8rem,0.9fr) 6.75rem";

function OverallResultColGroup({ visibleDisciplines }: { visibleDisciplines: DisciplineCode[] }) {
  return (
    <colgroup>
      <col style={{ width: "2.75rem" }} />
      <col style={{ width: "3.25rem" }} />
      <col />
      {visibleDisciplines.map((discipline) => (
        <col key={discipline} style={{ width: "2.65rem" }} />
      ))}
      <col style={{ width: "3rem" }} />
    </colgroup>
  );
}

function OverallResultTable({
  classResult,
  visibleDisciplines,
  watchlistTeamIdSet,
  focusedResultElementId,
  onFocusTeam,
  onFocusResultEntry,
}: {
  classResult: ClassResult;
  visibleDisciplines: DisciplineCode[];
  watchlistTeamIdSet: Set<string>;
  focusedResultElementId: string | null;
  onFocusTeam?: (teamId: string) => void;
  onFocusResultEntry: (request: ResultsFocusRequest) => boolean;
}) {
  const headerScrollRef = useRef<HTMLDivElement | null>(null);
  const bodyScrollRef = useRef<HTMLDivElement | null>(null);
  const scrollSyncSourceRef = useRef<"header" | "body" | null>(null);

  const syncHorizontalScroll = useCallback((source: "header" | "body") => {
    if (scrollSyncSourceRef.current !== null && scrollSyncSourceRef.current !== source) return;
    const sourceElement = source === "header" ? headerScrollRef.current : bodyScrollRef.current;
    const targetElement = source === "header" ? bodyScrollRef.current : headerScrollRef.current;
    if (!sourceElement || !targetElement) return;

    scrollSyncSourceRef.current = source;
    targetElement.scrollLeft = sourceElement.scrollLeft;
    window.requestAnimationFrame(() => {
      scrollSyncSourceRef.current = null;
    });
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
    >
      <Card className="gap-0 overflow-visible py-0">
        <div className="sticky top-11 z-40 border-b border-border/60 bg-card/95 backdrop-blur">
          <div
            ref={headerScrollRef}
            className="overflow-x-auto overflow-y-hidden"
            onScroll={() => syncHorizontalScroll("header")}
          >
            <div className="relative min-w-[600px] px-2 py-1.5 text-xs text-muted-foreground sm:px-3" style={{ display: "grid", gridTemplateColumns: getOverallResultColumns(visibleDisciplines) }}>
              <div className="col-span-3 row-start-1 mb-1 flex min-w-0 items-center gap-2 pr-2 text-sm font-semibold text-foreground">
                <span className="truncate">{resultClassLabel(classResult)}</span>
                <Badge variant="secondary" className="shrink-0 text-xs">
                  {classResult.teamScores.length} Teams
                </Badge>
              </div>
              <div className="pointer-events-none absolute inset-x-0 top-1.5 flex justify-center">
                <StickyTabLabel>Gesamtergebnisse</StickyTabLabel>
              </div>
              <span className="col-start-1 row-start-2">Platz</span>
              <span className="col-start-2 row-start-2">STRNR</span>
              <span className="col-start-3 row-start-2">Team</span>
              {visibleDisciplines.map((discipline) => (
                <span key={discipline} className="relative row-start-2 h-11 px-0.5">
                  <VerticalHeader>{getOverallDisciplineHeader(discipline)}</VerticalHeader>
                </span>
              ))}
              <span className="relative row-start-2 h-11 px-0.5 font-bold">
                <VerticalHeader>Gesamt</VerticalHeader>
              </span>
            </div>
          </div>
        </div>
        <CardContent className="p-0">
          <div
            ref={bodyScrollRef}
            className="overflow-x-auto overflow-y-visible px-2 pb-2 sm:px-3 sm:pb-3"
            onScroll={() => syncHorizontalScroll("body")}
          >
            <table className="w-full min-w-[600px] table-fixed text-sm">
              <OverallResultColGroup visibleDisciplines={visibleDisciplines} />
              <tbody>
                {classResult.teamScores.length === 0 && (
                  <tr>
                    <td colSpan={visibleDisciplines.length + 4} className="py-6 text-center text-sm text-muted-foreground">
                      Noch keine Gesamtergebnisse für diese Klasse.
                    </td>
                  </tr>
                )}
                {classResult.teamScores.map((team) => {
                  const watched = watchlistTeamIdSet.has(team.teamId);
                  const overallElementId = getOverallTeamElementId({
                    classCode: classResult.classCode,
                    teamId: team.teamId,
                  });
                  const isOverallFocused = focusedResultElementId === overallElementId;

                  return (
                    <tr
                      key={team.teamId}
                      id={overallElementId}
                      tabIndex={-1}
                      className={`scroll-mt-24 border-b border-border/30 transition-colors hover:bg-muted/30 focus-visible:outline-none ${
                        isOverallFocused ? "bg-primary/10 ring-2 ring-inset ring-primary/30" : ""
                      }`}
                    >
                      <td className="py-2 pr-1 font-semibold tabular-nums">{team.hasAnyResult === false ? "-" : team.rank}</td>
                      <td className="px-1 py-2">
                        <span className="inline-flex min-w-0 items-center gap-1">
                          <StartNumberCell startNumber={team.startNumber} showHash={false} />
                          {watched && <Star className="size-3.5 shrink-0 fill-current text-primary" aria-label="Favorit" />}
                        </span>
                      </td>
                      <td className="py-2 pr-2 font-medium leading-snug">
                        {onFocusTeam ? (
                          <button
                            type="button"
                            className="min-w-0 whitespace-normal break-words text-left text-primary underline decoration-primary/50 underline-offset-2 hover:decoration-primary"
                            title={`${team.teamName} in Live-Teams fokussieren`}
                            onClick={() => onFocusTeam(team.teamId)}
                          >
                            {team.teamName}
                          </button>
                        ) : (
                          <span className="min-w-0 whitespace-normal break-words">{team.teamName}</span>
                        )}
                      </td>
                      {visibleDisciplines.map((discipline) => {
                        const entry = (classResult.disciplineRankings[discipline] ?? []).find((candidate) => candidate.teamId === team.teamId);
                        const resultElementId = entry
                          ? getResultEntryElementId({
                              classCode: classResult.classCode,
                              discipline,
                              teamId: entry.teamId,
                              participantId: entry.participantId,
                            })
                          : null;
                        const isFocused = resultElementId !== null && focusedResultElementId === resultElementId;
                        const value = team.hasAnyResult === false ? "-" : team.disciplinePoints[discipline];

                        return (
                          <td key={discipline} className="px-0.5 py-2 text-center text-xs text-muted-foreground tabular-nums">
                            {entry ? (
                              <button
                                type="button"
                                className={`inline-flex min-h-7 min-w-7 items-center justify-center rounded border border-primary/25 bg-primary/5 px-1 font-semibold text-primary tabular-nums underline decoration-primary/40 underline-offset-2 transition-colors hover:bg-primary/10 hover:decoration-primary ${
                                  isFocused ? "bg-primary/10 ring-2 ring-primary/30" : ""
                                }`}
                                title={`${entry.participantName} in Einzelergebnissen fokussieren`}
                                onClick={() => {
                                  onFocusResultEntry({
                                    id: Date.now(),
                                    teamId: entry.teamId,
                                    participantId: entry.participantId,
                                    discipline,
                                    classCode: classResult.classCode,
                                  });
                                }}
                              >
                                {value}
                              </button>
                            ) : (
                              value
                            )}
                          </td>
                        );
                      })}
                      <td className="py-2 pl-1 text-right font-bold tabular-nums">
                        {team.hasAnyResult === false ? "-" : team.totalPoints}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function DisciplineResultRankButton({
  entry,
  classCode,
  onFocusOverallTeam,
}: {
  entry: RankedEntry;
  classCode: string;
  onFocusOverallTeam: (request: ResultsFocusRequest) => boolean;
}) {
  return (
    <button
      type="button"
      className="text-primary underline decoration-primary/50 underline-offset-2 hover:decoration-primary"
      title={`${entry.teamName} in Gesamtergebnissen fokussieren`}
      onClick={() => {
        onFocusOverallTeam({
          id: Date.now(),
          teamId: entry.teamId,
          classCode,
          view: "overall",
        });
      }}
    >
      {entry.rank}
    </button>
  );
}

function DisciplineResultTeamName({
  entry,
  onFocusTeam,
  className = "",
}: {
  entry: RankedEntry;
  onFocusTeam?: (teamId: string) => void;
  className?: string;
}) {
  if (onFocusTeam) {
    return (
      <button
        type="button"
        className={`min-w-0 truncate text-left font-medium text-primary underline decoration-primary/50 underline-offset-2 hover:decoration-primary ${className}`}
        title={`${entry.teamName} in Live-Teams fokussieren`}
        onClick={() => onFocusTeam(entry.teamId)}
      >
        {entry.teamName}
      </button>
    );
  }

  return <span className={`truncate ${className}`}>{entry.teamName}</span>;
}

function DisciplineResultValue({ entry, discipline, align = "right" }: {
  entry: RankedEntry;
  discipline: DisciplineCode;
  align?: "left" | "right";
}) {
  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      <div className="font-mono text-base font-semibold leading-none tabular-nums md:text-sm md:font-normal md:leading-normal">
        {entry.rawValueText || formatValue(entry.rawValue, discipline)}
      </div>
      {discipline === "STOCK" && <StockTieBreakerLine entry={entry} align={align} />}
    </div>
  );
}

function DisciplineResultResponsiveRow({
  entry,
  discipline,
  classCode,
  watched,
  resultElementId,
  focusedResultElementId,
  onFocusTeam,
  onFocusOverallTeam,
}: {
  entry: RankedEntry;
  discipline: DisciplineCode;
  classCode: string;
  watched: boolean;
  resultElementId: string;
  focusedResultElementId: string | null;
  onFocusTeam?: (teamId: string) => void;
  onFocusOverallTeam: (request: ResultsFocusRequest) => boolean;
}) {
  return (
    <div
      id={resultElementId}
      tabIndex={-1}
      className={`scroll-mt-24 rounded-md border border-border/50 bg-card px-3 py-2.5 shadow-sm transition-colors hover:bg-muted/30 focus-visible:outline-none md:grid md:rounded-none md:border-x-0 md:border-t-0 md:border-border/30 md:px-0 md:py-0 md:shadow-none ${
        focusedResultElementId === resultElementId ? "bg-primary/10 ring-2 ring-inset ring-primary/30" : ""
      }`}
      style={{ gridTemplateColumns: disciplineResultColumns }}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2 md:contents">
        <div className="pt-0.5 text-sm font-semibold tabular-nums md:py-2 md:pr-1">
          <DisciplineResultRankButton entry={entry} classCode={classCode} onFocusOverallTeam={onFocusOverallTeam} />
        </div>
        <div className="hidden px-1 py-2 md:block">
          <span className="inline-flex min-w-0 items-center gap-1">
            <StartNumberCell startNumber={entry.startNumber} showHash={false} />
            {watched && <Star className="size-3.5 shrink-0 fill-current text-primary" aria-label="Favorit" />}
          </span>
        </div>
        <div className="min-w-0 md:truncate md:px-1.5 md:py-2 md:font-medium">
          <div className="flex min-w-0 items-center gap-1.5 md:block">
            <span className="truncate text-sm font-semibold leading-snug md:font-medium">{entry.participantName}</span>
            {watched && <Star className="size-3.5 shrink-0 fill-current text-primary md:hidden" aria-label="Favorit" />}
          </div>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground md:hidden">
            <StartNumberCell startNumber={entry.startNumber} />
            <span className="min-w-0 max-w-full truncate">
              <DisciplineResultTeamName entry={entry} onFocusTeam={onFocusTeam} />
            </span>
          </div>
        </div>
        <div className="hidden truncate px-1.5 py-2 text-muted-foreground md:block">
          <DisciplineResultTeamName entry={entry} onFocusTeam={onFocusTeam} />
        </div>
        <div className="md:py-2 md:pl-1">
          <DisciplineResultValue entry={entry} discipline={discipline} align="right" />
        </div>
      </div>
    </div>
  );
}

function DisciplineResultsTables({
  results,
  visibleDisciplines,
  selectedDiscipline,
  watchlistTeamIdSet,
  focusedResultElementId,
  onFocusTeam,
  onFocusOverallTeam,
}: {
  results: ClassResult[];
  visibleDisciplines: DisciplineCode[];
  selectedDiscipline: DisciplineFilter;
  watchlistTeamIdSet: Set<string>;
  focusedResultElementId: string | null;
  onFocusTeam?: (teamId: string) => void;
  onFocusOverallTeam: (request: ResultsFocusRequest) => boolean;
}) {
  const selectedDisciplines = selectedDiscipline === "all" ? visibleDisciplines : [selectedDiscipline];

  return (
    <div className="space-y-4">
      {results.flatMap((classResult) =>
        selectedDisciplines.map((discipline) => {
          const entries = classResult.disciplineRankings[discipline] ?? [];
          const disciplineLabel = getDisciplineLabel(discipline);

          return (
            <motion.div
              key={`${classResult.classCode}-${discipline}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
            >
              <Card className="gap-0 overflow-visible py-0">
                <CardHeader className="sticky top-11 z-40 border-b border-border/60 bg-card/95 px-3 py-1.5 backdrop-blur">
                  <CardTitle className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-base md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                    <span className="flex min-w-0 items-center gap-2">
                      <DisciplineBrandIcon code={discipline} label={disciplineLabel} className="size-6 rounded" />
                      <span className="truncate">{disciplineLabel} - {resultClassLabel(classResult)}</span>
                    </span>
                    <span className="hidden md:inline-flex">
                      <StickyTabLabel>Einzelergebnisse</StickyTabLabel>
                    </span>
                    <Badge variant="secondary" className="justify-self-end text-xs">
                      {entries.length} Starter:innen
                    </Badge>
                  </CardTitle>
                  <div
                    className="hidden gap-1 border-t border-border/40 pt-1.5 text-[10px] font-medium uppercase tracking-normal text-muted-foreground md:grid"
                    style={{ gridTemplateColumns: disciplineResultColumns }}
                  >
                    <span>Platz</span>
                    <span>STRNR</span>
                    <span>Name</span>
                    <span>Mannschaft</span>
                    <span className="text-right">Wert</span>
                  </div>
                </CardHeader>
                <CardContent className="p-2 pt-0 sm:p-3 sm:pt-0">
                  {entries.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      Keine Einzelergebnisse für diese Auswahl.
                    </p>
                  ) : (
                    <div className="space-y-2 md:space-y-0">
                      {entries.map((entry, index) => {
                        const watched = watchlistTeamIdSet.has(entry.teamId);
                        const resultElementId = getResultEntryElementId({
                          classCode: classResult.classCode,
                          discipline,
                          teamId: entry.teamId,
                          participantId: entry.participantId,
                        });

                        return (
                          <DisciplineResultResponsiveRow
                            key={`${entry.teamId}-${discipline}-${index}`}
                            entry={entry}
                            discipline={discipline}
                            classCode={classResult.classCode}
                            watched={watched}
                            resultElementId={resultElementId}
                            focusedResultElementId={focusedResultElementId}
                            onFocusTeam={onFocusTeam}
                            onFocusOverallTeam={onFocusOverallTeam}
                          />
                        );
                      })}
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
