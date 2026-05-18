import { prisma } from "@/lib/prisma";
import { resolveCurrentUser } from "@/lib/current-user";

type AppRole = "ADMIN" | "MODERATOR" | "TEAMCHEF" | "TEILNEHMER";

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

  const tenantRoles = user
    ? await prisma.tenantRole.findMany({
        where: {
          userId: user.id,
          ...(tenantId ? { tenantId } : {}),
        },
      })
    : [];

  const roles = tenantRoles.map((tenantRole) => tenantRole.role as AppRole);
  const roleSet = new Set<AppRole>(roles);
  const isAdmin = roleSet.has("ADMIN");
  const isModerator = roleSet.has("MODERATOR");
  const canViewAllTeams = isAdmin || isModerator;
  const canEditAllTeams = isAdmin || isModerator;

  return {
    user,
    roles,
    isAdmin,
    isModerator,
    canViewAllTeams,
    canEditAllTeams,
  };
}
