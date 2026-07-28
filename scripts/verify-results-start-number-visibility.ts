import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("app/api/results/route.ts", "utf8");
assert.ok(route.includes("const canSeeStartNumber = true;"), "result viewers must receive start numbers");
assert.ok(route.includes("canRoleViewLiveResults"), "result publication access must remain server-side");
assert.ok(!route.includes("const canSeeStartNumber = Boolean(access?.isAdmin);"), "start numbers must not retain the admin-only gate");

console.log("Results start-number visibility verification passed.");
