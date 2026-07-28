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
  "app/api/admin/daily-orga-export/route.ts",
  "app/api/admin/deleted-teams/route.ts",
  "app/api/admin/mail-events/route.ts",
  "app/api/admin/orga-summary/route.ts",
  "app/api/admin/participant-audit/route.ts",
  "app/api/admin/participants/route.ts",
  "app/api/admin/result-staging/batches/route.ts",
  "app/api/admin/result-staging/batches/[batchId]/route.ts",
  "app/api/admin/result-staging/batches/[batchId]/corrections/route.ts",
  "app/api/admin/result-staging/batches/[batchId]/publish-preview/route.ts",
  "app/api/admin/result-staging/batches/[batchId]/publish/route.ts",
  "app/api/admin/result-staging/legacy-results/import/route.ts",
  "app/api/admin/result-staging/legacy-running/import/route.ts",
  "app/api/admin/result-staging/reset/preview/route.ts",
  "app/api/admin/result-staging/reset/route.ts",
  "app/api/admin/result-staging/timekeeping/sessions/[sessionId]/route.ts",
  "app/api/admin/result-staging/timekeeping/sessions/route.ts",
  "app/api/admin/start-numbers/import/route.ts",
  "app/api/admin/start-numbers/reset/route.ts",
  "app/api/admin/team-access-audit/route.ts",
  "app/api/admin/teams-export/route.ts",
] as const;

for (const route of competitionScopedRoutes) {
  const source = readSource(route);
  assertIncludes(source, "requireCompetitionTenantRoles", route);
}

const claimLinksRoute = readSource("app/api/admin/claim-links/route.ts");
assertIncludes(claimLinksRoute, "requireCompetitionAdminAccess(competitionId)", "claim links GET competition scope");
assertIncludes(claimLinksRoute, "requireCompetitionTenantRoles", "claim links GET competition scope");
assertIncludes(claimLinksRoute, "requireCompetitionRoles(session, [\"ADMIN\"], competitionId)", "claim links tenant toggle scope");

const dashboardLayoutsRoute = readSource("app/api/dashboard-layouts/route.ts");
assertIncludes(dashboardLayoutsRoute, "tenantContextCompetitionId", "dashboard layouts tenant context anchor");
assertIncludes(dashboardLayoutsRoute, "Aktiver Wettkampf als Tenant-Kontext erforderlich", "dashboard layouts tenant context validation");
assertIncludes(dashboardLayoutsRoute, "data.competitionId || data.tenantContextCompetitionId", "dashboard layouts tenant context resolution");

const rolePermissionsRoute = readSource("app/api/admin/role-permissions/route.ts");
assertIncludes(rolePermissionsRoute, "requireCompetitionRoles(session, [\"ADMIN\"], competitionId)", "role permission competition scope");

const competitionRoute = readSource("app/api/admin/competition/route.ts");
assertIncludes(competitionRoute, "requireCompetitionRoles(session, ['ADMIN'], competitionId)", "competition GET scope");
assertIncludes(competitionRoute, "requireCompetitionRoles(session, ['ADMIN'], typeof body.id", "competition PUT scope");

const homeNewsRoute = readSource("app/api/admin/home-news/route.ts");
assertIncludes(homeNewsRoute, "requireCompetitionRoles(session, [\"ADMIN\"]", "home news competition scope");
assertIncludes(homeNewsRoute, "competitionId: auth.competitionId", "home news persisted competition scope");

const homeNewsEntryRoute = readSource("app/api/admin/home-news/[entryId]/route.ts");
assertIncludes(homeNewsEntryRoute, "requireAnyTenantRoles(session, [\"ADMIN\"])", "home news entry global pre-auth");
assertIncludes(homeNewsEntryRoute, "getTenantRoleFlagsForUserId(userId, entry.tenantId)", "home news entry target tenant scope");

const userDeleteRoute = readSource("app/api/admin/users/[id]/route.ts");
assertIncludes(userDeleteRoute, "requireCompetitionRoles(session, [\"ADMIN\"], url.searchParams.get(\"competitionId\"))", "user delete competition scope");

const globalRoutes = [
  "app/api/admin/changelog-entries/route.ts",
  "app/api/admin/changelog-entries/[entryId]/route.ts",
  "app/api/admin/runtime-logs/route.ts",
] as const;
for (const route of globalRoutes) {
  assertIncludes(readSource(route), "requireAnyTenantRoles", `${route} explicit portal-global scope`);
}

const competitionResetRoute = readSource("app/api/admin/competition/reset/route.ts");
assertIncludes(competitionResetRoute, "requireCompetitionTenantRoles", "competition reset route");
assertIncludes(competitionResetRoute, 'request.nextUrl.searchParams.get("id")', "competition reset GET");
assertIncludes(competitionResetRoute, "const competitionId = typeof body.id", "competition reset POST");

const pendingChangeDecisionRoute = readSource("app/api/admin/pending-changes/[id]/route.ts");
assertIncludes(pendingChangeDecisionRoute, "resolvePendingChangeScope", "pending change decision route");
assertIncludes(pendingChangeDecisionRoute, "requireCompetitionRoles", "pending change decision route");
assertIncludes(pendingChangeDecisionRoute, "scopedCompetition.id", "pending change decision route");

const entityScopedRoutes = new Map<string, string[]>([
  [
    "app/api/admin/claim-links/route.ts",
    [
      "requireParticipantTenantRoles(session, [\"ADMIN\", \"MODERATOR\"], participantId)",
      "requireTeamTenantRoles(session, [\"ADMIN\", \"MODERATOR\"], teamId)",
      "requireCompetitionRoles(",
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
assertIncludes(adminTargetsRoute, "requireCompetitionRoles(", "message admin targets route");
assertIncludes(adminTargetsRoute, 'request.nextUrl.searchParams.get("competitionId")', "message admin targets route");
assertIncludes(adminTargetsRoute, "competitionId: auth.competitionId", "message admin targets route");

const adminConversationsRoute = readSource("app/api/messages/admin-conversations/route.ts");
assertIncludes(adminConversationsRoute, "requireCompetitionRoles(", "message admin conversations route");
assertIncludes(adminConversationsRoute, "competitionId: auth.competitionId", "message admin conversations route");
assertIncludes(adminConversationsRoute, "const competitionId = auth.competitionId", "message admin conversations route");

const timekeepingEventsRoute = readSource("app/api/timekeeping/events/route.ts");
assertIncludes(timekeepingEventsRoute, "existingSession.tenantId !== auth.tenantId", "timekeeping session tenant scope");
assertIncludes(timekeepingEventsRoute, "existingSession.competitionId !== competitionId", "timekeeping session competition scope");

type RouteScope =
  | "framework"
  | "public"
  | "capability"
  | "secret"
  | "self"
  | "entity"
  | "competition"
  | "tenant"
  | "global"
  | "mixed";

const routeScopeInventory = new Map<string, RouteScope>([
  ["app/api/admin/audit-events/route.ts", "competition"],
  ["app/api/admin/changelog-entries/[entryId]/route.ts", "global"],
  ["app/api/admin/changelog-entries/route.ts", "global"],
  ["app/api/admin/claim-audit/route.ts", "competition"],
  ["app/api/admin/claim-links/route.ts", "mixed"],
  ["app/api/admin/competition/classifications/route.ts", "competition"],
  ["app/api/admin/competition/reset/route.ts", "competition"],
  ["app/api/admin/competition/route.ts", "mixed"],
  ["app/api/admin/competitions/[id]/clone/route.ts", "tenant"],
  ["app/api/admin/competitions/route.ts", "tenant"],
  ["app/api/admin/daily-orga-export/route.ts", "competition"],
  ["app/api/admin/deleted-teams/[id]/restore/route.ts", "entity"],
  ["app/api/admin/deleted-teams/route.ts", "competition"],
  ["app/api/admin/home-news/[entryId]/route.ts", "entity"],
  ["app/api/admin/home-news/route.ts", "mixed"],
  ["app/api/admin/mail-events/route.ts", "competition"],
  ["app/api/admin/marketplace-matching/route.ts", "competition"],
  ["app/api/admin/orga-summary/route.ts", "competition"],
  ["app/api/admin/participant-audit/route.ts", "competition"],
  ["app/api/admin/participant-change-bundles/[id]/decision/route.ts", "entity"],
  ["app/api/admin/participant-change-bundles/[id]/route.ts", "entity"],
  ["app/api/admin/participant-change-bundles/route.ts", "entity"],
  ["app/api/admin/participants/route.ts", "competition"],
  ["app/api/admin/pending-changes/[id]/route.ts", "entity"],
  ["app/api/admin/pending-changes/route.ts", "competition"],
  ["app/api/admin/result-staging/batches/[batchId]/corrections/route.ts", "competition"],
  ["app/api/admin/result-staging/batches/[batchId]/publish-preview/route.ts", "competition"],
  ["app/api/admin/result-staging/batches/[batchId]/publish/route.ts", "competition"],
  ["app/api/admin/result-staging/batches/[batchId]/route.ts", "competition"],
  ["app/api/admin/result-staging/batches/route.ts", "competition"],
  ["app/api/admin/result-staging/legacy-results/import/route.ts", "competition"],
  ["app/api/admin/result-staging/legacy-running/import/route.ts", "competition"],
  ["app/api/admin/result-staging/reset/preview/route.ts", "competition"],
  ["app/api/admin/result-staging/reset/route.ts", "competition"],
  ["app/api/admin/result-staging/timekeeping/import/route.ts", "competition"],
  ["app/api/admin/result-staging/timekeeping/sessions/[sessionId]/route.ts", "competition"],
  ["app/api/admin/result-staging/timekeeping/sessions/route.ts", "competition"],
  ["app/api/admin/role-permissions/route.ts", "tenant"],
  ["app/api/admin/runtime-logs/route.ts", "global"],
  ["app/api/admin/start-numbers/import/route.ts", "competition"],
  ["app/api/admin/start-numbers/reset/route.ts", "competition"],
  ["app/api/admin/team-access-audit/route.ts", "competition"],
  ["app/api/admin/teams-export/route.ts", "competition"],
  ["app/api/admin/tenant/route.ts", "tenant"],
  ["app/api/admin/users/[id]/roles/route.ts", "tenant"],
  ["app/api/admin/users/[id]/route.ts", "tenant"],
  ["app/api/admin/users/route.ts", "tenant"],
  ["app/api/admin/visitor-counter/route.ts", "competition"],
  ["app/api/auth/[...nextauth]/route.ts", "framework"],
  ["app/api/auth/federated-logout/route.ts", "framework"],
  ["app/api/claim/[token]/route.ts", "capability"],
  ["app/api/competition/route.ts", "public"],
  ["app/api/competitions/route.ts", "public"],
  ["app/api/cron/daily-orga-export/route.ts", "secret"],
  ["app/api/dashboard-layouts/[id]/route.ts", "entity"],
  ["app/api/dashboard-layouts/route.ts", "mixed"],
  ["app/api/home-news/route.ts", "public"],
  ["app/api/messages/admin-conversations/route.ts", "tenant"],
  ["app/api/messages/admin-targets/route.ts", "tenant"],
  ["app/api/messages/conversations/[id]/messages/route.ts", "entity"],
  ["app/api/messages/conversations/[id]/read/route.ts", "entity"],
  ["app/api/messages/conversations/[id]/route.ts", "entity"],
  ["app/api/messages/conversations/route.ts", "mixed"],
  ["app/api/messages/support-contexts/route.ts", "self"],
  ["app/api/messages/unread-count/route.ts", "self"],
  ["app/api/mtc-anonym/[token]/route.ts", "capability"],
  ["app/api/participant-claim/[token]/route.ts", "capability"],
  ["app/api/participants/[id]/invite/route.ts", "entity"],
  ["app/api/participants/[id]/route.ts", "entity"],
  ["app/api/privacy/preferences/route.ts", "self"],
  ["app/api/profile/presence/route.ts", "self"],
  ["app/api/profile/roles/route.ts", "self"],
  ["app/api/profile/route.ts", "self"],
  ["app/api/results/route.ts", "competition"],
  ["app/api/teams/[id]/managers/route.ts", "entity"],
  ["app/api/teams/[id]/mtc-edit-link/route.ts", "entity"],
  ["app/api/teams/[id]/route.ts", "entity"],
  ["app/api/teams/route.ts", "mixed"],
  ["app/api/timekeeping/events/route.ts", "competition"],
  ["app/api/timekeeping/snapshot/route.ts", "competition"],
  ["app/api/visitor-counter/route.ts", "public"],
]);

const allApiRoutes = walk("app/api").filter((path) => path.endsWith("/route.ts")).sort();
assert.deepEqual(
  [...routeScopeInventory.keys()].sort(),
  allApiRoutes,
  "API route inventory is stale; classify every added or removed route",
);

const directTenantAuthRoutes: string[] = [];
for (const route of allApiRoutes) {
  const source = readSource(route);
  if (!source.includes("requireTenantRoles(")) continue;
  if (!source.includes("tenantId:")) directTenantAuthRoutes.push(route);
}

assert.deepEqual(
  directTenantAuthRoutes,
  [],
  `routes call requireTenantRoles() without an explicit tenantId: ${directTenantAuthRoutes.join(", ")}`,
);

const permissionSource = readSource("lib/server-permissions.ts");
assertIncludes(permissionSource, 'error: NextResponse.json({ error: "tenantId erforderlich" }, { status: 400 })', "tenant auth fail-closed behavior");
assert.ok(!permissionSource.includes("fallbackToFirstMatchingTenant"), "tenant auth must not retain first-tenant fallback");

console.log("tenant scope verification ok");
console.log(`entity scoped routes verified: ${entityScopedRoutes.size}`);
console.log(`API routes classified: ${routeScopeInventory.size}`);
