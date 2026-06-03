import { evaluateTeamState } from "@/lib/domain/classification";
import {
  parseSnapshot,
  summarizeParticipantChanges,
  toParticipantSnapshot,
  type ParticipantChangeSummaryItem,
  type ParticipantSnapshot,
} from "@/lib/participant-change";

const VALID_DISCIPLINE_CODES = new Set(["RUN", "BENCH", "STOCK", "ROAD", "MTB"]);
const VALID_GENDER_CODES = new Set(["M", "W", "D", "MALE", "FEMALE", "DIVERSE"] as const);
type BundleGenderCode = "M" | "W" | "D" | "MALE" | "FEMALE" | "DIVERSE";

type LiveTeamParticipant = {
  id: string;
  birthYear: number | null;
  gender: string | null;
  disciplineCode: string | null;
};

type BundlePendingChangeInput = {
  id: string;
  participantId: string;
  teamId: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "DRAFT";
  beforeData?: string | null;
  changeData: string;
  liveParticipantSnapshot?: ParticipantSnapshot;
};

export type BundleValidationIssue = {
  code:
    | "BUNDLE_TOO_SMALL"
    | "BUNDLE_CROSS_TEAM"
    | "BUNDLE_DUPLICATE_PARTICIPANT"
    | "BUNDLE_NON_PENDING_CHANGE"
    | "BUNDLE_LIVE_DRIFT"
    | "BUNDLE_INVALID_DISCIPLINE"
    | "BUNDLE_TEAM_DISCIPLINE_INVALID";
  message: string;
  participantId?: string;
  pendingChangeId?: string;
  details?: ParticipantChangeSummaryItem[];
};

export type BundleValidationResult = {
  valid: boolean;
  issues: BundleValidationIssue[];
};

export function validatePendingChangeBundle(
  pendingChanges: BundlePendingChangeInput[],
  liveTeamParticipants: LiveTeamParticipant[],
  currentClassificationCode?: string | null,
): BundleValidationResult {
  const issues: BundleValidationIssue[] = [];

  if (pendingChanges.length < 2) {
    issues.push({
      code: "BUNDLE_TOO_SMALL",
      message: "Ein Tausch-Bundle muss mindestens 2 Teilantraege enthalten.",
    });
    return { valid: false, issues };
  }

  const teamIds = new Set(pendingChanges.map((change) => change.teamId));
  if (teamIds.size !== 1) {
    issues.push({
      code: "BUNDLE_CROSS_TEAM",
      message: "Ein Tausch-Bundle darf nur Teilnehmer aus derselben Mannschaft enthalten.",
    });
  }

  const seenParticipantIds = new Set<string>();
  for (const change of pendingChanges) {
    if (seenParticipantIds.has(change.participantId)) {
      issues.push({
        code: "BUNDLE_DUPLICATE_PARTICIPANT",
        message: "Ein Teilnehmer darf in einem Bundle nur einmal vorkommen.",
        participantId: change.participantId,
        pendingChangeId: change.id,
      });
    }
    seenParticipantIds.add(change.participantId);

    if (change.status !== "PENDING") {
      issues.push({
        code: "BUNDLE_NON_PENDING_CHANGE",
        message: "Alle Teilantraege eines Bundles muessen im Status PENDING sein.",
        participantId: change.participantId,
        pendingChangeId: change.id,
      });
    }
  }

  if (issues.length > 0) {
    return { valid: false, issues };
  }

  const liveByParticipantId = new Map(liveTeamParticipants.map((participant) => [participant.id, participant]));

  for (const change of pendingChanges) {
    const requestedSnapshot = parseSnapshot(change.changeData);
    const liveSnapshot = change.liveParticipantSnapshot ?? toParticipantSnapshot(liveByParticipantId.get(change.participantId) ?? {});
    const beforeSnapshot = change.beforeData ? parseSnapshot(change.beforeData) : liveSnapshot;
    const drift = summarizeParticipantChanges(beforeSnapshot, liveSnapshot);

    if (drift.length > 0) {
      issues.push({
        code: "BUNDLE_LIVE_DRIFT",
        message: "Mindestens ein Teilantrag basiert nicht mehr auf dem Live-Stand.",
        participantId: change.participantId,
        pendingChangeId: change.id,
        details: drift,
      });
    }

    if (!isValidDisciplineCode(requestedSnapshot.disciplineCode)) {
      issues.push({
        code: "BUNDLE_INVALID_DISCIPLINE",
        message: "Jeder Teilantrag im Bundle braucht eine gueltige Zieldisziplin.",
        participantId: change.participantId,
        pendingChangeId: change.id,
      });
    }
  }

  const projectedParticipants = liveTeamParticipants.map((participant) => {
    const matchingChange = pendingChanges.find((change) => change.participantId === participant.id);
    if (!matchingChange) {
      return {
        birthYear: participant.birthYear,
        gender: normalizeGender(participant.gender),
        disciplineCode: participant.disciplineCode,
      };
    }

    const requestedSnapshot = parseSnapshot(matchingChange.changeData);
    return {
      birthYear: typeof requestedSnapshot.birthYear === "number" ? requestedSnapshot.birthYear : participant.birthYear,
      gender:
        typeof requestedSnapshot.gender === "string"
          ? normalizeGender(requestedSnapshot.gender)
          : normalizeGender(participant.gender),
      disciplineCode:
        typeof requestedSnapshot.disciplineCode === "string" ? requestedSnapshot.disciplineCode : participant.disciplineCode,
    };
  });

  const teamState = evaluateTeamState(projectedParticipants, currentClassificationCode);

  if (!teamState.discipline.valid) {
    issues.push({
      code: "BUNDLE_TEAM_DISCIPLINE_INVALID",
      message: "Die Zielbelegung des Bundles verletzt die Disziplinregeln der Mannschaft.",
      details: teamState.discipline.warnings.map((warning) => ({
        field: "disciplineCode",
        label: "Disziplin",
        before: "n/a",
        after: warning,
      })),
    });
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

function isValidDisciplineCode(value: string | number | null) {
  return typeof value === "string" && VALID_DISCIPLINE_CODES.has(value);
}

function normalizeGender(value: string | null): BundleGenderCode | null {
  if (!value) {
    return null;
  }

  return VALID_GENDER_CODES.has(value as BundleGenderCode) ? (value as BundleGenderCode) : null;
}
