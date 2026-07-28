import { Prisma } from "@prisma/client";

import { COURSE_ROUTES } from "@/lib/event-map/course-routes";
import { prisma } from "@/lib/prisma";

export type CompetitionCloneInput = {
  name: string;
  year: number;
};

export type CompetitionCloneSummary = {
  disciplines: number;
  classifications: number;
  homeNewsDrafts: number;
  sharedMapRoutes: number;
  excluded: readonly string[];
};

const EXCLUDED_DATA = [
  "teams",
  "participants",
  "disciplineResults",
  "rankings",
  "claimTokens",
  "messages",
  "auditEvents",
  "visitorCounters",
  "timekeeping",
  "resultStaging",
] as const;

type CloneClient = Prisma.TransactionClient;

function cloneJson(value: Prisma.JsonValue): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === null ? Prisma.JsonNull : value as Prisma.InputJsonValue;
}

async function loadSource(client: CloneClient, tenantId: string, sourceCompetitionId: string) {
  return client.competition.findFirst({
    where: { id: sourceCompetitionId, tenantId },
    include: {
      disciplines: {
        select: { code: true, name: true, unit: true, sortOrder: true, type: true },
        orderBy: { code: "asc" },
      },
      classifications: {
        select: { code: true, name: true, type: true, minAge: true, maxAge: true, genderRestriction: true, sourceClassCodes: true },
        orderBy: { code: "asc" },
      },
      homeNewsEntries: {
        where: { status: { not: "ARCHIVED" }, archivedAt: null },
        select: { title: true, body: true },
        orderBy: { updatedAt: "desc" },
      },
    },
  });
}

function buildSummary(source: NonNullable<Awaited<ReturnType<typeof loadSource>>>): CompetitionCloneSummary {
  return {
    disciplines: source.disciplines.length,
    classifications: source.classifications.length,
    homeNewsDrafts: source.homeNewsEntries.length,
    sharedMapRoutes: COURSE_ROUTES.length,
    excluded: EXCLUDED_DATA,
  };
}

export async function previewCompetitionClone(input: {
  tenantId: string;
  sourceCompetitionId: string;
  target: CompetitionCloneInput;
}) {
  const [source, existingTarget] = await Promise.all([
    loadSource(prisma, input.tenantId, input.sourceCompetitionId),
    prisma.competition.findFirst({
      where: { tenantId: input.tenantId, year: input.target.year },
      select: { id: true },
    }),
  ]);

  if (!source) throw new Error("competition_clone_source_not_found");
  if (existingTarget) throw new Error("competition_clone_target_year_exists");

  return {
    source: { id: source.id, name: source.name, year: source.year },
    target: { name: input.target.name, year: input.target.year, status: "DRAFT" as const },
    summary: buildSummary(source),
  };
}

export async function cloneCompetition(input: {
  tenantId: string;
  sourceCompetitionId: string;
  actorId: string;
  target: CompetitionCloneInput;
}) {
  return prisma.$transaction(async (tx) => {
    const source = await loadSource(tx, input.tenantId, input.sourceCompetitionId);
    if (!source) throw new Error("competition_clone_source_not_found");

    const existingTarget = await tx.competition.findFirst({
      where: { tenantId: input.tenantId, year: input.target.year },
      select: { id: true },
    });
    if (existingTarget) throw new Error("competition_clone_target_year_exists");

    const target = await tx.competition.create({
      data: {
        name: input.target.name,
        year: input.target.year,
        // Time-bound and contact-bearing settings must be reviewed for each year.
        date: null,
        dateEnd: null,
        registrationDeadline: null,
        shirtOrderDeadline: null,
        registrationNotificationEmail: null,
        ageReferenceDate: new Date(Date.UTC(input.target.year, 11, 31)),
        status: "DRAFT",
        claimTokenExpiryMode: source.claimTokenExpiryMode,
        claimTokenTtlDays: source.claimTokenTtlDays,
        teamOwnerFilterVisibleForTeamchef: source.teamOwnerFilterVisibleForTeamchef,
        participantsCanViewAllTeams: source.participantsCanViewAllTeams,
        spectatorsCanViewAllTeams: source.spectatorsCanViewAllTeams,
        hideForeignTeams: source.hideForeignTeams,
        liveTeamsVisibility: source.liveTeamsVisibility,
        liveStartlistsVisibility: source.liveStartlistsVisibility,
        liveResultsVisibility: source.liveResultsVisibility,
        liveResultsDisciplines: cloneJson(source.liveResultsDisciplines),
        marketplaceGlobalVisibility: source.marketplaceGlobalVisibility,
        maxTeams: source.maxTeams,
        teamSize: source.teamSize,
        benchPressTara: source.benchPressTara,
        benchPressMode: source.benchPressMode,
        stockShotsCount: source.stockShotsCount,
        stockStrikeoutCount: source.stockStrikeoutCount,
        location: source.location,
        publicResults: source.publicResults,
        tenantId: input.tenantId,
        disciplines: {
          create: source.disciplines.map((discipline) => ({
            code: discipline.code,
            name: discipline.name,
            unit: discipline.unit,
            sortOrder: discipline.sortOrder,
            type: discipline.type,
          })),
        },
        classifications: {
          create: source.classifications.map((classification) => ({
            code: classification.code,
            name: classification.name,
            type: classification.type,
            minAge: classification.minAge,
            maxAge: classification.maxAge,
            genderRestriction: classification.genderRestriction,
            sourceClassCodes: classification.sourceClassCodes,
          })),
        },
        homeNewsEntries: {
          create: source.homeNewsEntries.map((entry) => ({
            title: entry.title,
            body: entry.body,
            status: "DRAFT",
            createdById: input.actorId,
            updatedById: input.actorId,
            tenantId: input.tenantId,
          })),
        },
      },
      select: { id: true, name: true, year: true, status: true },
    });

    const summary = buildSummary(source);
    await tx.auditEvent.create({
      data: {
        action: "COMPETITION_CLONED",
        scopeType: "competition",
        scopeId: target.id,
        entityType: "Competition",
        entityId: target.id,
        afterData: {
          sourceCompetitionId: source.id,
          targetCompetitionId: target.id,
          targetYear: target.year,
          copied: {
            disciplines: summary.disciplines,
            classifications: summary.classifications,
            homeNewsDrafts: summary.homeNewsDrafts,
            sharedMapRoutes: summary.sharedMapRoutes,
          },
          excluded: summary.excluded,
          clearedForReview: ["dates", "deadlines", "registrationNotificationEmail"],
        },
        tenantId: input.tenantId,
        competitionId: target.id,
        actorId: input.actorId,
      },
    });

    return { competition: target, summary };
  });
}
