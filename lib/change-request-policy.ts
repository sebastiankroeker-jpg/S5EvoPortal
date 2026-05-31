import type {
  ChangeRequestChangeType,
  ChangeRequestSource,
  ChangeRequestTargetType,
  Role,
} from "@prisma/client";

import {
  DIRECT_PARTICIPANT_CHANGE_FIELDS,
  PARTICIPANT_CHANGE_FIELDS,
  type ParticipantChangeField,
} from "@/lib/participant-change";

export type ChangeRequestFieldDecision = "direct" | "review" | "denied";

export type ChangeRequestFieldPolicy = {
  field: string;
  decision: ChangeRequestFieldDecision;
  reason?: string;
};

export type ChangeRequestPolicyInput = {
  targetType: ChangeRequestTargetType;
  changeType: ChangeRequestChangeType;
  source: ChangeRequestSource;
  actorRoles: readonly Role[];
  fields: readonly string[];
  ownsTarget?: boolean;
};

const REVIEW_PARTICIPANT_FIELD_SET = new Set<ParticipantChangeField>(
  PARTICIPANT_CHANGE_FIELDS.filter((field) => !(DIRECT_PARTICIPANT_CHANGE_FIELDS as readonly ParticipantChangeField[]).includes(field)),
);
const DIRECT_PARTICIPANT_FIELD_SET = new Set<ParticipantChangeField>(DIRECT_PARTICIPANT_CHANGE_FIELDS);

export function canReviewChangeRequests(actorRoles: readonly Role[]) {
  return actorRoles.includes("ADMIN") || actorRoles.includes("MODERATOR");
}

export function canCreateChangeRequest(input: Pick<ChangeRequestPolicyInput, "actorRoles" | "ownsTarget">) {
  return input.ownsTarget === true || input.actorRoles.includes("ADMIN") || input.actorRoles.includes("MODERATOR");
}

export function classifyChangeRequestFields(input: ChangeRequestPolicyInput): ChangeRequestFieldPolicy[] {
  if (input.actorRoles.includes("ADMIN")) {
    return input.fields.map((field) => ({
      field,
      decision: "direct",
      reason: "Admins duerfen fachliche Aenderungen direkt ausfuehren; Audit bleibt Pflicht.",
    }));
  }

  if (input.targetType === "PARTICIPANT" && input.changeType === "UPDATE") {
    return input.fields.map((field) => {
      if (isParticipantChangeField(field) && DIRECT_PARTICIPANT_FIELD_SET.has(field)) {
        return {
          field,
          decision: "direct",
          reason: "Dieses Teilnehmerfeld ist aktuell als direkt speicherbar definiert.",
        };
      }

      if (isParticipantChangeField(field) && REVIEW_PARTICIPANT_FIELD_SET.has(field)) {
        return {
          field,
          decision: "review",
          reason: "Dieses Teilnehmerfeld beeinflusst Identitaet, Klassifikation oder Disziplin und braucht Review.",
        };
      }

      return {
        field,
        decision: "denied",
        reason: "Feld ist fuer Teilnehmeraenderungen nicht freigegeben.",
      };
    });
  }

  return input.fields.map((field) => ({
    field,
    decision: input.ownsTarget ? "review" : "denied",
    reason: input.ownsTarget
      ? "Fuer diesen TargetType gibt es noch keine feinere Policy; deshalb Review statt Direktänderung."
      : "Nur eigene oder administrativ berechtigte Zielobjekte duerfen beantragt werden.",
  }));
}

export function splitChangeRequestFieldsByDecision(policies: readonly ChangeRequestFieldPolicy[]) {
  return {
    direct: policies.filter((policy) => policy.decision === "direct").map((policy) => policy.field),
    review: policies.filter((policy) => policy.decision === "review").map((policy) => policy.field),
    denied: policies.filter((policy) => policy.decision === "denied").map((policy) => policy.field),
  };
}

function isParticipantChangeField(field: string): field is ParticipantChangeField {
  return (PARTICIPANT_CHANGE_FIELDS as readonly string[]).includes(field);
}
