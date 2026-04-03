/**
 * Scoring Engine v1 — Mannschaftsfünfkampf
 *
 * Regeln:
 * - Pro Disziplin + Klasse wird ein Ranking erstellt
 * - Punkte = Anzahl_Teams_in_Klasse - Platz + 1
 *   (Platz 1 = höchste Punkte, letzter Platz = 1 Punkt)
 * - Bei geteiltem Platz: gleiche Punkte, nächster Platz wird übersprungen
 *   z.B. bei 12 Teams: 2× Platz 3 → beide 10 Punkte, nächster ist Platz 5 (8 Punkte)
 * - Gesamt = Summe der 5 Disziplin-Punkte
 * - Gesamtranking: höchste Punktzahl = Platz 1
 *
 * Sortierung pro Disziplin:
 * - Laufen (RUN): ASC (niedrigere Zeit = besser)
 * - Bankdrücken (BENCH): DESC (höheres Gewicht = besser), -999 = nicht angetreten
 * - Stockschießen (STOCK): DESC (mehr Ringe = besser)
 * - Rennrad (ROAD): ASC (niedrigere Zeit = besser)
 * - Mountainbike (MTB): ASC (niedrigere Zeit = besser)
 */

export type DisciplineCode = "RUN" | "BENCH" | "STOCK" | "ROAD" | "MTB";

export type SortDirection = "ASC" | "DESC";

export const DISCIPLINE_SORT: Record<DisciplineCode, SortDirection> = {
  RUN: "ASC",
  BENCH: "DESC",
  STOCK: "DESC",
  ROAD: "ASC",
  MTB: "ASC",
};

export interface DisciplineEntry {
  teamId: string;
  teamName: string;
  participantName: string;
  rawValue: number | null; // null = nicht angetreten
  classCode: string;
}

export interface RankedEntry extends DisciplineEntry {
  rank: number;
  points: number;
}

export interface TeamScore {
  teamId: string;
  teamName: string;
  classCode: string;
  disciplinePoints: Record<DisciplineCode, number>;
  totalPoints: number;
  rank: number;
}

/**
 * Rank entries within a discipline + class.
 * Returns entries with rank and points assigned.
 */
export function rankDiscipline(
  entries: DisciplineEntry[],
  discipline: DisciplineCode
): RankedEntry[] {
  const sort = DISCIPLINE_SORT[discipline];
  const n = entries.length;

  // Sort: null/DNF values go last
  const sorted = [...entries].sort((a, b) => {
    // null = DNF → last
    if (a.rawValue === null && b.rawValue === null) return 0;
    if (a.rawValue === null) return 1;
    if (b.rawValue === null) return -1;
    // -999 for BENCH = DNF
    if (discipline === "BENCH") {
      if (a.rawValue === -999 && b.rawValue === -999) return 0;
      if (a.rawValue === -999) return 1;
      if (b.rawValue === -999) return -1;
    }
    return sort === "ASC"
      ? a.rawValue - b.rawValue
      : b.rawValue - a.rawValue;
  });

  // Assign ranks with ties
  const ranked: RankedEntry[] = [];
  let currentRank = 1;

  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];

    // If same value as previous → same rank
    if (i > 0 && entry.rawValue !== null && sorted[i - 1].rawValue === entry.rawValue) {
      ranked.push({
        ...entry,
        rank: ranked[i - 1].rank,
        points: ranked[i - 1].points,
      });
    } else {
      const points = entry.rawValue === null || (discipline === "BENCH" && entry.rawValue === -999)
        ? 0 // DNF gets 0 points
        : n - currentRank + 1;
      ranked.push({
        ...entry,
        rank: currentRank,
        points,
      });
    }
    currentRank = i + 2; // Next rank skips tied positions
  }

  return ranked;
}

/**
 * Calculate team scores for a class.
 * Takes ranked results per discipline and computes totals + overall ranking.
 */
export function calculateTeamScores(
  rankedByDiscipline: Record<DisciplineCode, RankedEntry[]>
): TeamScore[] {
  // Collect all unique teams
  const teamMap = new Map<string, TeamScore>();

  for (const [disc, entries] of Object.entries(rankedByDiscipline) as [DisciplineCode, RankedEntry[]][]) {
    for (const entry of entries) {
      if (!teamMap.has(entry.teamId)) {
        teamMap.set(entry.teamId, {
          teamId: entry.teamId,
          teamName: entry.teamName,
          classCode: entry.classCode,
          disciplinePoints: { RUN: 0, BENCH: 0, STOCK: 0, ROAD: 0, MTB: 0 },
          totalPoints: 0,
          rank: 0,
        });
      }
      teamMap.get(entry.teamId)!.disciplinePoints[disc] = entry.points;
    }
  }

  // Calculate totals
  const scores = Array.from(teamMap.values());
  for (const score of scores) {
    score.totalPoints = Object.values(score.disciplinePoints).reduce((a, b) => a + b, 0);
  }

  // Rank by total points (DESC)
  scores.sort((a, b) => b.totalPoints - a.totalPoints);

  // Assign ranks with ties
  for (let i = 0; i < scores.length; i++) {
    if (i > 0 && scores[i].totalPoints === scores[i - 1].totalPoints) {
      scores[i].rank = scores[i - 1].rank;
    } else {
      scores[i].rank = i + 1;
    }
  }

  return scores;
}
