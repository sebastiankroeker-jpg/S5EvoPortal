"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCompetition } from "@/lib/competition-context";
import { motion, AnimatePresence } from "framer-motion";

type DisciplineCode = "RUN" | "BENCH" | "STOCK" | "ROAD" | "MTB";

interface RankedEntry {
  teamId: string;
  teamName: string;
  participantName: string;
  rawValue: number | null;
  rank: number;
  points: number;
}

interface TeamScore {
  teamId: string;
  teamName: string;
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

function RankBadge({ rank }: { rank: number }) {
  const colors: Record<number, string> = {
    1: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30",
    2: "bg-gray-300/20 text-gray-600 border-gray-400/30",
    3: "bg-orange-400/20 text-orange-700 border-orange-400/30",
  };
  return (
    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border ${colors[rank] || "bg-muted text-muted-foreground border-border"}`}>
      {rank}
    </span>
  );
}

export default function ResultsView() {
  const { active: activeCompetition } = useCompetition();
  const [data, setData] = useState<ResultsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState<string>("all");
  const [expandedClasses, setExpandedClasses] = useState<Record<string, boolean>>({});
  const [detailView, setDetailView] = useState<{ classCode: string; discipline: DisciplineCode } | null>(null);

  useEffect(() => {
    if (!activeCompetition?.id) return;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/results?competitionId=${activeCompetition.id}`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
          // Auto-expand first class
          if (json.results?.length > 0) {
            setExpandedClasses({ [json.results[0].classCode]: true });
          }
        }
      } catch (err) {
        console.error("Failed to load results:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [activeCompetition?.id]);

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

  const filteredResults = selectedClass === "all"
    ? data.results
    : data.results.filter((r) => r.classCode === selectedClass);

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
              {entries.map((e, i) => (
                <div
                  key={`${e.teamId}-${i}`}
                  className="flex items-center gap-3 py-2 px-2 rounded-md hover:bg-muted/50 transition-colors"
                >
                  <RankBadge rank={e.rank} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{e.participantName}</p>
                    <p className="text-xs text-muted-foreground truncate">{e.teamName}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm">{formatValue(e.rawValue, detailView.discipline)}</p>
                    <p className="text-xs text-muted-foreground">{e.points} Pkt</p>
                  </div>
                </div>
              ))}
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
        </div>
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
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-xs text-muted-foreground">
                          <th className="text-left py-2 pr-2">#</th>
                          <th className="text-left py-2">Team</th>
                          {(Object.keys(DISC_SHORT) as DisciplineCode[]).map((d) => (
                            <th key={d} className="text-center py-2 px-1 min-w-[30px]">
                              {DISC_SHORT[d]}
                            </th>
                          ))}
                          <th className="text-right py-2 pl-2 font-bold">Σ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {classResult.teamScores.map((team) => (
                          <tr key={team.teamId} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                            <td className="py-2 pr-2">
                              <RankBadge rank={team.rank} />
                            </td>
                            <td className="py-2 font-medium truncate max-w-[150px]">{team.teamName}</td>
                            {(Object.keys(DISC_SHORT) as DisciplineCode[]).map((d) => (
                              <td key={d} className="text-center py-2 px-1 tabular-nums text-muted-foreground">
                                {team.disciplinePoints[d] || "–"}
                              </td>
                            ))}
                            <td className="text-right py-2 pl-2 font-bold tabular-nums">
                              {team.totalPoints}
                            </td>
                          </tr>
                        ))}
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
