import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { parseSnapshot, summarizeParticipantChanges, toParticipantSnapshot } from "@/lib/participant-change";
import { validatePendingChangeBundle } from "@/lib/participant-change-bundle";
import { prisma } from "@/lib/prisma";
import { requireTenantRoles } from "@/lib/server-permissions";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  const auth = await requireTenantRoles(session, ["ADMIN", "MODERATOR"]);
  if ("error" in auth) return auth.error;

  const { id: bundleId } = await params;
  if (!bundleId) {
    return NextResponse.json({ error: "Fehlende Bundle-ID." }, { status: 400 });
  }

  const pendingChanges = await prisma.pendingChange.findMany({
    where: {
      bundleId,
      participant: {
        team: {
          competition: {
            tenantId: auth.tenantId,
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
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
      requestedBy: { select: { name: true, email: true } },
      reviewedBy: { select: { name: true, email: true } },
    },
  });

  if (pendingChanges.length === 0) {
    return NextResponse.json({ error: "Bundle nicht gefunden." }, { status: 404 });
  }

  const first = pendingChanges[0];
  const validation = validatePendingChangeBundle(
    pendingChanges.map((change) => ({
      id: change.id,
      participantId: change.participantId,
      teamId: change.participant.team.id,
      status: change.status,
      beforeData: change.beforeData,
      changeData: change.changeData,
      liveParticipantSnapshot: toParticipantSnapshot(change.participant),
    })),
    first.participant.team.participants,
    first.participant.team.classificationCode,
  );

  return NextResponse.json({
    bundle: {
      id: bundleId,
      type: first.bundleType,
      status: first.bundleStatus,
      team: {
        id: first.participant.team.id,
        name: first.participant.team.name,
      },
      createdAt: pendingChanges.reduce(
        (min, change) => (change.createdAt < min ? change.createdAt : min),
        pendingChanges[0].createdAt,
      ),
      updatedAt: pendingChanges.reduce(
        (max, change) => (change.updatedAt > max ? change.updatedAt : max),
        pendingChanges[0].updatedAt,
      ),
      valid: validation.valid,
      validationIssues: validation.issues,
      pendingChanges: pendingChanges.map((change) => {
        const beforeSnapshot = change.beforeData ? parseSnapshot(change.beforeData) : toParticipantSnapshot(change.participant);
        const requestedSnapshot = parseSnapshot(change.changeData);
        return {
          id: change.id,
          status: change.status,
          createdAt: change.createdAt,
          updatedAt: change.updatedAt,
          reviewedAt: change.reviewedAt,
          reviewComment: change.reviewComment,
          participant: {
            id: change.participant.id,
            firstName: change.participant.firstName,
            lastName: change.participant.lastName,
          },
          requestedBy: change.requestedBy,
          reviewedBy: change.reviewedBy,
          changeSummary: summarizeParticipantChanges(beforeSnapshot, requestedSnapshot),
        };
      }),
    },
  });
}
