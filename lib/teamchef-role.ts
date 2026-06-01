import type { Prisma, PrismaClient } from "@prisma/client";

type RoleDbClient = PrismaClient | Prisma.TransactionClient;

type TeamchefRoleInput = {
  userId: string;
  tenantId: string;
};

export function collectTeamAccessUserIds(input: {
  ownerId?: string | null;
  teamChiefId?: string | null;
  memberRoles?: Array<{ userId?: string | null }> | null;
}) {
  return Array.from(
    new Set(
      [
        input.teamChiefId,
        ...(input.memberRoles ?? []).map((memberRole) => memberRole.userId),
      ].filter((value): value is string => Boolean(value)),
    ),
  );
}

export async function hasDerivedTeamchefScope(
  db: RoleDbClient,
  { userId, tenantId }: TeamchefRoleInput,
) {
  const [legacyTeam, managerRole] = await Promise.all([
    db.team.findFirst({
      where: {
        deletedAt: null,
        competition: { tenantId },
        teamChiefId: userId,
      },
      select: { id: true },
    }),
    db.teamMemberRole.findFirst({
      where: {
        userId,
        role: "TEAM_MANAGER",
        revokedAt: null,
        team: {
          deletedAt: null,
          competition: { tenantId },
        },
      },
      select: { id: true },
    }),
  ]);

  return Boolean(legacyTeam || managerRole);
}

export async function syncDerivedTeamchefRole(
  db: RoleDbClient,
  { userId, tenantId }: TeamchefRoleInput,
) {
  const shouldHaveRole = await hasDerivedTeamchefScope(db, { userId, tenantId });

  if (shouldHaveRole) {
    const existingRole = await db.tenantRole.findFirst({
      where: { userId, tenantId, role: "TEAMCHEF" },
      select: { id: true },
    });

    if (!existingRole) {
      await db.tenantRole.create({
        data: {
          userId,
          tenantId,
          role: "TEAMCHEF",
        },
      });
    }
  } else {
    await db.tenantRole.deleteMany({
      where: { userId, tenantId, role: "TEAMCHEF" },
    });
  }

  return shouldHaveRole;
}
