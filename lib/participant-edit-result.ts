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

export type ParticipantReviewDecisionStatus = "approved" | "rejected" | "conflict" | "idempotent";
export type ParticipantReviewDecisionScope = "single" | "bundle";

export type ParticipantReviewDecisionResult = {
  status: ParticipantReviewDecisionStatus;
  scope: ParticipantReviewDecisionScope;
  message: string;
  count: number;
  participantId?: string;
  teamId?: string;
  context: EditParticipantContext;
  reviewComment?: string | null;
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

export function buildParticipantReviewDecisionResult(input: {
  status: ParticipantReviewDecisionStatus;
  scope: ParticipantReviewDecisionScope;
  message: string;
  count?: number;
  participantId?: string;
  teamId?: string;
  context: EditParticipantContext;
  reviewComment?: string | null;
  fieldResults?: EditParticipantFieldResult[];
  diff?: ParticipantFieldDiff;
  fieldDecision?: EditParticipantFieldDecision;
  blockingErrors?: string[];
  warnings?: string[];
  info?: string[];
  notifications?: EditParticipantNotificationResult[];
}): ParticipantReviewDecisionResult {
  return {
    status: input.status,
    scope: input.scope,
    message: input.message,
    count: input.count ?? 1,
    participantId: input.participantId,
    teamId: input.teamId,
    context: input.context,
    reviewComment: input.reviewComment ?? null,
    fieldResults: input.fieldResults ?? (input.diff
      ? buildParticipantFieldResults(
          input.diff,
          Object.fromEntries(
            Object.keys(input.diff).map((field) => [field, input.fieldDecision ?? "denied"]),
          ) as Partial<Record<ParticipantChangeField, EditParticipantFieldDecision>>,
        )
      : []),
    validation: {
      blockingErrors: input.blockingErrors ?? [],
      warnings: input.warnings ?? [],
      info: input.info ?? [],
    },
    notifications: input.notifications ?? [],
  };
}

export function buildParticipantClaimNotificationResult(input: unknown): EditParticipantNotificationResult | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }

  const value = input as { status?: unknown; email?: unknown; reason?: unknown };
  const status =
    value.status === "sent" || value.status === "skipped" || value.status === "failed"
      ? value.status
      : null;

  if (!status) {
    return null;
  }

  return {
    channel: "email",
    recipient: typeof value.email === "string" ? value.email : "",
    template: "participant-claim-invitation",
    status,
    reason: typeof value.reason === "string" ? value.reason : undefined,
  };
}

function getFieldDecisionMessage(label: string, decision: EditParticipantFieldDecision) {
  if (decision === "saved") return `${label} wurde gespeichert.`;
  if (decision === "review") return `${label} wurde zur Pruefung eingereicht.`;
  return `${label} wurde nicht uebernommen.`;
}
