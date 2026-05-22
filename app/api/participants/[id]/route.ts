import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Prisma } from "@prisma/client";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { birthYearToBirthDateInput } from "@/lib/domain/team";
import { sendParticipantChangeSubmittedEmails } from "@/lib/mail/participant-change";
import {
  buildParticipantChangeData,
  diffParticipantSnapshots,
  mergeParticipantSnapshot,
  recalculateTeamClassification,
  serializeSnapshot,
  summarizeParticipantChanges,
  toParticipantSnapshot,
} from "@/lib/participant-change";
import { evaluateTeamState } from "@/lib/domain/classification";
import { prisma } from "@/lib/prisma";
import { isShirtOrderClosed } from "@/lib/domain/shirts";
import { getTenantRoleFlagsForUserId } from "@/lib/server-permissions";

// GET /api/participants/[id] — Teilnehmerdaten laden
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id } = await params;
  const participant = await prisma.participant.findUnique({
    where: { id, deletedAt: null },
    include: {
      team: {
        select: {
          id: true,
          name: true,
          contactEmail: true,
          competition: {
            select: {
              id: true,
              status: true,
              shirtOrderDeadline: true,
              tenantId: true,
            },
          },
        },
      },
      pendingChanges: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: { id: true, status: true, updatedAt: true, reviewedAt: true, reviewComment: true },
      },
    },
  });

  if (!participant) {
    return NextResponse.json({ error: "Teilnehmer nicht gefunden" }, { status: 404 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  const access = user
    ? await getTenantRoleFlagsForUserId(user.id, participant.team.competition.tenantId)
    : null;
  const isAdmin = Boolean(access?.isAdmin || access?.isModerator);
  const isTeamOwner = participant.team.contactEmail === session.user.email;
  const isSelf = participant.email === session.user.email;

  if (!isAdmin && !isTeamOwner && !isSelf) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  return NextResponse.json({
    ...participant,
    birthDate: birthYearToBirthDateInput(participant.birthYear),
  });
}

// PUT /api/participants/[id] — Teilnehmerdaten ändern
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const changeData = buildParticipantChangeData(body as Record<string, unknown>);

  const participant = await prisma.participant.findUnique({
    where: { id, deletedAt: null },
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
              shirtOrderDeadline: true,
              registrationNotificationEmail: true,
              tenantId: true,
              tenant: {
                select: {
                  name: true,
                  contactEmail: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!participant) {
    return NextResponse.json({ error: "Teilnehmer nicht gefunden" }, { status: 404 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return NextResponse.json({ error: "User nicht gefunden" }, { status: 404 });
  }

  const access = await getTenantRoleFlagsForUserId(user.id, participant.team.competition.tenantId);
  const isAdmin = access.isAdmin || access.isModerator;
  const isTeamOwner = participant.team.contactEmail === session.user.email;
  const isSelf = participant.email === session.user.email;
  const shirtOrderClosed = isShirtOrderClosed(participant.team.competition?.shirtOrderDeadline);

  if (!isAdmin && !isTeamOwner && !isSelf) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  if (!isAdmin && shirtOrderClosed && changeData.shirtSize !== undefined && changeData.shirtSize !== participant.shirtSize) {
    return NextResponse.json({ error: "T-Shirt-Bestellfrist abgeschlossen" }, { status: 403 });
  }

  const currentSnapshot = toParticipantSnapshot(participant);
  const requestedSnapshot = mergeParticipantSnapshot(currentSnapshot, changeData);
  const changedFields = diffParticipantSnapshots(currentSnapshot, requestedSnapshot);
  const changeSummary = summarizeParticipantChanges(currentSnapshot, requestedSnapshot);
  const projectedTeamState = evaluateTeamState(
    participant.team.participants.map((teamParticipant) =>
      teamParticipant.id === participant.id
        ? {
            birthYear: typeof requestedSnapshot.birthYear === "number" ? requestedSnapshot.birthYear : null,
            gender:
              requestedSnapshot.gender === "MALE" ||
              requestedSnapshot.gender === "FEMALE" ||
              requestedSnapshot.gender === "M" ||
              requestedSnapshot.gender === "W" ||
              requestedSnapshot.gender === "D" ||
              requestedSnapshot.gender === "DIVERSE"
                ? requestedSnapshot.gender
                : null,
            disciplineCode: typeof requestedSnapshot.disciplineCode === "string" ? requestedSnapshot.disciplineCode : null,
          }
        : {
            birthYear: teamParticipant.birthYear,
            gender: teamParticipant.gender,
            disciplineCode: teamParticipant.disciplineCode,
          }
    ),
    participant.team.classificationCode,
  );

  if (Object.keys(changedFields).length === 0) {
    return NextResponse.json({
      applied: false,
      message: "Keine Änderungen erkannt",
    });
  }

  if (!projectedTeamState.discipline.valid) {
    return NextResponse.json(
      {
        error: projectedTeamState.discipline.warnings.join(" · "),
        disciplineWarnings: projectedTeamState.discipline.warnings,
      },
      { status: 409 },
    );
  }

  if (isAdmin) {
    const updated = await prisma.$transaction(async (tx) => {
      const updatedParticipant = await tx.participant.update({
        where: { id },
        data: changeData as Prisma.ParticipantUpdateInput,
      });

      await tx.pendingChange.updateMany({
        where: {
          participantId: id,
          status: "PENDING",
        },
        data: {
          status: "REJECTED",
          reviewedAt: new Date(),
          reviewedById: user.id,
          reviewComment: "Durch direkte Änderung überholt",
        },
      });

      await tx.participantAuditLog.create({
        data: {
          action: "DIRECT_CHANGE",
          participantId: id,
          actorId: user.id,
          beforeData: serializeSnapshot(currentSnapshot),
          afterData: serializeSnapshot(requestedSnapshot),
          message: "Direkte Änderung durch Admin/Moderator",
        },
      });

      return updatedParticipant;
    });

    let classificationWarnings: string[] = [];
    if (changeData.birthYear !== undefined || changeData.gender !== undefined) {
      classificationWarnings = await recalculateTeamClassification(participant.team.id);
    }

    return NextResponse.json({
      participant: updated,
      applied: true,
      classificationWarnings:
        projectedTeamState.classificationWarnings.length > 0
          ? projectedTeamState.classificationWarnings
          : classificationWarnings,
    });
  }

  const existingPendingChange = await prisma.pendingChange.findFirst({
    where: {
      participantId: id,
      status: "PENDING",
    },
    orderBy: { createdAt: "desc" },
  });

  const savedPendingChange = existingPendingChange
    ? await prisma.$transaction(async (tx) => {
        const updatedPendingChange = await tx.pendingChange.update({
          where: { id: existingPendingChange.id },
          data: {
            beforeData: serializeSnapshot(currentSnapshot),
            changeData: serializeSnapshot(requestedSnapshot),
            requestedById: user.id,
            reviewComment: null,
            reviewedAt: null,
            reviewedById: null,
          },
        });

        await tx.participantAuditLog.create({
          data: {
            action: "REQUEST_UPDATED",
            participantId: id,
            actorId: user.id,
            pendingChangeId: updatedPendingChange.id,
            beforeData: serializeSnapshot(currentSnapshot),
            afterData: serializeSnapshot(requestedSnapshot),
            message: "Offene Änderungsanfrage aktualisiert",
          },
        });

        return updatedPendingChange;
      })
    : await prisma.$transaction(async (tx) => {
        const createdPendingChange = await tx.pendingChange.create({
          data: {
            beforeData: serializeSnapshot(currentSnapshot),
            changeData: serializeSnapshot(requestedSnapshot),
            status: "PENDING",
            participantId: id,
            requestedById: user.id,
          },
        });

        await tx.participantAuditLog.create({
          data: {
            action: "REQUEST_SUBMITTED",
            participantId: id,
            actorId: user.id,
            pendingChangeId: createdPendingChange.id,
            beforeData: serializeSnapshot(currentSnapshot),
            afterData: serializeSnapshot(requestedSnapshot),
            message: "Änderungsanfrage eingereicht",
          },
        });

        return createdPendingChange;
      });

  if (!existingPendingChange) {
    await sendParticipantChangeSubmittedEmails({
      competition: participant.team.competition,
      participant: {
        name: participant.firstName + " " + participant.lastName,
        email: participant.email,
        teamName: participant.team.name,
        teamContactEmail: participant.team.contactEmail,
      },
      requester: {
        name: user.name || session.user.email || "Teilnehmer",
        email: session.user.email,
      },
      changeSummary,
    });
  }

  return NextResponse.json({
    pendingChange: savedPendingChange,
    applied: false,
    message: existingPendingChange
      ? "Offener Änderungsantrag aktualisiert"
      : "Änderung zur Genehmigung eingereicht",
    classificationWarnings: projectedTeamState.classificationWarnings,
  });
}
