"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { RefreshCw, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCompetition } from "@/lib/competition-context";
import { calculateTeamScores, rankDiscipline } from "@/lib/domain/scoring";
import { usePermissions } from "@/lib/permissions-context";
import { formatOfflineCacheTimestamp, readOfflineCache, writeOfflineCache } from "@/lib/pwa-offline-cache";

type DisciplineCode = "RUN" | "BENCH" | "STOCK" | "ROAD" | "MTB";
type ResultTab = "overall" | "discipline";
type OverallGroupCode = "damen-gesamt" | "herren-gesamt";

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

interface OverallGroup {
  code: OverallGroupCode;
  label: string;
  sourceClassCodes: string[];
}

interface ResultsViewProps {
  watchlistTeamIds?: string[];
}

const DISCIPLINE_CODES: DisciplineCode[] = ["RUN", "BENCH", "STOCK", "ROAD", "MTB"];

const DISC_LABELS: Record<DisciplineCode, string> = {
  RUN: "🏃 Laufen",
  BENCH: "🏋️ Bank",
  STOCK: "🎯 Stock",
  ROAD: "🚴 Rennrad",
  MTB: "🚵 MTB",
};

const DISC_SHORT: Record<DisciplineCode, string> = {
  RUN: "L",
  BENCH: "B",
  STOCK: "S",
  ROAD: "R",
  MTB: "M",
};

const OVERALL_GROUPS: OverallGroup[] = [
  { code: "damen-gesamt", label: "Damen Gesamt", sourceClassCodes: ["damen-a", "damen-b"] },
  { code: "herren-gesamt", label: "Herren Gesamt", sourceClassCodes: ["jungsters", "herren", "masters"] },
];

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

function RankBadge({ rank, showHash = false }: { rank: number; showHash?: boolean }) {
  const colors: Record<number, string> = {
    1: "border-yellow-500/30 bg-yellow-500/20 text-yellow-700",
    2: "border-gray-400/30 bg-gray-300/20 text-gray-600",
    3: "border-orange-400/30 bg-orange-400/20 text-orange-700",
  };
  return (
    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold ${colors[rank] || "border-border bg-muted text-muted-foreground"}`}>
      {showHash ? `#${rank}` : rank}
    </span>
  );
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

function buildOverallResults(results: ClassResult[]): ClassResult[] {
  return OVERALL_GROUPS.map((group) => {
    const sourceResults = results.filter((result) => group.sourceClassCodes.includes(result.classCode));
    const disciplineEntries = Object.fromEntries(
      DISCIPLINE_CODES.map((discipline) => [
        discipline,
        sourceResults.flatMap((sourceResult) =>
          (sourceResult.disciplineRankings[discipline] ?? []).map((entry) => ({
            ...entry,
            classCode: group.code,
          })),
        ),
      ]),
    ) as Record<DisciplineCode, RankedEntry[]>;

    const disciplineRankings = Object.fromEntries(
      DISCIPLINE_CODES.map((discipline) => [
        discipline,
        rankDiscipline(disciplineEntries[discipline], discipline),
      ]),
    ) as Record<DisciplineCode, RankedEntry[]>;

    const teamScores = calculateTeamScores(disciplineRankings).map((team) => ({
      ...team,
      classCode: group.code,
    }));

    return {
      classCode: group.code,
      className: group.label,
      classType: "COMBINED",
      teamScores,
      disciplineRankings,
    };
  });
}

export default function ResultsView({ watchlistTeamIds = [] }: ResultsViewProps) {
  const { active: activeCompetition } = useCompetition();
  const { activeRole } = usePermissions();
  const [data, setData] = useState<ResultsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cacheState, setCacheState] = useState<{ storedAt: string | null; fallback: boolean } | null>(null);
  const [activeTab, setActiveTab] = useState<ResultTab>("overall");
  const [selectedOverallGroups, setSelectedOverallGroups] = useState<OverallGroupCode[]>(["damen-gesamt", "herren-gesamt"]);
  const [selectedDiscipline, setSelectedDiscipline] = useState<DisciplineCode>("RUN");
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
  const overallResults = useMemo(() => buildOverallResults(data?.results ?? []), [data?.results]);
  const selectedResults = useMemo(
    () => overallResults.filter((result) => selectedOverallGroups.includes(result.classCode as OverallGroupCode)),
    [overallResults, selectedOverallGroups],
  );
  const favoriteCountByGroup = useMemo(() => {
    return Object.fromEntries(
      overallResults.map((result) => [
        result.classCode,
        result.teamScores.filter((team) => watchlistTeamIdSet.has(team.teamId)).length,
      ]),
    ) as Record<string, number>;
  }, [overallResults, watchlistTeamIdSet]);

  const toggleOverallGroup = (groupCode: OverallGroupCode) => {
    setSelectedOverallGroups((current) =>
      current.includes(groupCode)
        ? current.filter((code) => code !== groupCode)
        : [...current, groupCode],
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
            {data.totalTeams} Teams · Damen Gesamt & Herren Gesamt
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

      <div className="flex flex-wrap gap-2">
        {OVERALL_GROUPS.map((group) => {
          const selected = selectedOverallGroups.includes(group.code);
          const favoriteCount = favoriteCountByGroup[group.code] ?? 0;
          const result = overallResults.find((entry) => entry.classCode === group.code);

          return (
            <Button
              key={group.code}
              type="button"
              variant={selected ? "secondary" : "outline"}
              size="sm"
              onClick={() => toggleOverallGroup(group.code)}
              aria-pressed={selected}
              disabled={!result}
              className="gap-2"
            >
              <span>{group.label}</span>
              <Badge variant={selected ? "default" : "secondary"} className="h-5 px-1.5 text-[10px]">
                {result?.teamScores.length ?? 0}
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
      </div>

      {selectedResults.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Wähle mindestens eine Gesamtklasse aus.
          </CardContent>
        </Card>
      ) : activeTab === "overall" ? (
        <OverallResultsTables results={selectedResults} watchlistTeamIdSet={watchlistTeamIdSet} />
      ) : (
        <DisciplineResultsTables
          results={selectedResults}
          selectedDiscipline={selectedDiscipline}
          onSelectDiscipline={setSelectedDiscipline}
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
  onSelectDiscipline,
  watchlistTeamIdSet,
}: {
  results: ClassResult[];
  selectedDiscipline: DisciplineCode;
  onSelectDiscipline: (discipline: DisciplineCode) => void;
  watchlistTeamIdSet: Set<string>;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {DISCIPLINE_CODES.map((discipline) => (
          <Button
            key={discipline}
            type="button"
            variant={selectedDiscipline === discipline ? "secondary" : "outline"}
            size="sm"
            onClick={() => onSelectDiscipline(discipline)}
          >
            <span className="font-mono text-xs">{DISC_SHORT[discipline]}</span>
            {DISC_LABELS[discipline]}
          </Button>
        ))}
      </div>

      {results.map((classResult) => {
        const entries = classResult.disciplineRankings[selectedDiscipline] ?? [];

        return (
          <motion.div
            key={`${classResult.classCode}-${selectedDiscipline}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
          >
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  {DISC_LABELS[selectedDiscipline]} - {classResult.className}
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
                    <table className="w-full min-w-[680px] text-sm">
                      <thead>
                        <tr className="border-b text-xs text-muted-foreground">
                          <th className="py-2 pr-3 text-left">Platz</th>
                          <th className="px-3 py-2 text-left">STRNR</th>
                          <th className="px-3 py-2 text-left">Name</th>
                          <th className="px-3 py-2 text-left">Mannschaft</th>
                          <th className="py-2 pl-3 text-right">Wert</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((entry, index) => {
                          const watched = watchlistTeamIdSet.has(entry.teamId);

                          return (
                            <tr
                              key={`${entry.teamId}-${selectedDiscipline}-${index}`}
                              className="border-b border-border/30 transition-colors hover:bg-muted/30"
                            >
                              <td className="py-2 pr-3">
                                <RankBadge rank={entry.rank} showHash />
                              </td>
                              <td className="px-3 py-2">
                                <StartNumberCell startNumber={entry.startNumber} showHash={false} />
                              </td>
                              <td className="px-3 py-2 font-medium">{entry.participantName}</td>
                              <td className="px-3 py-2 text-muted-foreground">
                                <span className="inline-flex min-w-0 items-center gap-1.5">
                                  {watched && <Star className="size-3.5 shrink-0 fill-current text-primary" aria-label="Favorit" />}
                                  <span className="truncate">{entry.teamName}</span>
                                </span>
                              </td>
                              <td className="py-2 pl-3 text-right font-mono tabular-nums">
                                {entry.rawValueText || formatValue(entry.rawValue, selectedDiscipline)}
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
      })}
    </div>
  );
}
