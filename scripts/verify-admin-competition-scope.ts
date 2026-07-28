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
assertIncludes(competitionsRoute, "resolveCurrentUser", "admin competition switcher");
assertIncludes(competitionsRoute, "userId: user.id", "admin competition switcher");
assertIncludes(competitionsRoute, 'role: "ADMIN"', "admin competition switcher");
assertIncludes(
  competitionsRoute,
  "prisma.competitionRole.findMany",
  "admin competition switcher",
);
assertIncludes(
  competitionsRoute,
  "{ id: { in: competitionIds } }",
  "admin competition switcher",
);
assertDoesNotInclude(
  competitionsRoute,
  "where: { tenantId: auth.tenantId }",
  "admin competition switcher",
);

assertIncludes(competitionRoute, "async function loadCompetition", "admin competition detail");
assertIncludes(competitionRoute, "where: { id: competitionId }", "admin competition detail");
assertIncludes(
  competitionRoute,
  "requireCompetitionRoles(session, ['ADMIN'], competitionId)",
  "admin competition detail",
);
assertIncludes(
  competitionRoute,
  "const auth = await requireCompetitionRoles(session, ['ADMIN'], competitionId)",
  "admin competition detail GET",
);
assertIncludes(
  competitionRoute,
  "const auth = await requireCompetitionRoles(session, ['ADMIN'], typeof body.id === 'string' ? body.id : null)",
  "admin competition detail PUT",
);
assertDoesNotInclude(competitionRoute, "requireTenantRoles", "admin competition detail");

console.log("admin competition scope verification ok");
