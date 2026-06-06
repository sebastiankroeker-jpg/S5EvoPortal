import type { Prisma } from "@prisma/client";

import type { EditParticipantContext, EditParticipantNotificationResult } from "@/lib/participant-edit-result";

export type ParticipantNotificationAuditInput = {
  tenantId: string;
  competitionId?: string | null;
  teamId: string;
  teamName: string;
  participantId: string;
  participantName: string;
  context: EditParticipantContext;
  actorId?: string | null;
  reason: string;
  notifications: EditParticipantNotificationResult[];
};

export function buildParticipantNotificationAuditEvents(
  input: ParticipantNotificationAuditInput,
): Prisma.AuditEventCreateManyInput[] {
  return input.notifications.map((notification) => ({
    action: "PARTICIPANT_CHANGE_MAIL",
    scopeType: "TEAM",
    scopeId: input.teamId,
    entityType: "PARTICIPANT",
    entityId: input.participantId,
    reason: input.reason,
    afterData: {
      mailStatus: notification.status,
      recipients: notification.recipient ? [notification.recipient] : [],
      template: notification.template,
      reason: notification.reason ?? null,
      channel: notification.channel,
    },
    meta: {
      teamName: input.teamName,
      participantName: input.participantName,
      context: input.context,
    },
    tenantId: input.tenantId,
    competitionId: input.competitionId ?? null,
    actorId: input.actorId ?? null,
  }));
}

export async function recordParticipantNotificationAuditEvents(
  client: { auditEvent: { createMany(args: { data: Prisma.AuditEventCreateManyInput[] }): Promise<unknown> } },
  input: ParticipantNotificationAuditInput,
) {
  if (input.notifications.length === 0) {
    return;
  }

  await client.auditEvent.createMany({
    data: buildParticipantNotificationAuditEvents(input),
  });
}
