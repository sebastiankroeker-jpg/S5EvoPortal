import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type CompetitionResetInput = {
  tenantId: string;
  competitionId: string;
  reason: string;
  actorId?: string | null;
  dryRun?: boolean;
};

type CompetitionResetSummary = {
  competition: {
    id: string;
    name: string;
    year: number;
    status: string;
  };
  counts: {
    teamsTotal: number;
    teamsActive: number;
    participantsTotal: number;
    participantsActive: number;
    pendingChangesOpen: number;
    pendingChangesApproved: number;
    pendingChangesRejected: number;
    pendingChangesTotal: number;
    participantAuditLogs: number;
    registrationClaimTokens: number;
    registrationClaimAuditEventsRetained: number;
    competitionRankings: number;
    disciplineResults: number;
    shots: number;
  };
};

type CompetitionResetResult = {
  dryRun: boolean;
  summary: CompetitionResetSummary;
  snapshotId?: string;
  deletedCounts?: CompetitionResetSummary["counts"];
};

function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function loadCompetitionResetScope(
  tx: Prisma.TransactionClient,
  tenantId: string,
  competitionId: string,
) {
  const competition = await tx.competition.findFirst({
    where: { id: competitionId, tenantId },
    include: {
      tenant: {
        select: {
          id: true,
          name: true,
          slug: true,
          claimLinksEnabled: true,
        },
      },
      disciplines: {
        orderBy: { code: "asc" },
      },
      classifications: {
        orderBy: [{ type: "asc" }, { code: "asc" }],
      },
    },
  });

  if (!competition) {
    throw new Error("competition_not_found");
  }

  const teams = await tx.team.findMany({
    where: { competitionId: competition.id },
    orderBy: { createdAt: "asc" },
  });
  const teamIds = teams.map((team) => team.id);

  const participants = teamIds.length
    ? await tx.participant.findMany({
        where: { teamId: { in: teamIds } },
        orderBy: { createdAt: "asc" },
      })
    : [];
  const participantIds = participants.map((participant) => participant.id);

  const pendingChanges = participantIds.length
    ? await tx.pendingChange.findMany({
        where: { participantId: { in: participantIds } },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const participantAuditLogs = participantIds.length
    ? await tx.participantAuditLog.findMany({
        where: { participantId: { in: participantIds } },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const disciplineResults = participantIds.length
    ? await tx.disciplineResult.findMany({
        where: { participantId: { in: participantIds } },
        orderBy: { createdAt: "asc" },
      })
    : [];
  const resultIds = disciplineResults.map((result) => result.id);

  const shots = resultIds.length
    ? await tx.shot.findMany({
        where: { resultId: { in: resultIds } },
        orderBy: [{ resultId: "asc" }, { shotNumber: "asc" }],
      })
    : [];

  const competitionRankings = teamIds.length
    ? await tx.competitionRanking.findMany({
        where: { teamId: { in: teamIds } },
        orderBy: { rank: "asc" },
      })
    : [];

  const registrationClaimTokens = teamIds.length
    ? await tx.registrationClaimToken.findMany({
        where: { teamId: { in: teamIds } },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const registrationClaimAuditEvents = teamIds.length
    ? await tx.registrationClaimAuditEvent.findMany({
        where: { teamId: { in: teamIds } },
        orderBy: { createdAt: "asc" },
      })
    : [];

  return {
    competition,
    teams,
    participants,
    pendingChanges,
    participantAuditLogs,
    disciplineResults,
    shots,
    competitionRankings,
    registrationClaimTokens,
    registrationClaimAuditEvents,
  };
}

function buildSummary(scope: Awaited<ReturnType<typeof loadCompetitionResetScope>>): CompetitionResetSummary {
  const pendingChangesOpen = scope.pendingChanges.filter((change) => change.status === "PENDING").length;
  const pendingChangesApproved = scope.pendingChanges.filter((change) => change.status === "APPROVED").length;
  const pendingChangesRejected = scope.pendingChanges.filter((change) => change.status === "REJECTED").length;

  return {
    competition: {
      id: scope.competition.id,
      name: scope.competition.name,
      year: scope.competition.year,
      status: scope.competition.status,
    },
    counts: {
      teamsTotal: scope.teams.length,
      teamsActive: scope.teams.filter((team) => !team.deletedAt).length,
      participantsTotal: scope.participants.length,
      participantsActive: scope.participants.filter((participant) => !participant.deletedAt).length,
      pendingChangesOpen,
      pendingChangesApproved,
      pendingChangesRejected,
      pendingChangesTotal: scope.pendingChanges.length,
      participantAuditLogs: scope.participantAuditLogs.length,
      registrationClaimTokens: scope.registrationClaimTokens.length,
      registrationClaimAuditEventsRetained: scope.registrationClaimAuditEvents.length,
      competitionRankings: scope.competitionRankings.length,
      disciplineResults: scope.disciplineResults.length,
      shots: scope.shots.length,
    },
  };
}

export async function resetCompetitionData(input: CompetitionResetInput): Promise<CompetitionResetResult> {
  const dryRun = Boolean(input.dryRun);
  const trimmedReason = input.reason.trim();

  if (!trimmedReason) {
    throw new Error("reset_reason_required");
  }

  return prisma.$transaction(async (tx) => {
    const scope = await loadCompetitionResetScope(tx, input.tenantId, input.competitionId);
    const summary = buildSummary(scope);

    if (dryRun) {
      await tx.auditEvent.create({
        data: {
          action: "COMPETITION_RESET_DRY_RUN",
          scopeType: "competition",
          scopeId: scope.competition.id,
          entityType: "Competition",
          entityId: scope.competition.id,
          reason: trimmedReason,
          beforeData: asJson(summary),
          meta: asJson({
            dryRun: true,
            competitionName: scope.competition.name,
            competitionYear: scope.competition.year,
          }),
          tenantId: input.tenantId,
          competitionId: scope.competition.id,
          actorId: input.actorId || null,
        },
      });

      return {
        dryRun: true,
        summary,
      };
    }

    await tx.auditEvent.create({
      data: {
        action: "COMPETITION_RESET_STARTED",
        scopeType: "competition",
        scopeId: scope.competition.id,
        entityType: "Competition",
        entityId: scope.competition.id,
        reason: trimmedReason,
        beforeData: asJson(summary),
        meta: asJson({
          phase: "start",
          competitionName: scope.competition.name,
          competitionYear: scope.competition.year,
        }),
        tenantId: input.tenantId,
        competitionId: scope.competition.id,
        actorId: input.actorId || null,
      },
    });

    const snapshot = await tx.competitionResetSnapshot.create({
      data: {
        reason: trimmedReason,
        summary: asJson(summary),
        snapshot: asJson({
          capturedAt: new Date().toISOString(),
          competition: scope.competition,
          teams: scope.teams,
          participants: scope.participants,
          pendingChanges: scope.pendingChanges,
          participantAuditLogs: scope.participantAuditLogs,
          disciplineResults: scope.disciplineResults,
          shots: scope.shots,
          competitionRankings: scope.competitionRankings,
          registrationClaimTokens: scope.registrationClaimTokens,
          registrationClaimAuditEvents: scope.registrationClaimAuditEvents,
        }),
        tenantId: input.tenantId,
        competitionId: scope.competition.id,
        createdById: input.actorId || null,
      },
    });

    await tx.team.deleteMany({
      where: { competitionId: scope.competition.id },
    });

    const afterSummary = {
      competition: summary.competition,
      counts: {
        teamsTotal: 0,
        teamsActive: 0,
        participantsTotal: 0,
        participantsActive: 0,
        pendingChangesOpen: 0,
        pendingChangesApproved: 0,
        pendingChangesRejected: 0,
        pendingChangesTotal: 0,
        participantAuditLogs: 0,
        registrationClaimTokens: 0,
        registrationClaimAuditEventsRetained: summary.counts.registrationClaimAuditEventsRetained,
        competitionRankings: 0,
        disciplineResults: 0,
        shots: 0,
      },
    } satisfies CompetitionResetSummary;

    await tx.auditEvent.create({
      data: {
        action: "COMPETITION_RESET_COMPLETED",
        scopeType: "competition",
        scopeId: scope.competition.id,
        entityType: "Competition",
        entityId: scope.competition.id,
        reason: trimmedReason,
        beforeData: asJson(summary),
        afterData: asJson(afterSummary),
        meta: asJson({
          phase: "completed",
          snapshotId: snapshot.id,
          retainedRegistrationClaimAuditEvents: summary.counts.registrationClaimAuditEventsRetained,
        }),
        tenantId: input.tenantId,
        competitionId: scope.competition.id,
        actorId: input.actorId || null,
      },
    });

    return {
      dryRun: false,
      summary,
      snapshotId: snapshot.id,
      deletedCounts: summary.counts,
    };
  });
}
