import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function readSource(path: string) {
  return readFileSync(join(root, path), "utf8");
}

function walk(dir: string): string[] {
  return readdirSync(join(root, dir)).flatMap((entry) => {
    const path = join(dir, entry);
    const absolutePath = join(root, path);
    const stat = statSync(absolutePath);
    if (stat.isDirectory()) return walk(path);
    return path.endsWith(".ts") ? [path] : [];
  });
}

function assertIncludes(source: string, expected: string, label: string) {
  assert.ok(source.includes(expected), `${label} missing expected source marker: ${expected}`);
}

const competitionScopedRoutes = [
  "app/api/admin/audit-events/route.ts",
  "app/api/admin/claim-audit/route.ts",
  "app/api/admin/deleted-teams/route.ts",
  "app/api/admin/mail-events/route.ts",
  "app/api/admin/orga-summary/route.ts",
  "app/api/admin/participant-audit/route.ts",
  "app/api/admin/participants/route.ts",
  "app/api/admin/result-staging/batches/route.ts",
  "app/api/admin/result-staging/reset/preview/route.ts",
  "app/api/admin/result-staging/reset/route.ts",
  "app/api/admin/result-staging/timekeeping/sessions/route.ts",
  "app/api/admin/start-numbers/import/route.ts",
  "app/api/admin/team-access-audit/route.ts",
] as const;

for (const route of competitionScopedRoutes) {
  const source = readSource(route);
  assertIncludes(source, "requireCompetitionTenantRoles", route);
}

const claimLinksRoute = readSource("app/api/admin/claim-links/route.ts");
assertIncludes(claimLinksRoute, "requireCompetitionAdminAccess(competitionId)", "claim links GET competition scope");
assertIncludes(claimLinksRoute, "requireCompetitionTenantRoles", "claim links GET competition scope");

const competitionResetRoute = readSource("app/api/admin/competition/reset/route.ts");
assertIncludes(competitionResetRoute, "requireCompetitionTenantRoles", "competition reset route");
assertIncludes(competitionResetRoute, 'request.nextUrl.searchParams.get("id")', "competition reset GET");
assertIncludes(competitionResetRoute, "const competitionId = typeof body.id", "competition reset POST");

const pendingChangeDecisionRoute = readSource("app/api/admin/pending-changes/[id]/route.ts");
assertIncludes(pendingChangeDecisionRoute, "resolvePendingChangeTenantId", "pending change decision route");
assertIncludes(pendingChangeDecisionRoute, "tenantId: scopedTenantId", "pending change decision route");
assertIncludes(pendingChangeDecisionRoute, "fallbackToFirstMatchingTenant: !scopedTenantId", "pending change decision route");

const entityScopedRoutes = new Map<string, string[]>([
  [
    "app/api/admin/claim-links/route.ts",
    [
      "requireParticipantTenantRoles(session, [\"ADMIN\", \"MODERATOR\"], participantId)",
      "requireTeamTenantRoles(session, [\"ADMIN\", \"MODERATOR\"], teamId)",
      "fallbackToFirstMatchingTenant: false",
    ],
  ],
  [
    "app/api/admin/deleted-teams/[id]/restore/route.ts",
    ["requireTeamTenantRoles(session, [\"ADMIN\"], id, { includeDeleted: true })"],
  ],
  [
    "app/api/admin/participant-change-bundles/route.ts",
    ["requirePendingChangesTenantRoles(session, [\"ADMIN\", \"MODERATOR\"], uniquePendingChangeIds)"],
  ],
  [
    "app/api/admin/participant-change-bundles/[id]/route.ts",
    ["requirePendingChangeBundleTenantRoles(session, [\"ADMIN\", \"MODERATOR\"], bundleId)"],
  ],
  [
    "app/api/admin/participant-change-bundles/[id]/decision/route.ts",
    ["requirePendingChangeBundleTenantRoles(session, [\"ADMIN\", \"MODERATOR\"], bundleId)"],
  ],
]);

for (const [route, expectedMarkers] of entityScopedRoutes) {
  const source = readSource(route);
  for (const marker of expectedMarkers) {
    assertIncludes(source, marker, route);
  }
}

const adminTargetsRoute = readSource("app/api/messages/admin-targets/route.ts");
assertIncludes(adminTargetsRoute, "requireAnyTenantRoles(session, [\"ADMIN\", \"MODERATOR\"])", "message admin targets route");
assertIncludes(adminTargetsRoute, "tenantId: { in: auth.tenantIds }", "message admin targets route");

const adminConversationsRoute = readSource("app/api/messages/admin-conversations/route.ts");
assertIncludes(adminConversationsRoute, "requireAnyTenantRoles(session, [\"ADMIN\", \"MODERATOR\"])", "message admin conversations route");
assertIncludes(adminConversationsRoute, "tenantId: { in: auth.tenantIds }", "message admin conversations route");
assertIncludes(adminConversationsRoute, "const tenantId = participant?.team.competition.tenantId ?? team?.competition.tenantId ?? tenantRole?.tenantId", "message admin conversations route");

const allowedCustomCompetitionScopeRoutes = new Map<string, string>([
  ["app/api/admin/competition/route.ts", "uses requireCompetitionAdmin() after resolving selected competition id"],
  ["app/api/admin/competitions/route.ts", "lists all admin tenants for the competition switcher"],
  ["app/api/admin/pending-changes/route.ts", "uses resolveScopedTenantId() and existing targeted guard"],
  ["app/api/admin/pending-changes/[id]/route.ts", "uses resolvePendingChangeTenantId() before role auth"],
  ["app/api/admin/users/route.ts", "uses resolveScopedTenantId() and existing targeted guard"],
  ["app/api/admin/users/[id]/route.ts", "uses resolveScopedTenantId() and existing targeted guard"],
  ["app/api/admin/users/[id]/roles/route.ts", "uses resolveScopedTenantId() and existing targeted guard"],
  ["app/api/dashboard-layouts/route.ts", "resolves competition tenant before requireTenantRoles()"],
  ["app/api/dashboard-layouts/[id]/route.ts", "loads layout tenant before requireTenantRoles()"],
  ["app/api/admin/result-staging/timekeeping/import/route.ts", "loads competition tenant before requireTenantRoles() with fallback disabled"],
]);

const tenantLevelRoutes = new Map<string, string>([
  ["app/api/admin/changelog-entries/route.ts", "tenant-level changelog moderation"],
  ["app/api/admin/changelog-entries/[entryId]/route.ts", "entry-id scoped changelog route"],
  ["app/api/admin/runtime-logs/route.ts", "tenant/project-level runtime log viewer"],
  ["app/api/admin/tenant/route.ts", "tenant settings route"],
]);

const scannedRoutes = [
  ...walk("app/api/admin"),
  ...walk("app/api/dashboard-layouts"),
  ...walk("app/api/messages"),
].filter((path) => path.endsWith("/route.ts"));

const unexpectedFallbackRoutes: string[] = [];
for (const route of scannedRoutes) {
  const source = readSource(route);
  if (!source.includes("competitionId") || !source.includes("requireTenantRoles(")) continue;
  if (source.includes("requireCompetitionTenantRoles")) continue;
  if (allowedCustomCompetitionScopeRoutes.has(route)) continue;
  if (tenantLevelRoutes.has(route)) continue;
  unexpectedFallbackRoutes.push(route);
}

assert.deepEqual(
  unexpectedFallbackRoutes,
  [],
  `competition-scoped routes still using fallback tenant auth: ${unexpectedFallbackRoutes.join(", ")}`,
);

console.log("tenant scope verification ok");
console.log(`entity scoped routes verified: ${entityScopedRoutes.size}`);
