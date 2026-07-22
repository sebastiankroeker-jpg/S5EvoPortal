import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { parseLegacyResultCsv, parseLegacyResultTimeMs } from "../lib/legacy-result-import";

const root = process.cwd();
const inboundDir = "/home/ocadmin/.openclaw/media/inbound";

const fixtures = [
  {
    name: "Laufen",
    path: "5K_Ergebnisse_LAUFEN_Gesamt---9bac4b6b-7b4b-43d5-966f-c68f3f82bfbf.csv",
    disciplineCode: "RUN",
    rawRows: 111,
    drafts: 111,
  },
  {
    name: "Rennrad",
    path: "5K_Ergebnisse_RENNRAD_Gesamt---696783db-8822-4229-8a02-166b220b7811.csv",
    disciplineCode: "ROAD",
    rawRows: 112,
    drafts: 112,
  },
  {
    name: "MTB",
    path: "5K_Ergebnisse_MTB_Gesamt---61b1b2aa-f64c-4ffd-ace1-f0097ec1631a.csv",
    disciplineCode: "MTB",
    rawRows: 111,
    drafts: 111,
  },
  {
    name: "Bank",
    path: "5K_Ergebnisse_BANK_Gesamt---67184a69-621b-4964-88a6-a0cfc49368e3.csv",
    disciplineCode: "BENCH",
    rawRows: 309,
    drafts: 111,
  },
  {
    name: "Stock",
    path: "5K_Ergebnisse_STOCK_Gesamt---4fb7b8e0-69a2-4e21-ba61-5e55650d2eb9.csv",
    disciplineCode: "STOCK",
    rawRows: 1344,
    drafts: 112,
  },
] as const;

assert.equal(parseLegacyResultTimeMs("00:07:22.23"), 442_230);
assert.equal(parseLegacyResultTimeMs("99:99:99.99"), null);

const inlineCsv = [
  "Bayersoier SuperfuenfkampfGesamtergebnisse;;;;;;;;;;;;",
  "Diese Datei wird automatisch eingelesen.;;;;;;;;;;;;",
  "BITTE KEINE MANUELLEN AENDERUNGEN VORNEHMEN!;;;;;;;;;;;;",
  "Rennrad;;;;;;;;;;;;",
  ";;;;;;;;;;;;",
  "Au1Startnr;Au1MaID;Au1TlID;Aumw;Au1Klasse;Au1Disziplin;AuStopzeit;AuStopzeitUhr2;AuZeitBasis;AuZeitBasisUhr2;AuZeitBasisZiel;AuUhrGueltig;AuZeit;AuBruttoGewicht;AuGewicht;AuRingeStock;AuRingeStockStreicherg;AuSchubBWZ;AuVersuchnr;AuPunkte;AuPunkteDamenGes;AuPunkteHerrenGes;AuPlatzKlasse;AuPlatzGesamt;AuBemerkung;AuStreichergebnis;AuSummenkennzeichen;AuPunktgleichheit;AuPunktgleichheitGes",
  "2;;9;;1;3;00:00:00.00;00:10:36.23;0;45193;45829;2;00:10:06.23;;;;;;;7;;;3;;;Falsch;;0;0",
].join("\n");

const inlineParsed = parseLegacyResultCsv(inlineCsv);
assert.equal(inlineParsed.summary.disciplineCode, "ROAD");
assert.equal(inlineParsed.summary.rawRows, 1);
assert.equal(inlineParsed.summary.drafts, 1);
assert.equal(inlineParsed.drafts[0].rawValueText, "00:10:06.23");

const foundFixtures = fixtures.filter((fixture) => existsSync(join(inboundDir, fixture.path)));
assert.ok(foundFixtures.length > 0, "No inbound legacy result fixtures found");

for (const fixture of foundFixtures) {
  const csv = readFileSync(join(inboundDir, fixture.path), "latin1");
  const parsed = parseLegacyResultCsv(csv);
  assert.equal(parsed.summary.disciplineCode, fixture.disciplineCode, fixture.name);
  assert.equal(parsed.summary.rawRows, fixture.rawRows, fixture.name);
  assert.equal(parsed.summary.drafts, fixture.drafts, fixture.name);
  assert.equal(parsed.headers.length, 29, fixture.name);
}

const route = readFileSync(join(root, "app/api/admin/result-staging/legacy-results/import/route.ts"), "utf8");
assert.ok(route.includes("requireCompetitionTenantRoles(session, [\"ADMIN\"], competitionId)"));
assert.ok(route.includes("if (dryRun)"));
assert.ok(route.includes("purpose: \"PROD_TEST\""));
assert.ok(route.includes("RESULT_LEGACY_RESULT_CSV_V2_STAGED"));

console.log(`legacy result import verification ok (${foundFixtures.length} inbound fixtures)`);
