import { prisma } from "@/lib/prisma";

type CompetitionExportRecord = {
  id: string;
  name: string;
  year: number;
  teamSize: number;
  registrationNotificationEmail: string | null;
  tenant: {
    name: string;
    contactEmail: string | null;
  };
  teams: Array<{
    id: string;
    name: string;
    classificationCode: string | null;
    contactName: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    clubName: string | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    owner: {
      name: string | null;
      email: string;
    };
    participants: Array<{
      id: string;
      firstName: string;
      lastName: string;
      birthYear: number;
      gender: "MALE" | "FEMALE";
      disciplineCode: string | null;
      shirtSize: string | null;
      moderationNote: string | null;
      email: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>;
  }>;
};

function escapeCsvValue(value: string | number | null | undefined) {
  const normalized = value == null ? "" : String(value);
  return '"' + normalized.replace(/"/g, '""') + '"';
}

function normalizeRecipientList(value?: string | null): string[] {
  if (!value) {
    return [];
  }

  return [...new Set(
    value
      .split(/[;,]/)
      .map((recipient) => recipient.trim())
      .filter(Boolean),
  )];
}

function formatDateTime(value?: Date | null) {
  return value ? value.toISOString() : "";
}

const DISCIPLINE_ORDER: Record<string, number> = {
  RUN: 1,
  BENCH: 2,
  STOCK: 3,
  ROAD: 4,
  MTB: 5,
  TBD: 99,
};

function getDisciplineSortOrder(code?: string | null) {
  if (!code) return DISCIPLINE_ORDER.TBD;
  return DISCIPLINE_ORDER[code] ?? DISCIPLINE_ORDER.TBD;
}

export function resolveCompetitionExportRecipients(competition: {
  registrationNotificationEmail?: string | null;
  tenant?: { contactEmail?: string | null } | null;
}) {
  const directRecipients = normalizeRecipientList(competition.registrationNotificationEmail);
  if (directRecipients.length > 0) {
    return directRecipients;
  }

  return normalizeRecipientList(competition.tenant?.contactEmail);
}

type CompetitionExportQuery = {
  competitionId?: string;
  tenantId?: string;
  openOnly?: boolean;
};

export async function loadCompetitionsForDailyExport({
  competitionId,
  tenantId,
  openOnly = true,
}: CompetitionExportQuery = {}) {
  return prisma.competition.findMany({
    where: {
      ...(openOnly ? { status: "OPEN" } : {}),
      ...(tenantId ? { tenantId } : {}),
      ...(competitionId ? { id: competitionId } : {}),
    },
    orderBy: [{ year: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      year: true,
      teamSize: true,
      registrationNotificationEmail: true,
      tenant: {
        select: {
          name: true,
          contactEmail: true,
        },
      },
      teams: {
        where: { deletedAt: null },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          classificationCode: true,
          contactName: true,
          contactEmail: true,
          contactPhone: true,
          clubName: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
          owner: {
            select: {
              name: true,
              email: true,
            },
          },
          participants: {
            where: { deletedAt: null },
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              birthYear: true,
              gender: true,
              disciplineCode: true,
              shirtSize: true,
              moderationNote: true,
              email: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      },
    },
  }) satisfies Promise<CompetitionExportRecord[]>;
}

export function buildCompetitionTeamsCsv(competition: CompetitionExportRecord) {
  const maxParticipantSlots = Math.max(
    competition.teamSize || 0,
    ...competition.teams.map((team) => team.participants.length),
    1,
  );

  const headers = [
    "wettkampf_jahr",
    "wettkampf_name",
    "tenant_name",
    "team_id",
    "team_name",
    "klasse",
    "team_kontakt_name",
    "team_kontakt_email",
    "team_kontakt_telefon",
    "verein",
    "team_owner_name",
    "team_owner_email",
    "team_notizen",
    "team_created_at",
    "team_updated_at",
    "teilnehmer_anzahl",
  ];
  for (let slot = 1; slot <= maxParticipantSlots; slot += 1) {
    const label = String(slot).padStart(2, "0");
    headers.push(`tn_${label}_id`);
    headers.push(`tn_${label}_vorname`);
    headers.push(`tn_${label}_nachname`);
    headers.push(`tn_${label}_geburtsjahr`);
    headers.push(`tn_${label}_geschlecht`);
    headers.push(`tn_${label}_disziplin`);
    headers.push(`tn_${label}_startnummer`);
  }

  const rows: Array<Array<string | number | null | undefined>> = [];
  for (const team of competition.teams) {
    const sortedParticipants = [...team.participants].sort((a, b) => {
      const disciplineCompare = getDisciplineSortOrder(a.disciplineCode) - getDisciplineSortOrder(b.disciplineCode);
      if (disciplineCompare !== 0) return disciplineCompare;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    const row: Array<string | number | null | undefined> = [
      competition.year,
      competition.name,
      competition.tenant.name,
      team.id,
      team.name,
      team.classificationCode,
      team.contactName,
      team.contactEmail,
      team.contactPhone,
      team.clubName,
      team.owner.name,
      team.owner.email,
      team.notes,
      formatDateTime(team.createdAt),
      formatDateTime(team.updatedAt),
      team.participants.length,
    ];

    for (let slot = 0; slot < maxParticipantSlots; slot += 1) {
      const participant = sortedParticipants[slot];
      if (!participant) {
        row.push(null, null, null, null, null, null, null);
        continue;
      }

      row.push(
        participant.id,
        participant.firstName,
        participant.lastName,
        participant.birthYear,
        participant.gender === "FEMALE" ? "W" : "M",
        participant.disciplineCode || "TBD",
        null, // Startnummer: aktuell Platzhalter bis Vergabe/Import vorhanden ist
      );
    }

    rows.push(row);
  }

  return [headers, ...rows]
    .map((row) => row.map((value) => escapeCsvValue(value)).join(";"))
    .join("\n");
}

export function buildCompetitionTeamsCsvAttachment(competition: CompetitionExportRecord) {
  const timestamp = new Date().toISOString().slice(0, 10);
  const safeName = competition.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const filename = `teams-export-${competition.year}-${safeName || "competition"}-${timestamp}.csv`;
  const csv = buildCompetitionTeamsCsv(competition);

  return {
    filename,
    content: Buffer.from("\uFEFF" + csv, "utf8").toString("base64"),
    contentType: "text/csv; charset=utf-8",
  };
}
