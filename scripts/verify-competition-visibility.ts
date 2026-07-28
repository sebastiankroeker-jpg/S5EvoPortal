import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  canViewerReadCompetition,
  canViewerRegisterForCompetition,
  selectDefaultCompetitionId,
} from "../lib/competition-visibility";

const draftPortal = {
  status: "DRAFT" as const,
  portalVisibility: "PORTAL_USERS" as const,
  registrationVisibility: "PORTAL_USERS" as const,
};
assert.equal(canViewerReadCompetition(draftPortal, { authenticated: false }), false);
assert.equal(canViewerReadCompetition(draftPortal, { authenticated: true }), true);
assert.equal(canViewerRegisterForCompetition(draftPortal, { authenticated: false }), false);
assert.equal(canViewerRegisterForCompetition(draftPortal, { authenticated: true }), true);

const legacyDraft = { status: "DRAFT" as const, portalVisibility: null, registrationVisibility: null };
assert.equal(canViewerReadCompetition(legacyDraft, { authenticated: true }), false, "legacy drafts must fail closed");
assert.equal(canViewerRegisterForCompetition(legacyDraft, { authenticated: true }), false, "legacy draft registration must not remain implicit");

assert.equal(selectDefaultCompetitionId([
  { id: "closed", year: 2026, status: "CLOSED" as const },
  { id: "draft", year: 2027, status: "DRAFT" as const },
]), "closed");
assert.equal(selectDefaultCompetitionId([
  { id: "closed", year: 2026, status: "CLOSED" as const },
  { id: "running", year: 2025, status: "RUNNING" as const },
]), "running", "running competition overrides last closed default");
assert.equal(selectDefaultCompetitionId([
  { id: "closed", year: 2026, status: "CLOSED" as const },
  { id: "running", year: 2025, status: "RUNNING" as const },
], "closed"), "closed", "explicit visible choice wins over default");

const registrationRoute = readFileSync("app/api/teams/route.ts", "utf8");
assert.ok(registrationRoute.includes("Bitte wähle einen Wettkampf für die Anmeldung aus."));
assert.ok(!registrationRoute.includes("ensureDefaultCompetition"), "registration writes must not select a default competition");

const publicRoute = readFileSync("app/api/competition/route.ts", "utf8");
assert.ok(publicRoute.includes("canViewerReadCompetition"), "explicit competition reads need server visibility enforcement");

console.log("Competition visibility verification passed.");
