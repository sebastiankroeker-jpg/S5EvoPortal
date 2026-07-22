import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

import { PrismaClient } from "@prisma/client";

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
    });
  }

  writeFileSync(join(outputDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
  console.log(JSON.stringify(manifest, null, 2));
}

main().finally(() => prisma.$disconnect());
