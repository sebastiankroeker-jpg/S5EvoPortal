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
  const validCompetitionRoles = input.competitionRoles.filter((role) =>
    COMPETITION_SCOPED_ROLE_SET.has(role),
  );
  const legacyTenantWideRoles = input.tenantRoles.filter((role) =>
    COMPETITION_SCOPED_ROLE_SET.has(role),
  );

  return {
    roles: [...new Set([...input.tenantRoles, ...validCompetitionRoles])],
    competitionRoles: [...new Set(validCompetitionRoles)],
    legacyTenantWideRoles: [...new Set(legacyTenantWideRoles)],
  };
}
