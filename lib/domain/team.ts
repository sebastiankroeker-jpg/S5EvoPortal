import { z } from "zod";

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

export const ParticipantSchema = z.object({
  firstName: z.string().min(2, "Vorname zu kurz"),
  lastName: z.string().min(2, "Nachname zu kurz"),
  birthDate: z.string().min(1, "Geburtsdatum fehlt"),
  gender: z.enum(["M", "W", "D"]),
  email: z.string().email("Ungültige E-Mail").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  discipline: disciplineEnum,
});

export const TeamRegistrationSchema = z.object({
  teamName: z.string().optional().or(z.literal("")),
  participants: z
    .array(ParticipantSchema)
    .length(5, "Es müssen genau 5 Teilnehmer erfasst werden"),
});

export type ParticipantInput = z.infer<typeof ParticipantSchema>;
export type TeamRegistrationInput = z.infer<typeof TeamRegistrationSchema>;

export function createEmptyParticipant(): ParticipantInput {
  return {
    firstName: "",
    lastName: "",
    birthDate: "",
    gender: "M",
    email: "",
    phone: "",
    discipline: DISCIPLINE_PLACEHOLDER,
  };
}

export function createDefaultTeamForm(): TeamRegistrationInput {
  const baseParticipants = DISCIPLINES.map((discipline) => ({
    ...createEmptyParticipant(),
    discipline: discipline.id,
  }));

  return {
    teamName: "",
    participants: baseParticipants,
  };
}

export function summarizeDisciplines(participants: ParticipantInput[]) {
  return participants.reduce<Record<DisciplineSelection, number>>((acc, participant) => {
    const key = participant.discipline;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, Object.create(null));
}


const TEAM_NAME_POOLS: Record<string, string[]> = {
  default: [
    "Bergziegen",
    "Karwendel-Kämpfer",
    "Isar Renner",
    "Soier Speedsters",
    "Lightning Goats",
  ],
  "schueler-a": ["Mini Warriors", "Young Stars", "Soier Minis"],
  "schueler-b": ["Junior Force", "Nachwuchs Crew"],
  jugend: ["Future Stars", "Jugend Elite"],
  jungsters: ["Quick Silver", "Turbo Soier"],
  herren: ["Powerhouse", "Gipfelstürmer"],
  masters: ["Golden Eagles", "Vintage Force"],
  "damen-a": ["Lady Power", "Girls on Fire"],
  "damen-b": ["Senior Queens", "Experience United"],
};

export function generateTeamName(category?: string) {
  const pool = (category && TEAM_NAME_POOLS[category]) || TEAM_NAME_POOLS.default;
  const label = pool[Math.floor(Math.random() * pool.length)] ?? "Team";
  const suffix = Math.floor(Math.random() * 900 + 100);
  return `${label} ${suffix}`;
}
