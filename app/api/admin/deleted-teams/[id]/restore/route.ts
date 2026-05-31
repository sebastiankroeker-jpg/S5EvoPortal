import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { sendTeamLifecycleOrgEmail } from "@/lib/mail/team-lifecycle";
import { prisma } from "@/lib/prisma";
import { requireTenantRoles } from "@/lib/server-permissions";

function getRequestMeta(request: NextRequest) {
  return {
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    userAgent: request.headers.get("user-agent") || null,
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  const auth = await requireTenantRoles(session, ["ADMIN"]);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const team = await prisma.team.findFirst({
    where: {
      id,
      deletedAt: { not: null },
      competition: { tenantId: auth.tenantId },
    },
    include: {
      owner: { select: { id: true, email: true, name: true, deletedAt: true } },
      competition: {
        select: {
          id: true,
          name: true,
          year: true,
          tenantId: true,
          registrationNotificationEmail: true,
          tenant: { select: { name: true, contactEmail: true } },
        },
      },
      participants: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          deletedAt: true,
          userId: true,
        },
      },
    },
  });

  if (!team) {
    return NextResponse.json({ error: "Gelöschte Mannschaft nicht gefunden" }, { status: 404 });
  }

  if (team.owner.deletedAt) {
    return NextResponse.json(
      { error: "Die Mannschaft kann nicht wiederhergestellt werden, weil der Besitzer-Account gelöscht ist." },
      { status: 409 },
    );
  }

  const now = new Date();
  const deletedParticipants = team.participants.filter((participant) => participant.deletedAt);
  const requestMeta = getRequestMeta(request);

  await prisma.$transaction([
    prisma.team.update({
      where: { id: team.id },
      data: { deletedAt: null },
    }),
    prisma.participant.updateMany({
      where: {
        teamId: team.id,
        deletedAt: { not: null },
      },
      data: { deletedAt: null },
    }),
    prisma.auditEvent.create({
      data: {
        action: "TEAM_RESTORED",
        scopeType: "TEAM",
        scopeId: team.id,
        entityType: "TEAM",
        entityId: team.id,
        reason: "admin_restore",
        beforeData: {
          teamDeletedAt: team.deletedAt?.toISOString() ?? null,
          deletedParticipantIds: deletedParticipants.map((participant) => participant.id),
        },
        afterData: {
          restoredAt: now.toISOString(),
          restoredParticipants: deletedParticipants.length,
        },
        meta: {
          ...requestMeta,
          teamName: team.name,
          ownerEmail: team.owner.email,
          linkedParticipants: team.participants.filter((participant) => participant.userId).length,
        },
        tenantId: auth.tenantId,
        competitionId: team.competition.id,
        actorId: auth.user.id,
      },
    }),
  ]);

  try {
    const mailResult = await sendTeamLifecycleOrgEmail({
      action: "restored",
      competition: team.competition,
      team: {
        name: team.name,
        ownerEmail: team.owner.email,
        contactEmail: team.contactEmail,
        participantCount: deletedParticipants.length,
        linkedParticipantCount: team.participants.filter((participant) => participant.userId).length,
      },
      actor: {
        name: auth.user.name,
        email: auth.user.email,
      },
    });
    await prisma.auditEvent.create({
      data: {
        action: "TEAM_LIFECYCLE_MAIL",
        scopeType: "TEAM",
        scopeId: team.id,
        entityType: "TEAM",
        entityId: team.id,
        reason: "team_restored_org_mail",
        afterData: {
          mailStatus: mailResult.status,
          recipients: mailResult.recipients,
          subject: mailResult.subject ?? null,
          reason: mailResult.status === "skipped" ? mailResult.reason : null,
          missing: mailResult.status === "skipped" ? mailResult.missing ?? [] : [],
        },
        meta: {
          lifecycleAction: "restored",
          teamName: team.name,
          ownerEmail: team.owner.email,
        },
        tenantId: auth.tenantId,
        competitionId: team.competition.id,
        actorId: auth.user.id,
      },
    }).catch((auditError) => console.error("Team restore mail audit failed", auditError));
  } catch (mailError) {
    console.error("Team restore org mail failed", mailError);
    await prisma.auditEvent.create({
      data: {
        action: "TEAM_LIFECYCLE_MAIL",
        scopeType: "TEAM",
        scopeId: team.id,
        entityType: "TEAM",
        entityId: team.id,
        reason: "team_restored_org_mail_failed",
        afterData: {
          mailStatus: "failed",
          recipients: [],
          error: mailError instanceof Error ? mailError.message : String(mailError),
        },
        meta: {
          lifecycleAction: "restored",
          teamName: team.name,
          ownerEmail: team.owner.email,
        },
        tenantId: auth.tenantId,
        competitionId: team.competition.id,
        actorId: auth.user.id,
      },
    }).catch((auditError) => console.error("Team restore mail audit failed", auditError));
  }

  return NextResponse.json({
    success: true,
    message: `Mannschaft "${team.name}" wurde mit ${deletedParticipants.length} Teilnehmer:innen wiederhergestellt.`,
    restored: {
      teamId: team.id,
      participantCount: deletedParticipants.length,
    },
  });
}
