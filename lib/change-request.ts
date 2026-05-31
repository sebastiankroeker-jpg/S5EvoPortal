import type {
  ChangeRequest,
  ChangeRequestAuditAction,
  ChangeRequestChangeType,
  ChangeRequestSource,
  ChangeRequestStatus,
  ChangeRequestTargetType,
  Prisma,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

type JsonInput = Prisma.InputJsonValue;
type ChangeRequestTx = Prisma.TransactionClient;

export type CreateChangeRequestInput = {
  tenantId: string;
  competitionId?: string | null;
  targetType: ChangeRequestTargetType;
  targetId: string;
  changeType?: ChangeRequestChangeType;
  source?: ChangeRequestSource;
  beforeSnapshot?: JsonInput;
  requestedSnapshot: JsonInput;
  metadata?: JsonInput;
  priority?: number;
  requestedById: string;
  supersedesRequestId?: string | null;
  submit?: boolean;
  message?: string;
};

export type ReviewChangeRequestInput = {
  id: string;
  reviewerId: string;
  comment?: string | null;
};

export type ApplyChangeRequestInput = {
  id: string;
  actorId: string;
  beforeData?: JsonInput;
  afterData?: JsonInput;
  message?: string | null;
};

export type LegacyParticipantChangeRequestInput = {
  tenantId: string;
  competitionId?: string | null;
  participantId: string;
  requestedById: string;
  beforeSnapshot: JsonInput;
  requestedSnapshot: JsonInput;
  legacyPendingChangeId: string;
  message: string;
};

export type LegacyParticipantReviewInput = {
  participantId: string;
  actorId: string;
  approved: boolean;
  applied?: boolean;
  comment?: string | null;
  beforeSnapshot?: JsonInput;
  requestedSnapshot?: JsonInput;
};

export async function createChangeRequest(input: CreateChangeRequestInput) {
  const now = new Date();
  const status: ChangeRequestStatus = input.submit ? "PENDING" : "DRAFT";

  return prisma.$transaction(async (tx) => {
    const request = await tx.changeRequest.create({
      data: {
        tenantId: input.tenantId,
        competitionId: input.competitionId ?? null,
        targetType: input.targetType,
        targetId: input.targetId,
        changeType: input.changeType ?? "UPDATE",
        source: input.source ?? "SELF_SERVICE",
        beforeSnapshot: input.beforeSnapshot ?? undefined,
        requestedSnapshot: input.requestedSnapshot,
        metadata: input.metadata ?? undefined,
        priority: input.priority ?? 0,
        requestedById: input.requestedById,
        supersedesRequestId: input.supersedesRequestId ?? null,
        status,
        submittedAt: input.submit ? now : null,
      },
    });

    await createChangeRequestAudit(tx, {
      changeRequestId: request.id,
      actorId: input.requestedById,
      action: input.submit ? "SUBMITTED" : "CREATED",
      afterData: input.requestedSnapshot,
      message: input.message ?? (input.submit ? "Aenderungsantrag eingereicht" : "Aenderungsantrag erstellt"),
    });

    return request;
  });
}

export async function upsertLegacyParticipantChangeRequest(
  tx: ChangeRequestTx,
  input: LegacyParticipantChangeRequestInput,
) {
  const existing = await tx.changeRequest.findFirst({
    where: {
      targetType: "PARTICIPANT",
      targetId: input.participantId,
      changeType: "UPDATE",
      status: "PENDING",
    },
    orderBy: { updatedAt: "desc" },
  });

  if (existing) {
    const updated = await tx.changeRequest.update({
      where: { id: existing.id },
      data: {
        tenantId: input.tenantId,
        competitionId: input.competitionId ?? null,
        requestedById: input.requestedById,
        beforeSnapshot: input.beforeSnapshot,
        requestedSnapshot: input.requestedSnapshot,
        metadata: {
          legacyPendingChangeId: input.legacyPendingChangeId,
        },
        reviewComment: null,
        reviewedAt: null,
        reviewedById: null,
      },
    });

    await createChangeRequestAudit(tx, {
      changeRequestId: updated.id,
      actorId: input.requestedById,
      action: "UPDATED",
      beforeData: asInputJson(existing.requestedSnapshot),
      afterData: input.requestedSnapshot,
      message: input.message,
    });

    return updated;
  }

  const created = await tx.changeRequest.create({
    data: {
      tenantId: input.tenantId,
      competitionId: input.competitionId ?? null,
      targetType: "PARTICIPANT",
      targetId: input.participantId,
      changeType: "UPDATE",
      source: "SELF_SERVICE",
      status: "PENDING",
      submittedAt: new Date(),
      beforeSnapshot: input.beforeSnapshot,
      requestedSnapshot: input.requestedSnapshot,
      metadata: {
        legacyPendingChangeId: input.legacyPendingChangeId,
      },
      requestedById: input.requestedById,
    },
  });

  await createChangeRequestAudit(tx, {
    changeRequestId: created.id,
    actorId: input.requestedById,
    action: "SUBMITTED",
    afterData: input.requestedSnapshot,
    message: input.message,
  });

  return created;
}

export async function reviewLegacyParticipantChangeRequest(
  tx: ChangeRequestTx,
  input: LegacyParticipantReviewInput,
) {
  const request = await tx.changeRequest.findFirst({
    where: {
      targetType: "PARTICIPANT",
      targetId: input.participantId,
      changeType: "UPDATE",
      status: "PENDING",
    },
    orderBy: { updatedAt: "desc" },
  });

  if (!request) {
    return null;
  }

  const nextStatus: ChangeRequestStatus = input.approved
    ? input.applied === false
      ? "APPROVED"
      : "APPLIED"
    : "REJECTED";
  const now = new Date();
  const updated = await tx.changeRequest.update({
    where: { id: request.id },
    data: {
      status: nextStatus,
      reviewedAt: now,
      reviewedById: input.actorId,
      appliedAt: nextStatus === "APPLIED" ? now : null,
      appliedById: nextStatus === "APPLIED" ? input.actorId : null,
      reviewComment: input.comment || null,
    },
  });

  await createChangeRequestAudit(tx, {
    changeRequestId: request.id,
    actorId: input.actorId,
    action: input.approved ? "APPROVED" : "REJECTED",
    beforeData: input.beforeSnapshot ?? asInputJson(request.beforeSnapshot),
    afterData: input.requestedSnapshot ?? asInputJson(request.requestedSnapshot),
    message: input.comment || (input.approved ? "Aenderungsantrag genehmigt" : "Aenderungsantrag abgelehnt"),
  });

  if (nextStatus === "APPLIED") {
    await createChangeRequestAudit(tx, {
      changeRequestId: request.id,
      actorId: input.actorId,
      action: "APPLIED",
      beforeData: input.beforeSnapshot ?? asInputJson(request.beforeSnapshot),
      afterData: input.requestedSnapshot ?? asInputJson(request.requestedSnapshot),
      message: "Aenderungsantrag angewendet",
    });
  }

  return updated;
}

export async function submitChangeRequest(id: string, actorId: string, message = "Aenderungsantrag eingereicht") {
  return prisma.$transaction(async (tx) => {
    const request = await getMutableChangeRequest(tx, id, ["DRAFT"]);

    const updated = await tx.changeRequest.update({
      where: { id },
      data: {
        status: "PENDING",
        submittedAt: new Date(),
      },
    });

    await createChangeRequestAudit(tx, {
      changeRequestId: id,
      actorId,
      action: "SUBMITTED",
      beforeData: asInputJson(request.requestedSnapshot),
      afterData: asInputJson(updated.requestedSnapshot),
      message,
    });

    return updated;
  });
}

export async function approveChangeRequest(input: ReviewChangeRequestInput) {
  return prisma.$transaction(async (tx) => {
    const request = await getMutableChangeRequest(tx, input.id, ["PENDING"]);

    const updated = await tx.changeRequest.update({
      where: { id: input.id },
      data: {
        status: "APPROVED",
        reviewedAt: new Date(),
        reviewedById: input.reviewerId,
        reviewComment: input.comment || null,
      },
    });

    await createChangeRequestAudit(tx, {
      changeRequestId: input.id,
      actorId: input.reviewerId,
      action: "APPROVED",
      beforeData: asInputJson(request.beforeSnapshot),
      afterData: asInputJson(request.requestedSnapshot),
      message: input.comment || "Aenderungsantrag genehmigt",
    });

    return updated;
  });
}

export async function rejectChangeRequest(input: ReviewChangeRequestInput) {
  return prisma.$transaction(async (tx) => {
    const request = await getMutableChangeRequest(tx, input.id, ["PENDING"]);

    const updated = await tx.changeRequest.update({
      where: { id: input.id },
      data: {
        status: "REJECTED",
        reviewedAt: new Date(),
        reviewedById: input.reviewerId,
        reviewComment: input.comment || null,
      },
    });

    await createChangeRequestAudit(tx, {
      changeRequestId: input.id,
      actorId: input.reviewerId,
      action: "REJECTED",
      beforeData: asInputJson(request.beforeSnapshot),
      afterData: asInputJson(request.requestedSnapshot),
      message: input.comment || "Aenderungsantrag abgelehnt",
    });

    return updated;
  });
}

export async function cancelChangeRequest(id: string, actorId: string, message = "Aenderungsantrag zurueckgezogen") {
  return prisma.$transaction(async (tx) => {
    const request = await getMutableChangeRequest(tx, id, ["DRAFT", "PENDING"]);

    const updated = await tx.changeRequest.update({
      where: { id },
      data: {
        status: "CANCELLED",
        reviewedAt: new Date(),
        reviewComment: message,
      },
    });

    await createChangeRequestAudit(tx, {
      changeRequestId: id,
      actorId,
      action: "CANCELLED",
      beforeData: asInputJson(request.requestedSnapshot),
      afterData: asInputJson(updated.requestedSnapshot),
      message,
    });

    return updated;
  });
}

export async function markChangeRequestApplied(input: ApplyChangeRequestInput) {
  return prisma.$transaction(async (tx) => {
    await getMutableChangeRequest(tx, input.id, ["APPROVED"]);

    const updated = await tx.changeRequest.update({
      where: { id: input.id },
      data: {
        status: "APPLIED",
        appliedAt: new Date(),
        appliedById: input.actorId,
      },
    });

    await createChangeRequestAudit(tx, {
      changeRequestId: input.id,
      actorId: input.actorId,
      action: "APPLIED",
      beforeData: input.beforeData,
      afterData: input.afterData,
      message: input.message || "Aenderungsantrag angewendet",
    });

    return updated;
  });
}

export async function listChangeRequests(input: {
  tenantId: string;
  status?: ChangeRequestStatus;
  targetType?: ChangeRequestTargetType;
  targetId?: string;
  take?: number;
}) {
  return prisma.changeRequest.findMany({
    where: {
      tenantId: input.tenantId,
      ...(input.status ? { status: input.status } : {}),
      ...(input.targetType ? { targetType: input.targetType } : {}),
      ...(input.targetId ? { targetId: input.targetId } : {}),
    },
    include: {
      requestedBy: { select: { name: true, email: true } },
      reviewedBy: { select: { name: true, email: true } },
      appliedBy: { select: { name: true, email: true } },
      auditLogs: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          actor: { select: { name: true, email: true } },
        },
      },
    },
    orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
    take: input.take ?? 100,
  });
}

async function getMutableChangeRequest(
  tx: ChangeRequestTx,
  id: string,
  allowedStatuses: readonly ChangeRequestStatus[],
): Promise<ChangeRequest> {
  const request = await tx.changeRequest.findUnique({ where: { id } });

  if (!request) {
    throw new Error("change_request_not_found");
  }

  if (!allowedStatuses.includes(request.status)) {
    throw new Error(`change_request_status_${request.status.toLowerCase()}`);
  }

  return request;
}

function asInputJson(value: Prisma.JsonValue | null): Prisma.InputJsonValue | undefined {
  if (value === null) {
    return undefined;
  }

  return value as Prisma.InputJsonValue;
}

async function createChangeRequestAudit(
  tx: ChangeRequestTx,
  input: {
    changeRequestId: string;
    actorId?: string | null;
    action: ChangeRequestAuditAction;
    beforeData?: JsonInput;
    afterData?: JsonInput;
    message?: string | null;
  },
) {
  return tx.changeRequestAuditLog.create({
    data: {
      changeRequestId: input.changeRequestId,
      actorId: input.actorId ?? null,
      action: input.action,
      beforeData: input.beforeData ?? undefined,
      afterData: input.afterData ?? undefined,
      message: input.message ?? null,
    },
  });
}
