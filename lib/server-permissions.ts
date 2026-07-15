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
  roles: AppRole[];
  isAdmin: boolean;
  isModerator: boolean;
  isTimekeeper: boolean;
  canViewAllTeams: boolean;
  canEditAllTeams: boolean;
};

export async function requireTenantRoles(
  session: Session | null,
  allowedRoles: AppRole[],
  options: RequireTenantRolesOptions = {},
): Promise<RequireTenantRolesError | RequireTenantRolesSuccess> {
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

  const roleFlags = await getTenantRoleFlagsForUserId(user.id, tenantId);
  if (!allowedRoles.some((role) => roleFlags.roles.includes(role))) {
    return {
      error: NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 }),
    };
  }

  return {
    user,
    tenantId,
    ...roleFlags,
  };
}
