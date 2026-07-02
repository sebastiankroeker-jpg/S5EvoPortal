/**
 * Klassifikationslogik für Mannschaftsfünfkampf 2026
 * Shared zwischen Frontend (Live-Preview) und Backend (Validierung)
 */

import {
  DISCIPLINE_PLACEHOLDER,
  DISCIPLINES,
  extractBirthYearFromInput,
  type DisciplineSelection,
} from "@/lib/domain/team";

const COMPETITION_YEAR = 2026;

export interface ClassificationInput {
  birthYear: number;
  gender: "M" | "W" | "D" | "MALE" | "FEMALE" | "DIVERSE";
}

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
};

export type TeamDraftEvaluation = TeamStateEvaluation & {
  mode: TeamDraftValidationMode;
  blockingErrors: string[];
  warnings: string[];
  info: string[];
  canSubmit: boolean;
};

export const YOUTH_CLASS_YEAR_RANGES = {
  "schueler-a": { minYear: 2016, maxYear: 2018 },
  "schueler-b": { minYear: 2013, maxYear: 2015 },
  jugend: { minYear: 2009, maxYear: 2012 },
} as const;

function youthClassDescription(code: keyof typeof YOUTH_CLASS_YEAR_RANGES) {
  const range = YOUTH_CLASS_YEAR_RANGES[code];
  return `Ältester Jg. ${range.minYear}–${range.maxYear}`;
}

export const CLASSIFICATIONS: Record<string, { label: string; emoji: string; desc: string }> = {
  "schueler-a": { label: "Schüler A", emoji: "SA", desc: youthClassDescription("schueler-a") },
  "schueler-b": { label: "Schüler B", emoji: "SB", desc: youthClassDescription("schueler-b") },
  "jugend": { label: "Jugend", emoji: "J", desc: youthClassDescription("jugend") },
  "jungsters": { label: "Jungsters", emoji: "🔥", desc: "Gesamtalter ≤ 125" },
  "herren": { label: "Herren", emoji: "🏆", desc: "Gesamtalter 126–225" },
  "masters": { label: "Masters", emoji: "⭐", desc: "Gesamtalter ≥ 226" },
  "damen-a": { label: "Damen A", emoji: "👑", desc: "Nur Frauen, ≤ 150" },
  "damen-b": { label: "Damen B", emoji: "💎", desc: "Nur Frauen, > 150" },
  "unclassified": { label: "Unklassifiziert", emoji: "❓", desc: "Unvollständig" },
};

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

function getYouthClassificationCodeByOldestBirthYear(birthYears: number[]) {
  const youngestYouthYear = YOUTH_CLASS_YEAR_RANGES["schueler-a"].maxYear;
  const oldestYouthYear = YOUTH_CLASS_YEAR_RANGES.jugend.minYear;

  if (!birthYears.every((year) => year >= oldestYouthYear && year <= youngestYouthYear)) {
    return null;
  }

  const oldestBirthYear = Math.min(...birthYears);
  const matchingEntry = Object.entries(YOUTH_CLASS_YEAR_RANGES).find(([, range]) =>
    oldestBirthYear >= range.minYear && oldestBirthYear <= range.maxYear
  );

  return matchingEntry?.[0] ?? null;
}

/**
 * Klassifiziert ein Team anhand seiner Teilnehmer.
 * Gibt Klasse + Warnungen zurück.
 */
export function classifyTeam(participants: ClassificationInput[]): ClassificationResult {
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

  const ages = valid.map(p => COMPETITION_YEAR - p.birthYear);
  const totalAge = ages.reduce((sum, age) => sum + age, 0);
  const birthYears = valid.map(p => p.birthYear);
  const isFemaleOnly = valid.every(p => isFemale(p.gender));
  const hasMixed = !isFemaleOnly && valid.some(p => isFemale(p.gender));

  // Klassifikation — zuerst prüfen, dann Warnungen generieren
  let code: string;
  let isYouthClass = false;
  const youthClassificationCode = getYouthClassificationCodeByOldestBirthYear(birthYears);

  // Jahrgänge-basierte Klassen (Schüler/Jugend): der älteste Jahrgang bestimmt die Klasse.
  if (youthClassificationCode) {
    code = youthClassificationCode;
    isYouthClass = true;
  }
  // Altersklassen (Gesamtalter)
  else if (isFemaleOnly && totalAge <= 150) {
    code = "damen-a";
  } else if (isFemaleOnly && totalAge > 150) {
    code = "damen-b";
  } else if (totalAge <= 125) {
    code = "jungsters";
  } else if (totalAge >= 226) {
    code = "masters";
  } else {
    code = "herren";
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
    if (totalAge >= 121 && totalAge <= 125) {
      warnings.push(`Grenzfall Jungsters/Herren: Gesamtalter ${totalAge} (Grenze: 125)`);
    }
    if (totalAge >= 226 && totalAge <= 230) {
      warnings.push(`Grenzfall Herren/Masters: Gesamtalter ${totalAge} (Grenze: 226)`);
    }
  }
  if (!isYouthClass && isFemaleOnly) {
    if (totalAge >= 146 && totalAge <= 154) {
      warnings.push(`Grenzfall Damen A/B: Gesamtalter ${totalAge} (Grenze: 150)`);
    }
  }

  // Jahrgangs-Validierung für Jugend
  if (isYouthClass) {
    const youngestYouthYear = YOUTH_CLASS_YEAR_RANGES["schueler-a"].maxYear;
    const oldestYouthYear = YOUTH_CLASS_YEAR_RANGES.jugend.minYear;
    const outOfRange = birthYears.filter(y => {
      return y < oldestYouthYear || y > youngestYouthYear;
    });
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

  const classInfo = CLASSIFICATIONS[code];

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
  newResult: ClassificationResult
): string[] {
  const warnings = [...newResult.warnings];

  if (oldCode && oldCode !== newResult.code && oldCode !== "unclassified") {
    const oldInfo = CLASSIFICATIONS[oldCode];
    warnings.unshift(
      `⚠️ Klassenwechsel: ${oldInfo?.emoji || ""} ${oldInfo?.label || oldCode} → ${newResult.emoji} ${newResult.label}`
    );
  }

  return warnings;
}

export function evaluateTeamState(
  participants: TeamStateParticipantInput[],
  oldClassificationCode?: string | null,
): TeamStateEvaluation {
  const classificationInputs = participants
    .filter((participant) => typeof participant.birthYear === "number" && participant.birthYear > 1900)
    .map((participant) => ({
      birthYear: participant.birthYear as number,
      gender: participant.gender ?? "MALE",
    }));

  const classification = classifyTeam(classificationInputs);
  const classificationWarnings = oldClassificationCode
    ? compareClassification(oldClassificationCode, classification)
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

function collectDraftParticipantBlockingErrors(participants: TeamDraftParticipantInput[]) {
  const messages: string[] = [];

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
    } else if (extractBirthYearFromInput(birthDate) === null) {
      messages.push(`${label}: Geburtsdatum unplausibel`);
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

  blockingErrors.push(...collectDraftParticipantBlockingErrors(participants));

  const teamStateParticipants = participants.map((participant) => ({
    birthYear: extractBirthYearFromInput(participant.birthDate ?? ""),
    gender: normalizeDraftGender(participant.gender),
    disciplineCode: normalizeDraftDiscipline(participant),
  }));
  const state = evaluateTeamState(teamStateParticipants, input.oldClassificationCode);
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
