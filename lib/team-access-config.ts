export type TeamScopeRole = "ADMIN" | "MODERATOR" | "ZEITNAHME" | "TEAMCHEF" | "TEILNEHMER" | "ZUSCHAUER";

export type CompetitionTeamAccessConfig = {
  teamOwnerFilterVisibleForTeamchef: boolean;
  participantsCanViewAllTeams: boolean;
  spectatorsCanViewAllTeams: boolean;
  hideForeignTeams: boolean;
};

export const DEFAULT_COMPETITION_TEAM_ACCESS_CONFIG: CompetitionTeamAccessConfig = {
  teamOwnerFilterVisibleForTeamchef: false,
  participantsCanViewAllTeams: false,
  spectatorsCanViewAllTeams: false,
  hideForeignTeams: false,
};

export function normalizeCompetitionTeamAccessConfig(
  input?: Partial<CompetitionTeamAccessConfig> | null,
): CompetitionTeamAccessConfig {
  return {
    teamOwnerFilterVisibleForTeamchef:
      input?.teamOwnerFilterVisibleForTeamchef ?? DEFAULT_COMPETITION_TEAM_ACCESS_CONFIG.teamOwnerFilterVisibleForTeamchef,
    participantsCanViewAllTeams: input?.hideForeignTeams === true ? false : true,
    spectatorsCanViewAllTeams:
      input?.hideForeignTeams === true
        ? false
        : input?.spectatorsCanViewAllTeams ?? DEFAULT_COMPETITION_TEAM_ACCESS_CONFIG.spectatorsCanViewAllTeams,
    hideForeignTeams: input?.hideForeignTeams ?? DEFAULT_COMPETITION_TEAM_ACCESS_CONFIG.hideForeignTeams,
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
    case "ZEITNAHME":
      return false;
    case "TEAMCHEF":
      return normalized.participantsCanViewAllTeams;
    case "TEILNEHMER":
      return normalized.participantsCanViewAllTeams;
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
    case "ZEITNAHME":
      return false;
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
