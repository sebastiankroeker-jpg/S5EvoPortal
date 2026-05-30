import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { normalizeEmail, resolveCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { getScopedRoleFlags } from "@/lib/server-permissions";
import { resolveTeamAccess } from "@/lib/team-manager-access";

function getRequestMeta(request: NextRequest) {
  return {
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    userAgent: request.headers.get("user-agent") || null,
  };
}

function serializeRoleForAudit(
  role:
    | {
        id: string;
        userId?: string | null;
        role?: string | null;
        revokedAt?: Date | null;
        grantedByUserId?: string | null;
        createdAt?: Date | null;
      }
    | null,
) {
  if (!role) return undefined;

  return {
    id: role.id,
    userId: role.userId ?? null,
    role: role.role ?? "TEAM_MANAGER",
    revokedAt: role.revokedAt?.toISOString() ?? null,
    grantedByUserId: role.grantedByUserId ?? null,
    createdAt: role.createdAt?.toISOString() ?? null,
  };
}

async function loadTeam(teamId: string) {
  return prisma.team.findFirst({
    where: { id: teamId, deletedAt: null },
    include: {
      owner: { select: { email: true, name: true } },
      competition: { select: { id: true, tenantId: true } },
      memberRoles: {
        where: { role: "TEAM_MANAGER", revokedAt: null },
        select: { userId: true, revokedAt: true },
      },
      participants: {
        where: { deletedAt: null },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          userId: true,
        },
      },
    },
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  const userEmail = session?.user?.email;

  if (!userEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const participantId = typeof body.participantId === "string" ? body.participantId : null;
  const { user } = await resolveCurrentUser(session, { createIfMissing: true });

  if (!user) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const team = await loadTeam(id);
  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  const access = await getScopedRoleFlags(userEmail, team.competition.tenantId, session);
  const teamAccess = resolveTeamAccess({
    team,
    user,
    userEmail,
    canEditAllTeams: access.canEditAllTeams,
  });
  const requestMeta = getRequestMeta(request);

  if (!teamAccess.canManageTeamManagers) {
    await prisma.auditEvent.create({
      data: {
        action: "TEAM_MANAGER_GRANT_FAILED",
        scopeType: "TEAM",
        scopeId: team.id,
        entityType: "TEAM_MEMBER_ROLE",
        reason: "forbidden",
        meta: { ...requestMeta, participantId, sessionEmail: normalizeEmail(userEmail) },
        tenantId: team.competition.tenantId,
        competitionId: team.competition.id,
        actorId: user.id,
      },
    });
    return NextResponse.json({ error: "Keine Berechtigung zum Verwalten von Team Manager:innen" }, { status: 403 });
  }

  if (!participantId) {
    return NextResponse.json({ error: "participantId ist erforderlich" }, { status: 400 });
  }

  const participant = team.participants.find((entry) => entry.id === participantId);
  if (!participant) {
    return NextResponse.json({ error: "Teilnehmer gehört nicht zu dieser Mannschaft" }, { status: 404 });
  }

  if (!participant.userId) {
    return NextResponse.json(
      { error: "Teilnehmer muss zuerst per Einladung mit einem Portal-Konto verknüpft werden" },
      { status: 409 },
    );
  }

  if (participant.userId === user.id && !access.canEditAllTeams) {
    return NextResponse.json({ error: "Du bist für diese Mannschaft bereits berechtigt" }, { status: 409 });
  }

  const targetUser = await prisma.user.findFirst({
    where: { id: participant.userId, deletedAt: null },
    select: { id: true, email: true, name: true },
  });

  if (!targetUser) {
    return NextResponse.json({ error: "Verknüpfter Benutzer wurde nicht gefunden" }, { status: 404 });
  }

  const previousRole = await prisma.teamMemberRole.findUnique({
    where: {
      teamId_userId_role: {
        teamId: team.id,
        userId: targetUser.id,
        role: "TEAM_MANAGER",
      },
    },
    select: { id: true, revokedAt: true, grantedByUserId: true, createdAt: true },
  });

  const role = await prisma.$transaction(async (tx) => {
    const nextRole = await tx.teamMemberRole.upsert({
      where: {
        teamId_userId_role: {
          teamId: team.id,
          userId: targetUser.id,
          role: "TEAM_MANAGER",
        },
      },
      update: {
        revokedAt: null,
        revokedByUserId: null,
        grantedByUserId: user.id,
        reason: typeof body.reason === "string" ? body.reason.trim() || null : null,
      },
      create: {
        teamId: team.id,
        userId: targetUser.id,
        role: "TEAM_MANAGER",
        grantedByUserId: user.id,
        reason: typeof body.reason === "string" ? body.reason.trim() || null : null,
      },
      select: { id: true, userId: true, role: true, revokedAt: true },
    });

    await tx.auditEvent.create({
      data: {
        action: "TEAM_MANAGER_GRANTED",
        scopeType: "TEAM",
        scopeId: team.id,
        entityType: "TEAM_MEMBER_ROLE",
        entityId: nextRole.id,
        beforeData: serializeRoleForAudit(previousRole),
        afterData: {
          id: nextRole.id,
          teamId: team.id,
          userId: targetUser.id,
          participantId: participant.id,
          role: nextRole.role,
          revokedAt: nextRole.revokedAt?.toISOString() ?? null,
        },
        meta: {
          ...requestMeta,
          sessionEmail: normalizeEmail(userEmail),
          targetUserEmail: targetUser.email,
          participantName: `${participant.firstName} ${participant.lastName}`.trim(),
        },
        tenantId: team.competition.tenantId,
        competitionId: team.competition.id,
        actorId: user.id,
      },
    });

    return nextRole;
  });

  return NextResponse.json({
    success: true,
    manager: {
      userId: role.userId,
      participantId: participant.id,
      role: role.role,
      isTeamManager: !role.revokedAt,
    },
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  const userEmail = session?.user?.email;

  if (!userEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const userId = request.nextUrl.searchParams.get("userId");
  const participantId = request.nextUrl.searchParams.get("participantId");
  const { user } = await resolveCurrentUser(session, { createIfMissing: true });

  if (!user) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const team = await loadTeam(id);
  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  const access = await getScopedRoleFlags(userEmail, team.competition.tenantId, session);
  const teamAccess = resolveTeamAccess({
    team,
    user,
    userEmail,
    canEditAllTeams: access.canEditAllTeams,
  });
  const requestMeta = getRequestMeta(request);

  if (!teamAccess.canManageTeamManagers) {
    await prisma.auditEvent.create({
      data: {
        action: "TEAM_MANAGER_REVOKE_FAILED",
        scopeType: "TEAM",
        scopeId: team.id,
        entityType: "TEAM_MEMBER_ROLE",
        reason: "forbidden",
        meta: { ...requestMeta, participantId, targetUserId: userId, sessionEmail: normalizeEmail(userEmail) },
        tenantId: team.competition.tenantId,
        competitionId: team.competition.id,
        actorId: user.id,
      },
    });
    return NextResponse.json({ error: "Keine Berechtigung zum Verwalten von Team Manager:innen" }, { status: 403 });
  }

  const participant = participantId ? team.participants.find((entry) => entry.id === participantId) : null;
  const targetUserId = userId || participant?.userId || null;

  if (!targetUserId) {
    return NextResponse.json({ error: "userId oder participantId ist erforderlich" }, { status: 400 });
  }

  const existingRole = await prisma.teamMemberRole.findUnique({
    where: {
      teamId_userId_role: {
        teamId: team.id,
        userId: targetUserId,
        role: "TEAM_MANAGER",
      },
    },
    select: { id: true, userId: true, role: true, revokedAt: true, grantedByUserId: true, createdAt: true },
  });

  if (!existingRole || existingRole.revokedAt) {
    return NextResponse.json({ success: true, revoked: false });
  }

  const revokedAt = new Date();
  await prisma.$transaction(async (tx) => {
    const updatedRole = await tx.teamMemberRole.update({
      where: { id: existingRole.id },
      data: {
        revokedAt,
        revokedByUserId: user.id,
      },
      select: { id: true, userId: true, role: true, revokedAt: true },
    });

    await tx.auditEvent.create({
      data: {
        action: "TEAM_MANAGER_REVOKED",
        scopeType: "TEAM",
        scopeId: team.id,
        entityType: "TEAM_MEMBER_ROLE",
        entityId: existingRole.id,
        beforeData: serializeRoleForAudit(existingRole),
        afterData: serializeRoleForAudit(updatedRole),
        meta: {
          ...requestMeta,
          sessionEmail: normalizeEmail(userEmail),
          participantId: participant?.id ?? null,
        },
        tenantId: team.competition.tenantId,
        competitionId: team.competition.id,
        actorId: user.id,
      },
    });
  });

  return NextResponse.json({ success: true, revoked: true, userId: targetUserId });
}
