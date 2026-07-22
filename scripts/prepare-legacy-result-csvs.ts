import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

import { PrismaClient } from "@prisma/client";

import { rankDiscipline, type DisciplineCode, type DisciplineEntry } from "../lib/domain/scoring";

const prisma = new PrismaClient();

const inboundDir = "/home/ocadmin/.openclaw/media/inbound";
const outputDir = "/home/ocadmin/.openclaw/workspace/exports/legacy-results-portal-startnumbers-2026-07-22";

const files = [
  "5K_Ergebnisse_LAUFEN_Gesamt---9bac4b6b-7b4b-43d5-966f-c68f3f82bfbf.csv",
  "5K_Ergebnisse_RENNRAD_Gesamt---696783db-8822-4229-8a02-166b220b7811.csv",
  "5K_Ergebnisse_MTB_Gesamt---61b1b2aa-f64c-4ffd-ace1-f0097ec1631a.csv",
  "5K_Ergebnisse_BANK_Gesamt---67184a69-621b-4964-88a6-a0cfc49368e3.csv",
  "5K_Ergebnisse_STOCK_Gesamt---4fb7b8e0-69a2-4e21-ba61-5e55650d2eb9.csv",
] as const;

const legacyClassByPortalCode: Record<string, string> = {
  "schueler-a": "1",
  "schueler-b": "2",
  jugend: "3",
  "damen-a": "4",
  "damen-b": "5",
  jungsters: "6",
  herren: "7",
  masters: "8",
};

const overallGroupByLegacyClass: Record<string, "DAMEN" | "HERREN" | null> = {
  "1": null,
  "2": null,
  "3": null,
  "4": "DAMEN",
  "5": "DAMEN",
  "6": "HERREN",
  "7": "HERREN",
  "8": "HERREN",
};

const disciplineByFile: Record<string, DisciplineCode> = {
  LAUFEN: "RUN",
  RENNRAD: "ROAD",
  MTB: "MTB",
};

function parseCsvRows(input: string, delimiter = ";") {
  const text = input.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const ch = text[index];
    const next = text[index + 1];

    if (ch === "\"") {
      if (inQuotes && next === "\"") {
        field += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && ch === delimiter) {
      row.push(field.trim());
      field = "";
      continue;
    }

    if (!inQuotes && ch === "\n") {
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += ch;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    rows.push(row);
  }

  return rows;
}

function serializeCsvRows(rows: string[][], delimiter = ";") {
  return rows
    .map((row) => row.map((field) => {
      if (/[;"\n\r]/.test(field)) return `"${field.replace(/"/g, "\"\"")}"`;
      return field;
    }).join(delimiter))
    .join("\r\n") + "\r\n";
}

function findHeaderRow(rows: string[][]) {
  const index = rows.findIndex((row) => row.includes("Au1Startnr") && row.includes("Au1Klasse"));
  if (index === -1) throw new Error("Legacy CSV header not found.");
  return index;
}

function parseLegacyTimeMs(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || trimmed === "88:88:88.00" || trimmed === "99:99:99.99" || trimmed === "00:00:00.00") return null;
  const match = /^(\d+):(\d{2}):(\d{2})\.(\d{2,3})$/.exec(trimmed);
  if (!match) return null;
  const [, hoursValue, minutesValue, secondsValue, fractionValue] = match;
  const hours = Number.parseInt(hoursValue, 10);
  const minutes = Number.parseInt(minutesValue, 10);
  const seconds = Number.parseInt(secondsValue, 10);
  const fraction = Number.parseInt(fractionValue.padEnd(3, "0").slice(0, 3), 10);
  if (minutes >= 60 || seconds >= 60) return null;
  return ((hours * 60 + minutes) * 60 + seconds) * 1000 + fraction;
}

function detectDiscipline(file: string): DisciplineCode | null {
  const match = Object.entries(disciplineByFile).find(([token]) => file.includes(token));
  return match?.[1] ?? null;
}

function setCell(row: string[], index: number, value: number | string | null) {
  if (index < 0) return;
  row[index] = value === null ? "" : String(value);
}

function correctTimeScoring(rows: string[][], headerIndex: number, file: string) {
  const disciplineCode = detectDiscipline(file);
  if (!disciplineCode) return { correctedRows: 0 };

  const headers = rows[headerIndex];
  const startIndex = headers.indexOf("Au1Startnr");
  const classIndex = headers.indexOf("Au1Klasse");
  const timeIndex = headers.indexOf("AuZeit");
  const classPointsIndex = headers.indexOf("AuPunkte");
  const classRankIndex = headers.indexOf("AuPlatzKlasse");
  const femalePointsIndex = headers.indexOf("AuPunkteDamenGes");
  const malePointsIndex = headers.indexOf("AuPunkteHerrenGes");
  const overallRankIndex = headers.indexOf("AuPlatzGesamt");

  const dataRows = rows.slice(headerIndex + 1).filter((row) => row.some((field) => field.trim()));
  const rowsByClass = new Map<string, string[][]>();
  const rowsByOverallGroup = new Map<string, string[][]>();

  for (const row of dataRows) {
    const legacyClass = row[classIndex]?.trim() ?? "";
    if (!legacyClass) continue;
    rowsByClass.set(legacyClass, [...(rowsByClass.get(legacyClass) ?? []), row]);
    const overallGroup = overallGroupByLegacyClass[legacyClass] ?? null;
    if (overallGroup) rowsByOverallGroup.set(overallGroup, [...(rowsByOverallGroup.get(overallGroup) ?? []), row]);
  }

  let correctedRows = 0;
  for (const [legacyClass, classRows] of rowsByClass) {
    const entries: DisciplineEntry[] = classRows.map((row) => ({
      teamId: row[startIndex]?.trim() ?? "",
      teamName: "",
      startNumber: row[startIndex]?.trim() ?? null,
      participantName: "",
      rawValue: parseLegacyTimeMs(row[timeIndex]),
      rawValueText: row[timeIndex] ?? null,
      classCode: legacyClass,
    }));
    const ranked = rankDiscipline(entries, disciplineCode);
    const scoringByStartNumber = new Map(ranked.map((entry) => [entry.teamId, entry]));
    for (const row of classRows) {
      const scoring = scoringByStartNumber.get(row[startIndex]?.trim() ?? "");
      if (!scoring) continue;
      setCell(row, classPointsIndex, scoring.points);
      setCell(row, classRankIndex, scoring.rank);
      correctedRows += 1;
    }
  }

  for (const [overallGroup, overallRows] of rowsByOverallGroup) {
    const entries: DisciplineEntry[] = overallRows.map((row) => ({
      teamId: row[startIndex]?.trim() ?? "",
      teamName: "",
      startNumber: row[startIndex]?.trim() ?? null,
      participantName: "",
      rawValue: parseLegacyTimeMs(row[timeIndex]),
      rawValueText: row[timeIndex] ?? null,
      classCode: overallGroup,
    }));
    const ranked = rankDiscipline(entries, disciplineCode);
    const scoringByStartNumber = new Map(ranked.map((entry) => [entry.teamId, entry]));
    for (const row of overallRows) {
      const scoring = scoringByStartNumber.get(row[startIndex]?.trim() ?? "");
      if (!scoring) continue;
      setCell(row, femalePointsIndex, overallGroup === "DAMEN" ? scoring.points : null);
      setCell(row, malePointsIndex, overallGroup === "HERREN" ? scoring.points : null);
      setCell(row, overallRankIndex, scoring.rank);
    }
  }

  for (const row of dataRows) {
    const legacyClass = row[classIndex]?.trim() ?? "";
    if (overallGroupByLegacyClass[legacyClass]) continue;
    setCell(row, femalePointsIndex, null);
    setCell(row, malePointsIndex, null);
    setCell(row, overallRankIndex, null);
  }

  return { correctedRows };
}

function parseLegacyDecimal(value: string | undefined) {
  const trimmed = value?.trim().replace(",", ".") ?? "";
  if (!trimmed || !/^-?\d+(\.\d+)?$/.test(trimmed)) return null;
  return Number.parseFloat(trimmed);
}

function benchGroupKey(row: string[], startIndex: number, participantIndex: number, classIndex: number) {
  return [
    row[startIndex]?.trim() || "missing-start",
    row[participantIndex]?.trim() || "missing-participant",
    row[classIndex]?.trim() || "missing-class",
  ].join(":");
}

function correctBenchScoring(rows: string[][], headerIndex: number, file: string) {
  if (!file.includes("BANK")) return { correctedRows: 0 };

  const headers = rows[headerIndex];
  const startIndex = headers.indexOf("Au1Startnr");
  const participantIndex = headers.indexOf("Au1TlID");
  const classIndex = headers.indexOf("Au1Klasse");
  const grossIndex = headers.indexOf("AuBruttoGewicht");
  const netIndex = headers.indexOf("AuGewicht");
  const attemptIndex = headers.indexOf("AuVersuchnr");
  const classPointsIndex = headers.indexOf("AuPunkte");
  const classRankIndex = headers.indexOf("AuPlatzKlasse");
  const femalePointsIndex = headers.indexOf("AuPunkteDamenGes");
  const malePointsIndex = headers.indexOf("AuPunkteHerrenGes");
  const overallRankIndex = headers.indexOf("AuPlatzGesamt");
  const omittedIndex = headers.indexOf("AuStreichergebnis");

  const dataRows = rows.slice(headerIndex + 1).filter((row) => row.some((field) => field.trim()));
  const groupedRows = new Map<string, string[][]>();
  for (const row of dataRows) {
    const key = benchGroupKey(row, startIndex, participantIndex, classIndex);
    groupedRows.set(key, [...(groupedRows.get(key) ?? []), row]);
  }

  const drafts = [...groupedRows.values()].map((groupRows) => {
    const attempts = groupRows
      .map((row) => ({
        row,
        attemptNumber: Number.parseInt(row[attemptIndex] || "0", 10),
        grossWeight: parseLegacyDecimal(row[grossIndex]),
        netWeight: parseLegacyDecimal(row[netIndex]),
      }))
      .sort((left, right) => left.attemptNumber - right.attemptNumber);
    const validAttempts = attempts.filter((attempt) => attempt.netWeight !== null && attempt.grossWeight !== null && attempt.netWeight > -999);
    const bestAttempt = validAttempts.toSorted((left, right) => (right.netWeight ?? -Infinity) - (left.netWeight ?? -Infinity))[0] ?? null;
    const dnfAttempt = attempts.find((attempt) => attempt.netWeight === -999 || attempt.grossWeight === -999) ?? null;
    const scoringAttempt = bestAttempt ?? dnfAttempt ?? attempts[0] ?? null;
    const legacyClass = groupRows[0]?.[classIndex]?.trim() ?? "";
    return {
      row: scoringAttempt?.row ?? groupRows[0],
      groupRows,
      startNumber: groupRows[0]?.[startIndex]?.trim() ?? "",
      legacyClass,
      rawValue: bestAttempt?.netWeight ?? (dnfAttempt ? -999 : null),
    };
  });

  const draftsByClass = new Map<string, typeof drafts>();
  const draftsByOverallGroup = new Map<string, typeof drafts>();
  for (const draft of drafts) {
    if (!draft.legacyClass) continue;
    draftsByClass.set(draft.legacyClass, [...(draftsByClass.get(draft.legacyClass) ?? []), draft]);
    const overallGroup = overallGroupByLegacyClass[draft.legacyClass] ?? null;
    if (overallGroup) draftsByOverallGroup.set(overallGroup, [...(draftsByOverallGroup.get(overallGroup) ?? []), draft]);
  }

  let correctedRows = 0;
  for (const [legacyClass, classDrafts] of draftsByClass) {
    const entries: DisciplineEntry[] = classDrafts.map((draft) => ({
      teamId: draft.startNumber,
      teamName: "",
      startNumber: draft.startNumber,
      participantName: "",
      rawValue: draft.rawValue,
      classCode: legacyClass,
    }));
    const ranked = rankDiscipline(entries, "BENCH");
    const scoringByStartNumber = new Map(ranked.map((entry) => [entry.teamId, entry]));
    for (const draft of classDrafts) {
      const scoring = scoringByStartNumber.get(draft.startNumber);
      if (!scoring) continue;
      for (const row of draft.groupRows) {
        setCell(row, classPointsIndex, null);
        setCell(row, classRankIndex, null);
        setCell(row, femalePointsIndex, null);
        setCell(row, malePointsIndex, null);
        setCell(row, overallRankIndex, null);
        setCell(row, omittedIndex, row === draft.row ? "Falsch" : "Wahr");
      }
      setCell(draft.row, classPointsIndex, scoring.points);
      setCell(draft.row, classRankIndex, scoring.rank);
      correctedRows += 1;
    }
  }

  for (const [overallGroup, overallDrafts] of draftsByOverallGroup) {
    const entries: DisciplineEntry[] = overallDrafts.map((draft) => ({
      teamId: draft.startNumber,
      teamName: "",
      startNumber: draft.startNumber,
      participantName: "",
      rawValue: draft.rawValue,
      classCode: overallGroup,
    }));
    const ranked = rankDiscipline(entries, "BENCH");
    const scoringByStartNumber = new Map(ranked.map((entry) => [entry.teamId, entry]));
    for (const draft of overallDrafts) {
      const scoring = scoringByStartNumber.get(draft.startNumber);
      if (!scoring) continue;
      setCell(draft.row, femalePointsIndex, overallGroup === "DAMEN" ? scoring.points : null);
      setCell(draft.row, malePointsIndex, overallGroup === "HERREN" ? scoring.points : null);
      setCell(draft.row, overallRankIndex, scoring.rank);
    }
  }

  return { correctedRows };
}

function stockTieBreakers(row: string[], bwzIndex: number, omittedRingsIndex: number) {
  const bwz = Number.parseInt((row[bwzIndex] ?? "").replace(/\D/g, "") || "0", 10);
  const omittedRings = Number.parseInt(row[omittedRingsIndex] || "0", 10);
  return [bwz, Number.isFinite(omittedRings) ? omittedRings : 0];
}

function stockGroupKey(row: string[], startIndex: number, participantIndex: number, classIndex: number) {
  return [
    row[startIndex]?.trim() || "missing-start",
    row[participantIndex]?.trim() || "missing-participant",
    row[classIndex]?.trim() || "missing-class",
  ].join(":");
}

function correctStockScoring(rows: string[][], headerIndex: number, file: string) {
  if (!file.includes("STOCK")) return { correctedRows: 0 };

  const headers = rows[headerIndex];
  const startIndex = headers.indexOf("Au1Startnr");
  const participantIndex = headers.indexOf("Au1TlID");
  const classIndex = headers.indexOf("Au1Klasse");
  const ringsIndex = headers.indexOf("AuRingeStock");
  const omittedRingsIndex = headers.indexOf("AuRingeStockStreicherg");
  const bwzIndex = headers.indexOf("AuSchubBWZ");
  const classPointsIndex = headers.indexOf("AuPunkte");
  const classRankIndex = headers.indexOf("AuPlatzKlasse");
  const femalePointsIndex = headers.indexOf("AuPunkteDamenGes");
  const malePointsIndex = headers.indexOf("AuPunkteHerrenGes");
  const overallRankIndex = headers.indexOf("AuPlatzGesamt");
  const summaryIndex = headers.indexOf("AuSummenkennzeichen");

  const dataRows = rows.slice(headerIndex + 1).filter((row) => row.some((field) => field.trim()));
  const groupedRows = new Map<string, string[][]>();
  for (const row of dataRows) {
    const key = stockGroupKey(row, startIndex, participantIndex, classIndex);
    groupedRows.set(key, [...(groupedRows.get(key) ?? []), row]);
  }

  const drafts = [...groupedRows.values()].map((groupRows) => {
    const summaryRow = groupRows.find((row) => row[summaryIndex] === "S") ?? groupRows[0];
    const legacyClass = groupRows[0]?.[classIndex]?.trim() ?? "";
    return {
      row: summaryRow,
      groupRows,
      startNumber: groupRows[0]?.[startIndex]?.trim() ?? "",
      legacyClass,
      rawValue: Number.parseInt(summaryRow?.[ringsIndex] || "0", 10),
      tieBreakers: stockTieBreakers(summaryRow, bwzIndex, omittedRingsIndex),
    };
  });

  const draftsByClass = new Map<string, typeof drafts>();
  const draftsByOverallGroup = new Map<string, typeof drafts>();
  for (const draft of drafts) {
    if (!draft.legacyClass) continue;
    draftsByClass.set(draft.legacyClass, [...(draftsByClass.get(draft.legacyClass) ?? []), draft]);
    const overallGroup = overallGroupByLegacyClass[draft.legacyClass] ?? null;
    if (overallGroup) draftsByOverallGroup.set(overallGroup, [...(draftsByOverallGroup.get(overallGroup) ?? []), draft]);
  }

  let correctedRows = 0;
  for (const [legacyClass, classDrafts] of draftsByClass) {
    const entries: DisciplineEntry[] = classDrafts.map((draft) => ({
      teamId: draft.startNumber,
      teamName: "",
      startNumber: draft.startNumber,
      participantName: "",
      rawValue: draft.rawValue,
      tieBreakers: draft.tieBreakers,
      classCode: legacyClass,
    }));
    const ranked = rankDiscipline(entries, "STOCK");
    const scoringByStartNumber = new Map(ranked.map((entry) => [entry.teamId, entry]));
    for (const draft of classDrafts) {
      const scoring = scoringByStartNumber.get(draft.startNumber);
      if (!scoring) continue;
      for (const row of draft.groupRows) {
        setCell(row, classPointsIndex, null);
        setCell(row, classRankIndex, null);
        setCell(row, femalePointsIndex, null);
        setCell(row, malePointsIndex, null);
        setCell(row, overallRankIndex, null);
      }
      setCell(draft.row, classPointsIndex, scoring.points);
      setCell(draft.row, classRankIndex, scoring.rank);
      correctedRows += 1;
    }
  }

  for (const [overallGroup, overallDrafts] of draftsByOverallGroup) {
    const entries: DisciplineEntry[] = overallDrafts.map((draft) => ({
      teamId: draft.startNumber,
      teamName: "",
      startNumber: draft.startNumber,
      participantName: "",
      rawValue: draft.rawValue,
      tieBreakers: draft.tieBreakers,
      classCode: overallGroup,
    }));
    const ranked = rankDiscipline(entries, "STOCK");
    const scoringByStartNumber = new Map(ranked.map((entry) => [entry.teamId, entry]));
    for (const draft of overallDrafts) {
      const scoring = scoringByStartNumber.get(draft.startNumber);
      if (!scoring) continue;
      setCell(draft.row, femalePointsIndex, overallGroup === "DAMEN" ? scoring.points : null);
      setCell(draft.row, malePointsIndex, overallGroup === "HERREN" ? scoring.points : null);
      setCell(draft.row, overallRankIndex, scoring.rank);
    }
  }

  return { correctedRows };
}

async function main() {
  const competition = await prisma.competition.findFirst({
    orderBy: { year: "desc" },
    select: { id: true, name: true, year: true },
  });
  if (!competition) throw new Error("No competition found.");

  const teams = await prisma.team.findMany({
    where: { competitionId: competition.id, deletedAt: null, startNumber: { not: null } },
    select: { startNumber: true, classificationCode: true, name: true },
  });

  const portalClassByStartNumber = new Map<string, string>();
  for (const team of teams) {
    if (!team.startNumber || !team.classificationCode) continue;
    const legacyClass = legacyClassByPortalCode[team.classificationCode];
    if (legacyClass) portalClassByStartNumber.set(team.startNumber, legacyClass);
  }
  mkdirSync(outputDir, { recursive: true });

  const manifest = {
    generatedAt: new Date().toISOString(),
    competition,
    outputDir,
    files: [] as Array<{
      source: string;
      output: string;
      sourceRows: number;
      outputRows: number;
      removedRows: number;
      changedClassRows: number;
      correctedScoringRows: number;
    }>,
  };

  for (const file of files) {
    const sourcePath = join(inboundDir, file);
    const rows = parseCsvRows(readFileSync(sourcePath, "latin1"));
    const headerIndex = findHeaderRow(rows);
    const headers = rows[headerIndex];
    const startIndex = headers.indexOf("Au1Startnr");
    const classIndex = headers.indexOf("Au1Klasse");
    const outputRows = rows.slice(0, headerIndex + 1).map((row) => [...row]);
    let sourceRows = 0;
    let changedClassRows = 0;

    for (const row of rows.slice(headerIndex + 1)) {
      if (!row.some((field) => field.trim())) continue;
      sourceRows += 1;
      const startNumber = row[startIndex]?.trim() ?? "";
      const legacyClass = portalClassByStartNumber.get(startNumber);
      if (!legacyClass) continue;

      const next = [...row];
      if (next[classIndex] !== legacyClass) {
        next[classIndex] = legacyClass;
        changedClassRows += 1;
      }
      outputRows.push(next);
    }

    const timeCorrection = correctTimeScoring(outputRows, headerIndex, file);
    const benchCorrection = correctBenchScoring(outputRows, headerIndex, file);
    const stockCorrection = correctStockScoring(outputRows, headerIndex, file);
    const correctedRows = timeCorrection.correctedRows + benchCorrection.correctedRows + stockCorrection.correctedRows;
    const outputName = basename(file, ".csv") + "--portal-startnummern.csv";
    const outputPath = join(outputDir, outputName);
    writeFileSync(outputPath, serializeCsvRows(outputRows), "latin1");
    manifest.files.push({
      source: sourcePath,
      output: outputPath,
      sourceRows,
      outputRows: outputRows.length - headerIndex - 1,
      removedRows: sourceRows - (outputRows.length - headerIndex - 1),
      changedClassRows,
      correctedScoringRows: correctedRows,
    });
  }

  writeFileSync(join(outputDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
  console.log(JSON.stringify(manifest, null, 2));
}

main().finally(() => prisma.$disconnect());
