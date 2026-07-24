export const LEGACY_RUNNING_DEFAULT_HEADER_ROW = 6;
export const LEGACY_RUNNING_DISCIPLINE_CODE = "RUN" as const;

export type LegacyRunningOverallGroup = "DAMEN" | "HERREN";

export type LegacyRunningValidationSeverity = "warning" | "error";

export type LegacyRunningValidationMessage = {
  code: string;
  severity: LegacyRunningValidationSeverity;
};

export type LegacyRunningNormalizedRecord = {
  rowNumber: number;
  rowKey: string;
  raw: Record<string, string>;
  startNumber: string | null;
  legacyParticipantId: string | null;
  legacyClassId: string | null;
  classCode: string | null;
  classLabel: string | null;
  disciplineCode: typeof LEGACY_RUNNING_DISCIPLINE_CODE;
  rawTimeText: string | null;
  elapsedMs: number | null;
  resultStatus: "valid" | "manual_check" | "invalid_time" | "missing_time" | "dnf";
  classPoints: number | null;
  classRank: number | null;
  overallGroup: LegacyRunningOverallGroup | null;
  overallGenderPoints: number | null;
  overallGenderRank: number | null;
  legacyTieClass: boolean;
  legacyTieOverall: boolean;
  validationMessages: LegacyRunningValidationMessage[];
};

export type LegacyRunningParseResult = {
  headers: string[];
  records: LegacyRunningNormalizedRecord[];
  summary: {
    headerRow: number;
    columns: number;
    rows: number;
    validTimes: number;
    invalidTimes: number;
    missingStartNumbers: number;
    classCounts: Record<string, number>;
    overallGroups: Record<LegacyRunningOverallGroup, number>;
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
  "Au1Klasse",
  "Au1Disziplin",
  "AuZeit",
  "AuPunkte",
  "AuPlatzKlasse",
] as const;

const LEGACY_CLASS_BY_ID: Record<string, { code: string; label: string; overallGroup: LegacyRunningOverallGroup | null }> = {
  "1": { code: "schueler-a", label: "Schueler A", overallGroup: null },
  "2": { code: "schueler-b", label: "Schueler B", overallGroup: null },
  "3": { code: "jugend", label: "Jugend", overallGroup: null },
  "4": { code: "damen-a", label: "Damen A", overallGroup: "DAMEN" },
  "5": { code: "damen-b", label: "Damen B", overallGroup: "DAMEN" },
  "6": { code: "jungsters", label: "Jungsters", overallGroup: "HERREN" },
  "7": { code: "herren", label: "Herren", overallGroup: "HERREN" },
  "8": { code: "masters", label: "Masters", overallGroup: "HERREN" },
};

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

function toNullableString(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

function toNullableInteger(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  if (!/^-?\d+$/.test(trimmed)) return null;
  return Number.parseInt(trimmed, 10);
}

export function parseLegacyRunningTimeMs(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  if (trimmed === "88:88:88.00" || trimmed === "00:00:00.00") return null;

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

function isLegacyZeroPointTime(rawTimeText: string | null) {
  if (!rawTimeText) return false;
  const normalized = rawTimeText.trim().replace(",", ".");
  return /^(?:(?:0+|99):)?99:99\.99(?:0|9)?$/.test(normalized);
}

function getResultStatus(rawTimeText: string | null, elapsedMs: number | null) {
  if (!rawTimeText) return "missing_time" as const;
  if (isLegacyZeroPointTime(rawTimeText)) return "dnf" as const;
  if (rawTimeText === "88:88:88.00") return "manual_check" as const;
  if (elapsedMs === null) return "invalid_time" as const;
  return "valid" as const;
}

function isTruthyLegacyFlag(value: string | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";
  return normalized === "1" || normalized === "true" || normalized === "wahr";
}

function buildRawRecord(headers: string[], row: string[]) {
  return Object.fromEntries(headers.map((header, index) => [header, row[index]?.trim() ?? ""]));
}

function countMessages(records: LegacyRunningNormalizedRecord[], severity: LegacyRunningValidationSeverity) {
  return records.reduce(
    (count, record) => count + record.validationMessages.filter((message) => message.severity === severity).length,
    0,
  );
}

export function parseLegacyRunningCsv(input: string, options: CsvParseOptions = {}): LegacyRunningParseResult {
  const delimiter = options.delimiter && options.delimiter.length === 1 ? options.delimiter : ";";
  const headerRow = options.headerRow && options.headerRow > 0 ? Math.floor(options.headerRow) : LEGACY_RUNNING_DEFAULT_HEADER_ROW;
  const allRows = parseCsvRows(input, delimiter);
  const headerIndex = headerRow - 1;
  const headers = allRows[headerIndex]?.map((header) => header.trim()) ?? [];

  if (headers.length === 0) {
    throw new Error(`Legacy Laufen CSV: Header-Zeile ${headerRow} wurde nicht gefunden.`);
  }

  const missingHeaders = REQUIRED_HEADERS.filter((header) => !headers.includes(header));
  if (missingHeaders.length > 0) {
    throw new Error(`Legacy Laufen CSV: Pflichtfelder fehlen: ${missingHeaders.join(", ")}`);
  }

  const records = allRows
    .slice(headerIndex + 1)
    .map((row, rowIndex): LegacyRunningNormalizedRecord | null => {
      const raw = buildRawRecord(headers, row);
      const hasValues = Object.values(raw).some((value) => value !== "");
      if (!hasValues) return null;

      const rowNumber = headerRow + rowIndex + 1;
      const validationMessages: LegacyRunningValidationMessage[] = [];
      const startNumber = toNullableString(raw.Au1Startnr);
      const legacyParticipantId = toNullableString(raw.Au1TlID);
      const legacyClassId = toNullableString(raw.Au1Klasse);
      const classInfo = legacyClassId ? LEGACY_CLASS_BY_ID[legacyClassId] : undefined;
      const rawTimeText = toNullableString(raw.AuZeit);
      const elapsedMs = parseLegacyRunningTimeMs(rawTimeText);
      const resultStatus = getResultStatus(rawTimeText, elapsedMs);
      const classPoints = resultStatus === "dnf" ? 0 : toNullableInteger(raw.AuPunkte);
      const classRank = resultStatus === "dnf" ? null : toNullableInteger(raw.AuPlatzKlasse);
      const overallGroup = classInfo?.overallGroup ?? null;
      const overallGenderPoints = resultStatus === "dnf"
        ? 0
        : overallGroup === "DAMEN"
          ? toNullableInteger(raw.AuPunkteDamenGes)
          : overallGroup === "HERREN"
            ? toNullableInteger(raw.AuPunkteHerrenGes)
            : null;
      const overallGenderRank = resultStatus === "dnf" ? null : overallGroup ? toNullableInteger(raw.AuPlatzGesamt) : null;

      if (!startNumber) validationMessages.push({ code: "missing_start_number", severity: "error" });
      if (!legacyClassId || !classInfo) validationMessages.push({ code: "unknown_legacy_class", severity: "error" });
      if (raw.Au1Disziplin !== "1") validationMessages.push({ code: "unexpected_legacy_discipline", severity: "error" });
      if (resultStatus === "missing_time") validationMessages.push({ code: "missing_time", severity: "error" });
      if (resultStatus === "invalid_time") validationMessages.push({ code: "invalid_time", severity: "error" });
      if (resultStatus === "dnf") validationMessages.push({ code: "legacy_zero_point_time", severity: "warning" });
      if (resultStatus === "manual_check") validationMessages.push({ code: "manual_check_time", severity: "warning" });
      if (classPoints === null) validationMessages.push({ code: "missing_class_points", severity: "warning" });
      if (classRank === null) validationMessages.push({ code: "missing_class_rank", severity: "warning" });
      if (overallGroup && overallGenderPoints === null) {
        validationMessages.push({ code: "missing_overall_gender_points", severity: "warning" });
      }
      if (overallGroup && overallGenderRank === null) {
        validationMessages.push({ code: "missing_overall_gender_rank", severity: "warning" });
      }

      return {
        rowNumber,
        rowKey: `legacy-running:${startNumber ?? "missing"}:row:${rowNumber}`,
        raw,
        startNumber,
        legacyParticipantId,
        legacyClassId,
        classCode: classInfo?.code ?? null,
        classLabel: classInfo?.label ?? null,
        disciplineCode: LEGACY_RUNNING_DISCIPLINE_CODE,
        rawTimeText,
        elapsedMs,
        resultStatus,
        classPoints,
        classRank,
        overallGroup,
        overallGenderPoints,
        overallGenderRank,
        legacyTieClass: isTruthyLegacyFlag(raw.AuPunktgleichheit),
        legacyTieOverall: isTruthyLegacyFlag(raw.AuPunktgleichheitGes),
        validationMessages,
      };
    })
    .filter((record): record is LegacyRunningNormalizedRecord => record !== null);

  const classCounts: Record<string, number> = {};
  const overallGroups: Record<LegacyRunningOverallGroup, number> = { DAMEN: 0, HERREN: 0 };
  for (const record of records) {
    if (record.legacyClassId) classCounts[record.legacyClassId] = (classCounts[record.legacyClassId] ?? 0) + 1;
    if (record.overallGroup) overallGroups[record.overallGroup] += 1;
  }

  return {
    headers,
    records,
    summary: {
      headerRow,
      columns: headers.length,
      rows: records.length,
      validTimes: records.filter((record) => record.resultStatus === "valid").length,
      invalidTimes: records.filter((record) => record.resultStatus !== "valid").length,
      missingStartNumbers: records.filter((record) => !record.startNumber).length,
      classCounts,
      overallGroups,
      warnings: countMessages(records, "warning"),
      errors: countMessages(records, "error"),
    },
  };
}
