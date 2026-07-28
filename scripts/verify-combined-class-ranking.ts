import assert from "node:assert/strict";

import {
  calculateTeamScores,
  rankDiscipline,
  type DisciplineEntry,
  type DisciplineCode,
} from "../lib/domain/scoring";

function entry(input: Partial<DisciplineEntry> & Pick<DisciplineEntry, "teamId" | "rawValue">): DisciplineEntry {
  return {
    teamName: input.teamId,
    participantName: input.teamId,
    classCode: "herren-gesamt",
    ...input,
  };
}

const combinedRun = rankDiscipline([
  // The legacy source-class places intentionally contradict the merged raw
  // values. Overall ranking must ignore them.
  entry({ teamId: "masters-fast", rawValue: 100, publishedRank: 2, publishedPoints: 1, startNumber: "20" }),
  entry({ teamId: "herren-slow", rawValue: 110, publishedRank: 1, publishedPoints: 5, startNumber: "10" }),
], "RUN", { usePublishedScores: false });

assert.deepEqual(
  combinedRun.map(({ teamId, rank, points }) => ({ teamId, rank, points })),
  [
    { teamId: "masters-fast", rank: 1, points: 2 },
    { teamId: "herren-slow", rank: 2, points: 1 },
  ],
  "combined rankings must be recomputed rather than inherit source-class values",
);

const stockTieBreak = rankDiscipline([
  entry({ teamId: "damen-a", rawValue: 100, tieBreakers: [9, 8, 7], startNumber: "2" }),
  entry({ teamId: "damen-b", rawValue: 100, tieBreakers: [9, 7, 7], startNumber: "1" }),
], "STOCK", { usePublishedScores: false });
assert.deepEqual(stockTieBreak.map(({ teamId, rank }) => ({ teamId, rank })), [
  { teamId: "damen-a", rank: 1 },
  { teamId: "damen-b", rank: 2 },
], "combined stock ranking must apply its tiebreakers");

const empty = () => [] as ReturnType<typeof rankDiscipline>;
const overallScores = calculateTeamScores({
  RUN: combinedRun,
  BENCH: rankDiscipline([
    entry({ teamId: "masters-fast", rawValue: 100, startNumber: "20" }),
    entry({ teamId: "herren-slow", rawValue: 90, startNumber: "10" }),
  ], "BENCH", { usePublishedScores: false }),
  STOCK: empty(),
  ROAD: empty(),
  MTB: empty(),
});
assert.equal(overallScores[0]?.teamId, "masters-fast", "combined total uses recalculated discipline points");
assert.equal(overallScores[0]?.rank, 1);

console.log("Combined-class ranking verification passed.");
