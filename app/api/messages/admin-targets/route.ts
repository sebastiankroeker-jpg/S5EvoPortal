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

type TargetAggregate = {
  userId: string;
  name: string | null;
  label: string;
  contexts: Set<string>;
  teamId: string | null;
  participantId: string | null;
};
type RegisteredTargetUser = { id: string; name: string | null; authentikSub: string | null };

function displayName(user: { name: string | null }) {
  return user.name || "Portal-Konto";
}

function addTarget(
  targets: Map<string, TargetAggregate>,
  input: {
    user: { id: string; name: string | null; authentikSub: string | null };
    context: string;
    teamId?: string | null;
    participantId?: string | null;
  },
) {
  if (!input.user.id || !input.user.authentikSub) return;
  const existing = targets.get(input.user.id);
  if (existing) {
    existing.contexts.add(input.context);
    if (!existing.participantId && input.participantId) existing.participantId = input.participantId;
    if (!existing.teamId && input.teamId) existing.teamId = input.teamId;
    return;
  }
  targets.set(input.user.id, {
    userId: input.user.id,
    name: input.user.name,
    label: displayName(input.user),
    contexts: new Set([input.context]),
    teamId: input.teamId ?? null,
    participantId: input.participantId ?? null,
  });
}

function targetDescription(target: TargetAggregate) {
  const contexts = Array.from(target.contexts).sort((a, b) => a.localeCompare(b, "de"));
  const visible = contexts.slice(0, 2).join(" · ");
  const remaining = contexts.length - 2;
  return remaining > 0 ? `${visible} · +${remaining} weitere Verknuepfungen` : visible;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const auth = await requireTenantRoles(session, ["ADMIN", "MODERATOR"]);
  if ("error" in auth) return auth.error;

  const [tenantUsers, participants, teams] = await Promise.all([
    prisma.user.findMany({
      where: {
        deletedAt: null,
        authentikSub: { not: null },
        id: { not: auth.user.id },
        tenantRoles: { some: { tenantId: auth.tenantId } },
      },
      select: { id: true, name: true, authentikSub: true },
      orderBy: [{ name: "asc" }, { createdAt: "asc" }],
      take: 200,
    }),
    prisma.participant.findMany({
      where: {
        deletedAt: null,
        userId: { not: null },
        user: { deletedAt: null, authentikSub: { not: null }, id: { not: auth.user.id } },
        team: { deletedAt: null, competition: { tenantId: auth.tenantId } },
      },
      select: {
        id: true,
        user: { select: { id: true, name: true, authentikSub: true } },
        team: {
          select: {
            id: true,
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
        owner: { select: { id: true, name: true, authentikSub: true } },
        teamChief: { select: { id: true, name: true, authentikSub: true } },
        memberRoles: {
          where: { role: "TEAM_MANAGER", revokedAt: null, user: { deletedAt: null, authentikSub: { not: null } } },
          select: { user: { select: { id: true, name: true, authentikSub: true } } },
        },
      },
      orderBy: [{ name: "asc" }],
      take: 200,
    }),
  ]);

  const targets = new Map<string, TargetAggregate>();

  for (const user of tenantUsers) {
    addTarget(targets, {
      user,
      context: "Portal-Rolle im aktuellen Mandanten",
    });
  }

  for (const participant of participants) {
    if (!participant.user || participant.user.id === auth.user.id) continue;
    addTarget(targets, {
      user: participant.user,
      context: "Teilnehmer:in verknuepft",
      teamId: participant.team.id,
      participantId: participant.id,
    });
  }

  for (const team of teams) {
    const users = [
      team.owner ? { user: team.owner, relation: "Teamkontakt" } : null,
      team.teamChief ? { user: team.teamChief, relation: "Teamchef:in" } : null,
      ...team.memberRoles.map((role) => ({ user: role.user, relation: "Team Manager:in" })),
    ].filter((entry): entry is { user: RegisteredTargetUser; relation: string } => Boolean(entry?.user));

    for (const entry of users) {
      if (entry.user.id === auth.user.id) continue;
      addTarget(targets, {
        user: entry.user,
        context: entry.relation,
        teamId: team.id,
        participantId: null,
      });
    }
  }

  return NextResponse.json({
    targets: Array.from(targets.values()).map((target): AdminMessageTarget & { searchText: string } => ({
      userId: target.userId,
      name: target.name,
      label: target.label,
      description: targetDescription(target),
      teamId: target.teamId,
      participantId: target.participantId,
      searchText: [
        target.label,
        ...target.contexts,
      ].join(" "),
    })).sort((a, b) => {
      const byLabel = a.label.localeCompare(b.label, "de");
      return byLabel || a.description.localeCompare(b.description, "de");
    }),
  });
}
