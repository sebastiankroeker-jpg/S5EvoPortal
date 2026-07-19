import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function readSource(path: string) {
  return readFileSync(join(root, path), "utf8");
}

function assertIncludes(source: string, expected: string, label: string) {
  assert.ok(source.includes(expected), `${label} missing expected source marker: ${expected}`);
}

function assertDoesNotInclude(source: string, unexpected: string, label: string) {
  assert.ok(!source.includes(unexpected), `${label} contains forbidden source marker: ${unexpected}`);
}

const serverPermissions = readSource("lib/server-permissions.ts");
const adminPage = readSource("app/admin/page.tsx");
const dailyExportRoute = readSource("app/api/admin/daily-orga-export/route.ts");
const teamsExportRoute = readSource("app/api/admin/teams-export/route.ts");

assertIncludes(serverPermissions, "requireCompetitionTenantRoles", "server permissions helper");
assertIncludes(serverPermissions, "where: { id: normalizedCompetitionId }", "server permissions helper");
assertIncludes(serverPermissions, "requireResolvedTenantRoles(user, allowedRoles, competition.tenantId, competition.id)", "server permissions helper");
assertIncludes(serverPermissions, "getTenantRoleFlagsForUserId(user.id, tenantId)", "server permissions helper");

for (const [label, source] of [
  ["daily orga export route", dailyExportRoute],
  ["teams export route", teamsExportRoute],
] as const) {
  assertIncludes(source, "requireCompetitionTenantRoles", label);
  assertIncludes(source, "competitionId", label);
  assertIncludes(source, "tenantId: auth.tenantId", label);
  assertDoesNotInclude(source, "requireTenantRoles(session, [\"ADMIN\", \"MODERATOR\"])", label);
}

assertIncludes(
  adminPage,
  'body: JSON.stringify({ competitionId: activeCompetition.id })',
  "admin page sends active competition id",
);

console.log("admin csv export scope verification ok");
