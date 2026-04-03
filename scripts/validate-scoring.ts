/**
 * Regression-Test: Vergleicht berechnete Ergebnisse mit den echten 2024er PDF-Rankings.
 *
 * Usage: DATABASE_URL="..." npx tsx scripts/validate-scoring.ts
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import {
  rankDiscipline,
  calculateTeamScores,
  type DisciplineCode,
  type DisciplineEntry,
} from "../lib/domain/scoring";

const prisma = new PrismaClient();

function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) { result.push(current); current = ""; }
    else current += ch;
  }
  result.push(current);
  return result;
}

function parseCSV(filePath: string): Record<string, string>[] {
  const raw = fs.readFileSync(filePath, "utf-8");
  const lines = raw.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = splitCSVLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = splitCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h.trim()] = (values[i] ?? "").trim()));
    return row;
  });
}

// Class group → code mapping
const CLASS_GROUP_TO_CODE: Record<string, string> = {
  "Schüler A": "SA",
  "Schüler B": "SB",
  "Jugend": "JU",
  "Herren Jungsters (A)": "HA",
  "Herren (B)": "HB",
  "Masters ( C)": "HC",
  "Damen Gruppe A (DA)": "DA",
  "Damen Gruppe B (DB)": "DB",
};

const DISC_NAME_TO_CODE: Record<string, DisciplineCode> = {
  "laufen": "RUN",
  "bankdruecken": "BENCH",
  "stock": "STOCK",
  "rennrad": "ROAD",
  "mountainbike": "MTB",
};

async function main() {
  console.log("🔬 Validating Scoring Engine against 2024 PDF results...\n");

  const dataDir = "/home/ocadmin/.openclaw/workspace/data/archiv-pdfs/processed";

  // ── 1. Load expected results from CSV ─────────────────────────────────
  const teamResultsCSV = parseCSV(path.join(dataDir, "2024-results.csv"));
  const discResultsCSV = parseCSV(path.join(dataDir, "2024-discipline-results.csv"));

  // Build expected: startnr → { classGroup, teamName, platz, disziplin-punkte, gesamt }
  // First, get class per startnr from discipline results
  const startnrClass = new Map<string, string>();
  for (const row of discResultsCSV) {
    if (row.is_combined === "no" && !startnrClass.has(row.startnr)) {
      startnrClass.set(row.startnr, row.class_group);
    }
  }

  // Build expected rankings per class from team results
  // Only use first occurrence per startnr (skip duplicates from combined rankings)
  const expectedByClass = new Map<string, { teamName: string; platz: number; points: Record<string, number>; total: number; startnr: string }[]>();
  const seenStartnr = new Set<string>();

  // Filter non-combined rows
  const nonCombinedResults = teamResultsCSV.filter(r => !r.class || r.class.trim() === "");
  
  for (const row of nonCombinedResults) {
    // Skip duplicate startnr entries (combined/gesamt rankings)
    if (seenStartnr.has(row.startnr)) continue;
    seenStartnr.add(row.startnr);

    const classGroup = startnrClass.get(row.startnr);
    if (!classGroup) continue;
    const classCode = CLASS_GROUP_TO_CODE[classGroup];
    if (!classCode) continue;

    if (!expectedByClass.has(classCode)) expectedByClass.set(classCode, []);
    expectedByClass.get(classCode)!.push({
      teamName: row.team_name,
      platz: parseInt(row.platz) || 0,
      points: {
        RUN: parseInt(row.laufen) || 0,
        BENCH: parseInt(row.bankdruecken) || 0,
        STOCK: parseInt(row.stock) || 0,
        ROAD: parseInt(row.rennrad) || 0,
        MTB: parseInt(row.mountainbike) || 0,
      },
      total: parseInt(row.gesamt) || 0,
      startnr: row.startnr,
    });
  }

  // ── 2. Load actual data from DB and compute ───────────────────────────
  const competition = await prisma.competition.findFirst({
    where: { year: 2024 },
  });

  if (!competition) {
    console.error("❌ No 2024 competition found in DB");
    process.exit(1);
  }

  const teams = await prisma.team.findMany({
    where: { competitionId: competition.id, deletedAt: null },
    include: {
      participants: {
        where: { deletedAt: null },
        include: {
          results: {
            include: { discipline: { select: { code: true } } },
          },
        },
      },
    },
  });

  // Group by classification code
  const teamsByClass = new Map<string, typeof teams>();
  for (const team of teams) {
    const code = team.classificationCode || "unknown";
    if (!teamsByClass.has(code)) teamsByClass.set(code, []);
    teamsByClass.get(code)!.push(team);
  }

  // ── 3. Compare per class ──────────────────────────────────────────────
  let totalChecks = 0;
  let passed = 0;
  let failed = 0;
  const failures: string[] = [];

  for (const [classCode, expected] of expectedByClass) {
    const classTeams = teamsByClass.get(classCode) || [];
    if (classTeams.length === 0) {
      console.log(`⚠️  ${classCode}: No teams in DB (expected ${expected.length})`);
      continue;
    }

    // Build discipline entries from DB
    const entries: Record<DisciplineCode, DisciplineEntry[]> = {
      RUN: [], BENCH: [], STOCK: [], ROAD: [], MTB: [],
    };

    for (const team of classTeams) {
      for (const participant of team.participants) {
        for (const result of participant.results) {
          const disc = result.discipline.code as DisciplineCode;
          if (!entries[disc]) continue;
          entries[disc].push({
            teamId: team.id,
            teamName: team.name,
            participantName: `${participant.firstName} ${participant.lastName}`,
            rawValue: result.rawValue,
            classCode,
          });
        }
      }
    }

    // Rank
    const ranked: Record<DisciplineCode, ReturnType<typeof rankDiscipline>> = {
      RUN: rankDiscipline(entries.RUN, "RUN"),
      BENCH: rankDiscipline(entries.BENCH, "BENCH"),
      STOCK: rankDiscipline(entries.STOCK, "STOCK"),
      ROAD: rankDiscipline(entries.ROAD, "ROAD"),
      MTB: rankDiscipline(entries.MTB, "MTB"),
    };

    const scores = calculateTeamScores(ranked);

    // Match by team name (fuzzy — CSV names are truncated)
    for (const exp of expected) {
      const actual = scores.find((s) =>
        s.teamName.startsWith(exp.teamName.substring(0, 20)) ||
        exp.teamName.startsWith(s.teamName.substring(0, 20))
      );

      if (!actual) {
        failures.push(`${classCode}: Team "${exp.teamName}" not found in computed results`);
        failed++;
        totalChecks++;
        continue;
      }

      // Compare total points
      totalChecks++;
      if (actual.totalPoints === exp.total) {
        passed++;
      } else {
        failed++;
        const discDetail = (["RUN", "BENCH", "STOCK", "ROAD", "MTB"] as DisciplineCode[])
          .map((d) => `${d}: got=${actual.disciplinePoints[d]} exp=${exp.points[d]}`)
          .join(", ");
        failures.push(
          `${classCode}: "${exp.teamName}" total: got=${actual.totalPoints} exp=${exp.total} | ${discDetail}`
        );
      }
    }
  }

  // ── 4. Report ─────────────────────────────────────────────────────────
  console.log(`\n${"=".repeat(60)}`);
  console.log(`SCORING VALIDATION REPORT`);
  console.log(`${"=".repeat(60)}`);
  console.log(`Total checks: ${totalChecks}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success rate: ${totalChecks > 0 ? ((passed / totalChecks) * 100).toFixed(1) : 0}%`);

  if (failures.length > 0) {
    console.log(`\n--- Failures ---`);
    for (const f of failures) {
      console.log(`  ❌ ${f}`);
    }
  }

  console.log(`\n${failed === 0 ? "🎉 ALL CHECKS PASSED!" : "⚠️  Some checks failed — investigate above."}`);

  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main();
