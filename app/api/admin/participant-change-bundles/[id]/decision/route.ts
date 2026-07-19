import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Prisma } from "@prisma/client";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { sendParticipantChangeDecisionEmail } from "@/lib/mail/participant-change";
import {
  diffParticipantSnapshots,
  parseSnapshot,
  recalculateTeamClassification,
  serializeSnapshot,
  snapshotToParticipantUpdateData,
  summarizeParticipantChanges,
  toParticipantSnapshot,
} from "@/lib/participant-change";
import { validatePendingChangeBundle } from "@/lib/participant-change-bundle";
import {
  buildParticipantFieldResults,
  buildParticipantReviewDecisionResult,
  resolveParticipantEditContext,
  type EditParticipantFieldDecision,
  type EditParticipantFieldResult,
  type EditParticipantNotificationResult,
} from "@/lib/participant-edit-result";
import { recordParticipantNotificationAuditEvents } from "@/lib/participant-notification-audit";
import { prisma } from "@/lib/prisma";
import { requirePendingChangeBundleTenantRoles } from "@/lib/server-permissions";

type BundleDecisionBody = {
  action?: unknown;
  comment?: unknown;
};

// PUT /api/admin/participant-change-bundles/[id]/decision
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  const auth = await requirePendingChangeBundleTenantRoles(session, ["ADMIN", "MODERATOR"], bundleId);
  if ("error" in auth) return auth.error;

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
              registrationMode: true,
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
                  id: true,
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
    const firstChange = pendingChanges[0];
    const idempotentResult = buildParticipantReviewDecisionResult({
      status: "idempotent",
      scope: "bundle",
      message:
        currentBundleStatus === "APPROVED"
          ? "Bundle war bereits genehmigt (idempotent)."
          : "Bundle war bereits abgelehnt (idempotent).",
      count: pendingChanges.length,
      participantId: firstChange.participantId,
      teamId: firstChange.participant.team.id,
      context: resolveParticipantEditContext(firstChange.participant.team.registrationMode),
      reviewComment: comment || null,
      info: ["Dieser Bundle-Entscheid wurde bereits abschliessend verarbeitet."],
    });

    if (action === "approve" && currentBundleStatus === "APPROVED") {
      return NextResponse.json({
        status: "approved",
        message: "Bundle war bereits genehmigt (idempotent).",
        idempotent: true,
        count: pendingChanges.length,
        decisionResult: idempotentResult,
      });
    }

    if (action === "reject" && currentBundleStatus === "REJECTED") {
      return NextResponse.json({
        status: "rejected",
        message: "Bundle war bereits abgelehnt (idempotent).",
        idempotent: true,
        count: pendingChanges.length,
        decisionResult: idempotentResult,
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

        await syncLegacyBundleChangeRequests(tx, {
          pendingChangeIds: pendingChanges.map((change) => change.id),
          actorId: auth.user.id,
          approved: true,
          applied: true,
          comment: comment || null,
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

    const notifications: EditParticipantNotificationResult[] = [];
    const fieldResults = buildBundleFieldResults(pendingChanges, "saved");

    for (const change of pendingChanges) {
      const beforeSnapshot = change.beforeData ? parseSnapshot(change.beforeData) : toParticipantSnapshot(change.participant);
      const requestedSnapshot = parseSnapshot(change.changeData);
      const changeSummary = summarizeParticipantChanges(beforeSnapshot, requestedSnapshot);

      const sentNotifications = await sendParticipantChangeDecisionEmail({
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
      notifications.push(...sentNotifications);
      await recordParticipantNotificationAuditEvents(prisma, {
        tenantId: change.participant.team.competition.tenant.id,
        competitionId: change.participant.team.competition.id,
        teamId: change.participant.team.id,
        teamName: change.participant.team.name,
        participantId: change.participantId,
        participantName: `${change.participant.firstName} ${change.participant.lastName}`.trim(),
        context: resolveParticipantEditContext(change.participant.team.registrationMode),
        actorId: auth.user.id,
        reason: "participant_change_bundle_approved",
        notifications: sentNotifications,
      }).catch((auditError) => console.error("Participant bundle decision mail audit failed", auditError));
    }

    return NextResponse.json({
      status: "approved",
      message: "Bundle wurde atomar genehmigt und angewendet.",
      count: pendingChanges.length,
      decisionResult: buildParticipantReviewDecisionResult({
        status: "approved",
        scope: "bundle",
        message: "Bundle wurde atomar genehmigt und angewendet.",
        count: pendingChanges.length,
        participantId: pendingChanges[0].participantId,
        teamId: pendingChanges[0].participant.team.id,
        context: resolveParticipantEditContext(pendingChanges[0].participant.team.registrationMode),
        reviewComment: comment || null,
        fieldResults,
        notifications,
      }),
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

      await syncLegacyBundleChangeRequests(tx, {
        pendingChangeIds: pendingChanges.map((change) => change.id),
        actorId: auth.user.id,
        approved: false,
        comment: comment || null,
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

  const notifications: EditParticipantNotificationResult[] = [];
  const fieldResults = buildBundleFieldResults(pendingChanges, "denied");

  for (const change of pendingChanges) {
    const beforeSnapshot = change.beforeData ? parseSnapshot(change.beforeData) : toParticipantSnapshot(change.participant);
    const requestedSnapshot = parseSnapshot(change.changeData);
    const changeSummary = summarizeParticipantChanges(beforeSnapshot, requestedSnapshot);

    const sentNotifications = await sendParticipantChangeDecisionEmail({
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
    notifications.push(...sentNotifications);
    await recordParticipantNotificationAuditEvents(prisma, {
      tenantId: change.participant.team.competition.tenant.id,
      competitionId: change.participant.team.competition.id,
      teamId: change.participant.team.id,
      teamName: change.participant.team.name,
      participantId: change.participantId,
      participantName: `${change.participant.firstName} ${change.participant.lastName}`.trim(),
      context: resolveParticipantEditContext(change.participant.team.registrationMode),
      actorId: auth.user.id,
      reason: "participant_change_bundle_rejected",
      notifications: sentNotifications,
    }).catch((auditError) => console.error("Participant bundle decision mail audit failed", auditError));
  }

  return NextResponse.json({
    status: "rejected",
    message: "Bundle wurde abgelehnt.",
    count: pendingChanges.length,
    decisionResult: buildParticipantReviewDecisionResult({
      status: "rejected",
      scope: "bundle",
      message: "Bundle wurde abgelehnt.",
      count: pendingChanges.length,
      participantId: pendingChanges[0].participantId,
      teamId: pendingChanges[0].participant.team.id,
      context: resolveParticipantEditContext(pendingChanges[0].participant.team.registrationMode),
      reviewComment: comment || null,
      fieldResults,
      notifications,
    }),
  });
}

async function syncLegacyBundleChangeRequests(
  tx: Prisma.TransactionClient,
  input: {
    pendingChangeIds: string[];
    actorId: string;
    approved: boolean;
    applied?: boolean;
    comment?: string | null;
  },
) {
  if (input.pendingChangeIds.length === 0) {
    return;
  }

  const requests = await tx.changeRequest.findMany({
    where: {
      status: "PENDING",
      OR: input.pendingChangeIds.map((id) => ({
        metadata: { path: ["legacyPendingChangeId"], equals: id },
      })),
    },
    select: {
      id: true,
      beforeSnapshot: true,
      requestedSnapshot: true,
    },
  });

  if (requests.length === 0) {
    return;
  }

  const now = new Date();
  const nextStatus = input.approved ? (input.applied === false ? "APPROVED" : "APPLIED") : "REJECTED";
  await tx.changeRequest.updateMany({
    where: { id: { in: requests.map((request) => request.id) } },
    data: {
      status: nextStatus,
      reviewedAt: now,
      reviewedById: input.actorId,
      appliedAt: nextStatus === "APPLIED" ? now : null,
      appliedById: nextStatus === "APPLIED" ? input.actorId : null,
      reviewComment: input.comment || null,
    },
  });

  await tx.changeRequestAuditLog.createMany({
    data: requests.map((request) => ({
      changeRequestId: request.id,
      actorId: input.actorId,
      action: input.approved ? "APPROVED" : "REJECTED",
      beforeData: asAuditJson(request.beforeSnapshot),
      afterData: asAuditJson(request.requestedSnapshot),
      message: input.comment || (input.approved ? "Aenderungsantrag genehmigt" : "Aenderungsantrag abgelehnt"),
    })),
  });

  if (nextStatus === "APPLIED") {
    await tx.changeRequestAuditLog.createMany({
      data: requests.map((request) => ({
        changeRequestId: request.id,
        actorId: input.actorId,
        action: "APPLIED",
        beforeData: asAuditJson(request.beforeSnapshot),
        afterData: asAuditJson(request.requestedSnapshot),
        message: "Aenderungsantrag angewendet",
      })),
    });
  }
}

function asAuditJson(value: Prisma.JsonValue | null): Prisma.InputJsonValue | undefined {
  if (value === null) {
    return undefined;
  }

  return value as Prisma.InputJsonValue;
}

function buildBundleFieldResults(
  changes: Array<{
    beforeData: string | null;
    changeData: string;
    participant: Record<string, unknown> & {
      firstName: string;
      lastName: string;
    };
  }>,
  decision: EditParticipantFieldDecision,
): EditParticipantFieldResult[] {
  return changes.flatMap((change) => {
    const beforeSnapshot = change.beforeData ? parseSnapshot(change.beforeData) : toParticipantSnapshot(change.participant);
    const requestedSnapshot = parseSnapshot(change.changeData);
    const diff = diffParticipantSnapshots(beforeSnapshot, requestedSnapshot);
    const decisions = Object.fromEntries(
      Object.keys(diff).map((field) => [field, decision]),
    ) as Parameters<typeof buildParticipantFieldResults>[1];
    const participantName = `${change.participant.firstName} ${change.participant.lastName}`.trim();

    return buildParticipantFieldResults(diff, decisions).map((fieldResult) => ({
      ...fieldResult,
      message: `${participantName}: ${fieldResult.message}`,
    }));
  });
}
