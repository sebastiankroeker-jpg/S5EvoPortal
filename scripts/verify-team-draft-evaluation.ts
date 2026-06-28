import assert from "node:assert/strict";

import {
  evaluateTeamDraft,
  type TeamDraftEvaluation,
  type TeamDraftParticipantInput,
} from "@/lib/domain/classification";

const disciplineCodes = ["RUN", "BENCH", "STOCK", "ROAD", "MTB"] as const;

const validParticipants: TeamDraftParticipantInput[] = [
  { firstName: "Max", lastName: "Muster", birthDate: "01.01.2016", gender: "M", discipline: "RUN" },
  { firstName: "Anna", lastName: "Beispiel", birthDate: "02.01.2016", gender: "W", discipline: "BENCH" },
  { firstName: "Tom", lastName: "Tester", birthDate: "03.01.2017", gender: "M", discipline: "STOCK" },
  { firstName: "Mia", lastName: "Demo", birthDate: "04.01.2017", gender: "W", discipline: "ROAD" },
  { firstName: "Leo", lastName: "Probe", birthDate: "05.01.2018", gender: "M", discipline: "MTB" },
];

function comparableEvaluation(evaluation: TeamDraftEvaluation) {
  return {
    blockingErrorsWithoutContact: evaluation.blockingErrors.filter(
      (message) => message !== "Kontaktname zu kurz" && message !== "Ungültige Kontakt-E-Mail",
    ),
    warnings: evaluation.warnings,
    info: evaluation.info,
    classificationCode: evaluation.classification.code,
    classificationLabel: evaluation.classification.label,
    totalAge: evaluation.classification.totalAge,
    discipline: evaluation.discipline,
  };
}

function evaluate(mode: "anonymous-create" | "authenticated-create", participants = validParticipants) {
  return evaluateTeamDraft({
    mode,
    teamName: "Ammertaler Testteam",
    contactFirstName: "Tina",
    contactLastName: "Teamlead",
    contactEmail: "teamlead@example.test",
    participants,
  });
}

function participantsFromBirthYears(birthYears: number[], gender: "M" | "W" = "M"): TeamDraftParticipantInput[] {
  return birthYears.map((birthYear, index) => ({
    firstName: `Test${index + 1}`,
    lastName: "Teilnehmer",
    birthDate: `01.01.${birthYear}`,
    gender,
    discipline: disciplineCodes[index],
  }));
}

const anonymous = evaluate("anonymous-create");
const authenticated = evaluate("authenticated-create");
assert.deepEqual(comparableEvaluation(anonymous), comparableEvaluation(authenticated));
assert.equal(anonymous.canSubmit, true);
assert.equal(authenticated.canSubmit, true);

const datesCompleteNamesMissing = validParticipants.map((participant) => ({
  ...participant,
  firstName: "",
  lastName: "",
}));
const anonymousMissingNames = evaluate("anonymous-create", datesCompleteNamesMissing);
const authenticatedMissingNames = evaluate("authenticated-create", datesCompleteNamesMissing);
assert.deepEqual(comparableEvaluation(anonymousMissingNames), comparableEvaluation(authenticatedMissingNames));
assert.ok(anonymousMissingNames.blockingErrors.some((message) => message.includes("Vorname zu kurz")));
assert.ok(anonymousMissingNames.blockingErrors.some((message) => message.includes("Nachname zu kurz")));

const invalidBirthDate = validParticipants.map((participant, index) =>
  index === 2 ? { ...participant, birthDate: "31.02.2016" } : participant,
);
const invalidBirthDateEvaluation = evaluate("authenticated-create", invalidBirthDate);
assert.ok(invalidBirthDateEvaluation.blockingErrors.some((message) => message.includes("Geburtsdatum unplausibel")));

const duplicateDisciplines = validParticipants.map((participant, index) => ({
  ...participant,
  discipline: index === 4 ? "RUN" : participant.discipline,
}));
const duplicateEvaluation = evaluate("authenticated-create", duplicateDisciplines);
assert.ok(duplicateEvaluation.warnings.some((message) => message.includes("Disziplinen noch offen")));
assert.ok(duplicateEvaluation.warnings.some((message) => message.includes("Disziplin doppelt vergeben")));
assert.deepEqual(evaluate("authenticated-create").discipline.warnings, []);

const mixedSchuelerB = evaluate("authenticated-create", [
  { firstName: "Vincent", lastName: "Pongratz", birthDate: "01.01.2015", gender: "M", discipline: "ROAD" },
  { firstName: "Quirin", lastName: "Saal", birthDate: "01.01.2016", gender: "M", discipline: "RUN" },
  { firstName: "Jonas", lastName: "Maier", birthDate: "01.01.2016", gender: "M", discipline: "BENCH" },
  { firstName: "Benedikt", lastName: "Hain", birthDate: "01.01.2015", gender: "M", discipline: "MTB" },
  { firstName: "Fabian", lastName: "Eurisch", birthDate: "01.01.2016", gender: "M", discipline: "STOCK" },
]);
assert.equal(mixedSchuelerB.classification.code, "schueler-b");
assert.equal(mixedSchuelerB.classification.totalAge, 52);
assert.deepEqual(mixedSchuelerB.classification.warnings, []);

const schuelerA = evaluate("authenticated-create", participantsFromBirthYears([2016, 2016, 2017, 2018, 2018]));
assert.equal(schuelerA.classification.code, "schueler-a");
assert.equal(schuelerA.classification.isYouthClass, true);

const mixedYouthToJugend = evaluate("authenticated-create", participantsFromBirthYears([2012, 2013, 2015, 2016, 2018]));
assert.equal(mixedYouthToJugend.classification.code, "jugend");
assert.equal(mixedYouthToJugend.classification.isYouthClass, true);

const adultJungsters = evaluate("authenticated-create", participantsFromBirthYears([2002, 2002, 2003, 2003, 2004]));
assert.equal(adultJungsters.classification.code, "jungsters");
assert.equal(adultJungsters.classification.isYouthClass, false);

const damenA = evaluate("authenticated-create", participantsFromBirthYears([1998, 1999, 2000, 2001, 2002], "W"));
assert.equal(damenA.classification.code, "damen-a");
assert.equal(damenA.classification.isFemaleOnly, true);

console.log("team draft evaluation parity ok");
