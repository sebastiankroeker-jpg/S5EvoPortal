export type TeamScopeRole = "ADMIN" | "MODERATOR" | "TEAMCHEF" | "TEILNEHMER" | "ZUSCHAUER";

export type CompetitionTeamAccessConfig = {
  teamOwnerFilterVisibleForTeamchef: boolean;
  participantsCanViewAllTeams: boolean;
  spectatorsCanViewAllTeams: boolean;
};

export const DEFAULT_COMPETITION_TEAM_ACCESS_CONFIG: CompetitionTeamAccessConfig = {
  teamOwnerFilterVisibleForTeamchef: false,
  participantsCanViewAllTeams: false,
  spectatorsCanViewAllTeams: false,
};

export function normalizeCompetitionTeamAccessConfig(
  input?: Partial<CompetitionTeamAccessConfig> | null,
): CompetitionTeamAccessConfig {
  return {
    teamOwnerFilterVisibleForTeamchef:
      input?.teamOwnerFilterVisibleForTeamchef ?? DEFAULT_COMPETITION_TEAM_ACCESS_CONFIG.teamOwnerFilterVisibleForTeamchef,
    participantsCanViewAllTeams: true,
    spectatorsCanViewAllTeams: false,
  };
}

export function canRoleViewAllTeams(
  role: TeamScopeRole,
  config?: Partial<CompetitionTeamAccessConfig> | null,
): boolean {
  const normalized = normalizeCompetitionTeamAccessConfig(config);

  switch (role) {
    case "ADMIN":
    case "MODERATOR":
      return true;
    case "TEAMCHEF":
      return normalized.participantsCanViewAllTeams;
    case "TEILNEHMER":
      return true;
    case "ZUSCHAUER":
      return false;
    default:
      return false;
  }
}

export function isOwnerFilterVisibleForRole(
  role: TeamScopeRole,
  config?: Partial<CompetitionTeamAccessConfig> | null,
): boolean {
  const normalized = normalizeCompetitionTeamAccessConfig(config);

  switch (role) {
    case "ADMIN":
    case "MODERATOR":
      return true;
    case "TEAMCHEF":
      return normalized.teamOwnerFilterVisibleForTeamchef;
    default:
      return false;
  }
}

export function resolveEffectiveTeamScopeRole(
  requestedRole: string | null | undefined,
  availableRoles: Array<Exclude<TeamScopeRole, "ZUSCHAUER">>,
): TeamScopeRole {
  if (requestedRole === "ZUSCHAUER") {
    return "ZUSCHAUER";
  }

  if (requestedRole && availableRoles.includes(requestedRole as Exclude<TeamScopeRole, "ZUSCHAUER">)) {
    return requestedRole as TeamScopeRole;
  }

  if (availableRoles.includes("ADMIN")) return "ADMIN";
  if (availableRoles.includes("MODERATOR")) return "MODERATOR";
  if (availableRoles.includes("TEAMCHEF")) return "TEAMCHEF";
  if (availableRoles.includes("TEILNEHMER")) return "TEILNEHMER";
  return "ZUSCHAUER";
}
