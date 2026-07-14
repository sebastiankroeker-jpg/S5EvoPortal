import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Prisma } from "@prisma/client";

import { evaluateTeamState, type TeamStateParticipantInput } from "@/lib/domain/classification";
import {
  parseSnapshot,
  serializeSnapshot,
  summarizeParticipantRequestConflicts,
  toParticipantSnapshot,
  type ParticipantSnapshot,
} from "@/lib/participant-change";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { requireTenantRoles } from "@/lib/server-permissions";

// GET /api/admin/pending-changes — Änderungsanträge für das Admin-Dashboard
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const auth = await requireTenantRoles(session, ["ADMIN", "MODERATOR"]);
  if ("error" in auth) return auth.error;

  const scope = request.nextUrl.searchParams.get("scope");
  const includeDirectChanges = scope === "all";
  const whereStatus =
    scope === "all"
      ? undefined
      : "PENDING";

  const changeRequests = await prisma.changeRequest.findMany({
    where: {
      status: whereStatus ? "PENDING" : { in: ["PENDING", "APPROVED", "APPLIED", "REJECTED"] },
      tenantId: auth.tenantId,
      targetType: "PARTICIPANT",
      changeType: "UPDATE",
    },
    include: {
      requestedBy: { select: { name: true, email: true } },
      reviewedBy: { select: { name: true, email: true } },
      auditLogs: {
        orderBy: { createdAt: "desc" },
        take: 4,
        select: {
          id: true,
          action: true,
          createdAt: true,
          message: true,
          actor: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      },
    },
    orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
  });
  const teamChangeRequests = await prisma.changeRequest.findMany({
    where: {
      status: whereStatus ? "PENDING" : { in: ["PENDING", "APPROVED", "APPLIED", "REJECTED"] },
      tenantId: auth.tenantId,
      targetType: "TEAM",
      changeType: "UPDATE",
    },
    include: {
      requestedBy: { select: { name: true, email: true } },
      reviewedBy: { select: { name: true, email: true } },
      auditLogs: {
        orderBy: { createdAt: "desc" },
        take: 4,
        select: {
          id: true,
          action: true,
          createdAt: true,
          message: true,
          actor: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      },
    },
    orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
  });
  const participantIds = [...new Set(changeRequests.map((change) => change.targetId))];
  const teamIds = [...new Set(teamChangeRequests.map((change) => change.targetId))];
  const participantById = new Map(
    (participantIds.length
      ? await prisma.participant.findMany({
          where: {
            id: { in: participantIds },
            team: {
              competition: {
                tenantId: auth.tenantId,
              },
            },
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            birthYear: true,
            birthDate: true,
            gender: true,
            disciplineCode: true,
            shirtSize: true,
            moderationNote: true,
            participantPublicationPreference: true,
            email: true,
            team: {
              select: {
                id: true,
                name: true,
                classificationCode: true,
                contactEmail: true,
                participants: {
                  where: { deletedAt: null },
                  select: {
                    id: true,
                    birthYear: true,
                    gender: true,
                    disciplineCode: true,
                  },
                },
              },
            },
          },
        })
      : []).map((participant) => [participant.id, participant]),
  );
  const teamById = new Map(
    (teamIds.length
      ? await prisma.team.findMany({
          where: {
            id: { in: teamIds },
            competition: {
              tenantId: auth.tenantId,
            },
          },
          select: {
            id: true,
            name: true,
            contactEmail: true,
          },
        })
      : []).map((team) => [team.id, team]),
  );
  const legacyPendingChangeIds = new Set(
    changeRequests.flatMap((changeRequest) => {
      const legacyPendingChangeId = getLegacyPendingChangeId(changeRequest.metadata);
      return legacyPendingChangeId ? [legacyPendingChangeId] : [];
    }),
  );
  const legacyPendingChangeMetaById = new Map(
    (legacyPendingChangeIds.size > 0
      ? await prisma.pendingChange.findMany({
          where: {
            id: { in: [...legacyPendingChangeIds] },
            participant: {
              team: {
                competition: {
                  tenantId: auth.tenantId,
                },
              },
            },
          },
          select: {
            id: true,
            status: true,
            bundleId: true,
            bundleType: true,
            bundleStatus: true,
          },
        })
      : []).map((change) => [change.id, change]),
  );

  const legacyChanges = await prisma.pendingChange.findMany({
    where: {
      status: whereStatus ? "PENDING" : { in: ["PENDING", "APPROVED", "REJECTED"] },
      ...(legacyPendingChangeIds.size > 0 ? { id: { notIn: [...legacyPendingChangeIds] } } : {}),
      participant: {
        team: {
          competition: {
            tenantId: auth.tenantId,
          },
        },
      },
    },
    include: {
      participant: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          birthYear: true,
          birthDate: true,
          gender: true,
          disciplineCode: true,
          shirtSize: true,
          moderationNote: true,
          participantPublicationPreference: true,
          email: true,
          team: {
            select: {
              id: true,
              name: true,
              classificationCode: true,
              contactEmail: true,
              participants: {
                where: { deletedAt: null },
                select: {
                  id: true,
                  birthYear: true,
                  gender: true,
                  disciplineCode: true,
                },
              },
            },
          },
          auditLogs: {
            orderBy: { createdAt: "desc" },
            take: 4,
            select: {
              id: true,
              action: true,
              createdAt: true,
              message: true,
              pendingChangeId: true,
              actor: {
                select: {
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      },
      requestedBy: { select: { name: true, email: true } },
      reviewedBy: { select: { name: true, email: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const directAuditLogs = includeDirectChanges
    ? await prisma.participantAuditLog.findMany({
        where: {
          action: "DIRECT_CHANGE",
          participant: {
            team: {
              competition: {
                tenantId: auth.tenantId,
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 250,
        select: {
          id: true,
          beforeData: true,
          afterData: true,
          message: true,
          createdAt: true,
          actor: { select: { name: true, email: true } },
          participant: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              birthYear: true,
              birthDate: true,
              gender: true,
              disciplineCode: true,
              shirtSize: true,
              moderationNote: true,
              participantPublicationPreference: true,
              email: true,
              team: {
                select: {
                  id: true,
                  name: true,
                  classificationCode: true,
                  contactEmail: true,
                  participants: {
                    where: { deletedAt: null },
                    select: {
                      id: true,
                      birthYear: true,
                      gender: true,
                      disciplineCode: true,
                    },
                  },
                },
              },
            },
          },
        },
      })
    : [];

  const genericDecoratedChanges = changeRequests.flatMap((changeRequest) => {
    const participant = participantById.get(changeRequest.targetId);
    const legacyPendingChangeId = getLegacyPendingChangeId(changeRequest.metadata);

    if (!participant || !legacyPendingChangeId) {
      return [];
    }

    const requestedSnapshot = normalizeJsonSnapshot(changeRequest.requestedSnapshot);
    const beforeSnapshot = normalizeJsonSnapshot(changeRequest.beforeSnapshot);
    const pendingChangeMeta = legacyPendingChangeMetaById.get(legacyPendingChangeId);

    return [
      decorateParticipantChange({
        id: legacyPendingChangeId,
        changeRequestId: changeRequest.id,
        bundleId: pendingChangeMeta?.bundleId,
        bundleType: pendingChangeMeta?.bundleType,
        bundleStatus: pendingChangeMeta?.bundleStatus,
        changeData: serializeSnapshot(requestedSnapshot),
        beforeData: serializeSnapshot(beforeSnapshot),
        status: pendingChangeMeta?.status ?? normalizeChangeRequestStatus(changeRequest.status),
        createdAt: changeRequest.createdAt,
        updatedAt: changeRequest.updatedAt,
        reviewedAt: changeRequest.reviewedAt,
        reviewComment: changeRequest.reviewComment,
        participant,
        requestedBy: changeRequest.requestedBy,
        reviewedBy: changeRequest.reviewedBy,
        targetType: changeRequest.targetType,
        changeType: changeRequest.changeType,
        source: changeRequest.source,
        recentHistory: changeRequest.auditLogs.map((entry) => ({
          id: entry.id,
          action: entry.action,
          createdAt: entry.createdAt,
          message: entry.message,
          pendingChangeId: legacyPendingChangeId,
          actor: entry.actor,
        })),
      }),
    ];
  });

  const legacyDecoratedChanges = legacyChanges.map((change) => {
    const requestedSnapshot = parseSnapshot(change.changeData);
    const beforeSnapshot = parseSnapshot(change.beforeData);

    return decorateParticipantChange({
      id: change.id,
      bundleId: change.bundleId,
      bundleType: change.bundleType,
      bundleStatus: change.bundleStatus,
      changeData: change.changeData,
      beforeData: change.beforeData,
      status: change.status,
      createdAt: change.createdAt,
      updatedAt: change.updatedAt,
      reviewedAt: change.reviewedAt,
      reviewComment: change.reviewComment,
      participant: change.participant,
      requestedBy: change.requestedBy,
      reviewedBy: change.reviewedBy,
      targetType: "PARTICIPANT",
      changeType: "UPDATE",
      source: "LEGACY_PENDING_CHANGE",
      recentHistory: change.participant.auditLogs.map((entry) => ({
        id: entry.id,
        action: entry.action,
        createdAt: entry.createdAt,
        message: entry.message,
        pendingChangeId: entry.pendingChangeId,
        actor: entry.actor,
      })),
      requestedSnapshot,
      beforeSnapshot,
    });
  });

  const directDecoratedChanges = directAuditLogs.map((entry) => {
    const actor = entry.actor ?? { name: "System", email: "system@s5evo.local" };

    return decorateParticipantChange({
      id: `direct:${entry.id}`,
      changeData: entry.afterData || "{}",
      beforeData: entry.beforeData,
      status: "DIRECT",
      createdAt: entry.createdAt,
      updatedAt: entry.createdAt,
      reviewedAt: entry.createdAt,
      reviewComment: entry.message,
      participant: entry.participant,
      requestedBy: actor,
      reviewedBy: actor,
      targetType: "PARTICIPANT",
      changeType: "UPDATE",
      source: "PARTICIPANT_AUDIT_DIRECT_CHANGE",
      recentHistory: [
        {
          id: entry.id,
          action: "DIRECT_CHANGE",
          createdAt: entry.createdAt,
          message: entry.message,
          actor,
        },
      ],
    });
  });
  const teamDecoratedChanges = teamChangeRequests.flatMap((changeRequest) => {
    const team = teamById.get(changeRequest.targetId);

    if (!team) {
      return [];
    }

    return [
      decorateTeamChange({
        id: changeRequest.id,
        changeData: stringifyJsonSnapshot(changeRequest.requestedSnapshot),
        beforeData: stringifyJsonSnapshot(changeRequest.beforeSnapshot),
        status: normalizeChangeRequestStatus(changeRequest.status),
        createdAt: changeRequest.createdAt,
        updatedAt: changeRequest.updatedAt,
        reviewedAt: changeRequest.reviewedAt,
        reviewComment: changeRequest.reviewComment,
        team,
        requestedBy: changeRequest.requestedBy,
        reviewedBy: changeRequest.reviewedBy,
        targetType: changeRequest.targetType,
        changeType: changeRequest.changeType,
        source: changeRequest.source,
        recentHistory: changeRequest.auditLogs.map((entry) => ({
          id: entry.id,
          action: entry.action,
          createdAt: entry.createdAt,
          message: entry.message,
          actor: entry.actor,
        })),
      }),
    ];
  });

  const decoratedChanges = [...genericDecoratedChanges, ...legacyDecoratedChanges, ...directDecoratedChanges, ...teamDecoratedChanges].sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );

  return NextResponse.json({ changes: decoratedChanges });
}

function decorateTeamChange(input: {
  id: string;
  changeData: string;
  beforeData?: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  reviewedAt?: Date | null;
  reviewComment?: string | null;
  team: {
    id: string;
    name: string;
    contactEmail?: string | null;
  };
  requestedBy: { name: string | null; email: string };
  reviewedBy?: { name: string | null; email: string } | null;
  targetType: string;
  changeType: string;
  source: string;
  recentHistory: Array<{
    id: string;
    action: string;
    createdAt: Date;
    message?: string | null;
    actor?: { name: string | null; email: string } | null;
  }>;
}) {
  return {
    id: input.id,
    changeRequestId: input.id,
    bundleId: null,
    bundleType: null,
    bundleStatus: null,
    targetType: input.targetType,
    changeType: input.changeType,
    source: input.source,
    changeData: input.changeData,
    beforeData: input.beforeData,
    status: input.status,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    reviewedAt: input.reviewedAt,
    reviewComment: input.reviewComment,
    participant: {
      id: `team:${input.team.id}`,
      firstName: "Mannschaft",
      lastName: input.team.name,
      email: null,
      team: {
        id: input.team.id,
        name: input.team.name,
        contactEmail: input.team.contactEmail,
      },
    },
    requestedBy: input.requestedBy,
    reviewedBy: input.reviewedBy,
    recentHistory: input.recentHistory,
    impact: {
      nextClassificationCode: "",
      nextClassificationLabel: "Mannschaft",
      nextTotalAge: 0,
      classificationWarnings: [],
      disciplineWarnings: [],
      hasLiveDrift: false,
      liveDriftSummary: [],
    },
  };
}

type ParticipantForApproval = {
  id: string;
  firstName: string;
  lastName: string;
  birthYear: number;
  birthDate?: string | null;
  gender: string;
  disciplineCode: string;
  shirtSize?: string | null;
  moderationNote?: string | null;
  participantPublicationPreference?: string | null;
  email?: string | null;
  team: {
    id: string;
    name: string;
    classificationCode?: string | null;
    contactEmail?: string | null;
    participants: Array<{
      id: string;
      birthYear: number;
      gender: string;
      disciplineCode: string;
    }>;
  };
};

function decorateParticipantChange(input: {
  id: string;
  changeRequestId?: string;
  bundleId?: string | null;
  bundleType?: string | null;
  bundleStatus?: string | null;
  changeData: string;
  beforeData?: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  reviewedAt?: Date | null;
  reviewComment?: string | null;
  participant: ParticipantForApproval;
  requestedBy: { name: string | null; email: string };
  reviewedBy?: { name: string | null; email: string } | null;
  targetType: string;
  changeType: string;
  source: string;
  recentHistory: Array<{
    id: string;
    action: string;
    createdAt: Date;
    message?: string | null;
    pendingChangeId?: string | null;
    actor?: { name: string | null; email: string } | null;
  }>;
  requestedSnapshot?: ParticipantSnapshot;
  beforeSnapshot?: ParticipantSnapshot;
}) {
  const requestedSnapshot = input.requestedSnapshot ?? parseSnapshot(input.changeData);
  const beforeSnapshot = input.beforeSnapshot ?? parseSnapshot(input.beforeData);
  const liveSnapshot = toParticipantSnapshot(input.participant);
  const liveDriftSummary = input.beforeData
    ? summarizeParticipantRequestConflicts(beforeSnapshot, requestedSnapshot, liveSnapshot)
    : [];
  const projectedParticipants: TeamStateParticipantInput[] = input.participant.team.participants.map((participant) => {
    const birthYear =
      participant.id === input.participant.id && typeof requestedSnapshot.birthYear === "number"
        ? requestedSnapshot.birthYear
        : participant.birthYear;
    const gender = (
      participant.id === input.participant.id && typeof requestedSnapshot.gender === "string"
        ? requestedSnapshot.gender
        : participant.gender
    ) as TeamStateParticipantInput["gender"];
    const disciplineCode =
      participant.id === input.participant.id && typeof requestedSnapshot.disciplineCode === "string"
        ? requestedSnapshot.disciplineCode
        : participant.disciplineCode;

    return {
      birthYear,
      gender,
      disciplineCode,
    };
  });
  const projectedTeamState = evaluateTeamState(
    projectedParticipants,
    input.participant.team.classificationCode,
  );

  return {
    id: input.id,
    changeRequestId: input.changeRequestId,
    bundleId: input.bundleId ?? null,
    bundleType: input.bundleType ?? null,
    bundleStatus: input.bundleStatus ?? null,
    targetType: input.targetType,
    changeType: input.changeType,
    source: input.source,
    changeData: input.changeData,
    beforeData: input.beforeData,
    status: input.status,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    reviewedAt: input.reviewedAt,
    reviewComment: input.reviewComment,
    participant: {
      id: input.participant.id,
      firstName: input.participant.firstName,
      lastName: input.participant.lastName,
      email: input.participant.email,
      team: {
        id: input.participant.team.id,
        name: input.participant.team.name,
        contactEmail: input.participant.team.contactEmail,
      },
    },
    requestedBy: input.requestedBy,
    reviewedBy: input.reviewedBy,
    recentHistory: input.recentHistory,
    impact: {
      nextClassificationCode: projectedTeamState.classification.code,
      nextClassificationLabel: projectedTeamState.classification.label,
      nextTotalAge: projectedTeamState.classification.totalAge,
      classificationWarnings: projectedTeamState.classificationWarnings,
      disciplineWarnings: projectedTeamState.discipline.warnings,
      hasLiveDrift: liveDriftSummary.length > 0,
      liveDriftSummary,
    },
  };
}

function normalizeJsonSnapshot(value: Prisma.JsonValue | null): ParticipantSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return parseSnapshot(null);
  }

  return parseSnapshot(JSON.stringify(value));
}

function stringifyJsonSnapshot(value: Prisma.JsonValue | null): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "{}";
  }

  return JSON.stringify(value);
}

function normalizeChangeRequestStatus(status: string) {
  if (status === "APPLIED") return "APPROVED";
  return status;
}

function getLegacyPendingChangeId(metadata: Prisma.JsonValue | null): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const value = metadata.legacyPendingChangeId;
  return typeof value === "string" ? value : null;
}
