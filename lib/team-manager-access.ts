import { normalizeEmail } from "@/lib/current-user";

type TeamAccessInput = {
  team: {
    ownerId?: string | null;
    teamChiefId?: string | null;
    contactEmail?: string | null;
    owner?: { email?: string | null } | null;
    memberRoles?: Array<{ userId?: string | null; revokedAt?: Date | string | null }> | null;
  };
  user?: { id?: string | null } | null;
  userEmail?: string | null;
  canEditAllTeams?: boolean;
};

export function resolveTeamAccess(input: TeamAccessInput) {
  const userId = input.user?.id ?? null;
  const normalizedUserEmail = normalizeEmail(input.userEmail);
  const isLegacyOwner =
    (!!userId && (input.team.ownerId === userId || input.team.teamChiefId === userId)) ||
    (!!normalizedUserEmail &&
      (normalizeEmail(input.team.owner?.email) === normalizedUserEmail ||
        normalizeEmail(input.team.contactEmail) === normalizedUserEmail));
  const isTeamManager =
    !!userId &&
    (input.team.memberRoles ?? []).some((memberRole) => memberRole.userId === userId && !memberRole.revokedAt);
  const canEditAllTeams = input.canEditAllTeams === true;

  return {
    isLegacyOwner,
    isTeamManager,
    canEditTeam: canEditAllTeams || isLegacyOwner || isTeamManager,
    canManageTeamManagers: canEditAllTeams || isLegacyOwner,
  };
}
