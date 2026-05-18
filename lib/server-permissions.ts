import { prisma } from "@/lib/prisma";

type AppRole = "ADMIN" | "MODERATOR" | "TEAMCHEF" | "TEILNEHMER";

export async function getScopedRoleFlags(userEmail: string, tenantId?: string) {
  const user = await prisma.user.findUnique({
    where: { email: userEmail },
    include: {
      tenantRoles: tenantId
        ? {
            where: { tenantId },
          }
        : true,
    },
  });

  const roles = (user?.tenantRoles ?? []).map((tenantRole) => tenantRole.role as AppRole);
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
