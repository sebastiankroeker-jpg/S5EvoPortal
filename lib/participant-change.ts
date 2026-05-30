import type { Prisma } from "@prisma/client";

import { compareClassification, classifyTeam } from "@/lib/domain/classification";
import { prisma } from "@/lib/prisma";

export const PARTICIPANT_CHANGE_FIELDS = [
  "firstName",
  "lastName",
  "birthYear",
  "gender",
  "disciplineCode",
  "shirtSize",
  "moderationNote",
  "email",
  "participantPublicationPreference",
] as const;

export type ParticipantChangeField = typeof PARTICIPANT_CHANGE_FIELDS[number];
export const DIRECT_PARTICIPANT_CHANGE_FIELDS = [
  "shirtSize",
  "moderationNote",
  "email",
  "participantPublicationPreference",
] as const satisfies readonly ParticipantChangeField[];
export type DirectParticipantChangeField = typeof DIRECT_PARTICIPANT_CHANGE_FIELDS[number];

const DIRECT_PARTICIPANT_CHANGE_FIELD_SET = new Set<ParticipantChangeField>(DIRECT_PARTICIPANT_CHANGE_FIELDS);

export type ParticipantSnapshot = Record<ParticipantChangeField, string | number | null>;
export type ParticipantChangeSummaryItem = {
  field: ParticipantChangeField;
  label: string;
  before: string;
  after: string;
};

export const PARTICIPANT_FIELD_LABELS: Record<ParticipantChangeField, string> = {
  firstName: "Vorname",
  lastName: "Nachname",
  birthYear: "Geburtsjahr",
  gender: "Geschlecht",
  disciplineCode: "Disziplin",
  shirtSize: "T-Shirt",
  moderationNote: "Moderationshinweis",
  email: "E-Mail",
  participantPublicationPreference: "Namensveröffentlichung",
};

const PARTICIPANT_GENDER_LABELS: Record<string, string> = {
  MALE: "Herr",
  M: "Herr",
  FEMALE: "Dame",
  W: "Dame",
  DIVERSE: "Divers",
  D: "Divers",
};

const PARTICIPANT_DISCIPLINE_LABELS: Record<string, string> = {
  RUN: "Laufen",
  BENCH: "Bankdruecken",
  STOCK: "Stockschiessen",
  ROAD: "Rennrad",
  MTB: "Mountainbike",
  TBD: "Noch offen",
};

export function toParticipantSnapshot(source: Partial<Record<ParticipantChangeField, unknown>>): ParticipantSnapshot {
  return {
    firstName: typeof source.firstName === "string" ? source.firstName : null,
    lastName: typeof source.lastName === "string" ? source.lastName : null,
    birthYear: typeof source.birthYear === "number" && Number.isFinite(source.birthYear) ? source.birthYear : null,
    gender: typeof source.gender === "string" ? source.gender : null,
    disciplineCode: typeof source.disciplineCode === "string" ? source.disciplineCode : null,
    shirtSize: typeof source.shirtSize === "string" ? source.shirtSize : null,
    moderationNote: typeof source.moderationNote === "string" ? source.moderationNote : null,
    email: typeof source.email === "string" ? source.email : null,
    participantPublicationPreference: typeof source.participantPublicationPreference === "string" ? source.participantPublicationPreference : null,
  };
}

export function serializeSnapshot(snapshot: ParticipantSnapshot) {
  return JSON.stringify(snapshot);
}

export function parseSnapshot(raw?: string | null): ParticipantSnapshot {
  if (!raw) {
    return toParticipantSnapshot({});
  }

  try {
    return toParticipantSnapshot(JSON.parse(raw) as Record<string, unknown>);
  } catch {
    return toParticipantSnapshot({});
  }
}

export function buildParticipantChangeData(body: Record<string, unknown>): Partial<Record<ParticipantChangeField, string | number | null>> {
  return {
    ...(body.firstName !== undefined ? { firstName: String(body.firstName || "").trim() } : {}),
    ...(body.lastName !== undefined ? { lastName: String(body.lastName || "").trim() } : {}),
    ...(body.birthYear !== undefined ? { birthYear: Number(body.birthYear) } : {}),
    ...(body.gender !== undefined ? { gender: String(body.gender) } : {}),
    ...(body.disciplineCode !== undefined ? { disciplineCode: String(body.disciplineCode) } : {}),
    ...(body.shirtSize !== undefined ? { shirtSize: body.shirtSize ? String(body.shirtSize) : null } : {}),
    ...(body.moderationNote !== undefined ? { moderationNote: body.moderationNote ? String(body.moderationNote).trim() : null } : {}),
    ...(body.email !== undefined ? { email: body.email ? String(body.email).trim() : null } : {}),
    ...(body.participantPublicationPreference !== undefined
      ? { participantPublicationPreference: body.participantPublicationPreference ? String(body.participantPublicationPreference) : null }
      : {}),
  };
}

export function mergeParticipantSnapshot(
  current: ParticipantSnapshot,
  changeData: Partial<Record<ParticipantChangeField, string | number | null>>,
): ParticipantSnapshot {
  return {
    ...current,
    ...changeData,
  };
}

export function snapshotToParticipantUpdateData(snapshot: ParticipantSnapshot): Prisma.ParticipantUpdateInput {
  return {
    firstName: typeof snapshot.firstName === "string" ? snapshot.firstName : "",
    lastName: typeof snapshot.lastName === "string" ? snapshot.lastName : "",
    birthYear: typeof snapshot.birthYear === "number" ? snapshot.birthYear : 0,
    gender: snapshot.gender === "FEMALE" ? "FEMALE" : "MALE",
    disciplineCode:
      snapshot.disciplineCode === "RUN" ||
      snapshot.disciplineCode === "BENCH" ||
      snapshot.disciplineCode === "STOCK" ||
      snapshot.disciplineCode === "ROAD" ||
      snapshot.disciplineCode === "MTB"
        ? snapshot.disciplineCode
        : "TBD",
    shirtSize:
      snapshot.shirtSize === "K116" ||
      snapshot.shirtSize === "K128" ||
      snapshot.shirtSize === "K140" ||
      snapshot.shirtSize === "K152" ||
      snapshot.shirtSize === "K164" ||
      snapshot.shirtSize === "XS" ||
      snapshot.shirtSize === "S" ||
      snapshot.shirtSize === "M" ||
      snapshot.shirtSize === "L" ||
      snapshot.shirtSize === "XL" ||
      snapshot.shirtSize === "XXL" ||
      snapshot.shirtSize === "XXXL"
        ? snapshot.shirtSize
        : null,
    moderationNote: typeof snapshot.moderationNote === "string" ? snapshot.moderationNote : null,
    email: typeof snapshot.email === "string" ? snapshot.email : null,
    participantPublicationPreference:
      snapshot.participantPublicationPreference === "NAME_VEROEFFENTLICHEN"
        ? "NAME_VEROEFFENTLICHEN"
        : "NAME_VERBERGEN",
  };
}

export function diffParticipantSnapshots(before: ParticipantSnapshot, after: ParticipantSnapshot) {
  return PARTICIPANT_CHANGE_FIELDS.reduce((diff, field) => {
    const normalizedBefore = normalizeParticipantSnapshotValue(field, before[field]);
    const normalizedAfter = normalizeParticipantSnapshotValue(field, after[field]);

    if (normalizedBefore !== normalizedAfter) {
      diff[field] = {
        before: before[field],
        after: after[field],
      };
    }
    return diff;
  }, {} as Partial<Record<ParticipantChangeField, { before: string | number | null; after: string | number | null }>>);
}

function normalizeParticipantSnapshotValue(field: ParticipantChangeField, value: string | number | null) {
  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.normalize("NFC").trim();

  if (normalized === "") {
    return null;
  }

  if (field === "email") {
    return normalized.toLowerCase();
  }

  return normalized;
}

export function pickDirectParticipantChangeData(
  changedFields: Partial<Record<ParticipantChangeField, { before: string | number | null; after: string | number | null }>>,
  requestedSnapshot: ParticipantSnapshot,
) {
  return PARTICIPANT_CHANGE_FIELDS.reduce((data, field) => {
    if (changedFields[field] && DIRECT_PARTICIPANT_CHANGE_FIELD_SET.has(field)) {
      data[field as DirectParticipantChangeField] = requestedSnapshot[field];
    }
    return data;
  }, {} as Partial<Record<DirectParticipantChangeField, string | number | null>>);
}

export function hasParticipantChangeData(changeData: Record<string, unknown>) {
  return Object.keys(changeData).length > 0;
}

export function summarizeDirectParticipantChangeFields(changeData: Record<string, unknown>) {
  return DIRECT_PARTICIPANT_CHANGE_FIELDS
    .filter((field) => Object.prototype.hasOwnProperty.call(changeData, field))
    .map((field) => PARTICIPANT_FIELD_LABELS[field]);
}

export function formatParticipantFieldValue(field: ParticipantChangeField, value: string | number | null) {
  if (value === null || value === "") {
    return "leer";
  }

  if (field === "gender" && typeof value === "string") {
    return PARTICIPANT_GENDER_LABELS[value] || value;
  }

  if (field === "disciplineCode" && typeof value === "string") {
    return PARTICIPANT_DISCIPLINE_LABELS[value] || value;
  }

  if (field === "participantPublicationPreference" && typeof value === "string") {
    return value === "NAME_VEROEFFENTLICHEN" ? "Name veröffentlichen" : "Name verbergen";
  }

  return String(value);
}

export function summarizeParticipantChanges(before: ParticipantSnapshot, after: ParticipantSnapshot): ParticipantChangeSummaryItem[] {
  const diff = diffParticipantSnapshots(before, after);

  return PARTICIPANT_CHANGE_FIELDS.flatMap((field) => {
    const change = diff[field];
    if (!change) {
      return [];
    }

    return [{
      field,
      label: PARTICIPANT_FIELD_LABELS[field],
      before: formatParticipantFieldValue(field, change.before),
      after: formatParticipantFieldValue(field, change.after),
    }];
  });
}

export async function recalculateTeamClassification(teamId: string) {
  let classificationWarnings: string[] = [];

  const teamWithParticipants = await prisma.team.findUnique({
    where: { id: teamId },
    include: { participants: { where: { deletedAt: null } } },
  });

  if (!teamWithParticipants) {
    return classificationWarnings;
  }

  const inputs = teamWithParticipants.participants.map((participant) => ({
    birthYear: participant.birthYear,
    gender: participant.gender as "M" | "W" | "D" | "MALE" | "FEMALE" | "DIVERSE",
  }));
  const newClassification = classifyTeam(inputs);
  const oldCode = teamWithParticipants.classificationCode || "unclassified";
  classificationWarnings = compareClassification(oldCode, newClassification);

  if (newClassification.code !== oldCode || newClassification.totalAge !== teamWithParticipants.totalAge) {
    await prisma.team.update({
      where: { id: teamId },
      data: {
        classificationCode: newClassification.code,
        totalAge: newClassification.totalAge,
      },
    });
  }

  return classificationWarnings;
}
