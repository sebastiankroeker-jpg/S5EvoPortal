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
  const auth = await requireCompetitionTenantRoles(session, ["ADMIN", "MODERATOR"], competitionId);
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
  const hasAssignments = parsedAssignments.teamAssignments.size > 0 || parsedAssignments.participantAssignments.size > 0;
  if (!hasAssignments) {
    return NextResponse.json(
      {
        error:
          "Keine gueltigen Startnummern-Zuordnungen gefunden. Erwartet: team_id+team_startnummer oder participant_id+startnummer oder tn_XX_id+tn_XX_startnummer.",
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
  });
}
