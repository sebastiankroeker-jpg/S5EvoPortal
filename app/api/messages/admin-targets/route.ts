import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { requireTenantRoles } from "@/lib/server-permissions";

type AdminMessageTarget = {
  userId: string;
  name: string | null;
  label: string;
  description: string;
  teamId: string | null;
  participantId: string | null;
};

function displayName(user: { name: string | null }) {
  return user.name || "Portal-Konto";
}

function addTarget(targets: Map<string, AdminMessageTarget>, target: AdminMessageTarget) {
  if (!target.userId) return;
  const key = [target.userId, target.teamId || "no-team", target.participantId || "no-participant"].join(":");
  if (targets.has(key)) return;
  targets.set(key, target);
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const auth = await requireTenantRoles(session, ["ADMIN", "MODERATOR"]);
  if ("error" in auth) return auth.error;

  const [tenantUsers, participants, teams] = await Promise.all([
    prisma.user.findMany({
      where: {
        deletedAt: null,
        id: { not: auth.user.id },
        tenantRoles: { some: { tenantId: auth.tenantId } },
      },
      select: { id: true, name: true },
      orderBy: [{ name: "asc" }, { createdAt: "asc" }],
      take: 200,
    }),
    prisma.participant.findMany({
      where: {
        deletedAt: null,
        userId: { not: null },
        user: { deletedAt: null, id: { not: auth.user.id } },
        team: { deletedAt: null, competition: { tenantId: auth.tenantId } },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        user: { select: { id: true, name: true } },
        team: {
          select: {
            id: true,
            name: true,
            competition: { select: { name: true, year: true } },
          },
        },
      },
      orderBy: [{ team: { name: "asc" } }, { lastName: "asc" }, { firstName: "asc" }],
      take: 200,
    }),
    prisma.team.findMany({
      where: {
        deletedAt: null,
        competition: { tenantId: auth.tenantId },
        OR: [
          { ownerId: { not: auth.user.id } },
          { teamChiefId: { not: null } },
          { memberRoles: { some: { role: "TEAM_MANAGER", revokedAt: null } } },
        ],
      },
      select: {
        id: true,
        name: true,
        owner: { select: { id: true, name: true } },
        teamChief: { select: { id: true, name: true } },
        competition: { select: { name: true, year: true } },
        memberRoles: {
          where: { role: "TEAM_MANAGER", revokedAt: null, user: { deletedAt: null } },
          select: { user: { select: { id: true, name: true } } },
        },
      },
      orderBy: [{ name: "asc" }],
      take: 200,
    }),
  ]);

  const targets = new Map<string, AdminMessageTarget>();

  for (const user of tenantUsers) {
    addTarget(targets, {
      userId: user.id,
      name: user.name,
      label: displayName(user),
      description: "Portal-Rolle im aktuellen Mandanten",
      teamId: null,
      participantId: null,
    });
  }

  for (const participant of participants) {
    if (!participant.user || participant.user.id === auth.user.id) continue;
    addTarget(targets, {
      userId: participant.user.id,
      name: participant.user.name,
      label: `${displayName(participant.user)} · ${participant.firstName} ${participant.lastName}`,
      description: `${participant.team.name} · ${participant.team.competition.name} ${participant.team.competition.year}`,
      teamId: participant.team.id,
      participantId: participant.id,
    });
  }

  for (const team of teams) {
    const context = `${team.name} · ${team.competition.name} ${team.competition.year}`;
    const users = [
      team.owner ? { user: team.owner, relation: "Teamkontakt" } : null,
      team.teamChief ? { user: team.teamChief, relation: "Teamchef:in" } : null,
      ...team.memberRoles.map((role) => ({ user: role.user, relation: "Team Manager:in" })),
    ].filter((entry): entry is { user: { id: string; name: string | null }; relation: string } => Boolean(entry?.user));

    for (const entry of users) {
      if (entry.user.id === auth.user.id) continue;
      addTarget(targets, {
        userId: entry.user.id,
        name: entry.user.name,
        label: `${displayName(entry.user)} · ${entry.relation}`,
        description: context,
        teamId: team.id,
        participantId: null,
      });
    }
  }

  return NextResponse.json({
    targets: Array.from(targets.values()).sort((a, b) => {
      const byLabel = a.label.localeCompare(b.label, "de");
      return byLabel || a.description.localeCompare(b.description, "de");
    }),
  });
}
