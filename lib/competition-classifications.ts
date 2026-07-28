/**
 * Serializable class rules. They deliberately contain no participant data and
 * can therefore be used by the server and the registration preview alike.
 */

export type CompetitionClassificationType = "AGE_INDIVIDUAL" | "AGE_TEAM" | "COMBINED";
export type CompetitionGenderRestriction = "FEMALE_ONLY" | null;

export type CompetitionClassification = {
  code: string;
  name: string;
  type: CompetitionClassificationType;
  minAge: number | null;
  maxAge: number | null;
  genderRestriction: CompetitionGenderRestriction;
  sourceClassCodes: string[];
  sortOrder: number;
  displayEmoji: string | null;
};

const legacy = (entry: Omit<CompetitionClassification, "sortOrder"> & { sortOrder?: number }) => ({
  ...entry,
  sortOrder: entry.sortOrder ?? 0,
});

/**
 * The historic rules, represented as data. They are the fail-safe fallback
 * until an older competition has been explicitly backfilled.
 */
export const LEGACY_COMPETITION_CLASSIFICATIONS: readonly CompetitionClassification[] = [
  legacy({ code: "schueler-a", name: "Schüler A", type: "AGE_INDIVIDUAL", minAge: 8, maxAge: 10, genderRestriction: null, sourceClassCodes: [], sortOrder: 10, displayEmoji: "SA" }),
  legacy({ code: "schueler-b", name: "Schüler B", type: "AGE_INDIVIDUAL", minAge: 11, maxAge: 13, genderRestriction: null, sourceClassCodes: [], sortOrder: 20, displayEmoji: "SB" }),
  legacy({ code: "jugend", name: "Jugend", type: "AGE_INDIVIDUAL", minAge: 14, maxAge: 17, genderRestriction: null, sourceClassCodes: [], sortOrder: 30, displayEmoji: "J" }),
  legacy({ code: "damen-a", name: "Damen A", type: "AGE_TEAM", minAge: null, maxAge: 150, genderRestriction: "FEMALE_ONLY", sourceClassCodes: [], sortOrder: 40, displayEmoji: "DA" }),
  legacy({ code: "damen-b", name: "Damen B", type: "AGE_TEAM", minAge: 151, maxAge: null, genderRestriction: "FEMALE_ONLY", sourceClassCodes: [], sortOrder: 50, displayEmoji: "DB" }),
  legacy({ code: "jungsters", name: "Jungsters", type: "AGE_TEAM", minAge: null, maxAge: 125, genderRestriction: null, sourceClassCodes: [], sortOrder: 60, displayEmoji: "HA" }),
  legacy({ code: "herren", name: "Herren", type: "AGE_TEAM", minAge: 126, maxAge: 225, genderRestriction: null, sourceClassCodes: [], sortOrder: 70, displayEmoji: "HB" }),
  legacy({ code: "masters", name: "Masters", type: "AGE_TEAM", minAge: 226, maxAge: null, genderRestriction: null, sourceClassCodes: [], sortOrder: 80, displayEmoji: "HC" }),
  legacy({ code: "damen-gesamt", name: "Damen Gesamt", type: "COMBINED", minAge: null, maxAge: null, genderRestriction: "FEMALE_ONLY", sourceClassCodes: ["damen-a", "damen-b"], sortOrder: 90, displayEmoji: null }),
  legacy({ code: "herren-gesamt", name: "Herren Gesamt", type: "COMBINED", minAge: null, maxAge: null, genderRestriction: null, sourceClassCodes: ["jungsters", "herren", "masters"], sortOrder: 100, displayEmoji: null }),
] as const;

export function sortCompetitionClassifications(entries: readonly CompetitionClassification[]) {
  return [...entries].sort((left, right) =>
    left.sortOrder - right.sortOrder || left.code.localeCompare(right.code, "de"),
  );
}

/** A persisted configuration is authoritative; an empty legacy competition uses the historic rules. */
export function resolveCompetitionClassifications(entries?: readonly CompetitionClassification[] | null) {
  return entries && entries.length > 0
    ? sortCompetitionClassifications(entries)
    : [...LEGACY_COMPETITION_CLASSIFICATIONS];
}

export function classificationDescription(entry: CompetitionClassification, competitionYear: number) {
  if (entry.type === "AGE_INDIVIDUAL") {
    const oldest = entry.maxAge === null ? `ab ${entry.minAge}` : `${entry.minAge ?? 0}–${entry.maxAge}`;
    return `Ältestes Teammitglied: ${oldest} Jahre (${competitionYear})`;
  }

  const range = [entry.minAge === null ? null : `ab ${entry.minAge}`, entry.maxAge === null ? null : `bis ${entry.maxAge}`]
    .filter(Boolean)
    .join(" ");
  const gender = entry.genderRestriction === "FEMALE_ONLY" ? "Nur Frauen, " : "";
  return `${gender}Gesamtalter ${range || "ohne Grenze"}`;
}

export function toPublicCompetitionClassifications(entries: readonly CompetitionClassification[], competitionYear: number) {
  return sortCompetitionClassifications(entries).map((entry) => ({
    code: entry.code,
    name: entry.name,
    type: entry.type,
    minAge: entry.minAge,
    maxAge: entry.maxAge,
    genderRestriction: entry.genderRestriction,
    sourceClassCodes: entry.sourceClassCodes,
    sortOrder: entry.sortOrder,
    displayEmoji: entry.displayEmoji,
    description: classificationDescription(entry, competitionYear),
  }));
}
