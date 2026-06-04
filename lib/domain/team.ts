import { z } from "zod";
import { SHIRT_SIZE_IDS, type ShirtSizeId } from "@/lib/domain/shirts";

export const MIN_BIRTH_YEAR = 1901;
export const MAX_BIRTH_YEAR = 2018;
export const MIN_BIRTHDATE = `${MIN_BIRTH_YEAR}-01-01`;
export const MAX_BIRTHDATE = `${MAX_BIRTH_YEAR}-12-31`;

export function formatBirthDateInput(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 8);
  if (!digits) return "";
  if (digits.length < 2) return digits;
  if (digits.length === 2) return `${digits}.`;
  if (digits.length < 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length === 4) return `${digits.slice(0, 2)}.${digits.slice(2)}.`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
}

export function birthYearToBirthDateInput(birthYear?: number | null): string {
  if (!birthYear || !Number.isInteger(birthYear)) return "";
  return formatBirthDateInput(`0101${birthYear}`);
}

function countBirthDateDigitsBeforeCursor(value: string, cursor: number) {
  return value.slice(0, cursor).replace(/\D/g, "").length;
}

function getBirthDateCaretFromDigitIndex(value: string, digitIndex: number) {
  if (digitIndex <= 0) return 0;

  let digitsSeen = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (/\d/.test(value[index])) {
      digitsSeen += 1;
      if (digitsSeen === digitIndex) {
        return index + 1;
      }
    }
  }

  return value.length;
}

export function resolveBirthDateInputKey(
  value: string,
  key: string,
  selectionStart: number | null,
  selectionEnd: number | null,
) {
  if (selectionStart == null || selectionEnd == null || selectionStart !== selectionEnd) {
    return null;
  }

  const digits = value.replace(/\D/g, "");

  if (key === "Backspace" && selectionStart > 0 && value[selectionStart - 1] === ".") {
    const removeDigitIndex = countBirthDateDigitsBeforeCursor(value, selectionStart) - 1;
    if (removeDigitIndex < 0) return null;

    const nextValue = formatBirthDateInput(
      digits.slice(0, removeDigitIndex) + digits.slice(removeDigitIndex + 1),
    );

    return {
      value: nextValue,
      caret: getBirthDateCaretFromDigitIndex(nextValue, removeDigitIndex),
    };
  }

  if (key === "Delete" && selectionStart < value.length && value[selectionStart] === ".") {
    const removeDigitIndex = countBirthDateDigitsBeforeCursor(value, selectionStart);
    if (removeDigitIndex >= digits.length) return null;

    const nextValue = formatBirthDateInput(
      digits.slice(0, removeDigitIndex) + digits.slice(removeDigitIndex + 1),
    );

    return {
      value: nextValue,
      caret: getBirthDateCaretFromDigitIndex(nextValue, removeDigitIndex),
    };
  }

  return null;
}

function isValidBirthDate(year: number, month: number, day: number) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (year < MIN_BIRTH_YEAR || year > MAX_BIRTH_YEAR) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  const candidate = new Date(Date.UTC(year, month - 1, day));
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

export function normalizeBirthDateInput(input: string): string {
  const value = input.trim();
  if (!value) return "";

  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, yearText, monthText, dayText] = isoMatch;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    return isValidBirthDate(year, month, day) ? value : value;
  }

  const deMatch = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (deMatch) {
    const [, dayText, monthText, yearText] = deMatch;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);

    if (!isValidBirthDate(year, month, day)) {
      return value;
    }

    return `${yearText}-${monthText.padStart(2, "0")}-${dayText.padStart(2, "0")}`;
  }

  return value;
}

export function extractBirthYearFromInput(birthDate: string): number | null {
  const normalized = normalizeBirthDateInput(birthDate);
  const match = normalized.match(/^(\d{4})-\d{2}-\d{2}$/);
  if (!match) return null;

  const year = Number(match[1]);
  if (!Number.isInteger(year) || year < MIN_BIRTH_YEAR || year > MAX_BIRTH_YEAR) {
    return null;
  }

  return year;
}

export const DISCIPLINE_PLACEHOLDER = "TBD" as const;

export const DISCIPLINES = [
  { id: "RUN", label: "Laufen", icon: "🏃" },
  { id: "BENCH", label: "Bankdrücken", icon: "🏋️" },
  { id: "STOCK", label: "Stockschießen", icon: "🎯" },
  { id: "ROAD", label: "Rennrad", icon: "🚴" },
  { id: "MTB", label: "Mountainbike", icon: "🚵" },
] as const;

export const DISCIPLINE_IDS = DISCIPLINES.map((d) => d.id);

export type DisciplineId = (typeof DISCIPLINE_IDS)[number];
export type DisciplineSelection = DisciplineId | typeof DISCIPLINE_PLACEHOLDER;

const disciplineEnum = z.enum([
  DISCIPLINE_PLACEHOLDER,
  ...DISCIPLINE_IDS,
] as [DisciplineSelection, ...DisciplineSelection[]]);

const shirtSizeEnum = z.enum(SHIRT_SIZE_IDS as [ShirtSizeId, ...ShirtSizeId[]]);
const teamPublicationLevelEnum = z.enum([
  "TEAM_ANONYM",
  "TEAMNAME_OEFFENTLICH",
  "ALLES_OEFFENTLICH",
] as const);
const participantPublicationPreferenceEnum = z.enum([
  "NAME_VERBERGEN",
  "NAME_VEROEFFENTLICHEN",
] as const);

export const TEAM_PUBLICATION_OPTIONS = [
  { id: "TEAM_ANONYM", label: "Team anonym" },
  { id: "TEAMNAME_OEFFENTLICH", label: "Teamname sichtbar, Teilnehmer anonym" },
  { id: "ALLES_OEFFENTLICH", label: "Alles öffentlich" },
] as const;

export const PARTICIPANT_PUBLICATION_OPTIONS = [
  { id: "NAME_VERBERGEN", label: "Namen nicht veröffentlichen" },
  { id: "NAME_VEROEFFENTLICHEN", label: "Namen veröffentlichen" },
] as const;

export const ParticipantSchema = z.object({
  id: z.string().optional(),
  firstName: z.string().min(2, "Vorname zu kurz"),
  lastName: z.string().min(2, "Nachname zu kurz"),
  birthDate: z
    .string()
    .min(1, "Geburtsdatum fehlt")
    .refine((value) => extractBirthYearFromInput(value) !== null, "Geburtsdatum unplausibel"),
  gender: z.enum(["M", "W", "D"]),
  moderationNote: z.string().max(280, "Moderationshinweis zu lang").optional().or(z.literal("")),
  email: z.string().email("Ungültige E-Mail").optional().or(z.literal("")),
  participantPublicationPreference: participantPublicationPreferenceEnum.default("NAME_VERBERGEN"),
  discipline: disciplineEnum,
  shirtSize: shirtSizeEnum.optional().or(z.literal("")),
});

export const TeamRegistrationSchema = z.object({
  teamName: z.string().min(3, "Mannschaftsname zu kurz"),
  contactFirstName: z.string().min(2, "Vorname zu kurz").optional().or(z.literal("")),
  contactLastName: z.string().min(2, "Name zu kurz").optional().or(z.literal("")),
  contactName: z.string().min(2, "Kontaktname zu kurz").optional().or(z.literal("")),
  contactEmail: z.string().email("Ungültige Kontakt-E-Mail").optional().or(z.literal("")),
  teamPublicationLevel: teamPublicationLevelEnum.default("TEAM_ANONYM"),
  participants: z
    .array(ParticipantSchema)
    .length(5, "Es müssen genau 5 Teilnehmer erfasst werden"),
});

export type ParticipantInput = z.output<typeof ParticipantSchema>;
export type TeamRegistrationInput = z.output<typeof TeamRegistrationSchema>;
export type TeamRegistrationFormInput = z.input<typeof TeamRegistrationSchema>;

export function formatTeamRegistrationValidationIssues(issues: z.ZodIssue[]) {
  const fieldLabels: Record<string, string> = {
    teamName: "Mannschaftsname",
    contactFirstName: "Kontakt-Vorname",
    contactLastName: "Kontakt-Nachname",
    contactName: "Kontaktname",
    contactEmail: "Kontakt-E-Mail",
    participants: "Teilnehmer",
    firstName: "Vorname",
    lastName: "Nachname",
    birthDate: "Geburtsdatum",
    gender: "Geschlecht",
    discipline: "Disziplin",
    shirtSize: "T-Shirt",
    email: "E-Mail",
    moderationNote: "Moderationshinweis",
    participantPublicationPreference: "Namensveröffentlichung",
  };

  const messages = issues.map((issue) => {
    const participantPathIndex = issue.path.findIndex((segment) => segment === "participants");
    const participantIndex = issue.path[participantPathIndex + 1];
    const field = issue.path[issue.path.length - 1];
    const fieldLabel = typeof field === "string" ? fieldLabels[field] : null;

    if (participantPathIndex >= 0 && typeof participantIndex === "number") {
      return `Teilnehmer:in ${participantIndex + 1}${fieldLabel ? ` ${fieldLabel}` : ""}: ${issue.message}`;
    }

    return fieldLabel ? `${fieldLabel}: ${issue.message}` : issue.message;
  });

  return Array.from(new Set(messages)).join(" · ") || "Validierung fehlgeschlagen";
}

export function createEmptyParticipant(): ParticipantInput {
  return {
    firstName: "",
    lastName: "",
    birthDate: "",
    gender: "M",
    moderationNote: "",
    email: "",
    participantPublicationPreference: "NAME_VERBERGEN",
    discipline: DISCIPLINE_PLACEHOLDER,
    shirtSize: "",
  };
}

export function createDefaultTeamForm(): TeamRegistrationInput {
  const baseParticipants = DISCIPLINES.map((discipline) => ({
    ...createEmptyParticipant(),
    discipline: discipline.id,
  }));

  return {
    teamName: "",
    contactFirstName: "",
    contactLastName: "",
    contactName: "",
    contactEmail: "",
    teamPublicationLevel: "TEAM_ANONYM",
    participants: baseParticipants,
  };
}

export function summarizeDisciplines(participants: Array<{ discipline: DisciplineSelection }>) {
  return participants.reduce<Record<DisciplineSelection, number>>((acc, participant) => {
    const key = participant.discipline;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, Object.create(null));
}


const TEAM_NAME_POOLS: Record<string, string[]> = {
  default: [
    "Ammertaler Bergziegen", "Kofel-Kraxler", "Soier Sturmtrupp", "Ammer-Piraten",
    "Ettaler Klosterbräu Gang", "Oberammergau Express", "Unterammergau United",
    "Wildsteig Wölfe", "Rottenbuch Rockets", "Peißenberg Powerplay",
    "Bad Bayersoier Bademeister", "Alfeld Alligators", "Pürschling Panther",
    "Laber-Lawine", "Steckenberg Strolche", "Scherenauer Schwalben",
    "Pulvermoos Pumas", "Graswang Geier", "Linderhof Legenden", "Kolbensattel Crew",
  ],
  "schueler-a": [
    "Soier Mini-Ziegen", "Ammer-Zwerge", "Kofel-Kids", "Kleine Kraxler",
    "Ettaler Engelchen", "Lütte Laber-Bande", "Mini-Alpinisten",
  ],
  "schueler-b": [
    "Junior Bergsteiger", "Nachwuchs-Gämsen", "Ammer-Jugend Force",
    "Kofel-Kadetten", "Soier School Stars", "Pürschling Pfadfinder",
  ],
  jugend: [
    "Future Alpinists", "Jugend-Lawine", "Ammertal Next Gen",
    "Young Kofel Climbers", "Soier Youth Crew", "Oberammergau Originals",
  ],
  jungsters: [
    "Turbo Soier", "Ammer-Blitz", "Quick Kofel", "Kolbensattel Sprinter",
    "Soier Speedsters", "Junge Wilde Ammertal", "Flash Ettaler",
  ],
  herren: [
    "Gipfelstürmer ESV", "Ammertaler Kraftpaket", "Kofel Kommandos",
    "Soier Stahlharte", "Oberammergau Outlaws", "Ettaler Eisenmänner",
    "Pürschling Power", "Steckenberg Strongmen", "Laber Legionäre",
  ],
  masters: [
    "Alte Berghasen", "Silberrücken Ammertal", "Vintage Kofel",
    "Graue Gipfelwölfe", "Erfahrene Ettaler", "Soier Senioren-Express",
    "Masters of the Ammer", "Weise Wildsteiger", "Opa-Power Oberammergau",
  ],
  "damen-a": [
    "Ammer-Amazonen", "Kofel Queens", "Soier Powerfrauen",
    "Ettaler Ladys", "Pürschling Prinzessinnen", "Bergziegen-Mädels",
    "Lady Laber", "Wildsteig Women", "Ammertaler Heldinnen",
  ],
  "damen-b": [
    "Erfahrene Amazonen", "Ammer Grande Dames", "Kofel Königinnen",
    "Soier Senior Ladies", "Goldene Gämsinnen", "Ettaler Expertinnen",
    "Wise Women Wildsteig", "Ammer-Matriarchinnen",
  ],
};

export function generateTeamName(category?: string) {
  const pool = (category && TEAM_NAME_POOLS[category]) || TEAM_NAME_POOLS.default;
  const label = pool[Math.floor(Math.random() * pool.length)] ?? "Team";
  const suffix = Math.floor(Math.random() * 900 + 100);
  return `${label} ${suffix}`;
}
