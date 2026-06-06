import {
  formatParticipantFieldValue,
  PARTICIPANT_FIELD_LABELS,
  type ParticipantChangeField,
} from "@/lib/participant-change";

export type EditParticipantContext = "TEAM" | "MARKETPLACE";
export type EditParticipantStatus = "saved" | "pending_review" | "partial" | "rejected" | "unchanged";
export type EditParticipantFieldDecision = "saved" | "review" | "denied";
export type EditParticipantNotificationStatus = "sent" | "skipped" | "failed";

export type EditParticipantFieldResult = {
  field: ParticipantChangeField;
  label: string;
  decision: EditParticipantFieldDecision;
  before: string | number | null;
  after: string | number | null;
  beforeLabel: string;
  afterLabel: string;
  message: string;
};

export type EditParticipantNotificationResult = {
  channel: "email";
  recipient: string;
  template: string;
  status: EditParticipantNotificationStatus;
  reason?: string;
};

export type EditParticipantResult = {
  status: EditParticipantStatus;
  participantId: string;
  teamId: string;
  context: EditParticipantContext;
  fieldResults: EditParticipantFieldResult[];
  validation: {
    blockingErrors: string[];
    warnings: string[];
    info: string[];
  };
  notifications: EditParticipantNotificationResult[];
};

export type ParticipantFieldDiff = Partial<
  Record<ParticipantChangeField, { before: string | number | null; after: string | number | null }>
>;

export function resolveParticipantEditContext(registrationMode?: string | null): EditParticipantContext {
  return registrationMode === "MARKETPLACE" ? "MARKETPLACE" : "TEAM";
}

export function buildParticipantFieldResults(
  diff: ParticipantFieldDiff,
  decisions: Partial<Record<ParticipantChangeField, EditParticipantFieldDecision>>,
) {
  return Object.entries(diff).map(([field, change]) => {
    const participantField = field as ParticipantChangeField;
    const decision = decisions[participantField] ?? "denied";

    return {
      field: participantField,
      label: PARTICIPANT_FIELD_LABELS[participantField],
      decision,
      before: change.before,
      after: change.after,
      beforeLabel: formatParticipantFieldValue(participantField, change.before),
      afterLabel: formatParticipantFieldValue(participantField, change.after),
      message: getFieldDecisionMessage(PARTICIPANT_FIELD_LABELS[participantField], decision),
    };
  });
}

export function buildParticipantEditResult(input: {
  status: EditParticipantStatus;
  participantId: string;
  teamId: string;
  context: EditParticipantContext;
  fieldResults?: EditParticipantFieldResult[];
  blockingErrors?: string[];
  warnings?: string[];
  info?: string[];
  notifications?: EditParticipantNotificationResult[];
}): EditParticipantResult {
  return {
    status: input.status,
    participantId: input.participantId,
    teamId: input.teamId,
    context: input.context,
    fieldResults: input.fieldResults ?? [],
    validation: {
      blockingErrors: input.blockingErrors ?? [],
      warnings: input.warnings ?? [],
      info: input.info ?? [],
    },
    notifications: input.notifications ?? [],
  };
}

function getFieldDecisionMessage(label: string, decision: EditParticipantFieldDecision) {
  if (decision === "saved") return `${label} wurde gespeichert.`;
  if (decision === "review") return `${label} wurde zur Pruefung eingereicht.`;
  return `${label} wurde nicht uebernommen.`;
}
