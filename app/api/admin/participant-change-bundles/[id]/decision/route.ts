import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { sendParticipantChangeDecisionEmail } from "@/lib/mail/participant-change";
import {
  parseSnapshot,
  recalculateTeamClassification,
  serializeSnapshot,
  snapshotToParticipantUpdateData,
  summarizeParticipantChanges,
  toParticipantSnapshot,
} from "@/lib/participant-change";
import { validatePendingChangeBundle } from "@/lib/participant-change-bundle";
import { prisma } from "@/lib/prisma";
import { requireTenantRoles } from "@/lib/server-permissions";

const BUNDLE_FEATURE_FLAG = process.env.ENABLE_PENDING_CHANGE_BUNDLES === "true";

type BundleDecisionBody = {
  action?: unknown;
  comment?: unknown;
};

// PUT /api/admin/participant-change-bundles/[id]/decision
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!BUNDLE_FEATURE_FLAG) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }

  const session = await getServerSession(authOptions);
  const auth = await requireTenantRoles(session, ["ADMIN", "MODERATOR"]);
  if ("error" in auth) return auth.error;

  const { id: bundleId } = await params;
  const body = (await request.json().catch(() => ({}))) as BundleDecisionBody;
  const action = body.action;
  const comment = typeof body.comment === "string" ? body.comment.trim() : "";

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "Ungueltige Aktion" }, { status: 400 });
  }

  if (action === "reject" && !comment) {
    return NextResponse.json(
      { error: "Bitte bei einer Ablehnung einen kurzen Kommentar hinterlegen" },
      { status: 400 },
    );
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
    include: {
      participant: {
        include: {
          team: {
            select: {
              id: true,
              name: true,
              contactEmail: true,
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
              competition: {
                select: {
                  name: true,
                  year: true,
                  date: true,
                  dateEnd: true,
                  registrationDeadline: true,
                  registrationNotificationEmail: true,
                  claimTokenExpiryMode: true,
                  claimTokenTtlDays: true,
                  tenant: {
                    select: {
                      id: true,
                      name: true,
                      contactEmail: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      requestedBy: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  if (pendingChanges.length === 0) {
    return NextResponse.json({ error: "Bundle nicht gefunden" }, { status: 404 });
  }

  const distinctBundleStatuses = [...new Set(pendingChanges.map((change) => change.bundleStatus).filter(Boolean))];
  const currentBundleStatus = distinctBundleStatuses.length === 1 ? distinctBundleStatuses[0] : null;
  if (currentBundleStatus && currentBundleStatus !== "PENDING") {
    if (action === "approve" && currentBundleStatus === "APPROVED") {
      return NextResponse.json({
        status: "approved",
        message: "Bundle war bereits genehmigt (idempotent).",
        idempotent: true,
        count: pendingChanges.length,
      });
    }

    if (action === "reject" && currentBundleStatus === "REJECTED") {
      return NextResponse.json({
        status: "rejected",
        message: "Bundle war bereits abgelehnt (idempotent).",
        idempotent: true,
        count: pendingChanges.length,
      });
    }

    return NextResponse.json(
      { error: "Bundle ist bereits abschliessend bearbeitet worden." },
      { status: 409 },
    );
  }

  if (pendingChanges.some((change) => change.status !== "PENDING")) {
    return NextResponse.json(
      { error: "Bundle enthaelt nicht mehr ausschliesslich offene Teilantraege." },
      { status: 409 },
    );
  }

  if (action === "approve") {
    const firstTeam = pendingChanges[0].participant.team;
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
      firstTeam.participants,
      firstTeam.classificationCode,
    );

    if (!validation.valid) {
      await prisma.pendingChange.updateMany({
        where: {
          bundleId,
          status: "PENDING",
        },
        data: {
          bundleStatus: "CONFLICT",
          reviewComment: "Konflikt bei Bundle-Genehmigung: Bitte neu einreichen.",
          reviewedAt: new Date(),
          reviewedById: auth.user.id,
        },
      });

      return NextResponse.json(
        {
          error: "Bundle konnte nicht genehmigt werden, da Konflikte erkannt wurden.",
          status: "conflict",
          issues: validation.issues,
        },
        { status: 409 },
      );
    }

    const requestedByParticipantId = new Map(
      pendingChanges.map((change) => [change.participantId, parseSnapshot(change.changeData)]),
    );

    try {
      await prisma.$transaction(async (tx) => {
        const openInBundleCount = await tx.pendingChange.count({
          where: {
            bundleId,
            status: "PENDING",
          },
        });

        if (openInBundleCount !== pendingChanges.length) {
          throw new Error("BUNDLE_STATE_CHANGED");
        }

        for (const change of pendingChanges) {
          const requestedSnapshot = requestedByParticipantId.get(change.participantId);
          if (!requestedSnapshot) {
            continue;
          }

          await tx.participant.update({
            where: { id: change.participantId },
            data: snapshotToParticipantUpdateData(requestedSnapshot),
          });
        }

        await tx.pendingChange.updateMany({
          where: {
            bundleId,
            status: "PENDING",
          },
          data: {
            status: "APPROVED",
            bundleStatus: "APPROVED",
            reviewedAt: new Date(),
            reviewedById: auth.user.id,
            reviewComment: comment || null,
          },
        });

        await tx.participantAuditLog.createMany({
          data: pendingChanges.map((change) => {
            const requestedSnapshot = requestedByParticipantId.get(change.participantId);
            return {
              action: "REQUEST_APPROVED" as const,
              participantId: change.participantId,
              actorId: auth.user.id,
              pendingChangeId: change.id,
              beforeData: serializeSnapshot(toParticipantSnapshot(change.participant)),
              afterData: requestedSnapshot ? serializeSnapshot(requestedSnapshot) : change.changeData,
              message: comment || "Tausch-Bundle genehmigt",
            };
          }),
        });
      });
    } catch (error) {
      if (error instanceof Error && error.message === "BUNDLE_STATE_CHANGED") {
        return NextResponse.json(
          { error: "Bundle-Zustand hat sich waehrend der Verarbeitung geaendert. Bitte neu laden." },
          { status: 409 },
        );
      }
      throw error;
    }

    const needsClassificationRecalc = pendingChanges.some((change) => {
      const liveSnapshot = toParticipantSnapshot(change.participant);
      const requestedSnapshot = parseSnapshot(change.changeData);
      return requestedSnapshot.birthYear !== liveSnapshot.birthYear || requestedSnapshot.gender !== liveSnapshot.gender;
    });

    if (needsClassificationRecalc) {
      await recalculateTeamClassification(pendingChanges[0].participant.team.id);
    }

    for (const change of pendingChanges) {
      const beforeSnapshot = change.beforeData ? parseSnapshot(change.beforeData) : toParticipantSnapshot(change.participant);
      const requestedSnapshot = parseSnapshot(change.changeData);
      const changeSummary = summarizeParticipantChanges(beforeSnapshot, requestedSnapshot);

      await sendParticipantChangeDecisionEmail({
        competition: change.participant.team.competition,
        participant: {
          name: change.participant.firstName + " " + change.participant.lastName,
          email: change.participant.email,
          teamName: change.participant.team.name,
          teamContactEmail: change.participant.team.contactEmail,
        },
        requester: {
          name: change.requestedBy.name || change.requestedBy.email,
          email: change.requestedBy.email,
        },
        approved: true,
        reviewComment: comment || null,
        changeSummary,
      });
    }

    return NextResponse.json({
      status: "approved",
      message: "Bundle wurde atomar genehmigt und angewendet.",
      count: pendingChanges.length,
    });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const openInBundleCount = await tx.pendingChange.count({
        where: {
          bundleId,
          status: "PENDING",
        },
      });

      if (openInBundleCount !== pendingChanges.length) {
        throw new Error("BUNDLE_STATE_CHANGED");
      }

    await tx.pendingChange.updateMany({
      where: {
        bundleId,
        status: "PENDING",
      },
      data: {
        status: "REJECTED",
        bundleStatus: "REJECTED",
        reviewedAt: new Date(),
        reviewedById: auth.user.id,
        reviewComment: comment || null,
      },
    });

    await tx.participantAuditLog.createMany({
      data: pendingChanges.map((change) => ({
        action: "REQUEST_REJECTED" as const,
        participantId: change.participantId,
        actorId: auth.user.id,
        pendingChangeId: change.id,
        beforeData: change.beforeData || serializeSnapshot(toParticipantSnapshot(change.participant)),
        afterData: change.changeData,
        message: comment || "Tausch-Bundle abgelehnt",
      })),
    });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "BUNDLE_STATE_CHANGED") {
      return NextResponse.json(
        { error: "Bundle-Zustand hat sich waehrend der Verarbeitung geaendert. Bitte neu laden." },
        { status: 409 },
      );
    }
    throw error;
  }

  for (const change of pendingChanges) {
    const beforeSnapshot = change.beforeData ? parseSnapshot(change.beforeData) : toParticipantSnapshot(change.participant);
    const requestedSnapshot = parseSnapshot(change.changeData);
    const changeSummary = summarizeParticipantChanges(beforeSnapshot, requestedSnapshot);

    await sendParticipantChangeDecisionEmail({
      competition: change.participant.team.competition,
      participant: {
        name: change.participant.firstName + " " + change.participant.lastName,
        email: change.participant.email,
        teamName: change.participant.team.name,
        teamContactEmail: change.participant.team.contactEmail,
      },
      requester: {
        name: change.requestedBy.name || change.requestedBy.email,
        email: change.requestedBy.email,
      },
      approved: false,
      reviewComment: comment || null,
      changeSummary,
    });
  }

  return NextResponse.json({
    status: "rejected",
    message: "Bundle wurde abgelehnt.",
    count: pendingChanges.length,
  });
}
