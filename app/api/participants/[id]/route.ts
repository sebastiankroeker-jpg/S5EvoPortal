import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Prisma } from "@prisma/client";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { upsertLegacyParticipantChangeRequest } from "@/lib/change-request";
import { birthYearToBirthDateInput } from "@/lib/domain/team";
import { sendParticipantChangeSubmittedEmails } from "@/lib/mail/participant-change";
import {
  createParticipantClaimInvitation,
  getParticipantClaimTokenStatus,
  getParticipantEmailInvitationStatus,
  shouldInviteParticipantClaim,
} from "@/lib/participant-claim-invitation";
import {
  buildParticipantChangeData,
  diffParticipantSnapshots,
  hasParticipantChangeData,
  mergeParticipantSnapshot,
  pickDirectParticipantChangeData,
  recalculateTeamClassification,
  serializeSnapshot,
  summarizeDirectParticipantChangeFields,
  summarizeParticipantChanges,
  toParticipantSnapshot,
} from "@/lib/participant-change";
import { evaluateTeamState } from "@/lib/domain/classification";
import { prisma } from "@/lib/prisma";
import { isShirtOrderClosed } from "@/lib/domain/shirts";
import { getTenantRoleFlagsForUserId } from "@/lib/server-permissions";
import { normalizeEmail, resolveCurrentUser } from "@/lib/current-user";
import { resolveTeamAccess } from "@/lib/team-manager-access";

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
          ownerId: true,
          teamChiefId: true,
          owner: { select: { email: true } },
          memberRoles: {
            where: { role: "TEAM_MANAGER", revokedAt: null },
            select: { userId: true, revokedAt: true },
          },
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
      claimTokens: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, createdAt: true, expiresAt: true, claimedAt: true, revokedAt: true },
      },
    },
  });

  if (!participant) {
    return NextResponse.json({ error: "Teilnehmer nicht gefunden" }, { status: 404 });
  }

  const { user } = await resolveCurrentUser(session, { createIfMissing: true });

  const access = user
    ? await getTenantRoleFlagsForUserId(user.id, participant.team.competition.tenantId)
    : null;
  const normalizedSessionEmail = normalizeEmail(session.user.email);
  const teamAccess = resolveTeamAccess({
    team: participant.team,
    user,
    userEmail: session.user.email,
    canEditAllTeams: access?.canEditAllTeams,
  });
  const ownTeamAccess = resolveTeamAccess({
    team: participant.team,
    user,
    userEmail: session.user.email,
    canEditAllTeams: false,
  });
  const isSelf = participant.userId
    ? participant.userId === user?.id
    : normalizeEmail(participant.email) === normalizedSessionEmail;
  const isModeratorGlobalView =
    access?.isModerator === true &&
    access.isAdmin !== true &&
    !ownTeamAccess.canEditTeam &&
    !isSelf;

  if (!teamAccess.canEditTeam && !isSelf) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const { phone: _ignoredPhone, ...participantWithoutPhone } = participant;
  const visibleParticipant = isModeratorGlobalView
    ? {
        ...participantWithoutPhone,
        email: null,
        shirtSize: null,
        claimTokens: [],
      }
    : participantWithoutPhone;

  return NextResponse.json({
    ...visibleParticipant,
    birthDate: birthYearToBirthDateInput(participant.birthYear),
    emailInvitation: isModeratorGlobalView
      ? null
      : {
          status: getParticipantEmailInvitationStatus({
            email: participant.email,
            participantUserId: participant.userId,
            token: participant.claimTokens[0] ?? null,
          }),
          tokenStatus: getParticipantClaimTokenStatus(participant.claimTokens[0] ?? null),
          sentAt: participant.claimTokens[0]?.createdAt?.toISOString?.() ?? null,
          expiresAt: participant.claimTokens[0]?.expiresAt?.toISOString?.() ?? null,
          claimedAt: participant.claimTokens[0]?.claimedAt?.toISOString?.() ?? null,
          revokedAt: participant.claimTokens[0]?.revokedAt?.toISOString?.() ?? null,
        },
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
          ownerId: true,
          teamChiefId: true,
          owner: { select: { email: true } },
          classificationCode: true,
          memberRoles: {
            where: { role: "TEAM_MANAGER", revokedAt: null },
            select: { userId: true, revokedAt: true },
          },
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
              shirtOrderDeadline: true,
              registrationNotificationEmail: true,
              claimTokenExpiryMode: true,
              claimTokenTtlDays: true,
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

  const { user } = await resolveCurrentUser(session, { createIfMissing: true });

  if (!user) {
    return NextResponse.json({ error: "User nicht gefunden" }, { status: 404 });
  }

  const access = await getTenantRoleFlagsForUserId(user.id, participant.team.competition.tenantId);
  const isAdmin = access.isAdmin;
  const normalizedSessionEmail = normalizeEmail(session.user.email);
  const teamAccess = resolveTeamAccess({
    team: participant.team,
    user,
    userEmail: session.user.email,
    canEditAllTeams: access.canEditAllTeams,
  });
  const ownTeamAccess = resolveTeamAccess({
    team: participant.team,
    user,
    userEmail: session.user.email,
    canEditAllTeams: false,
  });
  const isSelf = participant.userId
    ? participant.userId === user.id
    : normalizeEmail(participant.email) === normalizedSessionEmail;
  const isModeratorGlobalEdit =
    access.isModerator &&
    !access.isAdmin &&
    !ownTeamAccess.canEditTeam &&
    !isSelf;
  const shirtOrderClosed = isShirtOrderClosed(participant.team.competition?.shirtOrderDeadline);

  if (!teamAccess.canEditTeam && !isSelf) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  if (!isAdmin && shirtOrderClosed && changeData.shirtSize !== undefined && changeData.shirtSize !== participant.shirtSize) {
    return NextResponse.json({ error: "T-Shirt-Bestellfrist abgeschlossen" }, { status: 403 });
  }

  const currentSnapshot = toParticipantSnapshot(participant);
  const requestedSnapshot = mergeParticipantSnapshot(currentSnapshot, changeData);
  const changedFields = diffParticipantSnapshots(currentSnapshot, requestedSnapshot);

  if (!isAdmin && changedFields.disciplineCode) {
    return NextResponse.json(
      {
        error:
          "Disziplinen koennen nur im Mannschaftskontext geaendert werden, weil jede Disziplin genau einmal vergeben sein muss. Bitte die Mannschaft bearbeiten.",
      },
      { status: 409 },
    );
  }

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

  if (isModeratorGlobalEdit) {
    const disallowedFields = Object.keys(changedFields).filter((field) => field !== "moderationNote");
    if (disallowedFields.length > 0) {
      return NextResponse.json(
        { error: "Moderator:innen dürfen hier nur den Moderationshinweis bearbeiten." },
        { status: 403 },
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedParticipant = await tx.participant.update({
        where: { id },
        data: {
          moderationNote: typeof changeData.moderationNote === "string" ? changeData.moderationNote : null,
        },
      });

      await tx.participantAuditLog.create({
        data: {
          action: "DIRECT_CHANGE",
          participantId: id,
          actorId: user.id,
          beforeData: serializeSnapshot(currentSnapshot),
          afterData: serializeSnapshot(requestedSnapshot),
          message: "Moderationshinweis direkt durch Moderator:in aktualisiert",
        },
      });

      return updatedParticipant;
    });

    return NextResponse.json({
      participant: {
        ...updated,
        email: null,
        shirtSize: null,
      },
      applied: true,
      message: "Moderationshinweis gespeichert",
      classificationWarnings: [],
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
    const shouldSendParticipantClaim = shouldInviteParticipantClaim({
      previousEmail: typeof currentSnapshot.email === "string" ? currentSnapshot.email : null,
      nextEmail: typeof requestedSnapshot.email === "string" ? requestedSnapshot.email : null,
      participantUserId: participant.userId,
    });

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

      const overriddenChangeRequests = await tx.changeRequest.findMany({
        where: {
          targetType: "PARTICIPANT",
          targetId: id,
          changeType: "UPDATE",
          status: "PENDING",
        },
        select: { id: true, requestedSnapshot: true },
      });

      await tx.changeRequest.updateMany({
        where: {
          targetType: "PARTICIPANT",
          targetId: id,
          changeType: "UPDATE",
          status: "PENDING",
        },
        data: {
          status: "REJECTED",
          reviewedAt: new Date(),
          reviewedById: user.id,
          reviewComment: "Durch direkte Änderung überholt",
        },
      });

      for (const changeRequest of overriddenChangeRequests) {
        await tx.changeRequestAuditLog.create({
          data: {
            changeRequestId: changeRequest.id,
            actorId: user.id,
            action: "REJECTED",
            beforeData: changeRequest.requestedSnapshot as Prisma.InputJsonValue,
            afterData: requestedSnapshot,
            message: "Durch direkte Änderung überholt",
          },
        });
      }

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

    let participantClaimMail: unknown = null;
    if (shouldSendParticipantClaim) {
      try {
        participantClaimMail = await createParticipantClaimInvitation({
          request,
          participant: {
            id: updated.id,
            firstName: updated.firstName,
            lastName: updated.lastName,
            email: updated.email,
            userId: updated.userId,
          },
          team: participant.team,
          competition: participant.team.competition,
          actorUserId: user.id,
          sessionEmail: session.user.email,
          previousEmail: typeof currentSnapshot.email === "string" ? currentSnapshot.email : null,
        });
      } catch (error) {
        participantClaimMail = {
          status: "failed" as const,
          reason: error instanceof Error ? error.message : String(error),
        };
        console.error("Participant claim invitation failed after direct participant update", {
          participantId: updated.id,
          error,
        });
      }
    }

    return NextResponse.json({
      participant: updated,
      applied: true,
      participantClaimMail,
      classificationWarnings:
        projectedTeamState.classificationWarnings.length > 0
          ? projectedTeamState.classificationWarnings
          : classificationWarnings,
    });
  }

  let approvalBaseSnapshot = currentSnapshot;
  let approvalRequestedSnapshot = requestedSnapshot;
  let approvalChangeSummary = summarizeParticipantChanges(approvalBaseSnapshot, approvalRequestedSnapshot);
  let directParticipantClaimMail: unknown = null;
  let updatedParticipantAfterDirectChanges: unknown = null;
  const directlyAppliedChangeData = pickDirectParticipantChangeData(changedFields, requestedSnapshot);
  const emailChangedDirectly = Object.prototype.hasOwnProperty.call(directlyAppliedChangeData, "email");

  if (hasParticipantChangeData(directlyAppliedChangeData)) {
    const directAppliedSnapshot = {
      ...currentSnapshot,
      ...directlyAppliedChangeData,
    };
    const shouldSendParticipantClaim = shouldInviteParticipantClaim({
      previousEmail: typeof currentSnapshot.email === "string" ? currentSnapshot.email : null,
      nextEmail: typeof requestedSnapshot.email === "string" ? requestedSnapshot.email : null,
      participantUserId: participant.userId,
    });
    const directFieldLabels = summarizeDirectParticipantChangeFields(directlyAppliedChangeData);

    updatedParticipantAfterDirectChanges = await prisma.$transaction(async (tx) => {
      const updatedParticipant = await tx.participant.update({
        where: { id },
        data: directlyAppliedChangeData as Prisma.ParticipantUpdateInput,
      });

      await tx.participantAuditLog.create({
        data: {
          action: "DIRECT_CHANGE",
          participantId: id,
          actorId: user.id,
          beforeData: serializeSnapshot(currentSnapshot),
          afterData: serializeSnapshot(directAppliedSnapshot),
          message: directFieldLabels.join(", ") + " direkt aktualisiert",
        },
      });

      return updatedParticipant;
    });

    if (shouldSendParticipantClaim) {
      try {
        directParticipantClaimMail = await createParticipantClaimInvitation({
          request,
          participant: {
            id: participant.id,
            firstName: participant.firstName,
            lastName: participant.lastName,
            email: typeof requestedSnapshot.email === "string" ? requestedSnapshot.email : null,
            userId: participant.userId,
          },
          team: participant.team,
          competition: participant.team.competition,
          actorUserId: user.id,
          sessionEmail: session.user.email,
          previousEmail: typeof currentSnapshot.email === "string" ? currentSnapshot.email : null,
        });
      } catch (error) {
        directParticipantClaimMail = {
          status: "failed" as const,
          reason: error instanceof Error ? error.message : String(error),
        };
        console.error("Participant claim invitation failed after direct participant email update", {
          participantId: participant.id,
          error,
        });
      }
    }

    approvalBaseSnapshot = directAppliedSnapshot;
    approvalRequestedSnapshot = {
      ...requestedSnapshot,
      ...directlyAppliedChangeData,
    };
    approvalChangeSummary = summarizeParticipantChanges(approvalBaseSnapshot, approvalRequestedSnapshot);

    if (approvalChangeSummary.length === 0) {
      return NextResponse.json({
        participant: updatedParticipantAfterDirectChanges,
        applied: true,
        message: directFieldLabels.join(" und ") + " direkt gespeichert",
        participantClaimMail: directParticipantClaimMail,
        classificationWarnings: [],
      });
    }
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
            beforeData: serializeSnapshot(approvalBaseSnapshot),
            changeData: serializeSnapshot(approvalRequestedSnapshot),
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
            beforeData: serializeSnapshot(approvalBaseSnapshot),
            afterData: serializeSnapshot(approvalRequestedSnapshot),
            message: "Offene Änderungsanfrage aktualisiert",
          },
        });

        await upsertLegacyParticipantChangeRequest(tx, {
          tenantId: participant.team.competition.tenantId,
          competitionId: participant.team.competition.id,
          participantId: id,
          requestedById: user.id,
          beforeSnapshot: approvalBaseSnapshot,
          requestedSnapshot: approvalRequestedSnapshot,
          legacyPendingChangeId: updatedPendingChange.id,
          message: "Offene Teilnehmer-Änderungsanfrage aktualisiert",
        });

        return updatedPendingChange;
      })
    : await prisma.$transaction(async (tx) => {
        const createdPendingChange = await tx.pendingChange.create({
          data: {
            beforeData: serializeSnapshot(approvalBaseSnapshot),
            changeData: serializeSnapshot(approvalRequestedSnapshot),
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
            beforeData: serializeSnapshot(approvalBaseSnapshot),
            afterData: serializeSnapshot(approvalRequestedSnapshot),
            message: "Änderungsanfrage eingereicht",
          },
        });

        await upsertLegacyParticipantChangeRequest(tx, {
          tenantId: participant.team.competition.tenantId,
          competitionId: participant.team.competition.id,
          participantId: id,
          requestedById: user.id,
          beforeSnapshot: approvalBaseSnapshot,
          requestedSnapshot: approvalRequestedSnapshot,
          legacyPendingChangeId: createdPendingChange.id,
          message: "Teilnehmer-Änderungsanfrage eingereicht",
        });

        return createdPendingChange;
      });

  if (!existingPendingChange) {
    await sendParticipantChangeSubmittedEmails({
      competition: participant.team.competition,
      participant: {
        name: participant.firstName + " " + participant.lastName,
        email: typeof approvalBaseSnapshot.email === "string" ? approvalBaseSnapshot.email : participant.email,
        teamName: participant.team.name,
        teamContactEmail: participant.team.contactEmail,
      },
      requester: {
        name: user.name || session.user.email || "Teilnehmer",
        email: session.user.email,
      },
      changeSummary: approvalChangeSummary,
    });
  }

  return NextResponse.json({
    pendingChange: savedPendingChange,
    applied: false,
    message: existingPendingChange
      ? emailChangedDirectly
        ? "E-Mail direkt gespeichert, offener Änderungsantrag aktualisiert"
        : "Offener Änderungsantrag aktualisiert"
      : emailChangedDirectly
        ? "E-Mail direkt gespeichert, weitere Änderung zur Genehmigung eingereicht"
      : "Änderung zur Genehmigung eingereicht",
    participantClaimMail: directParticipantClaimMail,
    classificationWarnings: projectedTeamState.classificationWarnings,
  });
}
