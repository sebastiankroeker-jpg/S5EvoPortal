import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { resolveCurrentUser } from "@/lib/current-user";
import { requireCompetitionTenantRoles } from "@/lib/server-permissions";
import { CLASSIFICATIONS } from "@/lib/domain/classification";

type ImportBody = {
  competitionId?: string;
  csv?: string;
  delimiter?: string;
  dryRun?: boolean;
  clearMissing?: boolean;
  createMissingTeams?: boolean;
};

type ParsedCsv = {
  headers: string[];
  rows: string[][];
  dataStartRowNumber: number;
};

type ParsedAssignments = {
  teamAssignments: Map<string, string | null>;
  participantAssignments: Map<string, string | null>;
};

const TEAM_ID_HEADER_ALIASES = ["team_id", "teamid", "team_uid", "teamuid", "portal_team_uid", "mannschaft_id"];
const TEAM_NAME_HEADER_ALIASES = ["mannschaftsname", "team_name", "teamname", "mannschaft"];
const START_NUMBER_HEADER_ALIASES = [
  "team_startnummer",
  "team_start_number",
  "team_startnumber",
  "startnummer",
  "start_number",
  "startnumber",
];

type LegacyImportWarning = {
  row: number;
  startNumber: string | null;
  teamName: string;
  reason:
    | "missing_team_name"
    | "missing_start_number"
    | "unmatched_team"
    | "ambiguous_team"
    | "missing_participant_data"
    | "invalid_birth_year"
    | "invalid_gender"
    | "duplicate_start_number"
    | "existing_team_name";
  candidates?: Array<{ teamId: string; teamName: string }>;
};

type LegacyCreateCandidate = {
  row: number;
  startNumber: string;
  teamName: string;
  classificationCode: string | null;
  totalAge: number | null;
  participants: Array<{
    firstName: string;
    lastName: string;
    gender: "MALE" | "FEMALE";
    birthYear: number;
    disciplineCode: "RUN" | "BENCH" | "STOCK" | "ROAD" | "MTB";
  }>;
};

function parseCsv(input: string, delimiter = ";"): ParsedCsv {
  const text = input.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
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
      const hasValues = row.some((value) => value !== "");
      if (hasValues) rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += ch;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    const hasValues = row.some((value) => value !== "");
    if (hasValues) rows.push(row);
  }

  if (rows.length === 0) return { headers: [], rows: [], dataStartRowNumber: 1 };
  const headerIndex = rows.findIndex(isStartNumberHeaderRow);
  const effectiveHeaderIndex = headerIndex === -1 ? 0 : headerIndex;
  const headers = rows[effectiveHeaderIndex];
  const dataRows = rows.slice(effectiveHeaderIndex + 1);
  return {
    headers: headers.map((header) => header.trim()),
    rows: dataRows,
    dataStartRowNumber: effectiveHeaderIndex + 2,
  };
}

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function normalizeStartNumber(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeImportId(value: string | null | undefined) {
  const trimmed = (value || "").trim();
  const normalized = trimmed.toLocaleLowerCase("de-DE");
  return ["", "-", "null", "n/a", "na", "#n/a", "#nv", "neu", "new"].includes(normalized) ? "" : trimmed;
}

function normalizeLegacyText(value: string | null | undefined) {
  return (value || "")
    .trim()
    .toLocaleLowerCase("de-DE")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function findHeaderIndex(normalizedHeaders: string[], aliases: string[]) {
  return normalizedHeaders.findIndex((header) => aliases.includes(header));
}

function isStartNumberHeaderRow(row: string[]) {
  const normalizedHeaders = row.map(normalizeHeader);
  const hasTeamId = findHeaderIndex(normalizedHeaders, TEAM_ID_HEADER_ALIASES) !== -1;
  const hasStartNumber = findHeaderIndex(normalizedHeaders, START_NUMBER_HEADER_ALIASES) !== -1;
  const hasTeamName = findHeaderIndex(normalizedHeaders, TEAM_NAME_HEADER_ALIASES) !== -1;
  return hasStartNumber && (hasTeamId || hasTeamName);
}

async function startNumberColumnExists() {
  const result = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'teams'
        AND column_name = 'startNumber'
    ) AS "exists"
  `;
  return Boolean(result[0]?.exists);
}

function collectAssignments(
  headers: string[],
  rows: string[][],
  clearMissing: boolean,
): ParsedAssignments {
  const normalizedHeaders = headers.map(normalizeHeader);
  const teamIdIndex = normalizedHeaders.findIndex((header) => TEAM_ID_HEADER_ALIASES.includes(header));
  const teamStartNumberIndex = normalizedHeaders.findIndex((header) => START_NUMBER_HEADER_ALIASES.includes(header));

  const participantIdIndex = normalizedHeaders.findIndex((header) =>
    ["participant_id", "participantid", "tn_id", "teilnehmer_id"].includes(header),
  );
  const startNumberIndex = normalizedHeaders.findIndex((header) =>
    ["startnummer", "start_number", "startnumber", "tn_startnummer"].includes(header),
  );

  const teamAssignments = new Map<string, string | null>();
  const participantAssignments = new Map<string, string | null>();

  if (teamIdIndex !== -1 && teamStartNumberIndex !== -1) {
    for (const row of rows) {
      const teamId = normalizeImportId(row[teamIdIndex]);
      if (!teamId) continue;
      const normalized = normalizeStartNumber(row[teamStartNumberIndex] || "");
      if (normalized === null && !clearMissing) continue;
      teamAssignments.set(teamId, normalized);
    }
  }

  if (participantIdIndex !== -1 && startNumberIndex !== -1) {
    for (const row of rows) {
      const participantId = normalizeImportId(row[participantIdIndex]);
      if (!participantId) continue;
      const normalized = normalizeStartNumber(row[startNumberIndex] || "");
      if (normalized === null && !clearMissing) continue;
      participantAssignments.set(participantId, normalized);
    }
  }

  const slotIndices: Array<{ participantId: number; startNumber: number }> = [];
  for (let slot = 1; slot <= 99; slot += 1) {
    const token = String(slot).padStart(2, "0");
    const participantHeader = `tn_${token}_id`;
    const startHeader = `tn_${token}_startnummer`;
    const participantIndex = normalizedHeaders.indexOf(participantHeader);
    const startIndex = normalizedHeaders.indexOf(startHeader);
    if (participantIndex !== -1 && startIndex !== -1) {
      slotIndices.push({ participantId: participantIndex, startNumber: startIndex });
    }
  }

  for (const row of rows) {
    for (const slot of slotIndices) {
      const participantId = normalizeImportId(row[slot.participantId]);
      if (!participantId) continue;
      const normalized = normalizeStartNumber(row[slot.startNumber] || "");
      if (normalized === null && !clearMissing) continue;
      participantAssignments.set(participantId, normalized);
    }
  }

  return {
    teamAssignments,
    participantAssignments,
  };
}

function getLegacySlotIndices(normalizedHeaders: string[]) {
  return [
    {
      firstName: findHeaderIndex(normalizedHeaders, ["laufvorname", "runvorname"]),
      lastName: findHeaderIndex(normalizedHeaders, ["laufname", "runnachname", "runname"]),
      gender: findHeaderIndex(normalizedHeaders, ["laufgeschlecht", "rungeschlecht"]),
      birthYear: findHeaderIndex(normalizedHeaders, ["laufgeburtsjahr", "rungeburtsjahr"]),
      disciplineCode: "RUN",
    },
    {
      firstName: findHeaderIndex(normalizedHeaders, ["bankvorname", "benchvorname"]),
      lastName: findHeaderIndex(normalizedHeaders, ["bankname", "benchnachname", "benchname"]),
      gender: findHeaderIndex(normalizedHeaders, ["bankgeschlecht", "benchgeschlecht"]),
      birthYear: findHeaderIndex(normalizedHeaders, ["bankgeburtsjahr", "benchgeburtsjahr"]),
      disciplineCode: "BENCH",
    },
    {
      firstName: findHeaderIndex(normalizedHeaders, ["stockvorname"]),
      lastName: findHeaderIndex(normalizedHeaders, ["stockname", "stocknachname"]),
      gender: findHeaderIndex(normalizedHeaders, ["stockgeschlecht"]),
      birthYear: findHeaderIndex(normalizedHeaders, ["stockgeburtsjahr"]),
      disciplineCode: "STOCK",
    },
    {
      firstName: findHeaderIndex(normalizedHeaders, ["radvorname", "roadvorname"]),
      lastName: findHeaderIndex(normalizedHeaders, ["radname", "radnachname", "roadname", "roadnachname"]),
      gender: findHeaderIndex(normalizedHeaders, ["radgeschlecht", "roadgeschlecht"]),
      birthYear: findHeaderIndex(normalizedHeaders, ["radgeburtsjahr", "roadgeburtsjahr"]),
      disciplineCode: "ROAD",
    },
    {
      firstName: findHeaderIndex(normalizedHeaders, ["mtbvorname"]),
      lastName: findHeaderIndex(normalizedHeaders, ["mtbname", "mtbnachname"]),
      gender: findHeaderIndex(normalizedHeaders, ["mtbgeschlecht"]),
      birthYear: findHeaderIndex(normalizedHeaders, ["mtbgeburtsjahr"]),
      disciplineCode: "MTB",
    },
  ];
}

function getDashboardSlotIndices(normalizedHeaders: string[]) {
  const slots: Array<{
    firstName: number;
    lastName: number;
    gender: number;
    birthYear: number;
    discipline: number;
  }> = [];

  for (let slot = 1; slot <= 99; slot += 1) {
    const token = String(slot).padStart(2, "0");
    const firstName = findHeaderIndex(normalizedHeaders, [`tn_${token}_vorname`, `tn_${token}_first_name`, `tn_${token}_firstname`]);
    const lastName = findHeaderIndex(normalizedHeaders, [`tn_${token}_nachname`, `tn_${token}_name`, `tn_${token}_last_name`, `tn_${token}_lastname`]);
    const gender = findHeaderIndex(normalizedHeaders, [`tn_${token}_geschlecht`, `tn_${token}_gender`]);
    const birthYear = findHeaderIndex(normalizedHeaders, [`tn_${token}_geburtsjahr`, `tn_${token}_birth_year`, `tn_${token}_birthyear`]);
    const discipline = findHeaderIndex(normalizedHeaders, [`tn_${token}_disziplin`, `tn_${token}_discipline`, `tn_${token}_discipline_code`]);

    if ([firstName, lastName, gender, birthYear, discipline].some((index) => index !== -1)) {
      slots.push({ firstName, lastName, gender, birthYear, discipline });
    }
  }

  return slots;
}

function parseDashboardDisciplineCode(value: string | null | undefined): "RUN" | "BENCH" | "STOCK" | "ROAD" | "MTB" | null {
  const normalized = normalizeLegacyText(value);
  const compact = normalized.replace(/[^a-z0-9]/g, "");
  const aliases: Record<string, "RUN" | "BENCH" | "STOCK" | "ROAD" | "MTB"> = {
    run: "RUN",
    lauf: "RUN",
    laufen: "RUN",
    bench: "BENCH",
    bank: "BENCH",
    bankdruecken: "BENCH",
    bankdrucken: "BENCH",
    stock: "STOCK",
    stockschiessen: "STOCK",
    stockschiesen: "STOCK",
    road: "ROAD",
    rad: "ROAD",
    rennrad: "ROAD",
    mtb: "MTB",
    mountainbike: "MTB",
  };

  return aliases[compact] ?? null;
}

function collectDashboardCreateParticipants(
  row: string[],
  normalizedHeaders: string[],
): LegacyCreateCandidate["participants"] | null {
  const slots = getDashboardSlotIndices(normalizedHeaders);
  if (slots.length === 0) return null;

  const participants: LegacyCreateCandidate["participants"] = [];
  for (const slot of slots) {
    const values = [slot.firstName, slot.lastName, slot.gender, slot.birthYear, slot.discipline]
      .filter((index) => index !== -1)
      .map((index) => (row[index] || "").trim());
    if (values.every((value) => !value)) continue;

    if (slot.firstName === -1 || slot.lastName === -1 || slot.gender === -1 || slot.birthYear === -1 || slot.discipline === -1) {
      return null;
    }

    const firstName = (row[slot.firstName] || "").trim();
    const lastName = (row[slot.lastName] || "").trim();
    const gender = parseLegacyGender(row[slot.gender]);
    const birthYear = parseLegacyBirthYear(row[slot.birthYear]);
    const disciplineCode = parseDashboardDisciplineCode(row[slot.discipline]);
    if (!firstName || !lastName || !gender || !birthYear || !disciplineCode) {
      return null;
    }

    participants.push({
      firstName,
      lastName,
      gender,
      birthYear,
      disciplineCode,
    });
  }

  return participants.length > 0 ? participants : null;
}

function collectLegacyCreateParticipants(
  row: string[],
  normalizedHeaders: string[],
): LegacyCreateCandidate["participants"] | null {
  const participants: LegacyCreateCandidate["participants"] = [];
  for (const slot of getLegacySlotIndices(normalizedHeaders)) {
    if (slot.firstName === -1 || slot.lastName === -1 || slot.gender === -1 || slot.birthYear === -1) {
      return null;
    }

    const firstName = (row[slot.firstName] || "").trim();
    const lastName = (row[slot.lastName] || "").trim();
    const gender = parseLegacyGender(row[slot.gender]);
    const birthYear = parseLegacyBirthYear(row[slot.birthYear]);
    if (!firstName || !lastName || !gender || !birthYear) {
      return null;
    }

    participants.push({
      firstName,
      lastName,
      gender,
      birthYear,
      disciplineCode: slot.disciplineCode as "RUN" | "BENCH" | "STOCK" | "ROAD" | "MTB",
    });
  }

  return participants;
}

function buildLegacyRowSignature(row: string[], normalizedHeaders: string[]) {
  const slots = getLegacySlotIndices(normalizedHeaders);
  return slots
    .map((slot) => {
      if (slot.firstName === -1 || slot.lastName === -1) return "";
      const firstName = normalizeLegacyText(row[slot.firstName]);
      const lastName = normalizeLegacyText(row[slot.lastName]);
      if (!firstName && !lastName) return "";
      const gender = slot.gender === -1 ? "" : normalizeLegacyText(row[slot.gender]);
      const birthYear = slot.birthYear === -1 ? "" : normalizeLegacyText(row[slot.birthYear]);
      return [slot.disciplineCode, firstName, lastName, gender, birthYear].join(":");
    })
    .filter(Boolean)
    .join("|");
}

function buildTeamSignature(team: {
  participants: Array<{
    firstName: string;
    lastName: string;
    gender: "MALE" | "FEMALE";
    birthYear: number;
    disciplineCode: string | null;
  }>;
}) {
  const byDiscipline = new Map(team.participants.map((participant) => [participant.disciplineCode || "TBD", participant]));
  return ["RUN", "BENCH", "STOCK", "ROAD", "MTB"]
    .map((disciplineCode) => {
      const participant = byDiscipline.get(disciplineCode);
      if (!participant) return "";
      return [
        disciplineCode,
        normalizeLegacyText(participant.firstName),
        normalizeLegacyText(participant.lastName),
        participant.gender === "FEMALE" ? "w" : "m",
        String(participant.birthYear),
      ].join(":");
    })
    .filter(Boolean)
    .join("|");
}

function parseLegacyGender(value: string | null | undefined): "MALE" | "FEMALE" | null {
  const normalized = normalizeLegacyText(value);
  if (["w", "weiblich", "female", "f", "frau"].includes(normalized)) return "FEMALE";
  if (["m", "maennlich", "mannlich", "male", "herr", "mann"].includes(normalized)) return "MALE";
  return null;
}

function parseLegacyBirthYear(value: string | null | undefined) {
  const normalized = (value || "").trim();
  const match = normalized.match(/\d{4}/);
  if (!match) return null;
  const birthYear = Number(match[0]);
  return Number.isInteger(birthYear) && birthYear >= 1901 && birthYear <= 2018 ? birthYear : null;
}

function parseLegacyInteger(value: string | null | undefined) {
  const normalized = (value || "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized.replace(",", "."));
  return Number.isInteger(parsed) ? parsed : null;
}

function resolveLegacyClassificationCode(value: string | null | undefined) {
  const normalized = normalizeLegacyText(value);
  if (!normalized) return null;

  const entries = Object.entries(CLASSIFICATIONS);
  const byCode = entries.find(([code]) => normalizeLegacyText(code) === normalized);
  if (byCode) return byCode[0];

  const byLabel = entries.find(([, meta]) => normalizeLegacyText(meta.label) === normalized);
  if (byLabel) return byLabel[0];

  const compact = normalized.replace(/[^a-z0-9]/g, "");
  const aliases: Record<string, string> = {
    sa: "schueler-a",
    schuelera: "schueler-a",
    schuelerinnena: "schueler-a",
    sb: "schueler-b",
    schuelerb: "schueler-b",
    schuelerinnenb: "schueler-b",
    j: "jugend",
    jugend: "jugend",
    da: "damen-a",
    damena: "damen-a",
    db: "damen-b",
    damenb: "damen-b",
    ha: "jungsters",
    jungsters: "jungsters",
    hb: "herren",
    herren: "herren",
    hc: "masters",
    masters: "masters",
  };

  return aliases[compact] ?? null;
}

function collectLegacyCreateCandidates(
  headers: string[],
  rows: string[][],
  dataStartRowNumber: number,
  teams: Array<{
    id: string;
    name: string;
    startNumber: string | null;
    participants: Array<{
      firstName: string;
      lastName: string;
      gender: "MALE" | "FEMALE";
      birthYear: number;
      disciplineCode: string | null;
    }>;
  }>,
): { createCandidates: LegacyCreateCandidate[]; warnings: LegacyImportWarning[] } {
  const normalizedHeaders = headers.map(normalizeHeader);
  const teamIdIndex = findHeaderIndex(normalizedHeaders, TEAM_ID_HEADER_ALIASES);
  const startNumberIndex = findHeaderIndex(normalizedHeaders, START_NUMBER_HEADER_ALIASES);
  const teamNameIndex = findHeaderIndex(normalizedHeaders, TEAM_NAME_HEADER_ALIASES);
  const classificationIndex = findHeaderIndex(normalizedHeaders, ["klasse", "classification", "class"]);
  const totalAgeIndex = findHeaderIndex(normalizedHeaders, ["gesamtalter", "total_age", "totalage"]);

  const createCandidates: LegacyCreateCandidate[] = [];
  const warnings: LegacyImportWarning[] = [];
  const teamsByName = new Map(teams.map((team) => [normalizeLegacyText(team.name), team]));
  const existingStartNumbers = new Set(teams.map((team) => normalizeStartNumber(team.startNumber || "")).filter(Boolean));
  const candidateStartNumbers = new Set<string>();

  if (teamIdIndex === -1 || startNumberIndex === -1 || teamNameIndex === -1) {
    return { createCandidates, warnings };
  }

  rows.forEach((row, index) => {
    const rowNumber = dataStartRowNumber + index;
    const teamId = normalizeImportId(row[teamIdIndex]);
    if (teamId) return;

    const teamName = (row[teamNameIndex] || "").trim();
    const startNumber = normalizeStartNumber(row[startNumberIndex] || "");

    if (!teamName) {
      warnings.push({ row: rowNumber, startNumber, teamName, reason: "missing_team_name" });
      return;
    }
    if (!startNumber) {
      warnings.push({ row: rowNumber, startNumber, teamName, reason: "missing_start_number" });
      return;
    }
    if (teamsByName.has(normalizeLegacyText(teamName))) {
      warnings.push({ row: rowNumber, startNumber, teamName, reason: "existing_team_name" });
      return;
    }
    if (existingStartNumbers.has(startNumber) || candidateStartNumbers.has(startNumber)) {
      warnings.push({ row: rowNumber, startNumber, teamName, reason: "duplicate_start_number" });
      return;
    }

    const participants =
      collectDashboardCreateParticipants(row, normalizedHeaders) ?? collectLegacyCreateParticipants(row, normalizedHeaders);
    if (!participants) {
      warnings.push({ row: rowNumber, startNumber, teamName, reason: "missing_participant_data" });
      return;
    }

    candidateStartNumbers.add(startNumber);
    createCandidates.push({
      row: rowNumber,
      startNumber,
      teamName,
      classificationCode: classificationIndex === -1 ? null : resolveLegacyClassificationCode(row[classificationIndex]),
      totalAge: totalAgeIndex === -1 ? null : parseLegacyInteger(row[totalAgeIndex]),
      participants,
    });
  });

  return { createCandidates, warnings };
}

function collectLegacyAssignments(
  headers: string[],
  rows: string[][],
  dataStartRowNumber: number,
  teams: Array<{
    id: string;
    name: string;
    participants: Array<{
      firstName: string;
      lastName: string;
      gender: "MALE" | "FEMALE";
      birthYear: number;
      disciplineCode: string | null;
    }>;
  }>,
): { teamAssignments: Map<string, string | null>; warnings: LegacyImportWarning[] } {
  const normalizedHeaders = headers.map(normalizeHeader);
  const startNumberIndex = findHeaderIndex(normalizedHeaders, START_NUMBER_HEADER_ALIASES);
  const teamNameIndex = findHeaderIndex(normalizedHeaders, TEAM_NAME_HEADER_ALIASES);

  const teamAssignments = new Map<string, string | null>();
  const warnings: LegacyImportWarning[] = [];

  if (startNumberIndex === -1 || teamNameIndex === -1) {
    return { teamAssignments, warnings };
  }

  const teamsByName = new Map<string, typeof teams>();
  const signatureByTeamId = new Map(teams.map((team) => [team.id, buildTeamSignature(team)]));
  for (const team of teams) {
    const key = normalizeLegacyText(team.name);
    const existing = teamsByName.get(key) || [];
    existing.push(team);
    teamsByName.set(key, existing);
  }

  rows.forEach((row, index) => {
    const rowNumber = dataStartRowNumber + index;
    const startNumber = normalizeStartNumber(row[startNumberIndex] || "");
    const teamName = (row[teamNameIndex] || "").trim();
    if (!teamName) {
      warnings.push({ row: rowNumber, startNumber, teamName, reason: "missing_team_name" });
      return;
    }
    if (!startNumber) {
      warnings.push({ row: rowNumber, startNumber, teamName, reason: "missing_start_number" });
      return;
    }

    const candidates = teamsByName.get(normalizeLegacyText(teamName)) || [];
    if (candidates.length === 0) {
      warnings.push({ row: rowNumber, startNumber, teamName, reason: "unmatched_team" });
      return;
    }

    let matched = candidates;
    if (candidates.length > 1) {
      const rowSignature = buildLegacyRowSignature(row, normalizedHeaders);
      if (rowSignature) {
        matched = candidates.filter((team) => signatureByTeamId.get(team.id) === rowSignature);
      }
    }

    if (matched.length !== 1) {
      warnings.push({
        row: rowNumber,
        startNumber,
        teamName,
        reason: "ambiguous_team",
        candidates: candidates.slice(0, 10).map((team) => ({ teamId: team.id, teamName: team.name })),
      });
      return;
    }

    teamAssignments.set(matched[0].id, startNumber);
  });

  return { teamAssignments, warnings };
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as ImportBody | null;
  if (!body) {
    return NextResponse.json({ error: "Ungueltiger Request-Body" }, { status: 400 });
  }

  const competitionId = body.competitionId?.trim();
  if (!competitionId) {
    return NextResponse.json({ error: "competitionId fehlt" }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  const auth = await requireCompetitionTenantRoles(session, ["ADMIN"], competitionId);
  if ("error" in auth) return auth.error;

  const csv = body.csv?.trim();
  if (!csv) {
    return NextResponse.json({ error: "csv fehlt" }, { status: 400 });
  }

  const columnReady = await startNumberColumnExists();
  if (!columnReady) {
    return NextResponse.json(
      {
        error: 'DB-Migration fehlt: teams.startNumber ist noch nicht vorhanden. Bitte zuerst Migration deployen.',
      },
      { status: 412 },
    );
  }

  const delimiter = typeof body.delimiter === "string" && body.delimiter.length === 1 ? body.delimiter : ";";
  const dryRun = Boolean(body.dryRun);
  const clearMissing = Boolean(body.clearMissing);
  const createMissingTeams = Boolean(body.createMissingTeams);

  const parsed = parseCsv(csv, delimiter);
  if (parsed.headers.length === 0 || parsed.rows.length === 0) {
    return NextResponse.json({ error: "CSV ist leer oder ungueltig" }, { status: 400 });
  }

  const parsedAssignments = collectAssignments(parsed.headers, parsed.rows, clearMissing);
  let legacyWarnings: LegacyImportWarning[] = [];
  let hasAssignments = parsedAssignments.teamAssignments.size > 0 || parsedAssignments.participantAssignments.size > 0;
  const teamsForLegacyMatch = await prisma.team.findMany({
    where: {
      deletedAt: null,
      competitionId,
      competition: { tenantId: auth.tenantId },
    },
    select: {
      id: true,
      name: true,
      startNumber: true,
      participants: {
        where: { deletedAt: null },
        select: {
          firstName: true,
          lastName: true,
          gender: true,
          birthYear: true,
          disciplineCode: true,
        },
      },
    },
  });
  let createCandidates: LegacyCreateCandidate[] = [];
  if (createMissingTeams) {
    const createCandidateResult = collectLegacyCreateCandidates(
      parsed.headers,
      parsed.rows,
      parsed.dataStartRowNumber,
      teamsForLegacyMatch,
    );
    createCandidates = createCandidateResult.createCandidates;
    legacyWarnings = [...legacyWarnings, ...createCandidateResult.warnings];
  }

  if (!hasAssignments && createCandidates.length === 0) {
    const legacyAssignments = collectLegacyAssignments(
      parsed.headers,
      parsed.rows,
      parsed.dataStartRowNumber,
      teamsForLegacyMatch,
    );
    legacyWarnings = [...legacyWarnings, ...legacyAssignments.warnings];
    for (const [teamId, startNumber] of legacyAssignments.teamAssignments) {
      parsedAssignments.teamAssignments.set(teamId, startNumber);
    }
    hasAssignments = parsedAssignments.teamAssignments.size > 0 || parsedAssignments.participantAssignments.size > 0;
  }

  if (!hasAssignments && createCandidates.length === 0) {
    return NextResponse.json(
      {
        error:
          "Keine gueltigen Startnummern-Zuordnungen gefunden. Erwartet: team_id+team_startnummer oder participant_id+startnummer oder tn_XX_id+tn_XX_startnummer.",
        warnings: legacyWarnings,
      },
      { status: 400 },
    );
  }

  const mergedTeamAssignments = new Map(parsedAssignments.teamAssignments);
  const participantIds = [...parsedAssignments.participantAssignments.keys()];
  if (participantIds.length > 0) {
    const participants = await prisma.participant.findMany({
      where: {
        id: { in: participantIds },
        deletedAt: null,
        team: {
          competitionId,
          competition: { tenantId: auth.tenantId },
        },
      },
      select: {
        id: true,
        teamId: true,
      },
    });

    const participantMap = new Map(participants.map((participant) => [participant.id, participant]));
    const missingParticipants = participantIds.filter((id) => !participantMap.has(id));
    if (missingParticipants.length > 0) {
      return NextResponse.json(
        {
          error: "Einige Teilnehmer-IDs konnten im Wettbewerb nicht gefunden werden.",
          missingParticipantIds: missingParticipants,
        },
        { status: 400 },
      );
    }

    const participantConflicts: Array<{ teamId: string; participantId: string; value: string | null; previous: string | null }> = [];
    const teamValueFromParticipants = new Map<string, { value: string | null; participantIds: string[] }>();
    for (const participantId of participantIds) {
      const participant = participantMap.get(participantId);
      if (!participant) continue;
      const value = parsedAssignments.participantAssignments.get(participantId) ?? null;
      const existing = teamValueFromParticipants.get(participant.teamId);
      if (!existing) {
        teamValueFromParticipants.set(participant.teamId, { value, participantIds: [participantId] });
        continue;
      }
      if (existing.value !== value) {
        participantConflicts.push({
          teamId: participant.teamId,
          participantId,
          value,
          previous: existing.value,
        });
        continue;
      }
      existing.participantIds.push(participantId);
    }

    if (participantConflicts.length > 0) {
      return NextResponse.json(
        {
          error: "Konflikt in Teilnehmer-Zeilen: eine Mannschaft hat mehrere unterschiedliche Startnummern.",
          conflicts: participantConflicts.slice(0, 20),
        },
        { status: 400 },
      );
    }

    const mergeConflicts: Array<{ teamId: string; teamValue: string | null; participantValue: string | null }> = [];
    for (const [teamId, fromParticipants] of teamValueFromParticipants) {
      const existing = mergedTeamAssignments.get(teamId);
      if (existing != null && existing !== fromParticipants.value) {
        mergeConflicts.push({
          teamId,
          teamValue: existing,
          participantValue: fromParticipants.value,
        });
        continue;
      }
      if (existing == null) {
        mergedTeamAssignments.set(teamId, fromParticipants.value);
      }
    }

    if (mergeConflicts.length > 0) {
      return NextResponse.json(
        {
          error: "Konflikt zwischen Team- und Teilnehmer-Zeilen fuer dieselbe Mannschaft.",
          conflicts: mergeConflicts.slice(0, 20),
        },
        { status: 400 },
      );
    }
  }

  const teamIds = [...mergedTeamAssignments.keys()];
  const teams = await prisma.team.findMany({
    where: {
      id: { in: teamIds },
      deletedAt: null,
      competitionId,
      competition: { tenantId: auth.tenantId },
    },
    select: {
      id: true,
      name: true,
      startNumber: true,
    },
  });
  const teamMap = new Map(teams.map((team) => [team.id, team]));
  const missingTeams = teamIds.filter((id) => !teamMap.has(id));
  if (missingTeams.length > 0) {
    return NextResponse.json(
      {
        error: "Einige Team-IDs konnten im Wettbewerb nicht gefunden werden.",
        missingTeamIds: missingTeams,
      },
      { status: 400 },
    );
  }

  const changed = teams
    .map((team) => ({
      team,
      nextStartNumber: mergedTeamAssignments.get(team.id) ?? null,
    }))
    .filter(({ team, nextStartNumber }) => (team.startNumber || null) !== (nextStartNumber || null));

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      parsedRows: parsed.rows.length,
      assignments: mergedTeamAssignments.size,
      changed: changed.length,
      createMissingTeams,
      createCandidates: createCandidates.length,
      warnings: legacyWarnings,
      preview: changed.slice(0, 20).map(({ team, nextStartNumber }) => ({
        teamId: team.id,
        teamName: team.name,
        previousStartNumber: team.startNumber,
        nextStartNumber,
      })),
      createPreview: createCandidates.slice(0, 20).map((candidate) => ({
        row: candidate.row,
        teamName: candidate.teamName,
        startNumber: candidate.startNumber,
        classificationCode: candidate.classificationCode,
        totalAge: candidate.totalAge,
        participantCount: candidate.participants.length,
      })),
    });
  }

  const currentUser = await resolveCurrentUser(session);
  const actorId = currentUser.user?.id ?? null;
  const importOwnerEmail = "sebastian.kroeker@proton.me";
  const importOwner = createCandidates.length > 0
    ? await prisma.user.findFirst({
        where: {
          deletedAt: null,
          email: { equals: importOwnerEmail, mode: "insensitive" },
        },
        select: { id: true, name: true, email: true },
      })
    : null;

  if (createCandidates.length > 0 && !importOwner) {
    return NextResponse.json(
      {
        error: `Owner/Kontakt fuer neue Mannschaften nicht gefunden: ${importOwnerEmail}`,
      },
      { status: 400 },
    );
  }

  await prisma.$transaction(async (tx) => {
    for (const entry of changed) {
      await tx.team.update({
        where: { id: entry.team.id },
        data: { startNumber: entry.nextStartNumber },
      });
    }

    const createdTeamAuditEvents = [];
    for (const candidate of createCandidates) {
      const createdTeam = await tx.team.create({
        data: {
          name: candidate.teamName,
          startNumber: candidate.startNumber,
          contactName: importOwner?.name || "Sebastian Kroeker",
          contactEmail: importOwner?.email || importOwnerEmail,
          approved: true,
          totalAge: candidate.totalAge,
          classificationCode: candidate.classificationCode,
          ownerId: importOwner?.id ?? auth.user.id,
          competitionId,
          participants: {
            create: candidate.participants.map((participant) => ({
              firstName: participant.firstName,
              lastName: participant.lastName,
              birthYear: participant.birthYear,
              gender: participant.gender,
              disciplineCode: participant.disciplineCode,
              participantPublicationPreference: "NAME_VERBERGEN",
              consentGiven: false,
            })),
          },
        },
        select: { id: true, name: true, startNumber: true },
      });

      createdTeamAuditEvents.push({
        action: "TEAM_CREATED_FROM_START_NUMBER_IMPORT",
        scopeType: "TEAM",
        scopeId: createdTeam.id,
        entityType: "TEAM",
        entityId: createdTeam.id,
        reason: "csv_import_create_missing_team",
        beforeData: { existed: false },
        afterData: {
          name: createdTeam.name,
          startNumber: createdTeam.startNumber,
          approved: true,
          participantCount: candidate.participants.length,
          ownerEmail: importOwner?.email || importOwnerEmail,
        },
        meta: {
          source: "admin_start_numbers_import",
          competitionId,
          row: candidate.row,
        },
        tenantId: auth.tenantId,
        competitionId,
        actorId: actorId ?? auth.user.id,
      });
    }

    if (changed.length > 0) {
      await tx.auditEvent.createMany({
        data: changed.map((entry) => ({
          action: "TEAM_START_NUMBER_IMPORTED",
          scopeType: "TEAM",
          scopeId: entry.team.id,
          entityType: "TEAM",
          entityId: entry.team.id,
          reason: "csv_import",
          beforeData: { startNumber: entry.team.startNumber || null },
          afterData: { startNumber: entry.nextStartNumber || null },
          meta: {
            source: "admin_start_numbers_import",
            competitionId,
          },
          tenantId: auth.tenantId,
          competitionId,
          actorId: actorId ?? auth.user.id,
        })),
      });
    }

    if (createdTeamAuditEvents.length > 0) {
      await tx.auditEvent.createMany({ data: createdTeamAuditEvents });
    }
  }, { timeout: 30_000 });

  return NextResponse.json({
    ok: true,
    dryRun: false,
    parsedRows: parsed.rows.length,
    assignments: mergedTeamAssignments.size,
    changed: changed.length,
    createMissingTeams,
    createdTeams: createCandidates.length,
    warnings: legacyWarnings,
  });
}
