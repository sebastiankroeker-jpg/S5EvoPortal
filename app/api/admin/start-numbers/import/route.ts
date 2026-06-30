import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { resolveCurrentUser } from "@/lib/current-user";
import { requireTenantRoles } from "@/lib/server-permissions";

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
        AND table_name = 'participants'
        AND column_name = 'startNumber'
    ) AS "exists"
  `;
  return Boolean(result[0]?.exists);
}

function collectAssignments(
  headers: string[],
  rows: string[][],
  clearMissing: boolean,
) {
  const normalizedHeaders = headers.map(normalizeHeader);
  const participantIdIndex = normalizedHeaders.findIndex((header) =>
    ["participant_id", "participantid", "tn_id", "teilnehmer_id"].includes(header),
  );
  const startNumberIndex = normalizedHeaders.findIndex((header) =>
    ["startnummer", "start_number", "startnumber", "tn_startnummer"].includes(header),
  );

  const assignments = new Map<string, string | null>();

  if (participantIdIndex !== -1 && startNumberIndex !== -1) {
    for (const row of rows) {
      const participantId = (row[participantIdIndex] || "").trim();
      if (!participantId) continue;
      const normalized = normalizeStartNumber(row[startNumberIndex] || "");
      if (normalized === null && !clearMissing) continue;
      assignments.set(participantId, normalized);
    }
    return assignments;
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
      assignments.set(participantId, normalized);
    }
  }

  return assignments;
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const auth = await requireTenantRoles(session, ["ADMIN", "MODERATOR"]);
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => null)) as ImportBody | null;
  if (!body) {
    return NextResponse.json({ error: "Ungueltiger Request-Body" }, { status: 400 });
  }

  const competitionId = body.competitionId?.trim();
  if (!competitionId) {
    return NextResponse.json({ error: "competitionId fehlt" }, { status: 400 });
  }

  const csv = body.csv?.trim();
  if (!csv) {
    return NextResponse.json({ error: "csv fehlt" }, { status: 400 });
  }

  const columnReady = await startNumberColumnExists();
  if (!columnReady) {
    return NextResponse.json(
      {
        error: 'DB-Migration fehlt: participants.startNumber ist noch nicht vorhanden. Bitte zuerst Migration deployen.',
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

  const assignments = collectAssignments(parsed.headers, parsed.rows, clearMissing);
  if (assignments.size === 0) {
    return NextResponse.json(
      {
        error:
          "Keine gueltigen Startnummern-Zuordnungen gefunden. Erwartet: participant_id+startnummer oder tn_XX_id+tn_XX_startnummer.",
      },
      { status: 400 },
    );
  }

  const participantIds = [...assignments.keys()];
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
      firstName: true,
      lastName: true,
      startNumber: true,
    },
  });

  const participantMap = new Map(participants.map((participant) => [participant.id, participant]));
  const missing = participantIds.filter((id) => !participantMap.has(id));
  if (missing.length > 0) {
    return NextResponse.json(
      {
        error: "Einige Teilnehmer-IDs konnten im Wettbewerb nicht gefunden werden.",
        missingParticipantIds: missing,
      },
      { status: 400 },
    );
  }

  const changed = participants
    .map((participant) => ({
      participant,
      nextStartNumber: assignments.get(participant.id) ?? null,
    }))
    .filter(({ participant, nextStartNumber }) => (participant.startNumber || null) !== (nextStartNumber || null));

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      parsedRows: parsed.rows.length,
      assignments: assignments.size,
      changed: changed.length,
      preview: changed.slice(0, 20).map(({ participant, nextStartNumber }) => ({
        participantId: participant.id,
        participantName: `${participant.firstName} ${participant.lastName}`.trim(),
        previousStartNumber: participant.startNumber,
        nextStartNumber,
      })),
    });
  }

  const currentUser = await resolveCurrentUser(session);
  const actorId = currentUser.user?.id ?? null;

  await prisma.$transaction(async (tx) => {
    for (const entry of changed) {
      await tx.participant.update({
        where: { id: entry.participant.id },
        data: { startNumber: entry.nextStartNumber },
      });

      await tx.participantAuditLog.create({
        data: {
          action: "DIRECT_CHANGE",
          participantId: entry.participant.id,
          actorId,
          beforeData: JSON.stringify({ startNumber: entry.participant.startNumber || null }),
          afterData: JSON.stringify({ startNumber: entry.nextStartNumber || null }),
          message: "Startnummer per CSV-Import aktualisiert",
        },
      });
    }
  });

  return NextResponse.json({
    ok: true,
    dryRun: false,
    parsedRows: parsed.rows.length,
    assignments: assignments.size,
    changed: changed.length,
  });
}
