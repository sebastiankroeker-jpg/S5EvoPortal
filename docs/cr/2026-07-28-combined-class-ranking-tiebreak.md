# CR: Ergebnis-Hotfix — Gesamtklassen-Rangfolge und Startnummern

Status: Deployed
Date: 2026-07-28
Type: hotfix
Risk: medium
Owner: S5Evo

## Context

In den Einzelergebnislisten für `Damen Gesamt` und `Herren Gesamt` wurden
gespeicherte Rang-/Punktwerte der jeweiligen Quellklasse übernommen. Dadurch
konnte die Gesamtklasse nicht gegen alle enthaltenen Teams neu ranken.

## Scope

- In scope: Gesamtgruppen berechnen jede Disziplin und die Gesamtrangfolge
  über alle Quellklassen neu und verwenden dabei die vorhandenen Tiebreak-
  Regeln; Startnummern werden an alle bereits berechtigten Ergebnis-Viewer
  ausgegeben.
- Out of scope: keine Änderung gespeicherter Ergebnisdaten, keine Änderung
  der Einzelklassen oder des Veröffentlichungsstatus.

## Affected Flows

- User/API/admin flows touched: `GET /api/results`, öffentliche
  Ergebnisansicht und Live-Ergebnisansicht.
- Data model impact: keiner.
- Auth/permission impact: keiner.
- Sensitive data impact: keine neue Sichtbarkeit; vorhandene Ergebnis-
  Serializer bleiben unverändert, mit einer bewusst dokumentierten Ausnahme:
  Startnummern sind öffentliche Veranstaltungskennzeichen in freigegebenen
  Ergebnislisten.

## Business Invariants

- Einzelklassen dürfen weiterhin veröffentlichte Rang-/Punktwerte nutzen,
  sofern diese historisch autoritativ sind.
- Eine `COMBINED`-Klasse bewertet ihre vereinigten Quellklassen stets neu.
- Stock-Tiebreak und Gesamt-Tiebreak (Punktprofil, danach Startnummer) gelten
  in Gesamtklassen identisch wie in jeder anderen Rangfolge.
- Wer die Ergebnisliste sehen darf, sieht auch die Startnummer; Ergebnis-
  Zugriff bleibt durch `canRoleViewLiveResults` serverseitig geschützt.

## Acceptance Criteria

- Die Platzierung in Damen-/Herren-Gesamt hängt nicht von der Platzierung der
  ursprünglichen Unterklasse ab.
- Gleichstände werden per bestehender Disziplin- bzw. Gesamt-Tiebreak-Regel
  aufgelöst; echte Gleichstände behalten denselben Rang.
- Einzelklassen behalten ihr bisheriges Verhalten.
- Die 2026er gespeicherten Startnummern erscheinen in Einzel- und
  Gesamtergebnislisten für alle berechtigten Viewer.

## Implementation Handoff

- Relevant files: `app/api/results/route.ts`, `lib/domain/scoring.ts`,
  gezielte Ranking-Verifikation.
- Required checks: synthetische Gesamtklassenmatrix, TypeScript, ESLint,
  Diff-Check, Production-Build.

## Confirmation Gate

- Gate needed: yes
- Reason: öffentliche Ergebnisränge werden korrekt berechnet; Push auf
  `main` löst Production-Deploy aus.
- Approved by: Sebastian, lokale Implementierung am 2026-07-28 UTC.
- Not approved: Commit/Push/Deploy.

## Implementation Notes

- Files changed:
  - `rankDiscipline` receives an explicit `usePublishedScores` option;
    default behavior for source classes is unchanged.
  - Combined result groups explicitly disable source-class published
    rank/point overrides and therefore recalculate discipline and total ranks.
- A focused synthetic matrix verifies cross-class recomputation, Stock
  tiebreak and the derived total ranking.
- The result serializer now returns the start number only after its existing
  result-publication access check; no additional team/contact fields are
  exposed.

## Verification

- Local checks: TypeScript, ESLint, diff check and production build passed.
- Targeted verification: `verify:combined-class-ranking` and
  `verify:results-start-number-visibility` passed.
- Production smoke: public core flows passed; the live 2026 results payload
  contains `startNumber` values.

## Deploy

- Deployment needed: completed
- Production alias: https://portal.s5evo.de
- Production source commit: `ee03206`
- Production deployment: `dpl_66UWz5J4VYgrpbmJk16N2dd9Csqy` (READY)

## Follow-Ups

- Authentifizierter Ergebnis-Smoketest nach Release, sobald eine kontrollierte
  Testsession verfügbar ist.
