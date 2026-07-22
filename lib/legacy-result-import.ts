export const LEGACY_RESULT_DEFAULT_HEADER_ROW = 6;

export type LegacyResultDisciplineCode = "RUN" | "STOCK" | "ROAD" | "BENCH" | "MTB";
export type LegacyResultValidationSeverity = "warning" | "error";

export type LegacyResultValidationMessage = {
  code: string;
  severity: LegacyResultValidationSeverity;
};

export type LegacyRawResultRecord = {
  rowNumber: number;
  rowKey: string;
  raw: Record<string, string>;
  startNumber: string | null;
  legacyParticipantId: string | null;
  legacyClassId: string | null;
  disciplineCode: LegacyResultDisciplineCode | null;
  validationMessages: LegacyResultValidationMessage[];
};

export type LegacyResultDraftPreview = {
  rowKey: string;
  sourceRowNumbers: number[];
  startNumber: string | null;
  legacyParticipantId: string | null;
  legacyClassId: string | null;
  disciplineCode: LegacyResultDisciplineCode;
  rawValue: number | null;
  rawValueText: string | null;
  resultStatus: string;
  classPoints: number | null;
  classRank: number | null;
  overallGenderPoints: number | null;
  overallGenderRank: number | null;
  details: Record<string, unknown>;
  validationMessages: LegacyResultValidationMessage[];
};

export type LegacyResultParseResult = {
  headers: string[];
  rawRecords: LegacyRawResultRecord[];
  drafts: LegacyResultDraftPreview[];
  summary: {
    headerRow: number;
    columns: number;
    rawRows: number;
    drafts: number;
    disciplineCode: LegacyResultDisciplineCode | "MIXED" | "UNKNOWN";
    disciplineCounts: Record<string, number>;
    warnings: number;
    errors: number;
  };
};

type CsvParseOptions = {
  delimiter?: string;
  headerRow?: number;
};

const REQUIRED_HEADERS = [
  "Au1Startnr",
  "Au1TlID",
  "Au1Klasse",
  "Au1Disziplin",
  "AuZeit",
  "AuBruttoGewicht",
  "AuGewicht",
  "AuRingeStock",
  "AuRingeStockStreicherg",
  "AuSchubBWZ",
  "AuVersuchnr",
  "AuPunkte",
  "AuPlatzKlasse",
  "AuSummenkennzeichen",
] as const;

const DISCIPLINE_BY_LEGACY_ID: Record<string, LegacyResultDisciplineCode> = {
  "1": "RUN",
  "2": "STOCK",
  "3": "ROAD",
  "4": "BENCH",
  "5": "MTB",
};

const TIME_DISCIPLINES = new Set<LegacyResultDisciplineCode>(["RUN", "ROAD", "MTB"]);

function parseCsvRows(input: string, delimiter: string): string[][] {
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

function buildRawRecord(headers: string[], row: string[]) {
  return Object.fromEntries(headers.map((header, index) => [header, row[index]?.trim() ?? ""]));
}

function nullableString(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

function nullableInteger(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!/^-?\d+$/.test(trimmed)) return null;
  return Number.parseInt(trimmed, 10);
}

function nullableDecimal(value: string | undefined) {
  const trimmed = value?.trim().replace(",", ".") ?? "";
  if (!trimmed || !/^-?\d+(\.\d+)?$/.test(trimmed)) return null;
  return Number.parseFloat(trimmed);
}

export function parseLegacyResultTimeMs(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  if (trimmed === "88:88:88.00" || trimmed === "99:99:99.99" || trimmed === "00:00:00.00") return null;

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

function timeResultStatus(rawTimeText: string | null, elapsedMs: number | null) {
  if (!rawTimeText) return "missing_time";
  if (rawTimeText === "88:88:88.00" || rawTimeText === "99:99:99.99") return "manual_check";
  if (elapsedMs === null) return "invalid_time";
  return "valid";
}

function countMessages(records: Array<{ validationMessages: LegacyResultValidationMessage[] }>, severity: LegacyResultValidationSeverity) {
  return records.reduce(
    (count, record) => count + record.validationMessages.filter((message) => message.severity === severity).length,
    0,
  );
}

function groupKey(record: LegacyRawResultRecord) {
  return [
    record.disciplineCode ?? "UNKNOWN",
    record.startNumber ?? "missing-start",
    record.legacyParticipantId ?? "missing-participant",
    record.legacyClassId ?? "missing-class",
  ].join(":");
}

function pointsAndRanks(raw: Record<string, string>) {
  return {
    classPoints: nullableInteger(raw.AuPunkte),
    classRank: nullableInteger(raw.AuPlatzKlasse),
    overallGenderPoints: nullableInteger(raw.AuPunkteDamenGes) ?? nullableInteger(raw.AuPunkteHerrenGes),
    overallGenderRank: nullableInteger(raw.AuPlatzGesamt),
  };
}

function buildTimeDraft(record: LegacyRawResultRecord): LegacyResultDraftPreview {
  const rawTimeText = nullableString(record.raw.AuZeit);
  const elapsedMs = parseLegacyResultTimeMs(rawTimeText);
  const resultStatus = timeResultStatus(rawTimeText, elapsedMs);
  const validationMessages = [...record.validationMessages];
  if (resultStatus === "missing_time") validationMessages.push({ code: "missing_time", severity: "error" });
  if (resultStatus === "invalid_time") validationMessages.push({ code: "invalid_time", severity: "error" });
  if (resultStatus === "manual_check") validationMessages.push({ code: "manual_check_time", severity: "warning" });

  return {
    rowKey: `${record.disciplineCode?.toLowerCase()}:${record.startNumber ?? "missing"}:row:${record.rowNumber}`,
    sourceRowNumbers: [record.rowNumber],
    startNumber: record.startNumber,
    legacyParticipantId: record.legacyParticipantId,
    legacyClassId: record.legacyClassId,
    disciplineCode: record.disciplineCode as LegacyResultDisciplineCode,
    rawValue: elapsedMs,
    rawValueText: rawTimeText,
    resultStatus,
    ...pointsAndRanks(record.raw),
    details: {
      uhrGueltig: record.raw.AuUhrGueltig || null,
      stopzeitUhr1: record.raw.AuStopzeit || null,
      stopzeitUhr2: record.raw.AuStopzeitUhr2 || null,
      zeitBasis: record.raw.AuZeitBasis || null,
      zeitBasisUhr2: record.raw.AuZeitBasisUhr2 || null,
      zeitBasisZiel: record.raw.AuZeitBasisZiel || null,
    },
    validationMessages,
  };
}

function buildBenchDraft(records: LegacyRawResultRecord[]): LegacyResultDraftPreview {
  const [first] = records;
  const attempts = records
    .map((record) => ({
      rowNumber: record.rowNumber,
      attemptNumber: nullableInteger(record.raw.AuVersuchnr),
      grossWeight: nullableDecimal(record.raw.AuBruttoGewicht),
      netWeight: nullableDecimal(record.raw.AuGewicht),
      raw: record.raw,
    }))
    .sort((left, right) => (left.attemptNumber ?? 0) - (right.attemptNumber ?? 0));
  const validAttempts = attempts.filter((attempt) => attempt.netWeight !== null && attempt.grossWeight !== null && attempt.netWeight > -999);
  const bestAttempt = validAttempts.toSorted((left, right) => (right.netWeight ?? -Infinity) - (left.netWeight ?? -Infinity))[0] ?? null;
  const validationMessages = records.flatMap((record) => record.validationMessages);
  if (!bestAttempt) validationMessages.push({ code: "missing_valid_bench_attempt", severity: "error" });

  const scoringRaw = bestAttempt?.raw ?? first.raw;
  const rawValueText = bestAttempt
    ? `${String(bestAttempt.grossWeight).replace(".", ",")} kg / ${String(bestAttempt.netWeight).replace(".", ",")} netto`
    : null;

  return {
    rowKey: `bench:${first.startNumber ?? "missing"}:${first.legacyParticipantId ?? "missing"}`,
    sourceRowNumbers: records.map((record) => record.rowNumber),
    startNumber: first.startNumber,
    legacyParticipantId: first.legacyParticipantId,
    legacyClassId: first.legacyClassId,
    disciplineCode: "BENCH",
    rawValue: bestAttempt?.netWeight ?? null,
    rawValueText,
    resultStatus: bestAttempt ? "valid" : "missing_attempt",
    ...pointsAndRanks(scoringRaw),
    details: {
      attempts,
      bestAttemptNumber: bestAttempt?.attemptNumber ?? null,
      bestGrossWeight: bestAttempt?.grossWeight ?? null,
      bestNetWeight: bestAttempt?.netWeight ?? null,
    },
    validationMessages,
  };
}

function buildStockDraft(records: LegacyRawResultRecord[]): LegacyResultDraftPreview {
  const [first] = records;
  const summary = records.find((record) => record.raw.AuSummenkennzeichen === "S") ?? null;
  const shotRows = records.filter((record) => record.raw.AuSummenkennzeichen !== "S");
  const shots = shotRows
    .map((record) => ({
      rowNumber: record.rowNumber,
      shotNumber: nullableInteger(record.raw.AuVersuchnr),
      rings: nullableInteger(record.raw.AuRingeStock),
    }))
    .sort((left, right) => (left.shotNumber ?? 0) - (right.shotNumber ?? 0));
  const validationMessages = records.flatMap((record) => record.validationMessages);
  if (!summary) validationMessages.push({ code: "missing_stock_summary", severity: "error" });
  if (shots.length !== 11) validationMessages.push({ code: "unexpected_stock_shot_count", severity: "warning" });

  const scoringRaw = summary?.raw ?? first.raw;
  const stockSum = nullableInteger(scoringRaw.AuRingeStock);
  const dropped = nullableInteger(scoringRaw.AuRingeStockStreicherg);
  const bwz = nullableString(scoringRaw.AuSchubBWZ);
  if (summary && stockSum === null) validationMessages.push({ code: "missing_stock_sum", severity: "error" });

  return {
    rowKey: `stock:${first.startNumber ?? "missing"}:${first.legacyParticipantId ?? "missing"}`,
    sourceRowNumbers: records.map((record) => record.rowNumber),
    startNumber: first.startNumber,
    legacyParticipantId: first.legacyParticipantId,
    legacyClassId: first.legacyClassId,
    disciplineCode: "STOCK",
    rawValue: stockSum,
    rawValueText: stockSum === null ? null : `${stockSum} Ringe`,
    resultStatus: summary && stockSum !== null ? "valid" : "manual_check",
    ...pointsAndRanks(scoringRaw),
    details: {
      shots,
      dropped,
      bwz,
      summaryRowNumber: summary?.rowNumber ?? null,
    },
    validationMessages,
  };
}

export function parseLegacyResultCsv(input: string, options: CsvParseOptions = {}): LegacyResultParseResult {
  const delimiter = options.delimiter && options.delimiter.length === 1 ? options.delimiter : ";";
  const headerRow = options.headerRow && options.headerRow > 0 ? Math.floor(options.headerRow) : LEGACY_RESULT_DEFAULT_HEADER_ROW;
  const allRows = parseCsvRows(input, delimiter);
  const headerIndex = headerRow - 1;
  const headers = allRows[headerIndex]?.map((header) => header.trim()) ?? [];

  if (headers.length === 0) {
    throw new Error(`Legacy Ergebnis CSV: Header-Zeile ${headerRow} wurde nicht gefunden.`);
  }

  const missingHeaders = REQUIRED_HEADERS.filter((header) => !headers.includes(header));
  if (missingHeaders.length > 0) {
    throw new Error(`Legacy Ergebnis CSV: Pflichtfelder fehlen: ${missingHeaders.join(", ")}`);
  }

  const rawRecords = allRows
    .slice(headerIndex + 1)
    .map((row, rowIndex): LegacyRawResultRecord | null => {
      const raw = buildRawRecord(headers, row);
      if (!Object.values(raw).some((value) => value !== "")) return null;

      const rowNumber = headerRow + rowIndex + 1;
      const legacyDisciplineId = nullableString(raw.Au1Disziplin);
      const disciplineCode = legacyDisciplineId ? DISCIPLINE_BY_LEGACY_ID[legacyDisciplineId] ?? null : null;
      const startNumber = nullableString(raw.Au1Startnr);
      const legacyParticipantId = nullableString(raw.Au1TlID);
      const legacyClassId = nullableString(raw.Au1Klasse);
      const validationMessages: LegacyResultValidationMessage[] = [];

      if (!disciplineCode) validationMessages.push({ code: "unknown_legacy_discipline", severity: "error" });
      if (!startNumber) validationMessages.push({ code: "missing_start_number", severity: "error" });
      if (!legacyParticipantId) validationMessages.push({ code: "missing_legacy_participant", severity: "warning" });
      if (!legacyClassId) validationMessages.push({ code: "missing_legacy_class", severity: "error" });

      return {
        rowNumber,
        rowKey: `legacy-result:${legacyDisciplineId ?? "unknown"}:${startNumber ?? "missing"}:row:${rowNumber}`,
        raw,
        startNumber,
        legacyParticipantId,
        legacyClassId,
        disciplineCode,
        validationMessages,
      };
    })
    .filter((record): record is LegacyRawResultRecord => record !== null);

  const drafts: LegacyResultDraftPreview[] = [];
  for (const record of rawRecords) {
    if (record.disciplineCode && TIME_DISCIPLINES.has(record.disciplineCode)) {
      drafts.push(buildTimeDraft(record));
    }
  }

  const groupedRecords = new Map<string, LegacyRawResultRecord[]>();
  for (const record of rawRecords) {
    if (record.disciplineCode !== "BENCH" && record.disciplineCode !== "STOCK") continue;
    const existing = groupedRecords.get(groupKey(record)) || [];
    existing.push(record);
    groupedRecords.set(groupKey(record), existing);
  }
  for (const records of groupedRecords.values()) {
    const [first] = records;
    if (first.disciplineCode === "BENCH") drafts.push(buildBenchDraft(records));
    if (first.disciplineCode === "STOCK") drafts.push(buildStockDraft(records));
  }

  const disciplineCounts: Record<string, number> = {};
  for (const record of rawRecords) {
    const key = record.disciplineCode ?? "UNKNOWN";
    disciplineCounts[key] = (disciplineCounts[key] ?? 0) + 1;
  }
  const disciplineCodes = Object.keys(disciplineCounts).filter((key) => key !== "UNKNOWN");
  const warningCount = countMessages([...rawRecords, ...drafts], "warning");
  const errorCount = countMessages([...rawRecords, ...drafts], "error");

  return {
    headers,
    rawRecords,
    drafts,
    summary: {
      headerRow,
      columns: headers.length,
      rawRows: rawRecords.length,
      drafts: drafts.length,
      disciplineCode: disciplineCodes.length === 1
        ? disciplineCodes[0] as LegacyResultDisciplineCode
        : disciplineCodes.length > 1 ? "MIXED" : "UNKNOWN",
      disciplineCounts,
      warnings: warningCount,
      errors: errorCount,
    },
  };
}
