import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function readSource(path: string) {
  return readFileSync(join(root, path), "utf8");
}

function assertIncludes(source: string, expected: string, label: string) {
  assert.ok(
    source.includes(expected),
    `${label} missing expected source marker: ${expected}`,
  );
}

function assertDoesNotInclude(source: string, unexpected: string, label: string) {
  assert.ok(
    !source.includes(unexpected),
    `${label} contains forbidden source marker: ${unexpected}`,
  );
}

const competitionsRoute = readSource("app/api/admin/competitions/route.ts");
const competitionRoute = readSource("app/api/admin/competition/route.ts");

assertIncludes(
  competitionsRoute,
  "prisma.tenantRole.findMany",
  "admin competition switcher",
);
assertIncludes(competitionsRoute, "userId: auth.user.id", "admin competition switcher");
assertIncludes(competitionsRoute, 'role: "ADMIN"', "admin competition switcher");
assertIncludes(
  competitionsRoute,
  "const adminTenantIds = [...new Set(adminTenantRoles.map((role) => role.tenantId))]",
  "admin competition switcher",
);
assertIncludes(
  competitionsRoute,
  "where: { tenantId: { in: adminTenantIds } }",
  "admin competition switcher",
);
assertDoesNotInclude(
  competitionsRoute,
  "where: { tenantId: auth.tenantId }",
  "admin competition switcher",
);

assertIncludes(competitionRoute, "async function requireCompetitionAdmin", "admin competition detail");
assertIncludes(competitionRoute, "where: { id: competitionId }", "admin competition detail");
assertIncludes(
  competitionRoute,
  "getTenantRoleFlagsForUserId(userId, competition.tenantId)",
  "admin competition detail",
);
assertIncludes(competitionRoute, "if (!access.isAdmin)", "admin competition detail");
assertIncludes(
  competitionRoute,
  "await requireCompetitionAdmin(auth.user.id, competitionId)",
  "admin competition detail GET",
);
assertIncludes(
  competitionRoute,
  "await requireCompetitionAdmin(auth.user.id, String(body.id))",
  "admin competition detail PUT",
);

console.log("admin competition scope verification ok");
