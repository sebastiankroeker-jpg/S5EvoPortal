import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseLegacyRunningCsv, parseLegacyRunningTimeMs } from "../lib/legacy-running-result-import";

const root = process.cwd();

function readSource(path: string) {
  return readFileSync(join(root, path), "utf8");
}

const csv = [
  "Bayersoier SuperfuenfkampfGesamtergebnisse;;;;;;;;;;;;",
  "Diese Datei wird automatisch eingelesen.;;;;;;;;;;;;",
  "BITTE KEINE MANUELLEN AENDERUNGEN VORNEHMEN!;;;;;;;;;;;;",
  "Laufen;;;;;;;;;;;;",
  ";;;;;;;;;;;;",
  "Au1Startnr;Au1MaID;Au1TlID;Aumw;Au1Klasse;Au1Disziplin;AuStopzeit;AuStopzeitUhr2;AuZeitBasis;AuZeitBasisUhr2;AuZeitBasisZiel;AuUhrGueltig;AuZeit;AuBruttoGewicht;AuGewicht;AuRingeStock;AuRingeStockStreicherg;AuSchubBWZ;AuVersuchnr;AuPunkte;AuPunkteDamenGes;AuPunkteHerrenGes;AuPlatzKlasse;AuPlatzGesamt;AuBemerkung;AuStreichergebnis;AuSummenkennzeichen;AuPunktgleichheit;AuPunktgleichheitGes",
  "19;;91;;2;1;00:07:22.23;00:00:00.00;59311;0;59753;1;00:07:22.23;;;;;;;15;;;1;;;Falsch;;0;0",
  "62;;281;;4;1;00:13:16.14;00:00:00.00;60537;0;61333;1;00:13:16.14;;;;;;;12;22;;1;1;;Falsch;;0;0",
  "123;;556;;7;1;00:18:35.05;00:00:00.00;62660;0;63775;1;00:18:35.05;;;;;;;36;;54;1;1;;Falsch;;0;0",
  "30;;121;;3;1;00:00:00.00;00:00:00.00;0;0;67150;1;88:88:88.00;;;;;;;1;;;11;;;Falsch;;0;0",
].join("\n");

assert.equal(parseLegacyRunningTimeMs("00:07:22.23"), 442_230);
assert.equal(parseLegacyRunningTimeMs("88:88:88.00"), null);

const parsed = parseLegacyRunningCsv(csv);
assert.equal(parsed.headers[0], "Au1Startnr");
assert.equal(parsed.summary.headerRow, 6);
assert.equal(parsed.summary.rows, 4);
assert.equal(parsed.summary.validTimes, 3);
assert.equal(parsed.summary.invalidTimes, 1);
assert.deepEqual(parsed.summary.classCounts, { "2": 1, "3": 1, "4": 1, "7": 1 });
assert.deepEqual(parsed.summary.overallGroups, { DAMEN: 1, HERREN: 1 });

const youthManualCheck = parsed.records.find((record) => record.startNumber === "30");
assert.ok(youthManualCheck);
assert.equal(youthManualCheck.elapsedMs, null);
assert.equal(youthManualCheck.resultStatus, "manual_check");
assert.equal(youthManualCheck.classPoints, 1);
assert.equal(youthManualCheck.classRank, 11);
assert.equal(youthManualCheck.overallGroup, null);
assert.equal(youthManualCheck.overallGenderPoints, null);
assert.ok(youthManualCheck.validationMessages.some((message) => message.code === "manual_check_time"));

const damen = parsed.records.find((record) => record.startNumber === "62");
assert.ok(damen);
assert.equal(damen.overallGroup, "DAMEN");
assert.equal(damen.overallGenderPoints, 22);
assert.equal(damen.overallGenderRank, 1);

const herren = parsed.records.find((record) => record.startNumber === "123");
assert.ok(herren);
assert.equal(herren.overallGroup, "HERREN");
assert.equal(herren.overallGenderPoints, 54);
assert.equal(herren.overallGenderRank, 1);

const route = readSource("app/api/admin/result-staging/legacy-running/import/route.ts");
assert.ok(route.includes("requireCompetitionTenantRoles(session, [\"ADMIN\"], competitionId)"));
assert.ok(route.includes("const dryRun = body.dryRun !== false"));
assert.ok(!route.includes("console.log"));

console.log("legacy running import verification ok");
