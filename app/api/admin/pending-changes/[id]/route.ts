import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { reviewLegacyParticipantChangeRequest } from "@/lib/change-request";
import { sendParticipantChangeDecisionEmail } from "@/lib/mail/participant-change";
import {
  createParticipantClaimInvitation,
  shouldInviteParticipantClaim,
} from "@/lib/participant-claim-invitation";
import {
  parseSnapshot,
  recalculateTeamClassification,
  serializeSnapshot,
  snapshotToParticipantUpdateData,
  summarizeParticipantChanges,
  summarizeParticipantRequestConflicts,
  toParticipantSnapshot,
} from "@/lib/participant-change";
import { prisma } from "@/lib/prisma";
import { requireTenantRoles } from "@/lib/server-permissions";

// PUT /api/admin/pending-changes/[id] — Approve oder Reject
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const auth = await requireTenantRoles(session, ["ADMIN", "MODERATOR"]);
  if ("error" in auth) return auth.error;

  const { id: routeId } = await params;
  const body = await request.json().catch(() => ({}));
  const action = body.action;
  const comment = typeof body.comment === "string" ? body.comment.trim() : "";

  if (!["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Ungültige Aktion" }, { status: 400 });
  }

  if (action === "reject" && !comment) {
    return NextResponse.json({ error: "Bitte bei einer Ablehnung einen kurzen Kommentar hinterlegen" }, { status: 400 });
  }

  const changeRequest = await prisma.changeRequest.findUnique({
    where: { id: routeId },
    select: {
      id: true,
      tenantId: true,
      targetType: true,
      targetId: true,
      changeType: true,
      status: true,
      metadata: true,
    },
  });
  let pendingChangeId = routeId;
  const activeChangeRequestId = changeRequest?.id ?? null;

  if (changeRequest) {
    if (changeRequest.tenantId !== auth.tenantId) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    if (changeRequest.targetType !== "PARTICIPANT" || changeRequest.changeType !== "UPDATE") {
      return NextResponse.json({ error: "Dieser Antragstyp wird in der Teilnehmer-Queue noch nicht bearbeitet" }, { status: 409 });
    }

    if (changeRequest.status !== "PENDING") {
      return NextResponse.json({ error: "Änderungsantrag nicht gefunden oder bereits bearbeitet" }, { status: 404 });
    }

    const legacyPendingChangeId = getLegacyPendingChangeId(changeRequest.metadata);
    if (!legacyPendingChangeId) {
      return NextResponse.json({ error: "Generischer Antrag hat noch keinen Legacy-Review-Link" }, { status: 409 });
    }

    pendingChangeId = legacyPendingChangeId;
  }

  const pendingChange = await prisma.pendingChange.findUnique({
    where: { id: pendingChangeId },
    include: {
      participant: {
        include: {
          team: {
            select: {
              id: true,
              name: true,
              contactEmail: true,
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
  });

  if (!pendingChange || pendingChange.status !== "PENDING") {
    return NextResponse.json({ error: "Änderungsantrag nicht gefunden oder bereits bearbeitet" }, { status: 404 });
  }

  if (pendingChange.bundleId) {
    return NextResponse.json(
      { error: "Dieser Antrag gehoert zu einem Tausch-Bundle und kann nur gesammelt bearbeitet werden." },
      { status: 409 },
    );
  }

  const pendingChangeTenantId = pendingChange.participant.team.competition?.tenant?.id;
  if (pendingChangeTenantId && pendingChangeTenantId !== auth.tenantId) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const liveSnapshot = toParticipantSnapshot(pendingChange.participant);
  const beforeSnapshot = pendingChange.beforeData ? parseSnapshot(pendingChange.beforeData) : liveSnapshot;
  const requestedSnapshot = parseSnapshot(pendingChange.changeData);
  const changeSummary = summarizeParticipantChanges(beforeSnapshot, requestedSnapshot);
  const liveDriftSummary = summarizeParticipantRequestConflicts(beforeSnapshot, requestedSnapshot, liveSnapshot);

  if (action === "approve") {
    if (liveDriftSummary.length > 0) {
      return NextResponse.json(
        {
          error: "Der Antrag basiert nicht mehr auf dem aktuellen Datenstand. Bitte zuerst den Live-Stand pruefen oder den Antrag neu einreichen lassen.",
          liveDriftSummary,
        },
        { status: 409 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.participant.update({
        where: { id: pendingChange.participantId },
        data: snapshotToParticipantUpdateData(requestedSnapshot),
      });

      await tx.pendingChange.update({
        where: { id: pendingChange.id },
        data: {
          status: "APPROVED",
          reviewedAt: new Date(),
          reviewedById: auth.user.id,
          reviewComment: comment || null,
        },
      });

      await tx.participantAuditLog.create({
        data: {
          action: "REQUEST_APPROVED",
          participantId: pendingChange.participantId,
          actorId: auth.user.id,
          pendingChangeId: pendingChange.id,
          beforeData: serializeSnapshot(liveSnapshot),
          afterData: serializeSnapshot(requestedSnapshot),
          message: comment || "Änderungsanfrage genehmigt",
        },
      });

      await reviewLegacyParticipantChangeRequest(tx, {
        changeRequestId: activeChangeRequestId ?? undefined,
        participantId: pendingChange.participantId,
        actorId: auth.user.id,
        approved: true,
        applied: true,
        comment: comment || null,
        beforeSnapshot: liveSnapshot,
        requestedSnapshot,
      });
    });

    if (requestedSnapshot.birthYear !== liveSnapshot.birthYear || requestedSnapshot.gender !== liveSnapshot.gender) {
      await recalculateTeamClassification(pendingChange.participant.team.id);
    }

    let participantClaimMail: unknown = null;
    if (
      shouldInviteParticipantClaim({
        previousEmail: typeof liveSnapshot.email === "string" ? liveSnapshot.email : null,
        nextEmail: typeof requestedSnapshot.email === "string" ? requestedSnapshot.email : null,
        participantUserId: pendingChange.participant.userId,
      })
    ) {
      try {
        participantClaimMail = await createParticipantClaimInvitation({
          request,
          participant: {
            id: pendingChange.participant.id,
            firstName:
              typeof requestedSnapshot.firstName === "string"
                ? requestedSnapshot.firstName
                : pendingChange.participant.firstName,
            lastName:
              typeof requestedSnapshot.lastName === "string"
                ? requestedSnapshot.lastName
                : pendingChange.participant.lastName,
            email: typeof requestedSnapshot.email === "string" ? requestedSnapshot.email : null,
            userId: pendingChange.participant.userId,
          },
          team: pendingChange.participant.team,
          competition: pendingChange.participant.team.competition,
          actorUserId: auth.user.id,
          sessionEmail: session?.user?.email || null,
          previousEmail: typeof liveSnapshot.email === "string" ? liveSnapshot.email : null,
        });
      } catch (error) {
        participantClaimMail = {
          status: "failed" as const,
          reason: error instanceof Error ? error.message : String(error),
        };
        console.error("Participant claim invitation failed after approving participant change", {
          participantId: pendingChange.participantId,
          pendingChangeId: pendingChange.id,
          error,
        });
      }
    }

    await sendParticipantChangeDecisionEmail({
      competition: pendingChange.participant.team.competition,
      participant: {
        name: pendingChange.participant.firstName + " " + pendingChange.participant.lastName,
        email: pendingChange.participant.email,
        teamName: pendingChange.participant.team.name,
        teamContactEmail: pendingChange.participant.team.contactEmail,
      },
      requester: {
        name: pendingChange.requestedBy.name || pendingChange.requestedBy.email,
        email: pendingChange.requestedBy.email,
      },
      approved: true,
      reviewComment: comment || null,
      changeSummary,
    });

    return NextResponse.json({
      status: "approved",
      message: "Änderung genehmigt und angewendet",
      participantClaimMail,
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.pendingChange.update({
      where: { id: pendingChange.id },
      data: {
          status: "REJECTED",
          reviewedAt: new Date(),
          reviewedById: auth.user.id,
          reviewComment: comment || null,
        },
      });

    await tx.participantAuditLog.create({
      data: {
          action: "REQUEST_REJECTED",
          participantId: pendingChange.participantId,
          actorId: auth.user.id,
          pendingChangeId: pendingChange.id,
          beforeData: pendingChange.beforeData || serializeSnapshot(liveSnapshot),
          afterData: serializeSnapshot(requestedSnapshot),
        message: comment || "Änderungsanfrage abgelehnt",
      },
    });

    await reviewLegacyParticipantChangeRequest(tx, {
      changeRequestId: activeChangeRequestId ?? undefined,
      participantId: pendingChange.participantId,
      actorId: auth.user.id,
      approved: false,
      comment: comment || null,
      beforeSnapshot: pendingChange.beforeData ? beforeSnapshot : liveSnapshot,
      requestedSnapshot,
    });
  });

  await sendParticipantChangeDecisionEmail({
    competition: pendingChange.participant.team.competition,
    participant: {
      name: pendingChange.participant.firstName + " " + pendingChange.participant.lastName,
      email: pendingChange.participant.email,
      teamName: pendingChange.participant.team.name,
      teamContactEmail: pendingChange.participant.team.contactEmail,
    },
    requester: {
      name: pendingChange.requestedBy.name || pendingChange.requestedBy.email,
      email: pendingChange.requestedBy.email,
    },
    approved: false,
    reviewComment: comment || null,
    changeSummary,
  });

  return NextResponse.json({ status: "rejected", message: "Änderung abgelehnt" });
}

function getLegacyPendingChangeId(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const value = (metadata as { legacyPendingChangeId?: unknown }).legacyPendingChangeId;
  return typeof value === "string" ? value : null;
}
