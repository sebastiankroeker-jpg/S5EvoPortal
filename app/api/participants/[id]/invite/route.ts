import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { normalizeEmail, resolveCurrentUser } from "@/lib/current-user";
import { createParticipantClaimInvitation } from "@/lib/participant-claim-invitation";
import { serializeSnapshot, toParticipantSnapshot } from "@/lib/participant-change";
import { prisma } from "@/lib/prisma";
import { getTenantRoleFlagsForUserId } from "@/lib/server-permissions";
import { resolveTeamAccess } from "@/lib/team-manager-access";

function isValidEmail(value?: string | null) {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const requestedEmail = typeof body.email === "string" ? normalizeEmail(body.email) : null;
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
              name: true,
              year: true,
              date: true,
              dateEnd: true,
              registrationDeadline: true,
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
  const teamAccess = resolveTeamAccess({
    team: participant.team,
    user,
    userEmail: session.user.email,
    canEditAllTeams: access.canEditAllTeams,
  });

  if (!teamAccess.canEditTeam) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  if (participant.userId) {
    return NextResponse.json({ error: "Teilnehmer ist bereits mit einem Portal-Konto verknüpft" }, { status: 409 });
  }

  const targetEmail = requestedEmail || normalizeEmail(participant.email);
  if (!isValidEmail(targetEmail)) {
    return NextResponse.json({ error: "Für diesen Teilnehmer ist keine gültige E-Mail hinterlegt" }, { status: 400 });
  }

  try {
    if (normalizeEmail(participant.email) !== targetEmail) {
      const beforeSnapshot = toParticipantSnapshot(participant);
      const afterSnapshot = { ...beforeSnapshot, email: targetEmail };

      await prisma.$transaction(async (tx) => {
        await tx.participant.update({
          where: { id: participant.id },
          data: { email: targetEmail },
        });

        await tx.participantAuditLog.create({
          data: {
            action: "DIRECT_CHANGE",
            participantId: participant.id,
            actorId: user.id,
            beforeData: serializeSnapshot(beforeSnapshot),
            afterData: serializeSnapshot(afterSnapshot),
            message: "E-Mail vor Einladung direkt aktualisiert",
          },
        });
      });
    }

    const participantClaimMail = await createParticipantClaimInvitation({
      request,
      participant: {
        id: participant.id,
        firstName: participant.firstName,
        lastName: participant.lastName,
        email: targetEmail,
        userId: participant.userId,
      },
      team: participant.team,
      competition: participant.team.competition,
      actorUserId: user.id,
      sessionEmail: session.user.email,
      previousEmail: null,
    });

    return NextResponse.json({
      success: true,
      participantClaimMail,
    });
  } catch (error) {
    console.error("Participant claim invitation failed after manual resend", {
      participantId: participant.id,
      error,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Einladung konnte nicht gesendet werden" },
      { status: 500 },
    );
  }
}
