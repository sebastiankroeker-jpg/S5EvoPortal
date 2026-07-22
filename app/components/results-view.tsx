"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCompetition } from "@/lib/competition-context";
import { usePermissions } from "@/lib/permissions-context";
import { formatOfflineCacheTimestamp, readOfflineCache, writeOfflineCache } from "@/lib/pwa-offline-cache";
import { motion, AnimatePresence } from "framer-motion";
import { Star } from "lucide-react";

type DisciplineCode = "RUN" | "BENCH" | "STOCK" | "ROAD" | "MTB";

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

function formatValue(val: number | null, disc: DisciplineCode): string {
  if (val === null || val === -999) return "–";
  if (disc === "RUN" || disc === "ROAD" || disc === "MTB") {
    // Seconds → mm:ss.xx
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
    1: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30",
    2: "bg-gray-300/20 text-gray-600 border-gray-400/30",
    3: "bg-orange-400/20 text-orange-700 border-orange-400/30",
  };
  return (
    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border ${colors[rank] || "bg-muted text-muted-foreground border-border"}`}>
      {showHash ? `#${rank}` : rank}
    </span>
  );
}

function StartNumberCell({ startNumber, showHash = true }: { startNumber?: string | null; showHash?: boolean }) {
  return (
    <span className="font-mono text-xs font-semibold text-muted-foreground tabular-nums">
      {startNumber ? `${showHash ? "#" : ""}${startNumber}` : "–"}
    </span>
  );
}

function VerticalHeader({ children }: { children: string }) {
  return (
    <span className="inline-flex h-24 items-center justify-center [writing-mode:vertical-rl] rotate-180 text-[11px] leading-none">
      {children}
    </span>
  );
}

interface ResultsViewProps {
  watchlistTeamIds?: string[];
}

export default function ResultsView({ watchlistTeamIds = [] }: ResultsViewProps) {
  const { active: activeCompetition } = useCompetition();
  const { activeRole } = usePermissions();
  const [data, setData] = useState<ResultsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cacheState, setCacheState] = useState<{ storedAt: string | null; fallback: boolean } | null>(null);
  const [selectedClass, setSelectedClass] = useState<string>("all");
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const [expandedClasses, setExpandedClasses] = useState<Record<string, boolean>>({});
  const [detailView, setDetailView] = useState<{ classCode: string; discipline: DisciplineCode } | null>(null);
  const [showStagingTestData, setShowStagingTestData] = useState(false);
  const canUseStagingTestMode = activeRole === "ADMIN";
  const cacheKey = useMemo(
    () => activeCompetition?.id ? `s5evo.offline.results.v1.${activeCompetition.id}.${showStagingTestData ? "staging-test" : "official"}` : null,
    [activeCompetition?.id, showStagingTestData],
  );

  const applyResultsData = useCallback((json: ResultsData) => {
    setData(json);
    if (json.results?.length > 0) {
      setExpandedClasses((current) => Object.keys(current).length > 0 ? current : { [json.results[0].classCode]: true });
    }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
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

  const watchlistTeamIdSet = new Set(watchlistTeamIds);
  const canFilterWatchlist = watchlistTeamIds.length > 0;
  const classFilteredResults = selectedClass === "all"
    ? data.results
    : data.results.filter((r) => r.classCode === selectedClass);
  const filteredResults = watchlistOnly && canFilterWatchlist
    ? classFilteredResults
        .map((classResult) => ({
          ...classResult,
          teamScores: classResult.teamScores.filter((team) => watchlistTeamIdSet.has(team.teamId)),
          disciplineRankings: (Object.fromEntries(
            (Object.entries(classResult.disciplineRankings) as Array<[DisciplineCode, RankedEntry[]]>)
              .map(([discipline, entries]) => [
                discipline,
                entries.filter((entry) => watchlistTeamIdSet.has(entry.teamId)),
              ]),
          ) as Record<DisciplineCode, RankedEntry[]>),
        }))
        .filter((classResult) => classResult.teamScores.length > 0)
    : classFilteredResults;

  const toggleClass = (code: string) => {
    setExpandedClasses((prev) => ({ ...prev, [code]: !prev[code] }));
  };

  // Detail view: discipline ranking for a class
  if (detailView) {
    const classResult = data.results.find((r) => r.classCode === detailView.classCode);
    const entries = classResult?.disciplineRankings[detailView.discipline] || [];
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        <Button variant="ghost" onClick={() => setDetailView(null)} className="text-sm">
          ← Zurück zur Übersicht
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {DISC_LABELS[detailView.discipline]} — {classResult?.className}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="py-2 pr-3 text-left"># Platz</th>
                      <th className="px-3 py-2 text-left">Start Nr</th>
                      <th className="px-3 py-2 text-left">Name</th>
                      <th className="px-3 py-2 text-left">Mannschaft</th>
                      <th className="px-3 py-2 text-left">Klasse</th>
                      <th className="py-2 pl-3 text-right">Zeit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e, i) => (
                      <tr
                        key={`${e.teamId}-${i}`}
                        className="border-b border-border/30 hover:bg-muted/30 transition-colors"
                      >
                        <td className="py-2 pr-3">
                          <RankBadge rank={e.rank} showHash />
                        </td>
                        <td className="px-3 py-2">
                          <StartNumberCell startNumber={e.startNumber} showHash={false} />
                        </td>
                        <td className="px-3 py-2 font-medium">{e.participantName}</td>
                        <td className="px-3 py-2 text-muted-foreground">{e.teamName}</td>
                        <td className="px-3 py-2 text-muted-foreground">{classResult?.className ?? e.classCode}</td>
                        <td className="py-2 pl-3 text-right font-mono tabular-nums">
                          {e.rawValueText || formatValue(e.rawValue, detailView.discipline)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">🏆 Ergebnisse</h2>
          <p className="text-xs text-muted-foreground">
            {data.totalTeams} Teams · {data.totalClasses} Klassen
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
        <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
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
          {canFilterWatchlist && (
            <Button
              type="button"
              variant={watchlistOnly ? "secondary" : "outline"}
              size="sm"
              onClick={() => setWatchlistOnly((value) => !value)}
            >
              <Star className={watchlistOnly ? "fill-current" : ""} />
              {watchlistOnly ? "Watchlist aktiv" : "Nur Watchlist"}
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => void loadResults("refresh")} disabled={refreshing}>
            {refreshing ? "Aktualisiere..." : "Daten aktualisieren"}
          </Button>
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Alle Klassen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Klassen</SelectItem>
              {data.results.map((r) => (
                <SelectItem key={r.classCode} value={r.classCode}>
                  {r.className} ({r.teamScores.length})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {watchlistOnly && filteredResults.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <Star className="mx-auto mb-3 size-8 fill-current text-muted-foreground" />
            <p className="font-medium">Keine Watchlist-Ergebnisse gefunden.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Fuer deine gemerkten Teams sind in der aktuellen Ergebnisliste noch keine Daten sichtbar.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Class Results */}
      <AnimatePresence mode="popLayout">
        {filteredResults.map((classResult) => (
          <motion.div
            key={classResult.classCode}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <Card>
              <CardHeader
                className="cursor-pointer py-3"
                onClick={() => toggleClass(classResult.classCode)}
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    {classResult.className}
                    <Badge variant="secondary" className="text-xs">
                      {classResult.teamScores.length} Teams
                    </Badge>
                  </CardTitle>
                  <span className="text-muted-foreground text-sm">
                    {expandedClasses[classResult.classCode] ? "▲" : "▼"}
                  </span>
                </div>
              </CardHeader>

              {expandedClasses[classResult.classCode] && (
                <CardContent className="pt-0">
                  {/* Discipline quick-links */}
                  <div className="flex gap-1 mb-3 flex-wrap">
                    {(Object.keys(DISC_LABELS) as DisciplineCode[]).map((disc) => (
                      <button
                        key={disc}
                        onClick={() => setDetailView({ classCode: classResult.classCode, discipline: disc })}
                        className="text-xs px-2 py-1 rounded-md bg-muted hover:bg-accent transition-colors"
                      >
                        {DISC_LABELS[disc]}
                      </button>
                    ))}
                  </div>

                  {/* Team Rankings Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-sm">
                      <thead>
                        <tr className="border-b text-xs text-muted-foreground">
                          <th className="w-16 py-2 pr-2 text-left align-bottom">Platz</th>
                          <th className="w-20 px-2 py-2 text-left align-bottom">STRNR</th>
                          <th className="py-2 text-left align-bottom">Team</th>
                          {(Object.keys(DISC_SHORT) as DisciplineCode[]).map((d) => (
                            <th key={d} className="min-w-[48px] px-1 py-2 text-center align-bottom">
                              <VerticalHeader>{DISC_LABELS[d].replace(/^\S+\s+/, "")}</VerticalHeader>
                            </th>
                          ))}
                          <th className="w-16 py-2 pl-2 text-right align-bottom font-bold">
                            <VerticalHeader>Gesamt</VerticalHeader>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {classResult.teamScores.map((team) => {
                          const watched = watchlistTeamIdSet.has(team.teamId);

                          return (
                          <tr key={team.teamId} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                            <td className="py-2 pr-2 font-semibold tabular-nums">
                              {team.rank}
                            </td>
                            <td className="px-2 py-2">
                              <StartNumberCell startNumber={team.startNumber} showHash={false} />
                            </td>
                            <td className="py-2 font-medium truncate max-w-[150px]">
                              <span className="inline-flex min-w-0 items-center gap-1.5">
                                {watched && <Star className="size-3.5 shrink-0 fill-current text-primary" aria-label="Watchlist-Team" />}
                                <span className="truncate">{team.teamName}</span>
                              </span>
                            </td>
                            {(Object.keys(DISC_SHORT) as DisciplineCode[]).map((d) => (
                              <td key={d} className="text-center py-2 px-1 tabular-nums text-muted-foreground">
                                {team.disciplinePoints[d] || "–"}
                              </td>
                            ))}
                            <td className="text-right py-2 pl-2 font-bold tabular-nums">
                              {team.totalPoints}
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              )}
            </Card>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
