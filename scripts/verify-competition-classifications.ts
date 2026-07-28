import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  LEGACY_COMPETITION_CLASSIFICATIONS,
  resolveCompetitionClassifications,
} from "@/lib/competition-classifications";
import { classifyTeam } from "@/lib/domain/classification";

const read = (path: string) => readFileSync(path, "utf8");
const fiveAdults = [2002, 2002, 2003, 2003, 2004].map((birthYear) => ({ birthYear, gender: "M" as const }));

assert.equal(LEGACY_COMPETITION_CLASSIFICATIONS.length, 10, "2026 baseline must contain eight classes plus two result aggregates");
assert.equal(resolveCompetitionClassifications([]).length, 10, "empty legacy competitions must use the reproducible fallback");
assert.equal(
  classifyTeam(fiveAdults, { competitionYear: 2026, classifications: LEGACY_COMPETITION_CLASSIFICATIONS }).code,
  "jungsters",
);
assert.equal(
  classifyTeam(fiveAdults, {
    competitionYear: 2026,
    classifications: LEGACY_COMPETITION_CLASSIFICATIONS.map((entry) =>
      entry.code === "jungsters" ? { ...entry, maxAge: 115 } : entry.code === "herren" ? { ...entry, minAge: 116 } : entry,
    ),
  }).code,
  "herren",
  "persisted configuration must be authoritative",
);

const schema = read("prisma/schema.prisma");
const cloneService = read("lib/competition-clone.ts");
const adminRoute = read("app/api/admin/competition/classifications/route.ts");
const timekeepingRoute = read("app/api/timekeeping/snapshot/route.ts");

for (const expected of ["sortOrder", "displayEmoji"]) {
  assert.ok(schema.includes(expected), `classification metadata missing from schema: ${expected}`);
  assert.ok(cloneService.includes(expected), `clone must copy classification metadata: ${expected}`);
}
assert.ok(adminRoute.includes("requireCompetitionRoles(session, [\"ADMIN\"], competitionId)"), "class write route must be competition-admin scoped");
assert.ok(adminRoute.includes("separaten Umklassifizierungs-CR"), "class writes with live teams must fail closed");
assert.ok(timekeepingRoute.includes("resolveCompetitionClassifications"), "timekeeping must read competition-specific labels/order");

console.log("competition classification configuration verification passed");
