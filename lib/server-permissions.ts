import type { Session } from "next-auth";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { resolveCurrentUser } from "@/lib/current-user";
import {
  COMPETITION_SCOPED_ROLES,
  resolveEffectiveCompetitionRoles,
} from "@/lib/competition-role-policy";

export type AppRole = "ADMIN" | "MODERATOR" | "ZEITNAHME" | "TEAMCHEF" | "TEILNEHMER" | "FRIENDS";
export type PermissionKey = "admin.roles.manage" | "portal.map.view";
export { COMPETITION_SCOPED_ROLES };
const COMPETITION_SCOPED_ROLE_SET = new Set<AppRole>(COMPETITION_SCOPED_ROLES);

function buildRoleFlags(roles: AppRole[]) {
  const uniqueRoles = [...new Set(roles)];
  const roleSet = new Set<AppRole>(uniqueRoles);
  const isAdmin = roleSet.has("ADMIN");
  const isModerator = roleSet.has("MODERATOR");
  const isTimekeeper = roleSet.has("ZEITNAHME");

  return {
    roles: uniqueRoles,
    isAdmin,
    isModerator,
    isTimekeeper,
    canViewAllTeams: isAdmin || isModerator,
    canEditAllTeams: isAdmin || isModerator,
  };
}

export async function getEffectivePermissionsForUserId(
  userId: string,
  tenantId: string,
  competitionId?: string,
): Promise<PermissionKey[]> {
  const roleFlags = competitionId
    ? await getCompetitionRoleFlagsForUserId(userId, tenantId, competitionId)
    : await getTenantRoleFlagsForUserId(userId, tenantId);
  if (roleFlags.roles.length === 0) return [];

  const grants = await prisma.rolePermission.findMany({
    where: {
      tenantId,
      role: { in: roleFlags.roles },
    },
    select: { permission: { select: { key: true } } },
  });

  return [...new Set(grants.map((grant) => grant.permission.key))]
    .filter((key): key is PermissionKey => key === "admin.roles.manage" || key === "portal.map.view");
}

export async function hasEffectivePermissionForUserId(
  userId: string,
  tenantId: string,
  permission: PermissionKey,
  competitionId?: string,
): Promise<boolean> {
  return (await getEffectivePermissionsForUserId(userId, tenantId, competitionId)).includes(permission);
}

export async function hasEffectivePermissionForAnyTenant(
  userId: string,
  permission: PermissionKey,
): Promise<boolean> {
  const tenantRoles = await prisma.tenantRole.findMany({
    where: {
      userId,
      role: { notIn: [...COMPETITION_SCOPED_ROLES] },
    },
    select: { tenantId: true },
    distinct: ["tenantId"],
  });

  for (const { tenantId } of tenantRoles) {
    if (await hasEffectivePermissionForUserId(userId, tenantId, permission)) return true;
  }
  return false;
}
type ResolvedUser = NonNullable<Awaited<ReturnType<typeof resolveCurrentUser>>["user"]>;

export async function getTenantRoleFlagsForUserId(userId: string, tenantId: string) {
  const tenantRoles = await prisma.tenantRole.findMany({
    where: {
      userId,
      tenantId,
      role: { notIn: [...COMPETITION_SCOPED_ROLES] },
    },
  });

  const roles = tenantRoles.map((tenantRole) => tenantRole.role as AppRole);
  return buildRoleFlags(roles);
}

export async function getCompetitionRoleFlagsForUserId(
  userId: string,
  tenantId: string,
  competitionId: string,
) {
  const competition = await prisma.competition.findUnique({
    where: { id: competitionId },
    select: { tenantId: true },
  });
  if (!competition || competition.tenantId !== tenantId) {
    return buildRoleFlags([]);
  }

  const [tenantRoles, competitionRoles] = await Promise.all([
    prisma.tenantRole.findMany({
      where: {
        userId,
        tenantId,
        role: { notIn: [...COMPETITION_SCOPED_ROLES] },
      },
      select: { role: true },
    }),
    prisma.competitionRole.findMany({
      where: {
        userId,
        competitionId,
        competition: { tenantId },
        role: { in: [...COMPETITION_SCOPED_ROLES] },
      },
      select: { role: true },
    }),
  ]);

  const tenantRoleValues = tenantRoles.map((tenantRole) => tenantRole.role as AppRole);
  const scopedRoleValues = competitionRoles.map((competitionRole) => competitionRole.role as AppRole);
  const effectiveRoles = resolveEffectiveCompetitionRoles({
    tenantRoles: tenantRoleValues,
    competitionRoles: scopedRoleValues,
  });

  return buildRoleFlags(effectiveRoles.roles as AppRole[]);
}

export async function getScopedRoleFlags(
  userEmail: string,
  tenantId?: string,
  session?: Parameters<typeof resolveCurrentUser>[0],
  competitionId?: string,
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
    ? competitionId
      ? await getCompetitionRoleFlagsForUserId(user.id, tenantId, competitionId)
      : await getTenantRoleFlagsForUserId(user.id, tenantId)
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

type RequireCompetitionRolesSuccess = Omit<RequireTenantRolesSuccess, "competitionId"> & {
  competitionId: string;
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

async function requireResolvedCompetitionRoles(
  user: ResolvedUser,
  allowedRoles: AppRole[],
  tenantId: string,
  competitionId: string,
): Promise<RequireTenantRolesError | RequireCompetitionRolesSuccess> {
  const roleFlags = await getCompetitionRoleFlagsForUserId(user.id, tenantId, competitionId);
  if (!allowedRoles.some((role) => roleFlags.roles.includes(role))) {
    return {
      error: NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 }),
    };
  }

  return {
    user,
    tenantId,
    competitionId,
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
        NOT: { role: { in: [...COMPETITION_SCOPED_ROLES] } },
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
      NOT: { role: { in: [...COMPETITION_SCOPED_ROLES] } },
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
    if (allowedRoles.some((role) => COMPETITION_SCOPED_ROLE_SET.has(role))) {
      return requireCompetitionRoles(session, allowedRoles, normalizedCompetitionId, options);
    }
    return requireTenantRoles(session, allowedRoles, options);
  }

  return requireCompetitionRoles(session, allowedRoles, normalizedCompetitionId, options);
}

export async function requireCompetitionRoles(
  session: Session | null,
  allowedRoles: AppRole[],
  competitionId: string | null | undefined,
  options: Pick<RequireTenantRolesOptions, "createIfMissing"> = {},
): Promise<RequireTenantRolesError | RequireCompetitionRolesSuccess> {
  const normalizedCompetitionId = competitionId?.trim() || null;
  const resolved = await requireAuthenticatedSessionUser(session, options);
  if ("error" in resolved) return resolved;

  if (!normalizedCompetitionId) {
    return {
      error: NextResponse.json({ error: "competitionId erforderlich" }, { status: 400 }),
    };
  }

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

  return requireResolvedCompetitionRoles(user, allowedRoles, competition.tenantId, competition.id);
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

  return requireResolvedCompetitionRoles(resolved.user, allowedRoles, team.competition.tenantId, team.competition.id);
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

  return requireResolvedCompetitionRoles(
    resolved.user,
    allowedRoles,
    participant.team.competition.tenantId,
    participant.team.competition.id,
  );
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
  return requireResolvedCompetitionRoles(resolved.user, allowedRoles, tenantId, competitionId);
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
  return requireResolvedCompetitionRoles(resolved.user, allowedRoles, tenantId, competitionId);
}
