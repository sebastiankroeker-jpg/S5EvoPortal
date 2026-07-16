import type { $Enums, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { RESULT_RESET_SCOPE_LABELS, canDiscardResultBatch, requiresResultResetSnapshot } from "@/lib/result-staging";

type ResultResetScope = $Enums.ResultResetScope;
type DisciplineCode = $Enums.DisciplineCode;

export type ResultResetFilterInput = {
  batchId?: string | null;
  publicationId?: string | null;
  disciplineCode?: DisciplineCode | null;
  participantId?: string | null;
  startNumber?: string | null;
};

export type ResultResetPreview = {
  mode: "PREVIEW";
  destructive: false;
  competition: {
    id: string;
    name: string;
    year: number;
    status: string;
  };
  scope: ResultResetScope;
  scopeLabel: string;
  scopeEntity: Record<string, unknown> | null;
  filter: Required<ResultResetFilterInput>;
  counts: Record<string, number>;
  warnings: string[];
  blockers: string[];
  executable: boolean;
  expectedConfirmationText: string;
  requiresSnapshotBeforeExecution: boolean;
};

type ResultResetExecutionInput = {
  tenantId: string;
  competitionId?: string | null;
  actorId?: string | null;
  scope: ResultResetScope;
  filter: ResultResetFilterInput;
  reason: string;
  confirmationText?: string | null;
};

type ResultResetPreviewInput = {
  tenantId: string;
  competitionId?: string | null;
  scope: ResultResetScope;
  filter: ResultResetFilterInput;
};

const EXECUTABLE_SCOPES = new Set<ResultResetScope>(["RAW_BATCH", "DRAFTS", "TEST_DATA"]);
const TEST_PURPOSES: $Enums.ResultDataPurpose[] = ["PROD_TEST", "DRY_RUN"];

function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function normalizeFilter(filter: ResultResetFilterInput): Required<ResultResetFilterInput> {
  return {
    batchId: filter.batchId || null,
    publicationId: filter.publicationId || null,
    disciplineCode: filter.disciplineCode || null,
    participantId: filter.participantId || null,
    startNumber: filter.startNumber || null,
  };
}

function buildExpectedConfirmationText(scope: ResultResetScope, competitionName: string) {
  return `${RESULT_RESET_SCOPE_LABELS[scope]} zuruecksetzen: ${competitionName}`;
}

async function resolveCompetition(
  client: Prisma.TransactionClient,
  tenantId: string,
  competitionId?: string | null,
) {
  if (competitionId) {
    return client.competition.findFirst({
      where: { id: competitionId, tenantId },
      select: { id: true, name: true, year: true, status: true },
    });
  }

  return client.competition.findFirst({
    where: { tenantId },
    orderBy: { year: "desc" },
    select: { id: true, name: true, year: true, status: true },
  });
}

function baseFilter(tenantId: string, competitionId: string) {
  return { tenantId, competitionId };
}

function draftWhere(
  tenantId: string,
  competitionId: string,
  filter: Required<ResultResetFilterInput>,
): Prisma.ResultDraftWhereInput {
  return {
    ...baseFilter(tenantId, competitionId),
    ...(filter.batchId ? { batchId: filter.batchId } : {}),
    ...(filter.disciplineCode ? { disciplineCode: filter.disciplineCode } : {}),
    ...(filter.participantId ? { participantId: filter.participantId } : {}),
    ...(filter.startNumber ? { startNumber: filter.startNumber } : {}),
  };
}

function testBatchWhere(tenantId: string, competitionId: string): Prisma.ResultDataBatchWhereInput {
  return {
    ...baseFilter(tenantId, competitionId),
    purpose: { in: TEST_PURPOSES },
  };
}

async function loadPreview(
  client: Prisma.TransactionClient,
  tenantId: string,
  competitionId: string,
  scope: ResultResetScope,
  filter: Required<ResultResetFilterInput>,
) {
  const base = baseFilter(tenantId, competitionId);
  const warnings: string[] = [];
  const blockers: string[] = [];
  let counts: Record<string, number> = {};
  let scopeEntity: Record<string, unknown> | null = null;

  if (scope === "RAW_BATCH") {
    if (!filter.batchId) {
      blockers.push("batchId ist fuer RAW_BATCH erforderlich.");
    } else {
      const batch = await client.resultDataBatch.findFirst({
        where: { ...base, id: filter.batchId },
        select: { id: true, source: true, purpose: true, status: true, label: true },
      });
      if (!batch) {
        blockers.push("Batch nicht gefunden.");
      } else {
        scopeEntity = batch;
        const [rawRecords, drafts, publications, publicationItems, resetSnapshots] = await Promise.all([
          client.resultRawRecord.count({ where: { ...base, batchId: filter.batchId } }),
          client.resultDraft.count({ where: { ...base, batchId: filter.batchId } }),
          client.resultPublication.count({ where: { ...base, sourceBatchId: filter.batchId } }),
          client.resultPublicationItem.count({ where: { publication: { ...base, sourceBatchId: filter.batchId } } }),
          client.resultResetSnapshot.count({ where: { ...base, batchId: filter.batchId } }),
        ]);
        counts = { rawRecords, drafts, publications, publicationItems, resetSnapshotsRetained: resetSnapshots };
        if (!canDiscardResultBatch(batch.status)) blockers.push(`Batch-Status ${batch.status} ist nicht loeschbar.`);
        if (publications > 0 || publicationItems > 0) blockers.push("Batch ist mit Publikationen verbunden.");
      }
    }
  }

  if (scope === "DRAFTS") {
    const where = draftWhere(tenantId, competitionId, filter);
    const [drafts, approvedDrafts, publishedDrafts, publicationItems] = await Promise.all([
      client.resultDraft.count({ where }),
      client.resultDraft.count({ where: { ...where, status: "APPROVED" } }),
      client.resultDraft.count({ where: { ...where, status: "PUBLISHED" } }),
      client.resultPublicationItem.count({ where: { draft: where } }),
    ]);
    counts = { drafts, approvedDrafts, publishedDrafts, publicationItems };
    if (!filter.batchId && !filter.disciplineCode && !filter.participantId && !filter.startNumber) {
      warnings.push("Draft-Reset ohne Filter betrifft alle Drafts des aktiven Wettkampfs.");
    }
    if (publishedDrafts > 0 || publicationItems > 0) blockers.push("Ein Teil der Drafts ist bereits publiziert oder referenziert.");
  }

  if (scope === "PUBLICATION") {
    if (!filter.publicationId) {
      blockers.push("publicationId ist fuer PUBLICATION erforderlich.");
    } else {
      const publication = await client.resultPublication.findFirst({
        where: { ...base, id: filter.publicationId },
        select: { id: true, version: true, status: true, label: true, publishedAt: true },
      });
      if (!publication) {
        blockers.push("Publikation nicht gefunden.");
      } else {
        scopeEntity = publication;
        const items = await client.resultPublicationItem.count({ where: { publicationId: filter.publicationId } });
        counts = { publications: 1, publicationItems: items };
      }
    }
    blockers.push("Publikations-Reset ist in V1 noch nicht freigeschaltet.");
  }

  if (scope === "OFFICIAL_RESULTS") {
    const officialResults = await client.disciplineResult.count({
      where: {
        participant: {
          team: {
            competition: {
              id: competitionId,
              tenantId,
            },
          },
          ...(filter.participantId ? { id: filter.participantId } : {}),
          ...(filter.startNumber ? { startNumber: filter.startNumber } : {}),
        },
        ...(filter.disciplineCode ? { discipline: { code: filter.disciplineCode } } : {}),
      },
    });
    counts = { officialResults };
    blockers.push("Official-Results-Reset ist in V1 noch nicht freigeschaltet.");
  }

  if (scope === "TEST_DATA") {
    const where = testBatchWhere(tenantId, competitionId);
    const [batches, rawRecords, drafts, publications, publicationItems, resetSnapshots] = await Promise.all([
      client.resultDataBatch.count({ where }),
      client.resultRawRecord.count({ where: { ...base, batch: { purpose: { in: TEST_PURPOSES } } } }),
      client.resultDraft.count({ where: { ...base, batch: { purpose: { in: TEST_PURPOSES } } } }),
      client.resultPublication.count({ where: { ...base, sourceBatch: { purpose: { in: TEST_PURPOSES } } } }),
      client.resultPublicationItem.count({ where: { publication: { ...base, sourceBatch: { purpose: { in: TEST_PURPOSES } } } } }),
      client.resultResetSnapshot.count({ where: { ...base, batch: { purpose: { in: TEST_PURPOSES } } } }),
    ]);
    counts = { batches, rawRecords, drafts, publications, publicationItems, resetSnapshotsRetained: resetSnapshots };
    if (publications > 0 || publicationItems > 0) blockers.push("Testdaten sind mit Publikationen verbunden.");
  }

  if (!EXECUTABLE_SCOPES.has(scope)) {
    warnings.push("Dieser Scope ist nur als Preview sichtbar.");
  }

  return { counts, warnings, blockers, scopeEntity };
}

export async function previewResultReset(input: ResultResetPreviewInput): Promise<ResultResetPreview> {
  const filter = normalizeFilter(input.filter);
  const competition = await resolveCompetition(prisma, input.tenantId, input.competitionId);
  if (!competition) throw new Error("competition_not_found");

  const preview = await loadPreview(prisma, input.tenantId, competition.id, input.scope, filter);
  return {
    mode: "PREVIEW",
    destructive: false,
    competition,
    scope: input.scope,
    scopeLabel: RESULT_RESET_SCOPE_LABELS[input.scope],
    scopeEntity: preview.scopeEntity,
    filter,
    counts: preview.counts,
    warnings: preview.warnings,
    blockers: preview.blockers,
    executable: EXECUTABLE_SCOPES.has(input.scope) && preview.blockers.length === 0,
    expectedConfirmationText: buildExpectedConfirmationText(input.scope, competition.name),
    requiresSnapshotBeforeExecution: requiresResultResetSnapshot(input.scope),
  };
}

async function loadSnapshotRows(
  client: Prisma.TransactionClient,
  tenantId: string,
  competitionId: string,
  scope: ResultResetScope,
  filter: Required<ResultResetFilterInput>,
) {
  const base = baseFilter(tenantId, competitionId);

  if (scope === "RAW_BATCH" && filter.batchId) {
    const [batch, rawRecords, drafts] = await Promise.all([
      client.resultDataBatch.findFirst({ where: { ...base, id: filter.batchId } }),
      client.resultRawRecord.findMany({ where: { ...base, batchId: filter.batchId }, orderBy: { createdAt: "asc" } }),
      client.resultDraft.findMany({ where: { ...base, batchId: filter.batchId }, orderBy: { createdAt: "asc" } }),
    ]);
    return { batch, rawRecords, drafts };
  }

  if (scope === "DRAFTS") {
    const drafts = await client.resultDraft.findMany({
      where: draftWhere(tenantId, competitionId, filter),
      orderBy: { createdAt: "asc" },
    });
    return { drafts };
  }

  if (scope === "TEST_DATA") {
    const [batches, rawRecords, drafts] = await Promise.all([
      client.resultDataBatch.findMany({ where: testBatchWhere(tenantId, competitionId), orderBy: { createdAt: "asc" } }),
      client.resultRawRecord.findMany({
        where: { ...base, batch: { purpose: { in: TEST_PURPOSES } } },
        orderBy: { createdAt: "asc" },
      }),
      client.resultDraft.findMany({
        where: { ...base, batch: { purpose: { in: TEST_PURPOSES } } },
        orderBy: { createdAt: "asc" },
      }),
    ]);
    return { batches, rawRecords, drafts };
  }

  return {};
}

export async function executeResultReset(input: ResultResetExecutionInput) {
  const reason = input.reason.trim();
  if (reason.length < 10) throw new Error("reset_reason_required");

  return prisma.$transaction(async (tx) => {
    const filter = normalizeFilter(input.filter);
    const competition = await resolveCompetition(tx, input.tenantId, input.competitionId);
    if (!competition) throw new Error("competition_not_found");

    const previewData = await loadPreview(tx, input.tenantId, competition.id, input.scope, filter);
    const expectedConfirmationText = buildExpectedConfirmationText(input.scope, competition.name);
    if (input.confirmationText !== expectedConfirmationText) throw new Error("confirmation_mismatch");
    if (!EXECUTABLE_SCOPES.has(input.scope)) throw new Error("scope_not_executable");
    if (previewData.blockers.length > 0) throw new Error("reset_blocked");

    const preview: ResultResetPreview = {
      mode: "PREVIEW",
      destructive: false,
      competition,
      scope: input.scope,
      scopeLabel: RESULT_RESET_SCOPE_LABELS[input.scope],
      scopeEntity: previewData.scopeEntity,
      filter,
      counts: previewData.counts,
      warnings: previewData.warnings,
      blockers: previewData.blockers,
      executable: true,
      expectedConfirmationText,
      requiresSnapshotBeforeExecution: requiresResultResetSnapshot(input.scope),
    };

    const snapshotRows = await loadSnapshotRows(tx, input.tenantId, competition.id, input.scope, filter);
    const snapshot = await tx.resultResetSnapshot.create({
      data: {
        scope: input.scope,
        mode: "EXECUTED",
        reason,
        scopeFilter: asJson(filter),
        summary: asJson({
          counts: preview.counts,
          warnings: preview.warnings,
          blockers: preview.blockers,
        }),
        snapshot: asJson({
          capturedAt: new Date().toISOString(),
          scope: input.scope,
          scopeLabel: preview.scopeLabel,
          competition,
          filter,
          ...snapshotRows,
        }),
        executedAt: new Date(),
        tenantId: input.tenantId,
        competitionId: competition.id,
        batchId: filter.batchId,
        publicationId: filter.publicationId,
        createdById: input.actorId || null,
      },
    });

    let deletedCounts: Record<string, number> = {};
    if (input.scope === "RAW_BATCH" && filter.batchId) {
      const deleted = await tx.resultDataBatch.deleteMany({
        where: { ...baseFilter(input.tenantId, competition.id), id: filter.batchId },
      });
      deletedCounts = { batches: deleted.count, rawRecords: preview.counts.rawRecords || 0, drafts: preview.counts.drafts || 0 };
    }

    if (input.scope === "DRAFTS") {
      const deleted = await tx.resultDraft.deleteMany({
        where: draftWhere(input.tenantId, competition.id, filter),
      });
      deletedCounts = { drafts: deleted.count };
    }

    if (input.scope === "TEST_DATA") {
      const deleted = await tx.resultDataBatch.deleteMany({
        where: testBatchWhere(input.tenantId, competition.id),
      });
      deletedCounts = {
        batches: deleted.count,
        rawRecords: preview.counts.rawRecords || 0,
        drafts: preview.counts.drafts || 0,
      };
    }

    await tx.auditEvent.create({
      data: {
        action: "RESULT_STAGING_RESET_EXECUTED",
        scopeType: "result-staging",
        scopeId: input.scope,
        entityType: "ResultResetSnapshot",
        entityId: snapshot.id,
        reason,
        beforeData: asJson(preview),
        afterData: asJson({ deletedCounts }),
        meta: asJson({
          snapshotId: snapshot.id,
          scope: input.scope,
          filter,
        }),
        tenantId: input.tenantId,
        competitionId: competition.id,
        actorId: input.actorId || null,
      },
    });

    return {
      success: true,
      mode: "EXECUTED",
      competition,
      scope: input.scope,
      scopeLabel: RESULT_RESET_SCOPE_LABELS[input.scope],
      filter,
      counts: preview.counts,
      deletedCounts,
      warnings: preview.warnings,
      snapshotId: snapshot.id,
    };
  });
}
