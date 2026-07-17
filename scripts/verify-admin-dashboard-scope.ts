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

const pendingChangesRoute = readSource("app/api/admin/pending-changes/route.ts");
const usersRoute = readSource("app/api/admin/users/route.ts");
const userRolesRoute = readSource("app/api/admin/users/[id]/roles/route.ts");
const userDeleteRoute = readSource("app/api/admin/users/[id]/route.ts");
const approvalQueue = readSource("app/components/approval-queue.tsx");
const userManagement = readSource("app/components/user-management.tsx");

for (const [label, source] of [
  ["pending changes route", pendingChangesRoute],
  ["users route", usersRoute],
] as const) {
  assertIncludes(source, "resolveScopedTenantId", label);
  assertIncludes(source, "getTenantRoleFlagsForUserId", label);
  assertIncludes(source, 'searchParams.get("competitionId")', label);
  assertIncludes(source, "scopedTenantId", label);
}

assertIncludes(pendingChangesRoute, "competitionId: scopedCompetitionId", "pending changes route");
assertIncludes(pendingChangesRoute, "tenantId: scopedTenantId", "pending changes route");
assertDoesNotInclude(pendingChangesRoute, "tenantId: auth.tenantId,", "pending changes route");

assertIncludes(usersRoute, "competitionId: scopedCompetitionId", "users route");
assertIncludes(usersRoute, "teamMemberRoles", "users route");
assertIncludes(usersRoute, "tenantId: scopedTenantId", "users route");
assertDoesNotInclude(usersRoute, "tenantId: auth.tenantId,", "users route");

assertIncludes(userRolesRoute, "body.competitionId", "user roles route");
assertIncludes(userRolesRoute, "tenantId: scopedTenantId", "user roles route");
assertDoesNotInclude(userRolesRoute, "tenantId: auth.tenantId,", "user roles route");

assertIncludes(userDeleteRoute, 'searchParams.get("competitionId")', "user delete route");
assertIncludes(userDeleteRoute, "tenantId: scopedTenantId", "user delete route");
assertDoesNotInclude(userDeleteRoute, "tenantId: auth.tenantId,", "user delete route");

assertIncludes(approvalQueue, "useCompetition", "approval queue");
assertIncludes(approvalQueue, 'params.set("competitionId", activeCompetition.id)', "approval queue");

assertIncludes(userManagement, "useCompetition", "user management");
assertIncludes(userManagement, 'params.set("competitionId", activeCompetition.id)', "user management");
assertIncludes(userManagement, "competitionId: activeCompetition?.id", "user management");

console.log("admin dashboard scope verification ok");
