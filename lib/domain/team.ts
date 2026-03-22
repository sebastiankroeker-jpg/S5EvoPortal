import { z } from "zod";

export const DISCIPLINE_PLACEHOLDER = "TBD" as const;

export const DISCIPLINES = [
  { id: "RUN", label: "Laufen", icon: "🏃" },
  { id: "SWIM", label: "Schwimmen", icon: "🏊" },
  { id: "SHOOT", label: "Schießen", icon: "🎯" },
  { id: "FENCE", label: "Fechten", icon: "🤺" },
  { id: "RIDE", label: "Reiten", icon: "🐎" },
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
  teamName: z.string().min(3, "Teamname zu kurz"),
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
