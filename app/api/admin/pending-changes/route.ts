import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { evaluateTeamState, type TeamStateParticipantInput } from "@/lib/domain/classification";
import { parseSnapshot, summarizeParticipantChanges, toParticipantSnapshot } from "@/lib/participant-change";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { requireTenantRoles } from "@/lib/server-permissions";

// GET /api/admin/pending-changes — Änderungsanträge für das Admin-Dashboard
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const auth = await requireTenantRoles(session, ["ADMIN", "MODERATOR"]);
  if ("error" in auth) return auth.error;

  const scope = request.nextUrl.searchParams.get("scope");
  const whereStatus =
    scope === "all"
      ? undefined
      : "PENDING";

  const changes = await prisma.pendingChange.findMany({
    where: {
      ...(whereStatus ? { status: whereStatus } : {}),
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

  const decoratedChanges = changes.map((change) => {
    const requestedSnapshot = parseSnapshot(change.changeData);
    const beforeSnapshot = parseSnapshot(change.beforeData);
    const liveSnapshot = toParticipantSnapshot(change.participant);
    const liveDriftSummary = change.beforeData
      ? summarizeParticipantChanges(beforeSnapshot, liveSnapshot)
      : [];
    const projectedParticipants: TeamStateParticipantInput[] = change.participant.team.participants.map((participant) => {
      const birthYear =
        participant.id === change.participant.id && typeof requestedSnapshot.birthYear === "number"
          ? requestedSnapshot.birthYear
          : participant.birthYear;
      const gender = (
        participant.id === change.participant.id && typeof requestedSnapshot.gender === "string"
          ? requestedSnapshot.gender
          : participant.gender
      ) as TeamStateParticipantInput["gender"];
      const disciplineCode =
        participant.id === change.participant.id && typeof requestedSnapshot.disciplineCode === "string"
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
      change.participant.team.classificationCode,
    );

    return {
      id: change.id,
      changeData: change.changeData,
      beforeData: change.beforeData,
      status: change.status,
      createdAt: change.createdAt,
      updatedAt: change.updatedAt,
      reviewedAt: change.reviewedAt,
      reviewComment: change.reviewComment,
      participant: {
        id: change.participant.id,
        firstName: change.participant.firstName,
        lastName: change.participant.lastName,
        email: change.participant.email,
        team: {
          id: change.participant.team.id,
          name: change.participant.team.name,
          contactEmail: change.participant.team.contactEmail,
        },
      },
      requestedBy: change.requestedBy,
      reviewedBy: change.reviewedBy,
      recentHistory: change.participant.auditLogs.map((entry) => ({
        id: entry.id,
        action: entry.action,
        createdAt: entry.createdAt,
        message: entry.message,
        pendingChangeId: entry.pendingChangeId,
        actor: entry.actor,
      })),
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
  });

  return NextResponse.json({ changes: decoratedChanges });
}
