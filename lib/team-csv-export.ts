import { prisma } from "@/lib/prisma";
import type { TeamExportColumnKey } from "@/lib/dashboard-layout-config";

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

function formatParticipantList(team: CompetitionExportRecord["teams"][number]) {
  return [...team.participants]
    .sort((a, b) => {
      const disciplineCompare = getDisciplineSortOrder(a.disciplineCode) - getDisciplineSortOrder(b.disciplineCode);
      if (disciplineCompare !== 0) return disciplineCompare;
      return a.createdAt.getTime() - b.createdAt.getTime();
    })
    .map((participant) => {
      const gender = participant.gender === "FEMALE" ? "W" : "M";
      return `${participant.firstName} ${participant.lastName} (${participant.birthYear}, ${gender}, ${participant.disciplineCode || "TBD"})`;
    })
    .join(" | ");
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

export async function loadTeamStartNumbersForCompetition(competitionId: string) {
  if (!(await startNumberColumnExists())) {
    return new Map<string, string | null>();
  }

  const rows = await prisma.$queryRaw<Array<{ id: string; startNumber: string | null }>>`
    SELECT t.id, t."startNumber"
    FROM teams t
    WHERE t."competitionId" = ${competitionId}
      AND t."deletedAt" IS NULL
  `;

  return new Map(rows.map((row) => [row.id, row.startNumber]));
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

export function buildCompetitionTeamsCsv(
  competition: CompetitionExportRecord,
  startNumberByTeamId?: Map<string, string | null>,
) {
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
    "team_startnummer",
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
      startNumberByTeamId?.get(team.id) ?? null,
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
        row.push(null, null, null, null, null, null);
        continue;
      }

      row.push(
        participant.id,
        participant.firstName,
        participant.lastName,
        participant.birthYear,
        participant.gender === "FEMALE" ? "W" : "M",
        participant.disciplineCode || "TBD",
      );
    }

    rows.push(row);
  }

  return [headers, ...rows]
    .map((row) => row.map((value) => escapeCsvValue(value)).join(";"))
    .join("\n");
}

export function buildCompetitionTeamsCsvAttachment(
  competition: CompetitionExportRecord,
  startNumberByTeamId?: Map<string, string | null>,
) {
  const timestamp = new Date().toISOString().slice(0, 10);
  const safeName = competition.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const filename = `teams-export-${competition.year}-${safeName || "competition"}-${timestamp}.csv`;
  const csv = buildCompetitionTeamsCsv(competition, startNumberByTeamId);

  return {
    filename,
    content: Buffer.from("\uFEFF" + csv, "utf8").toString("base64"),
    contentType: "text/csv; charset=utf-8",
  };
}

type TeamExportColumnDefinition = {
  header: string;
  render: (
    input: {
      competition: CompetitionExportRecord;
      team: CompetitionExportRecord["teams"][number];
      startNumberByTeamId?: Map<string, string | null>;
    },
  ) => string | number | null | undefined;
};

export const TEAM_EXPORT_COLUMN_DEFINITIONS: Record<TeamExportColumnKey, TeamExportColumnDefinition> = {
  teamName: {
    header: "team_name",
    render: ({ team }) => team.name,
  },
  category: {
    header: "klasse",
    render: ({ team }) => team.classificationCode,
  },
  contactName: {
    header: "team_kontakt_name",
    render: ({ team }) => team.contactName,
  },
  contactEmail: {
    header: "team_kontakt_email",
    render: ({ team }) => team.contactEmail,
  },
  ownerEmail: {
    header: "team_owner_email",
    render: ({ team }) => team.owner.email,
  },
  participantCount: {
    header: "teilnehmer_anzahl",
    render: ({ team }) => team.participants.length,
  },
  participants: {
    header: "teilnehmer",
    render: ({ team }) => formatParticipantList(team),
  },
  createdAt: {
    header: "team_created_at",
    render: ({ team }) => formatDateTime(team.createdAt),
  },
  updatedAt: {
    header: "team_updated_at",
    render: ({ team }) => formatDateTime(team.updatedAt),
  },
};

export function buildCompetitionTeamsLayoutCsv(
  competition: CompetitionExportRecord,
  columnKeys: TeamExportColumnKey[],
  options: {
    startNumberByTeamId?: Map<string, string | null>;
    teamIds?: string[];
  } = {},
) {
  const allowedColumns = columnKeys
    .map((key) => [key, TEAM_EXPORT_COLUMN_DEFINITIONS[key]] as const)
    .filter((entry): entry is readonly [TeamExportColumnKey, TeamExportColumnDefinition] => Boolean(entry[1]));
  const columns = allowedColumns.length > 0
    ? allowedColumns
    : (Object.entries(TEAM_EXPORT_COLUMN_DEFINITIONS) as Array<[TeamExportColumnKey, TeamExportColumnDefinition]>);
  const teamOrder = new Map((options.teamIds || []).map((id, index) => [id, index]));
  const teams = options.teamIds
    ? competition.teams
        .filter((team) => teamOrder.has(team.id))
        .sort((left, right) => (teamOrder.get(left.id) ?? 0) - (teamOrder.get(right.id) ?? 0))
    : competition.teams;

  const headers = columns.map(([, definition]) => definition.header);
  const rows = teams.map((team) =>
    columns.map(([, definition]) =>
      definition.render({
        competition,
        team,
        startNumberByTeamId: options.startNumberByTeamId,
      }),
    ),
  );

  return [headers, ...rows]
    .map((row) => row.map((value) => escapeCsvValue(value)).join(";"))
    .join("\n");
}

export function buildCompetitionTeamsLayoutCsvAttachment(
  competition: CompetitionExportRecord,
  columnKeys: TeamExportColumnKey[],
  options: {
    startNumberByTeamId?: Map<string, string | null>;
    teamIds?: string[];
    layoutName?: string | null;
  } = {},
) {
  const timestamp = new Date().toISOString().slice(0, 10);
  const safeCompetitionName = competition.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const safeLayoutName = (options.layoutName || "layout")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const filename = `teams-export-${competition.year}-${safeCompetitionName || "competition"}-${safeLayoutName || "layout"}-${timestamp}.csv`;
  const csv = buildCompetitionTeamsLayoutCsv(competition, columnKeys, options);

  return {
    filename,
    content: Buffer.from("\uFEFF" + csv, "utf8").toString("base64"),
    contentType: "text/csv; charset=utf-8",
  };
}
