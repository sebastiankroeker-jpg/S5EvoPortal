import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { resolveEffectiveCompetitionRoles } from "../lib/competition-role-policy";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

const competitionA = resolveEffectiveCompetitionRoles({
  tenantRoles: ["TEILNEHMER"],
  competitionRoles: ["MODERATOR"],
});
const competitionB = resolveEffectiveCompetitionRoles({
  tenantRoles: ["TEILNEHMER"],
  competitionRoles: [],
});
assert(competitionA.roles.includes("MODERATOR"), "competition A must receive its explicit moderator grant");
assert(!competitionB.roles.includes("MODERATOR"), "competition A moderator grant must not authorize competition B");

const timekeepingA = resolveEffectiveCompetitionRoles({
  tenantRoles: [],
  competitionRoles: ["ZEITNAHME"],
});
const timekeepingB = resolveEffectiveCompetitionRoles({
  tenantRoles: [],
  competitionRoles: [],
});
assert(timekeepingA.roles.includes("ZEITNAHME"), "competition A must receive its explicit timekeeping grant");
assert(!timekeepingB.roles.includes("ZEITNAHME"), "competition A timekeeping grant must not authorize competition B");

const tenantAdminA = resolveEffectiveCompetitionRoles({
  tenantRoles: ["ADMIN"],
  competitionRoles: [],
});
const tenantAdminB = resolveEffectiveCompetitionRoles({
  tenantRoles: ["ADMIN"],
  competitionRoles: [],
});
assert(tenantAdminA.roles.includes("ADMIN") && tenantAdminB.roles.includes("ADMIN"), "tenant admin must remain tenant-wide");

const legacyModerator = resolveEffectiveCompetitionRoles({
  tenantRoles: ["MODERATOR"],
  competitionRoles: [],
});
assert(!legacyModerator.roles.includes("MODERATOR"), "legacy moderator must not remain effective");

const legacyTimekeeping = resolveEffectiveCompetitionRoles({
  tenantRoles: ["ZEITNAHME"],
  competitionRoles: [],
});
assert(!legacyTimekeeping.roles.includes("ZEITNAHME"), "legacy timekeeping must not remain effective");

const tenantAdminWithLegacyTimekeeping = resolveEffectiveCompetitionRoles({
  tenantRoles: ["ADMIN", "ZEITNAHME"],
  competitionRoles: [],
});
assert(tenantAdminWithLegacyTimekeeping.roles.includes("ADMIN"), "tenant admin must remain effective");
assert(
  !tenantAdminWithLegacyTimekeeping.roles.includes("ZEITNAHME"),
  "legacy operational roles must not piggyback on tenant admin access",
);

const invalidScopedAdmin = resolveEffectiveCompetitionRoles({
  tenantRoles: [],
  competitionRoles: ["ADMIN"],
});
assert(!invalidScopedAdmin.roles.includes("ADMIN"), "competition grants must not create competition-scoped admins");

const schema = read("prisma/schema.prisma");
assert(schema.includes("model CompetitionRole"), "CompetitionRole model missing");
assert(schema.includes("@@unique([userId, competitionId, role])"), "CompetitionRole uniqueness missing");
const migration = read("prisma/migrations/20260728091500_add_competition_roles/migration.sql");
assert(
  migration.includes("competition_roles_operational_role_check"),
  "database must reject unsupported competition-scoped roles",
);
const legacyRemovalMigration = read("prisma/migrations/20260728105000_disallow_tenant_wide_operational_roles/migration.sql");
assert(
  legacyRemovalMigration.includes("tenant_roles_no_competition_scoped_roles"),
  "database must reject tenant-wide operational roles",
);

const serverPermissions = read("lib/server-permissions.ts");
assert(serverPermissions.includes("export async function requireCompetitionRoles"), "strict competition helper missing");
assert(serverPermissions.includes('error: "competitionId erforderlich"'), "strict helper must fail closed without competitionId");
assert(
  serverPermissions.includes("competition.tenantId !== tenantId"),
  "effective-role resolver must reject tenant/competition mismatches",
);
assert(
  serverPermissions.includes("return requireResolvedCompetitionRoles(resolved.user, allowedRoles, team.competition.tenantId, team.competition.id)"),
  "team entity helper must authorize in the resolved competition",
);
assert(
  serverPermissions.includes("return requireResolvedCompetitionRoles("),
  "entity helpers must use competition role resolution",
);
assert(
  !serverPermissions.includes("legacyTenantWideRoles"),
  "server permissions must not retain legacy operational role compatibility",
);

const competitionSwitcher = read("app/api/admin/competitions/route.ts");
assert(
  competitionSwitcher.includes('role: "ADMIN"'),
  "tenant-wide switcher access must be reserved for admins",
);

for (const route of [
  "app/api/timekeeping/events/route.ts",
  "app/api/timekeeping/snapshot/route.ts",
]) {
  assert(read(route).includes("requireCompetitionRoles"), `${route} must require a competition-scoped timekeeping role`);
}

const roleRoute = read("app/api/admin/users/[id]/roles/route.ts");
assert(roleRoute.includes("prisma.competitionRole.create"), "role API must create CompetitionRole grants");
assert(
  roleRoute.includes("role: { in: VALID_ROLES }"),
  "role API must keep operational grants out of tenant roles",
);

const profileRoute = read("app/api/profile/roles/route.ts");
assert(profileRoute.includes('searchParams.get("competitionId")'), "profile roles must require active competition scope");
assert(profileRoute.includes("getCompetitionRoleFlagsForUserId"), "profile roles must use competition-scoped resolver");
assert(!profileRoute.includes("legacyTenantWideRoles"), "profile roles must not expose legacy role compatibility");

process.stdout.write("Competition role scope verification passed (two-competition negative matrix + static guards).\n");
