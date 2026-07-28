export type CompetitionScopedAppRole = "MODERATOR" | "ZEITNAHME";

export const COMPETITION_SCOPED_ROLES = [
  "MODERATOR",
  "ZEITNAHME",
] as const satisfies readonly CompetitionScopedAppRole[];

const COMPETITION_SCOPED_ROLE_SET = new Set<string>(COMPETITION_SCOPED_ROLES);

export function resolveEffectiveCompetitionRoles(input: {
  tenantRoles: readonly string[];
  competitionRoles: readonly string[];
}) {
  const tenantScopedRoles = input.tenantRoles.filter((role) =>
    !COMPETITION_SCOPED_ROLE_SET.has(role),
  );
  const validCompetitionRoles = input.competitionRoles.filter((role) =>
    COMPETITION_SCOPED_ROLE_SET.has(role),
  );

  return {
    roles: [...new Set([...tenantScopedRoles, ...validCompetitionRoles])],
    competitionRoles: [...new Set(validCompetitionRoles)],
  };
}
