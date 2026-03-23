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
