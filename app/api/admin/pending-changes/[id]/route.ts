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

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const action = body.action;
  const comment = typeof body.comment === "string" ? body.comment.trim() : "";

  if (!["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Ungültige Aktion" }, { status: 400 });
  }

  const pendingChange = await prisma.pendingChange.findUnique({
    where: { id },
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
                  registrationNotificationEmail: true,
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

  const pendingChangeTenantId = pendingChange.participant.team.competition?.tenant?.id;
  if (pendingChangeTenantId && pendingChangeTenantId !== auth.tenantId) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const liveSnapshot = toParticipantSnapshot(pendingChange.participant);
  const beforeSnapshot = pendingChange.beforeData ? parseSnapshot(pendingChange.beforeData) : liveSnapshot;
  const requestedSnapshot = parseSnapshot(pendingChange.changeData);
  const changeSummary = summarizeParticipantChanges(beforeSnapshot, requestedSnapshot);

  if (action === "approve") {
    await prisma.$transaction(async (tx) => {
      await tx.participant.update({
        where: { id: pendingChange.participantId },
        data: snapshotToParticipantUpdateData(requestedSnapshot),
      });

      await tx.pendingChange.update({
        where: { id },
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
    });

    if (requestedSnapshot.birthYear !== liveSnapshot.birthYear || requestedSnapshot.gender !== liveSnapshot.gender) {
      await recalculateTeamClassification(pendingChange.participant.team.id);
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

    return NextResponse.json({ status: "approved", message: "Änderung genehmigt und angewendet" });
  }

  await prisma.$transaction(async (tx) => {
    await tx.pendingChange.update({
      where: { id },
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
