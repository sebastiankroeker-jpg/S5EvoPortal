/**
 * Wettkampfabhängige Klassifikationslogik für Mannschaftsfünfkampf
 * Shared zwischen Frontend (Live-Preview) und Backend (Validierung)
 */

import {
  DISCIPLINE_PLACEHOLDER,
  DISCIPLINES,
  extractBirthYearFromInput,
  type DisciplineSelection,
} from "@/lib/domain/team";
import {
  LEGACY_COMPETITION_CLASSIFICATIONS,
  resolveCompetitionClassifications,
  type CompetitionClassification,
} from "@/lib/competition-classifications";

export const DEFAULT_COMPETITION_YEAR = 2026;

export interface ClassificationInput {
  birthYear: number;
  gender: "M" | "W" | "D" | "MALE" | "FEMALE" | "DIVERSE";
}

export type ClassificationOptions = {
  /** Calendar/reference year of the selected competition. Defaults to 2026 for legacy callers. */
  competitionYear?: number | null;
  /** Persisted competition rules. Empty older competitions retain the legacy fallback until backfilled. */
  classifications?: readonly CompetitionClassification[] | null;
};

export interface ClassificationResult {
  code: string;
  label: string;
  emoji: string;
  totalAge: number;
  isFemaleOnly: boolean;
  isYouthClass: boolean;
  warnings: string[];
  info: string[];
}

export interface TeamStateParticipantInput {
  birthYear: number | null;
  gender?: "M" | "W" | "D" | "MALE" | "FEMALE" | "DIVERSE" | null;
  disciplineCode?: string | null;
}

export interface TeamStateEvaluation {
  classification: ClassificationResult;
  classificationWarnings: string[];
  discipline: {
    valid: boolean;
    warnings: string[];
  };
}

export type TeamDraftValidationMode =
  | "anonymous-create"
  | "authenticated-create"
  | "team-edit"
  | "admin-edit";

export type TeamDraftParticipantInput = {
  firstName?: string | null;
  lastName?: string | null;
  birthDate?: string | null;
  gender?: "M" | "W" | "D" | "MALE" | "FEMALE" | "DIVERSE" | null;
  discipline?: DisciplineSelection | string | null;
  disciplineCode?: DisciplineSelection | string | null;
};

export type TeamDraftEvaluationInput = {
  mode: TeamDraftValidationMode;
  teamName?: string | null;
  contactFirstName?: string | null;
  contactLastName?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  participants?: TeamDraftParticipantInput[] | null;
  oldClassificationCode?: string | null;
  competitionYear?: number | null;
  classifications?: readonly CompetitionClassification[] | null;
};

export type TeamDraftEvaluation = TeamStateEvaluation & {
  mode: TeamDraftValidationMode;
  blockingErrors: string[];
  warnings: string[];
  info: string[];
  canSubmit: boolean;
};

function normalizeCompetitionYear(value?: number | null) {
  return typeof value === "number" && Number.isInteger(value) && value >= 2020 && value <= 2100
    ? value
    : DEFAULT_COMPETITION_YEAR;
}

export function getYoungestEligibleBirthYear(
  competitionYear?: number | null,
  classifications?: readonly CompetitionClassification[] | null,
) {
  const youngestAge = resolveCompetitionClassifications(classifications)
    .filter((entry) => entry.type === "AGE_INDIVIDUAL")
    .reduce<number | null>((current, entry) =>
      entry.minAge === null ? current : current === null ? entry.minAge : Math.min(current, entry.minAge),
    null);
  return normalizeCompetitionYear(competitionYear) - (youngestAge ?? 8);
}

export function getYouthClassificationYearRanges(competitionYear?: number | null) {
  const year = normalizeCompetitionYear(competitionYear);
  return {
    "schueler-a": { minYear: year - 10, maxYear: year - 8 },
    "schueler-b": { minYear: year - 13, maxYear: year - 11 },
    jugend: { minYear: year - 17, maxYear: year - 14 },
  } as const;
}

/** Legacy 2026 ranges for callers that have not yet resolved a competition. */
export const YOUTH_CLASS_YEAR_RANGES = getYouthClassificationYearRanges(DEFAULT_COMPETITION_YEAR);

function youthClassDescription(code: keyof typeof YOUTH_CLASS_YEAR_RANGES, competitionYear = DEFAULT_COMPETITION_YEAR) {
  const range = getYouthClassificationYearRanges(competitionYear)[code];
  return `Ältester Jg. ${range.minYear}–${range.maxYear}`;
}

export const CLASSIFICATIONS: Record<string, { label: string; emoji: string; desc: string }> = Object.fromEntries(
  LEGACY_COMPETITION_CLASSIFICATIONS.map((entry) => [
    entry.code,
    { label: entry.name, emoji: entry.displayEmoji ?? "", desc: entry.name },
  ]),
) as Record<string, { label: string; emoji: string; desc: string }>;
CLASSIFICATIONS.unclassified = { label: "Unklassifiziert", emoji: "❓", desc: "Unvollständig" };

export const CLASSIFICATION_DISPLAY_ORDER = [
  "schueler-a",
  "schueler-b",
  "jugend",
  "damen-a",
  "damen-b",
  "jungsters",
  "herren",
  "masters",
] as const;

const CLASSIFICATION_ORDER_INDEX: ReadonlyMap<string, number> = new Map(
  CLASSIFICATION_DISPLAY_ORDER.map((code, index) => [code, index]),
);

export function compareClassificationCodes(a: string, b: string): number {
  const aOrder = CLASSIFICATION_ORDER_INDEX.get(a) ?? Number.MAX_SAFE_INTEGER;
  const bOrder = CLASSIFICATION_ORDER_INDEX.get(b) ?? Number.MAX_SAFE_INTEGER;

  if (aOrder !== bOrder) return aOrder - bOrder;
  return a.localeCompare(b, "de");
}

function isFemale(gender: string): boolean {
  return gender === "W" || gender === "FEMALE";
}

function matchesAgeRange(age: number, entry: CompetitionClassification) {
  return (entry.minAge === null || age >= entry.minAge) && (entry.maxAge === null || age <= entry.maxAge);
}

function classificationMetadata(code: string, definitions: readonly CompetitionClassification[]) {
  const entry = definitions.find((definition) => definition.code === code);
  if (entry) return { label: entry.name, emoji: entry.displayEmoji ?? "" };
  return CLASSIFICATIONS[code] ?? { label: code, emoji: "❓" };
}

function findYouthClassification(ages: number[], definitions: readonly CompetitionClassification[]) {
  const youth = definitions.filter((entry) => entry.type === "AGE_INDIVIDUAL");
  if (youth.length === 0) return null;
  if (!ages.every((age) => youth.some((entry) => matchesAgeRange(age, entry)))) return null;

  const oldestParticipantAge = Math.max(...ages);
  return youth.find((entry) => matchesAgeRange(oldestParticipantAge, entry)) ?? null;
}

function findTeamClassification(
  totalAge: number,
  isFemaleOnly: boolean,
  definitions: readonly CompetitionClassification[],
) {
  const teamRules = definitions.filter((entry) => entry.type === "AGE_TEAM");
  const femaleMatch = isFemaleOnly
    ? teamRules.find((entry) => entry.genderRestriction === "FEMALE_ONLY" && matchesAgeRange(totalAge, entry))
    : null;
  if (femaleMatch) return femaleMatch;

  return teamRules.find((entry) => entry.genderRestriction === null && matchesAgeRange(totalAge, entry)) ?? null;
}

/**
 * Klassifiziert ein Team anhand seiner Teilnehmer.
 * Gibt Klasse + Warnungen zurück.
 */
export function classifyTeam(participants: ClassificationInput[], options: ClassificationOptions = {}): ClassificationResult {
  const competitionYear = normalizeCompetitionYear(options.competitionYear);
  const definitions = resolveCompetitionClassifications(options.classifications);
  const warnings: string[] = [];
  const infoMessages: string[] = [];
  const valid = participants.filter(p => p.birthYear > 1900);

  if (valid.length < 5) {
    return {
      code: "unclassified",
      label: "Unklassifiziert",
      emoji: "❓",
      totalAge: 0,
      isFemaleOnly: false,
      isYouthClass: false,
      warnings: [`Nur ${valid.length}/5 Teilnehmer mit gültigem Geburtsjahr`],
      info: [],
    };
  }

  const ages = valid.map(p => competitionYear - p.birthYear);
  const totalAge = ages.reduce((sum, age) => sum + age, 0);
  const isFemaleOnly = valid.every(p => isFemale(p.gender));
  const hasMixed = !isFemaleOnly && valid.some(p => isFemale(p.gender));

  // Klassifikation — zuerst prüfen, dann Warnungen generieren
  let code: string = "unclassified";
  let isYouthClass = false;
  const youthClassification = findYouthClassification(ages, definitions);
  const teamClassification = youthClassification
    ? null
    : findTeamClassification(totalAge, isFemaleOnly, definitions);

  // Jahrgänge-basierte Klassen (Schüler/Jugend): der älteste Jahrgang bestimmt die Klasse.
  if (youthClassification) {
    code = youthClassification.code;
    isYouthClass = true;
  }
  else if (teamClassification) {
    code = teamClassification.code;
  } else {
    warnings.push("Keine passende Klassenregel für dieses Team konfiguriert");
  }

  // Info-Nachrichten für Jugend-Klassen
  if (isYouthClass) {
    infoMessages.push("Eigene Ergebnisliste (nicht in der Gesamtwertung)");
    infoMessages.push("Klassifikation nach ältestem Jahrgang, nicht Gesamtalter");
  }

  // Warnungen nur für Erwachsenen-Klassen
  if (!isYouthClass && hasMixed) {
    warnings.push("Gemischtes Team → startet in der Herren-Wertung (keine Mixed-Kategorie 2026)");
  }

  // Grenzfall-Warnungen nur für altersbasierte Klassen
  if (!isYouthClass && !isFemaleOnly) {
    const openTeamRules = definitions.filter((entry) => entry.type === "AGE_TEAM" && entry.genderRestriction === null);
    for (const entry of openTeamRules) {
      if (entry.maxAge !== null && totalAge >= entry.maxAge - 4 && totalAge <= entry.maxAge) {
        warnings.push(`Grenzfall ${entry.name}: Gesamtalter ${totalAge} (Grenze: ${entry.maxAge})`);
      }
      if (entry.minAge !== null && totalAge >= entry.minAge && totalAge <= entry.minAge + 4) {
        warnings.push(`Grenzfall ${entry.name}: Gesamtalter ${totalAge} (Grenze: ${entry.minAge})`);
      }
    }
  }
  if (!isYouthClass && isFemaleOnly) {
    const femaleTeamRules = definitions.filter((entry) => entry.type === "AGE_TEAM" && entry.genderRestriction === "FEMALE_ONLY");
    for (const entry of femaleTeamRules) {
      if (entry.maxAge !== null && totalAge >= entry.maxAge - 4 && totalAge <= entry.maxAge + 4) {
        warnings.push(`Grenzfall ${entry.name}: Gesamtalter ${totalAge} (Grenze: ${entry.maxAge})`);
      }
    }
  }

  // Jahrgangs-Validierung für Jugend
  if (isYouthClass) {
    const youthRules = definitions.filter((entry) => entry.type === "AGE_INDIVIDUAL");
    const outOfRange = ages.filter((age) => !youthRules.some((entry) => matchesAgeRange(age, entry)));
    if (outOfRange.length > 0) {
      warnings.push(`${outOfRange.length} Teilnehmer außerhalb der Schüler-/Jugend-Jahrgänge`);
    }
  }

  // Alters-Validierung
  const minAge = Math.min(...ages);
  const maxAge = Math.max(...ages);
  if (minAge < 6) {
    warnings.push(`Jüngster Teilnehmer ist ${minAge} Jahre — ungewöhnlich jung`);
  }
  if (maxAge > 80) {
    warnings.push(`Ältester Teilnehmer ist ${maxAge} Jahre — bitte prüfen`);
  }

  const classInfo = classificationMetadata(code, definitions);

  return {
    code,
    label: classInfo?.label || code,
    emoji: classInfo?.emoji || "❓",
    totalAge,
    isFemaleOnly,
    isYouthClass,
    warnings,
    info: infoMessages,
  };
}

/**
 * Vergleicht alte und neue Klassifikation.
 * Gibt Warnungen zurück wenn sich die Klasse ändert.
 */
export function compareClassification(
  oldCode: string,
  newResult: ClassificationResult,
  options: ClassificationOptions = {},
): string[] {
  const warnings = [...newResult.warnings];

  if (oldCode && oldCode !== newResult.code && oldCode !== "unclassified") {
    const oldInfo = classificationMetadata(oldCode, resolveCompetitionClassifications(options.classifications));
    warnings.unshift(
      `⚠️ Klassenwechsel: ${oldInfo?.emoji || ""} ${oldInfo?.label || oldCode} → ${newResult.emoji} ${newResult.label}`
    );
  }

  return warnings;
}

export function evaluateTeamState(
  participants: TeamStateParticipantInput[],
  oldClassificationCode?: string | null,
  options: ClassificationOptions = {},
): TeamStateEvaluation {
  const classificationInputs = participants
    .filter((participant) => typeof participant.birthYear === "number" && participant.birthYear > 1900)
    .map((participant) => ({
      birthYear: participant.birthYear as number,
      gender: participant.gender ?? "MALE",
    }));

  const classification = classifyTeam(classificationInputs, options);
  const classificationWarnings = oldClassificationCode
    ? compareClassification(oldClassificationCode, classification, options)
    : [...classification.warnings];
  const discipline = validateDisciplineAssignment(
    participants.map((participant) => participant.disciplineCode ?? "TBD"),
  );

  return {
    classification,
    classificationWarnings,
    discipline,
  };
}

/**
 * Prüft ob alle 5 Disziplinen besetzt sind (keine Duplikate, kein TBD).
 */
export function validateDisciplineAssignment(
  disciplines: string[]
): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  const required = ["RUN", "BENCH", "STOCK", "ROAD", "MTB"];
  const assigned = disciplines.filter(d => d !== "TBD");
  const missing = required.filter(d => !assigned.includes(d));
  const duplicates = assigned.filter((d, i) => assigned.indexOf(d) !== i);

  if (missing.length > 0) {
    warnings.push(`Disziplinen noch offen: ${missing.join(", ")}`);
  }
  if (duplicates.length > 0) {
    warnings.push(`Disziplin doppelt vergeben: ${[...new Set(duplicates)].join(", ")}`);
  }

  return { valid: missing.length === 0 && duplicates.length === 0, warnings };
}

function compactUnique(messages: string[]) {
  return Array.from(new Set(messages.map((message) => message.trim()).filter(Boolean)));
}

function isPresent(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function isValidEmail(value: string | null | undefined) {
  if (!value?.trim()) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function getDraftDisciplineLabel(participant: TeamDraftParticipantInput | undefined, index: number) {
  const code = participant?.discipline ?? participant?.disciplineCode;
  const discipline = DISCIPLINES.find((entry) => entry.id === code);
  return discipline ? `${discipline.icon} ${discipline.label}` : `Teilnehmer:in ${index + 1}`;
}

function normalizeDraftGender(gender: TeamDraftParticipantInput["gender"]): TeamStateParticipantInput["gender"] {
  if (gender === "W" || gender === "FEMALE") return "W";
  if (gender === "D" || gender === "DIVERSE") return "D";
  return "M";
}

function normalizeDraftDiscipline(participant: TeamDraftParticipantInput) {
  return participant.discipline ?? participant.disciplineCode ?? DISCIPLINE_PLACEHOLDER;
}

function collectDraftParticipantBlockingErrors(
  participants: TeamDraftParticipantInput[],
  competitionYear?: number | null,
  classifications?: readonly CompetitionClassification[] | null,
) {
  const messages: string[] = [];
  const referenceYear = normalizeCompetitionYear(competitionYear);
  const youngestEligibleBirthYear = getYoungestEligibleBirthYear(referenceYear, classifications);

  participants.forEach((participant, index) => {
    const label = getDraftDisciplineLabel(participant, index);
    const firstName = participant.firstName?.trim() ?? "";
    const lastName = participant.lastName?.trim() ?? "";
    const birthDate = participant.birthDate?.trim() ?? "";

    if (firstName.length < 2) {
      messages.push(`${label}: Vorname zu kurz`);
    }

    if (lastName.length < 2) {
      messages.push(`${label}: Nachname zu kurz`);
    }

    if (!birthDate) {
      messages.push(`${label}: Geburtsdatum fehlt`);
    } else {
      const birthYear = extractBirthYearFromInput(birthDate);
      if (birthYear === null) {
        messages.push(`${label}: Geburtsdatum unplausibel`);
      } else if (birthYear > youngestEligibleBirthYear) {
        messages.push(`${label}: Für den Wettkampf ${referenceYear} zu jung`);
      }
    }
  });

  return messages;
}

export function evaluateTeamDraft(input: TeamDraftEvaluationInput): TeamDraftEvaluation {
  const participants = input.participants ?? [];
  const blockingErrors: string[] = [];

  if ((input.teamName?.trim() ?? "").length < 3) {
    blockingErrors.push("Mannschaftsname zu kurz");
  }

  if (input.mode === "anonymous-create") {
    const hasContactName =
      isPresent(input.contactName) || (isPresent(input.contactFirstName) && isPresent(input.contactLastName));

    if (!hasContactName) {
      blockingErrors.push("Kontaktname zu kurz");
    }

    if (!isValidEmail(input.contactEmail)) {
      blockingErrors.push("Ungültige Kontakt-E-Mail");
    }
  }

  if (participants.length !== 5) {
    blockingErrors.push("Es müssen genau 5 Teilnehmer erfasst werden");
  }

  blockingErrors.push(...collectDraftParticipantBlockingErrors(participants, input.competitionYear, input.classifications));

  const teamStateParticipants = participants.map((participant) => ({
    birthYear: extractBirthYearFromInput(participant.birthDate ?? ""),
    gender: normalizeDraftGender(participant.gender),
    disciplineCode: normalizeDraftDiscipline(participant),
  }));
  const state = evaluateTeamState(teamStateParticipants, input.oldClassificationCode, {
    competitionYear: input.competitionYear,
    classifications: input.classifications,
  });
  const warnings = compactUnique([...state.classificationWarnings, ...state.discipline.warnings]);
  const compactedBlockingErrors = compactUnique(blockingErrors);

  return {
    ...state,
    mode: input.mode,
    blockingErrors: compactedBlockingErrors,
    warnings,
    info: [...state.classification.info],
    canSubmit: compactedBlockingErrors.length === 0 && state.discipline.valid,
  };
}
