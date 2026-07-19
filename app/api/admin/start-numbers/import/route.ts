import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { resolveCurrentUser } from "@/lib/current-user";
import { requireCompetitionTenantRoles } from "@/lib/server-permissions";

type ImportBody = {
  competitionId?: string;
  csv?: string;
  delimiter?: string;
  dryRun?: boolean;
  clearMissing?: boolean;
};

type ParsedCsv = {
  headers: string[];
  rows: string[][];
};

type ParsedAssignments = {
  teamAssignments: Map<string, string | null>;
  participantAssignments: Map<string, string | null>;
};

type LegacyImportWarning = {
  row: number;
  startNumber: string | null;
  teamName: string;
  reason: "missing_team_name" | "missing_start_number" | "unmatched_team" | "ambiguous_team";
  candidates?: Array<{ teamId: string; teamName: string }>;
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

  if (rows.length === 0) return { headers: [], rows: [] };
  const [headers, ...dataRows] = rows;
  return {
    headers: headers.map((header) => header.trim()),
    rows: dataRows,
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
  const teamIdIndex = normalizedHeaders.findIndex((header) =>
    ["team_id", "teamid", "mannschaft_id"].includes(header),
  );
  const teamStartNumberIndex = normalizedHeaders.findIndex((header) =>
    ["team_startnummer", "team_start_number", "team_startnumber", "startnummer", "start_number", "startnumber"].includes(
      header,
    ),
  );

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
      const teamId = (row[teamIdIndex] || "").trim();
      if (!teamId) continue;
      const normalized = normalizeStartNumber(row[teamStartNumberIndex] || "");
      if (normalized === null && !clearMissing) continue;
      teamAssignments.set(teamId, normalized);
    }
  }

  if (participantIdIndex !== -1 && startNumberIndex !== -1) {
    for (const row of rows) {
      const participantId = (row[participantIdIndex] || "").trim();
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
      const participantId = (row[slot.participantId] || "").trim();
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

function collectLegacyAssignments(
  headers: string[],
  rows: string[][],
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
  const startNumberIndex = findHeaderIndex(normalizedHeaders, ["startnummer", "start_number", "startnumber"]);
  const teamNameIndex = findHeaderIndex(normalizedHeaders, ["mannschaftsname", "team_name", "teamname", "mannschaft"]);

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
    const rowNumber = index + 5;
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

  const parsed = parseCsv(csv, delimiter);
  if (parsed.headers.length === 0 || parsed.rows.length === 0) {
    return NextResponse.json({ error: "CSV ist leer oder ungueltig" }, { status: 400 });
  }

  const parsedAssignments = collectAssignments(parsed.headers, parsed.rows, clearMissing);
  let legacyWarnings: LegacyImportWarning[] = [];
  let hasAssignments = parsedAssignments.teamAssignments.size > 0 || parsedAssignments.participantAssignments.size > 0;
  if (!hasAssignments) {
    const teamsForLegacyMatch = await prisma.team.findMany({
      where: {
        deletedAt: null,
        competitionId,
        competition: { tenantId: auth.tenantId },
      },
      select: {
        id: true,
        name: true,
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
    const legacyAssignments = collectLegacyAssignments(parsed.headers, parsed.rows, teamsForLegacyMatch);
    legacyWarnings = legacyAssignments.warnings;
    for (const [teamId, startNumber] of legacyAssignments.teamAssignments) {
      parsedAssignments.teamAssignments.set(teamId, startNumber);
    }
    hasAssignments = parsedAssignments.teamAssignments.size > 0 || parsedAssignments.participantAssignments.size > 0;
  }

  if (!hasAssignments) {
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
      warnings: legacyWarnings,
      preview: changed.slice(0, 20).map(({ team, nextStartNumber }) => ({
        teamId: team.id,
        teamName: team.name,
        previousStartNumber: team.startNumber,
        nextStartNumber,
      })),
    });
  }

  const currentUser = await resolveCurrentUser(session);
  const actorId = currentUser.user?.id ?? null;

  await prisma.$transaction(async (tx) => {
    for (const entry of changed) {
      await tx.team.update({
        where: { id: entry.team.id },
        data: { startNumber: entry.nextStartNumber },
      });

      await tx.auditEvent.create({
        data: {
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
        },
      });
    }
  });

  return NextResponse.json({
    ok: true,
    dryRun: false,
    parsedRows: parsed.rows.length,
    assignments: mergedTeamAssignments.size,
    changed: changed.length,
    warnings: legacyWarnings,
  });
}
