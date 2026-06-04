import assert from "node:assert/strict";

import {
  evaluateTeamDraft,
  type TeamDraftEvaluation,
  type TeamDraftParticipantInput,
} from "@/lib/domain/classification";

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

console.log("team draft evaluation parity ok");
