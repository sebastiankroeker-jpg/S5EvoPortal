import type { NextRequest } from "next/server";
import type { ParticipantPublicationPreference } from "@prisma/client";

import {
  DISCIPLINE_PLACEHOLDER,
  type DisciplineSelection,
  birthYearToBirthDateInput,
  extractBirthYearFromInput,
} from "@/lib/domain/team";
import { evaluateTeamDraft } from "@/lib/domain/classification";
import { prisma } from "@/lib/prisma";
import { hashRegistrationClaimToken } from "@/lib/registration-claim";
import { recordClaimAuditEvent } from "@/lib/registration-claim-audit";

type MtcAccessFailureCode =
  | "not_found"
  | "revoked"
  | "expired"
  | "wrong_mode"
  | "claim_links_disabled";

type MtcParticipantInput = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  birthDate?: string | null;
  gender?: string | null;
  discipline?: string | null;
  participantPublicationPreference?: string | null;
  email?: string | null;
  moderationNote?: string | null;
  shirtSize?: string | null;
};

const VALID_DISCIPLINES = new Set(["RUN", "BENCH", "STOCK", "ROAD", "MTB", "TBD"]);
const VALID_PUBLICATION_PREFERENCES = new Set(["NAME_VERBERGEN", "NAME_VEROEFFENTLICHEN"]);
const REQUIRED_DISCIPLINES: DisciplineSelection[] = ["RUN", "BENCH", "STOCK", "ROAD", "MTB"];

function isExpired(expiresAt: Date) {
  return expiresAt.getTime() < Date.now();
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.normalize("NFC").trim() : "";
}

function mapGender(value: unknown): "MALE" | "FEMALE" {
  return value === "W" || value === "FEMALE" ? "FEMALE" : "MALE";
}

function normalizeGender(value: unknown): "M" | "W" {
  return value === "W" || value === "FEMALE" ? "W" : "M";
}

function normalizeDiscipline(value: unknown): DisciplineSelection {
  return typeof value === "string" && VALID_DISCIPLINES.has(value)
    ? (value as DisciplineSelection)
    : DISCIPLINE_PLACEHOLDER;
}

function normalizePublicationPreference(value: unknown): ParticipantPublicationPreference {
  return typeof value === "string" && VALID_PUBLICATION_PREFERENCES.has(value)
    ? (value as ParticipantPublicationPreference)
    : "NAME_VERBERGEN";
}

function isNewSlotId(value: string) {
  return value.startsWith("new:");
}

function hasParticipantIdentity(input: Pick<MtcParticipantInput, "firstName" | "lastName" | "birthDate">) {
  return Boolean(
    normalizeText(input.firstName).length >= 2 &&
    normalizeText(input.lastName).length >= 2 &&
    extractBirthYearFromInput(normalizeText(input.birthDate)) !== null,
  );
}

function toPublicTeam(tokenRecord: Awaited<ReturnType<typeof loadMtcAnonymousToken>>["token"]) {
  if (!tokenRecord) return null;
  const team = tokenRecord.team;
  const participants = [...team.participants].sort((a, b) => {
    const aDiscipline = a.disciplineCode || "TBD";
    const bDiscipline = b.disciplineCode || "TBD";
    if (aDiscipline === bDiscipline) return a.createdAt.getTime() - b.createdAt.getTime();
    return aDiscipline.localeCompare(bDiscipline);
  });

  const existingDraftParticipants = participants.map((participant) => ({
    id: participant.id,
    firstName: participant.firstName,
    lastName: participant.lastName,
    birthDate: birthYearToBirthDateInput(participant.birthYear),
    gender: normalizeGender(participant.gender),
    discipline: normalizeDiscipline(participant.disciplineCode),
    desiredDiscipline: participant.marketplaceReturnDisciplineCode || null,
    participantPublicationPreference: participant.participantPublicationPreference,
    email: participant.email || "",
    moderationNote: participant.moderationNote || "",
    shirtSize: participant.shirtSize || "",
  }));
  const usedDisciplines = new Set<DisciplineSelection>(
    existingDraftParticipants
      .map((participant) => participant.discipline)
      .filter((discipline) => discipline !== DISCIPLINE_PLACEHOLDER),
  );
  const openDisciplineSlots = REQUIRED_DISCIPLINES.filter((discipline) => !usedDisciplines.has(discipline));
  const openSlotCount = Math.max(0, 5 - existingDraftParticipants.length);
  const openDraftParticipants = Array.from({ length: openSlotCount }, (_, index) => {
    const discipline = openDisciplineSlots[index] || DISCIPLINE_PLACEHOLDER;
    return {
      id: `new:${discipline}:${index}`,
      firstName: "",
      lastName: "",
      birthDate: "",
      gender: "M" as const,
      discipline,
      desiredDiscipline: null,
      participantPublicationPreference: "NAME_VERBERGEN" as const,
      email: "",
      moderationNote: "",
      shirtSize: "",
    };
  });
  const draftParticipants = [...existingDraftParticipants, ...openDraftParticipants].slice(0, 5);

  const evaluation = evaluateTeamDraft({
    mode: "team-edit",
    teamName: team.name,
    contactName: team.contactName,
    contactEmail: team.contactEmail,
    oldClassificationCode: team.classificationCode,
    participants: draftParticipants,
  });

  return {
    token: {
      expiresAt: tokenRecord.expiresAt.toISOString(),
    },
    competition: {
      name: team.competition.name,
      year: team.competition.year,
    },
    team: {
      id: team.id,
      name: team.name,
      contactName: team.contactName || "",
      contactEmail: team.contactEmail || "",
      marketplaceMessage: team.marketplaceMessage || "",
      participants: draftParticipants,
      evaluation: {
        blockingErrors: evaluation.blockingErrors,
        warnings: evaluation.warnings,
        classificationCode: evaluation.classification.code,
        canSubmit: evaluation.canSubmit,
      },
    },
  };
}

export async function loadMtcAnonymousToken(token: string) {
  const tokenHash = hashRegistrationClaimToken(token);
  const tokenRecord = await prisma.registrationClaimToken.findUnique({
    where: { tokenHash },
    include: {
      team: {
        include: {
          competition: {
            select: {
              name: true,
              year: true,
              tenant: { select: { claimLinksEnabled: true } },
            },
          },
          participants: {
            where: { deletedAt: null },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });

  if (!tokenRecord) return { token: null, failure: "not_found" as const };
  if (tokenRecord.revokedAt) return { token: tokenRecord, failure: "revoked" as const };
  if (isExpired(tokenRecord.expiresAt)) return { token: tokenRecord, failure: "expired" as const };
  if (tokenRecord.team.registrationMode !== "MARKETPLACE") return { token: tokenRecord, failure: "wrong_mode" as const };
  if (!tokenRecord.team.competition.tenant.claimLinksEnabled) {
    return { token: tokenRecord, failure: "claim_links_disabled" as const };
  }

  return { token: tokenRecord, failure: null };
}

export function getMtcAnonymousFailureMessage(failure: MtcAccessFailureCode) {
  if (failure === "expired") return "MTC-Link ist abgelaufen";
  if (failure === "revoked") return "MTC-Link wurde gesperrt";
  if (failure === "wrong_mode") return "Dieser Link ist nicht fuer einen MTC-Entwurf freigegeben";
  if (failure === "claim_links_disabled") return "Die Einloesung von Links ist aktuell deaktiviert";
  return "MTC-Link nicht gefunden";
}

export async function getMtcAnonymousPayload(request: NextRequest, rawToken: string) {
  const { token, failure } = await loadMtcAnonymousToken(rawToken);

  await recordClaimAuditEvent({
    request,
    eventType: "MTC_ANON_VIEW",
    outcome: failure ? "FAIL" : "SUCCESS",
    reason: failure || undefined,
    tokenId: token?.id,
    teamId: token?.teamId,
  });

  if (failure) {
    return { error: getMtcAnonymousFailureMessage(failure), status: failure === "expired" ? 410 : 404 };
  }

  return { payload: toPublicTeam(token), status: 200 };
}

export async function updateMtcAnonymousTeam(request: NextRequest, rawToken: string, body: unknown) {
  const { token, failure } = await loadMtcAnonymousToken(rawToken);

  if (failure) {
    await recordClaimAuditEvent({
      request,
      eventType: "MTC_ANON_UPDATE",
      outcome: "FAIL",
      reason: failure,
      tokenId: token?.id,
      teamId: token?.teamId,
    });
    return { error: getMtcAnonymousFailureMessage(failure), status: failure === "expired" ? 410 : 404 };
  }

  const payload = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const participants = Array.isArray(payload.participants) ? (payload.participants as MtcParticipantInput[]) : [];
  const existingParticipants = new Map(token.team.participants.map((participant) => [participant.id, participant]));

  if (participants.length !== 5) {
    return { error: "Es muessen genau die 5 MTC-Slots bearbeitet werden.", status: 400 };
  }

  const seenParticipantIds = new Set<string>();
  for (const participant of participants) {
    if (!participant.id || seenParticipantIds.has(participant.id)) {
      return { error: "Teilnehmerdaten passen nicht mehr zum MTC-Entwurf. Bitte Seite neu laden.", status: 409 };
    }
    if (!isNewSlotId(participant.id) && !existingParticipants.has(participant.id)) {
      return { error: "Teilnehmerdaten passen nicht mehr zum MTC-Entwurf. Bitte Seite neu laden.", status: 409 };
    }
    seenParticipantIds.add(participant.id);
  }

  const draftParticipants = participants.map((participant) => ({
    id: participant.id,
    firstName: normalizeText(participant.firstName),
    lastName: normalizeText(participant.lastName),
    birthDate: normalizeText(participant.birthDate),
    gender: normalizeGender(participant.gender),
    discipline: normalizeDiscipline(participant.discipline),
    participantPublicationPreference: normalizePublicationPreference(participant.participantPublicationPreference),
    email: normalizeText(participant.email),
    moderationNote: normalizeText(participant.moderationNote),
    shirtSize: normalizeText(participant.shirtSize),
  }));

  const teamName = normalizeText(payload.teamName) || token.team.name;
  const contactName = normalizeText(payload.contactName) || token.team.contactName || "";
  const contactEmail = normalizeText(payload.contactEmail) || token.team.contactEmail || "";
  const completeDraftParticipants = draftParticipants.filter((participant) =>
    hasParticipantIdentity(participant),
  );

  for (const participant of draftParticipants) {
    if (!isNewSlotId(participant.id) && !hasParticipantIdentity(participant)) {
      return {
        error: "Bestehende MTC-Teilnehmer brauchen Vorname, Nachname und plausibles Geburtsdatum.",
        status: 400,
      };
    }
  }
  const evaluation = evaluateTeamDraft({
    mode: "team-edit",
    teamName,
    contactName,
    contactEmail,
    oldClassificationCode: token.team.classificationCode,
    participants: completeDraftParticipants,
  });

  const totalAge = completeDraftParticipants.reduce((sum, participant) => {
    const birthYear = extractBirthYearFromInput(participant.birthDate);
    return sum + (birthYear ? 2026 - birthYear : 0);
  }, 0);

  await prisma.$transaction(async (tx) => {
    await tx.team.update({
      where: { id: token.teamId },
      data: {
        name: teamName,
        contactName,
        contactEmail,
        classificationCode: completeDraftParticipants.length === 5 && evaluation.canSubmit
          ? evaluation.classification.code
          : token.team.classificationCode || "sportlerboerse",
        totalAge: totalAge || null,
      },
    });

    for (const participant of draftParticipants) {
      const birthYear = extractBirthYearFromInput(participant.birthDate);
      const participantIsComplete =
        participant.firstName.length >= 2 && participant.lastName.length >= 2 && birthYear !== null;

      if (isNewSlotId(participant.id)) {
        if (!participantIsComplete) continue;
        await tx.participant.create({
          data: {
            teamId: token.teamId,
            firstName: participant.firstName,
            lastName: participant.lastName,
            birthYear: birthYear as number,
            gender: mapGender(participant.gender),
            disciplineCode: normalizeDiscipline(participant.discipline),
            participantPublicationPreference: normalizePublicationPreference(participant.participantPublicationPreference),
            email: participant.email || null,
            moderationNote: participant.moderationNote || null,
            consentGiven: true,
          },
        });
        continue;
      }

      await tx.participant.update({
        where: { id: participant.id },
        data: {
          firstName: participant.firstName,
          lastName: participant.lastName,
          birthYear: birthYear as number,
          gender: mapGender(participant.gender),
          disciplineCode: normalizeDiscipline(participant.discipline),
          participantPublicationPreference: normalizePublicationPreference(participant.participantPublicationPreference),
          email: participant.email || null,
          moderationNote: participant.moderationNote || null,
        },
      });
    }
  });

  await recordClaimAuditEvent({
    request,
    eventType: "MTC_ANON_UPDATE",
    outcome: "SUCCESS",
    tokenId: token.id,
    teamId: token.teamId,
  });

  const refreshed = await loadMtcAnonymousToken(rawToken);
  return { payload: toPublicTeam(refreshed.token), status: 200 };
}
