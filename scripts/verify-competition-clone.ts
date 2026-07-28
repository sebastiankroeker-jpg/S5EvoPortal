import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

const cloneService = read("lib/competition-clone.ts");
const cloneRoute = read("app/api/admin/competitions/[id]/clone/route.ts");
const adminPage = read("app/admin/page.tsx");

for (const expected of [
  "status: \"DRAFT\"",
  "date: null",
  "registrationDeadline: null",
  "shirtOrderDeadline: null",
  "registrationNotificationEmail: null",
  "disciplines:",
  "classifications:",
  "homeNewsEntries:",
  "action: \"COMPETITION_CLONED\"",
  "EXCLUDED_DATA",
]) {
  assert.ok(cloneService.includes(expected), `clone service missing guard: ${expected}`);
}

for (const forbidden of [
  "teams: { create",
  "participants: { create",
  "timekeepingSessions: { create",
  "resultDataBatches: { create",
]) {
  assert.ok(!cloneService.includes(forbidden), `clone service must not copy excluded data: ${forbidden}`);
}

assert.ok(cloneRoute.includes('requireTenantRoles(session, ["ADMIN"])'), "clone route must require tenant ADMIN");
assert.ok(cloneRoute.includes("confirmationText"), "clone route must require explicit confirmation for writes");
assert.ok(cloneRoute.includes("dryRun"), "clone route must support a non-mutating preview");
assert.ok(adminPage.includes("Clone-Vorschau prüfen"), "admin UI must expose a clone preview");
assert.ok(adminPage.includes("Neuen Entwurf anlegen"), "admin UI must require an explicit clone action");

console.log("competition clone verification passed (draft-only configuration clone with excluded sensitive tables).");
