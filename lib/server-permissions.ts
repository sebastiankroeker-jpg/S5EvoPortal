import type { Session } from "next-auth";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { resolveCurrentUser } from "@/lib/current-user";

export type AppRole = "ADMIN" | "MODERATOR" | "ZEITNAHME" | "TEAMCHEF" | "TEILNEHMER";
type ResolvedUser = NonNullable<Awaited<ReturnType<typeof resolveCurrentUser>>["user"]>;

export async function getTenantRoleFlagsForUserId(userId: string, tenantId: string) {
  const tenantRoles = await prisma.tenantRole.findMany({
    where: {
      userId,
      tenantId,
    },
  });

  const roles = tenantRoles.map((tenantRole) => tenantRole.role as AppRole);
  const roleSet = new Set<AppRole>(roles);
  const isAdmin = roleSet.has("ADMIN");
  const isModerator = roleSet.has("MODERATOR");
  const isTimekeeper = roleSet.has("ZEITNAHME");

  return {
    roles,
    isAdmin,
    isModerator,
    isTimekeeper,
    canViewAllTeams: isAdmin || isModerator,
    canEditAllTeams: isAdmin || isModerator,
  };
}

export async function getScopedRoleFlags(
  userEmail: string,
  tenantId?: string,
  session?: Parameters<typeof resolveCurrentUser>[0],
) {
  const resolved = session ? await resolveCurrentUser(session, { createIfMissing: true }) : { user: null };
  const user =
    resolved.user ??
    (await prisma.user.findFirst({
      where: {
        deletedAt: null,
        email: {
          equals: userEmail,
          mode: "insensitive",
        },
      },
      orderBy: { createdAt: "asc" },
    }));

  const roleFlags = user && tenantId
    ? await getTenantRoleFlagsForUserId(user.id, tenantId)
    : {
        roles: [] as AppRole[],
        isAdmin: false,
        isModerator: false,
        isTimekeeper: false,
        canViewAllTeams: false,
        canEditAllTeams: false,
      };

  return {
    user,
    ...roleFlags,
  };
}

type RequireTenantRolesOptions = {
  tenantId?: string | null;
  createIfMissing?: boolean;
  fallbackToFirstMatchingTenant?: boolean;
};

type RequireTenantRolesError = {
  error: NextResponse;
};

type RequireTenantRolesSuccess = {
  user: ResolvedUser;
  tenantId: string;
  competitionId?: string;
  roles: AppRole[];
  isAdmin: boolean;
  isModerator: boolean;
  isTimekeeper: boolean;
  canViewAllTeams: boolean;
  canEditAllTeams: boolean;
};

type RequireAnyTenantRolesSuccess = {
  user: ResolvedUser;
  tenantIds: string[];
};

async function requireAuthenticatedSessionUser(
  session: Session | null,
  options: Pick<RequireTenantRolesOptions, "createIfMissing"> = {},
): Promise<RequireTenantRolesError | { user: ResolvedUser }> {
  if (!session?.user?.email) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { user } = await resolveCurrentUser(session, {
    createIfMissing: options.createIfMissing ?? false,
  });

  if (!user) {
    return {
      error: NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 }),
    };
  }

  return { user };
}

async function requireResolvedTenantRoles(
  user: ResolvedUser,
  allowedRoles: AppRole[],
  tenantId: string,
  competitionId?: string,
): Promise<RequireTenantRolesError | RequireTenantRolesSuccess> {
  const roleFlags = await getTenantRoleFlagsForUserId(user.id, tenantId);
  if (!allowedRoles.some((role) => roleFlags.roles.includes(role))) {
    return {
      error: NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 }),
    };
  }

  return {
    user,
    tenantId,
    ...(competitionId ? { competitionId } : {}),
    ...roleFlags,
  };
}

export async function requireTenantRoles(
  session: Session | null,
  allowedRoles: AppRole[],
  options: RequireTenantRolesOptions = {},
): Promise<RequireTenantRolesError | RequireTenantRolesSuccess> {
  const resolved = await requireAuthenticatedSessionUser(session, options);
  if ("error" in resolved) return resolved;
  const { user } = resolved;

  let tenantId = options.tenantId ?? null;
  if (!tenantId && options.fallbackToFirstMatchingTenant !== false) {
    const matchingTenantRole = await prisma.tenantRole.findFirst({
      where: {
        userId: user.id,
        role: { in: allowedRoles },
      },
      orderBy: { createdAt: "asc" },
    });

    tenantId = matchingTenantRole?.tenantId ?? null;
  }

  if (!tenantId) {
    return {
      error: NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 }),
    };
  }

  return requireResolvedTenantRoles(user, allowedRoles, tenantId);
}

export async function requireAnyTenantRoles(
  session: Session | null,
  allowedRoles: AppRole[],
  options: Pick<RequireTenantRolesOptions, "createIfMissing"> = {},
): Promise<RequireTenantRolesError | RequireAnyTenantRolesSuccess> {
  const resolved = await requireAuthenticatedSessionUser(session, options);
  if ("error" in resolved) return resolved;

  const tenantRoles = await prisma.tenantRole.findMany({
    where: {
      userId: resolved.user.id,
      role: { in: allowedRoles },
    },
    orderBy: { createdAt: "asc" },
    select: { tenantId: true },
  });
  const tenantIds = Array.from(new Set(tenantRoles.map((role) => role.tenantId)));

  if (tenantIds.length === 0) {
    return {
      error: NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 }),
    };
  }

  return {
    user: resolved.user,
    tenantIds,
  };
}

export async function requireCompetitionTenantRoles(
  session: Session | null,
  allowedRoles: AppRole[],
  competitionId: string | null | undefined,
  options: RequireTenantRolesOptions = {},
): Promise<RequireTenantRolesError | RequireTenantRolesSuccess> {
  const normalizedCompetitionId = competitionId?.trim() || null;
  if (!normalizedCompetitionId) {
    return requireTenantRoles(session, allowedRoles, options);
  }

  const resolved = await requireAuthenticatedSessionUser(session, options);
  if ("error" in resolved) return resolved;
  const { user } = resolved;

  const competition = await prisma.competition.findUnique({
    where: { id: normalizedCompetitionId },
    select: { id: true, tenantId: true },
  });

  if (!competition) {
    return {
      error: NextResponse.json({ error: "Wettkampf nicht gefunden" }, { status: 404 }),
    };
  }

  return requireResolvedTenantRoles(user, allowedRoles, competition.tenantId, competition.id);
}

export async function requireTeamTenantRoles(
  session: Session | null,
  allowedRoles: AppRole[],
  teamId: string | null | undefined,
  options: RequireTenantRolesOptions & { includeDeleted?: boolean } = {},
): Promise<RequireTenantRolesError | RequireTenantRolesSuccess> {
  const normalizedTeamId = teamId?.trim() || null;
  if (!normalizedTeamId) {
    return {
      error: NextResponse.json({ error: "Mannschaft nicht gefunden" }, { status: 404 }),
    };
  }

  const resolved = await requireAuthenticatedSessionUser(session, options);
  if ("error" in resolved) return resolved;

  const team = await prisma.team.findFirst({
    where: {
      id: normalizedTeamId,
      ...(options.includeDeleted ? {} : { deletedAt: null }),
    },
    select: {
      competition: { select: { id: true, tenantId: true } },
    },
  });

  if (!team) {
    return {
      error: NextResponse.json({ error: "Mannschaft nicht gefunden" }, { status: 404 }),
    };
  }

  return requireResolvedTenantRoles(resolved.user, allowedRoles, team.competition.tenantId, team.competition.id);
}

export async function requireParticipantTenantRoles(
  session: Session | null,
  allowedRoles: AppRole[],
  participantId: string | null | undefined,
  options: RequireTenantRolesOptions & { includeDeleted?: boolean } = {},
): Promise<RequireTenantRolesError | RequireTenantRolesSuccess> {
  const normalizedParticipantId = participantId?.trim() || null;
  if (!normalizedParticipantId) {
    return {
      error: NextResponse.json({ error: "Teilnehmer nicht gefunden" }, { status: 404 }),
    };
  }

  const resolved = await requireAuthenticatedSessionUser(session, options);
  if ("error" in resolved) return resolved;

  const participant = await prisma.participant.findFirst({
    where: {
      id: normalizedParticipantId,
      ...(options.includeDeleted ? {} : { deletedAt: null }),
      team: {
        ...(options.includeDeleted ? {} : { deletedAt: null }),
      },
    },
    select: {
      team: {
        select: {
          competition: { select: { id: true, tenantId: true } },
        },
      },
    },
  });

  if (!participant) {
    return {
      error: NextResponse.json({ error: "Teilnehmer nicht gefunden" }, { status: 404 }),
    };
  }

  return requireResolvedTenantRoles(resolved.user, allowedRoles, participant.team.competition.tenantId, participant.team.competition.id);
}

export async function requirePendingChangesTenantRoles(
  session: Session | null,
  allowedRoles: AppRole[],
  pendingChangeIds: string[],
  options: RequireTenantRolesOptions = {},
): Promise<RequireTenantRolesError | RequireTenantRolesSuccess> {
  const normalizedIds = Array.from(new Set(pendingChangeIds.map((id) => id.trim()).filter(Boolean)));
  if (normalizedIds.length === 0) {
    return {
      error: NextResponse.json({ error: "Änderungsanträge nicht gefunden" }, { status: 404 }),
    };
  }

  const resolved = await requireAuthenticatedSessionUser(session, options);
  if ("error" in resolved) return resolved;

  const pendingChanges = await prisma.pendingChange.findMany({
    where: { id: { in: normalizedIds } },
    select: {
      participant: {
        select: {
          team: {
            select: {
              competition: { select: { id: true, tenantId: true } },
            },
          },
        },
      },
    },
  });

  if (pendingChanges.length !== normalizedIds.length) {
    return {
      error: NextResponse.json({ error: "Mindestens ein Antrag wurde nicht gefunden" }, { status: 404 }),
    };
  }

  const competitionScopes = new Map(
    pendingChanges.map((change) => [
      change.participant.team.competition.tenantId,
      change.participant.team.competition.id,
    ]),
  );

  if (competitionScopes.size !== 1) {
    return {
      error: NextResponse.json({ error: "Anträge liegen in unterschiedlichen Mandanten" }, { status: 400 }),
    };
  }

  const [tenantId, competitionId] = [...competitionScopes.entries()][0];
  return requireResolvedTenantRoles(resolved.user, allowedRoles, tenantId, competitionId);
}

export async function requirePendingChangeBundleTenantRoles(
  session: Session | null,
  allowedRoles: AppRole[],
  bundleId: string | null | undefined,
  options: RequireTenantRolesOptions = {},
): Promise<RequireTenantRolesError | RequireTenantRolesSuccess> {
  const normalizedBundleId = bundleId?.trim() || null;
  if (!normalizedBundleId) {
    return {
      error: NextResponse.json({ error: "Bundle nicht gefunden" }, { status: 404 }),
    };
  }

  const resolved = await requireAuthenticatedSessionUser(session, options);
  if ("error" in resolved) return resolved;

  const pendingChanges = await prisma.pendingChange.findMany({
    where: { bundleId: normalizedBundleId },
    select: {
      participant: {
        select: {
          team: {
            select: {
              competition: { select: { id: true, tenantId: true } },
            },
          },
        },
      },
    },
  });

  if (pendingChanges.length === 0) {
    return {
      error: NextResponse.json({ error: "Bundle nicht gefunden" }, { status: 404 }),
    };
  }

  const competitionScopes = new Map(
    pendingChanges.map((change) => [
      change.participant.team.competition.tenantId,
      change.participant.team.competition.id,
    ]),
  );

  if (competitionScopes.size !== 1) {
    return {
      error: NextResponse.json({ error: "Bundle liegt in unterschiedlichen Mandanten" }, { status: 400 }),
    };
  }

  const [tenantId, competitionId] = [...competitionScopes.entries()][0];
  return requireResolvedTenantRoles(resolved.user, allowedRoles, tenantId, competitionId);
}
