import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  RESULT_BATCH_STATUS_LABELS,
  RESULT_DRAFT_STATUS_LABELS,
  RESULT_PURPOSE_LABELS,
  RESULT_SOURCE_LABELS,
} from "@/lib/result-staging";
import { prisma } from "@/lib/prisma";
import { requireCompetitionTenantRoles } from "@/lib/server-permissions";

export const dynamic = "force-dynamic";

const APPLY_CORRECTION_ACTION = "RESULT_STAGING_CORRECTION_APPLIED";
const REVERT_CORRECTION_ACTION = "RESULT_STAGING_CORRECTION_REVERTED";
const CORRECTION_SCOPE_TYPE = "result-staging-batch";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getSnapshot(record: Record<string, unknown> | null) {
  return asRecord(record?.proposedResultSnapshot);
}

function getResultPreview(record: Record<string, unknown> | null) {
  const snapshot = getSnapshot(record);
  const classScoring = asRecord(snapshot?.classScoring);
  const overallGenderScoring = asRecord(snapshot?.overallGenderScoring);
  const result = asRecord(snapshot?.result);

  return {
    resultStatus: typeof result?.status === "string" ? result.status : null,
    classPoints: asNumber(classScoring?.points),
    classRank: asNumber(classScoring?.rank),
    classLabel: typeof classScoring?.classLabel === "string" ? classScoring.classLabel : null,
    overallGroup: typeof overallGenderScoring?.group === "string" ? overallGenderScoring.group : null,
    overallGenderPoints: asNumber(overallGenderScoring?.points),
    overallGenderRank: asNumber(overallGenderScoring?.rank),
  };
}

function getCorrectionValue(corrections: ResultCorrection[], targetType: string, targetId: string, field: string) {
  const correction = corrections.findLast((entry) => (
    entry.targetType === targetType &&
    entry.targetId === targetId &&
    entry.field === field &&
    entry.active
  ));
  return correction?.afterValue ?? null;
}

type ResultCorrection = {
  id: string;
  targetType: string;
  targetId: string;
  field: string;
  beforeValue: string;
  afterValue: string;
  reason: string | null;
  active: boolean;
  createdAt: Date;
  createdBy: string | null;
  revertedAt: Date | null;
};

function buildCorrections(events: Array<{
  id: string;
  action: string;
  reason: string | null;
  beforeData: unknown;
  afterData: unknown;
  createdAt: Date;
  actor: { name: string | null; email: string | null } | null;
}>) {
  const revertedIds = new Set<string>();
  for (const event of events) {
    if (event.action !== REVERT_CORRECTION_ACTION) continue;
    const afterData = asRecord(event.afterData);
    const correctionId = typeof afterData?.correctionId === "string" ? afterData.correctionId : null;
    if (correctionId) revertedIds.add(correctionId);
  }

  return events
    .filter((event) => event.action === APPLY_CORRECTION_ACTION)
    .map((event) => {
      const beforeData = asRecord(event.beforeData);
      const afterData = asRecord(event.afterData);
      const targetType = typeof afterData?.targetType === "string" ? afterData.targetType : "";
      const targetId = typeof afterData?.targetId === "string" ? afterData.targetId : "";
      const field = typeof afterData?.field === "string" ? afterData.field : "";
      const beforeValue = typeof beforeData?.value === "string" ? beforeData.value : "";
      const afterValue = typeof afterData?.value === "string" ? afterData.value : "";
      const revertedAt = events.find((candidate) => {
        if (candidate.action !== REVERT_CORRECTION_ACTION) return false;
        const candidateAfterData = asRecord(candidate.afterData);
        return candidateAfterData?.correctionId === event.id;
      })?.createdAt ?? null;

      return {
        id: event.id,
        targetType,
        targetId,
        field,
        beforeValue,
        afterValue,
        reason: event.reason,
        active: !revertedIds.has(event.id),
        createdAt: event.createdAt,
        createdBy: event.actor?.name || event.actor?.email || null,
        revertedAt,
      };
    })
    .filter((correction) => correction.targetType && correction.targetId && correction.field);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> },
) {
  try {
    const { batchId } = await params;
    const competitionId = request.nextUrl.searchParams.get("competitionId");
    const session = await getServerSession(authOptions);
    const auth = await requireCompetitionTenantRoles(session, ["ADMIN", "MODERATOR"], competitionId);
    if ("error" in auth) return auth.error;

    if (!competitionId) {
      return NextResponse.json({ error: "competitionId fehlt." }, { status: 400 });
    }

    const batch = await prisma.resultDataBatch.findFirst({
      where: {
        id: batchId,
        tenantId: auth.tenantId,
        competitionId,
      },
      include: {
        _count: {
          select: {
            rawRecords: true,
            drafts: true,
            publications: true,
            resetSnapshots: true,
          },
        },
      },
    });

    if (!batch) {
      return NextResponse.json({ error: "Ergebnis-Paket nicht gefunden." }, { status: 404 });
    }

    const [rawRecords, drafts, correctionEvents] = await Promise.all([
      prisma.resultRawRecord.findMany({
        where: {
          batchId: batch.id,
          tenantId: auth.tenantId,
          competitionId,
        },
        orderBy: [
          { startNumber: "asc" },
          { createdAt: "asc" },
        ],
        take: 500,
      }),
      prisma.resultDraft.findMany({
        where: {
          batchId: batch.id,
          tenantId: auth.tenantId,
          competitionId,
        },
        orderBy: [
          { startNumber: "asc" },
          { createdAt: "asc" },
        ],
        take: 250,
        include: {
          sourceRawRecord: {
            select: {
              id: true,
              rowKey: true,
              validationStatus: true,
              validationMessages: true,
              payload: true,
            },
          },
        },
      }),
      prisma.auditEvent.findMany({
        where: {
          tenantId: auth.tenantId,
          competitionId,
          scopeType: CORRECTION_SCOPE_TYPE,
          scopeId: batch.id,
          action: { in: [APPLY_CORRECTION_ACTION, REVERT_CORRECTION_ACTION] },
        },
        orderBy: { createdAt: "asc" },
        include: {
          actor: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      }),
    ]);
    const corrections = buildCorrections(correctionEvents);

    const teamIds = [...new Set(drafts.map((draft) => draft.teamId).filter((id): id is string => Boolean(id)))];
    const participantIds = [...new Set(drafts.map((draft) => draft.participantId).filter((id): id is string => Boolean(id)))];

    const [teams, participants] = await Promise.all([
      teamIds.length > 0
        ? prisma.team.findMany({
            where: {
              id: { in: teamIds },
              competitionId,
              competition: { tenantId: auth.tenantId },
            },
            select: {
              id: true,
              name: true,
              startNumber: true,
              classificationCode: true,
            },
          })
        : Promise.resolve([]),
      participantIds.length > 0
        ? prisma.participant.findMany({
            where: {
              id: { in: participantIds },
              team: {
                competitionId,
                competition: { tenantId: auth.tenantId },
              },
            },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              disciplineCode: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const teamById = new Map(teams.map((team) => [team.id, team]));
    const participantById = new Map(participants.map((participant) => [participant.id, participant]));

    return NextResponse.json({
      batch: {
        id: batch.id,
        source: batch.source,
        sourceLabel: RESULT_SOURCE_LABELS[batch.source],
        purpose: batch.purpose,
        purposeLabel: RESULT_PURPOSE_LABELS[batch.purpose],
        status: batch.status,
        statusLabel: RESULT_BATCH_STATUS_LABELS[batch.status],
        label: batch.label,
        externalRef: batch.externalRef,
        sourceVersion: batch.sourceVersion,
        summary: batch.summary,
        validationSummary: batch.validationSummary,
        stagedAt: batch.stagedAt,
        createdAt: batch.createdAt,
        counts: {
          rawRecords: batch._count.rawRecords,
          drafts: batch._count.drafts,
          publications: batch._count.publications,
          resetSnapshots: batch._count.resetSnapshots,
        },
      },
      rawRecords: rawRecords.map((record) => {
        const payload = asRecord(record.payload);
        const fields = asRecord(payload?.fields);
        const rowNumber = asNumber(payload?.rowNumber);
        const effectiveStartNumber = getCorrectionValue(corrections, "RAW_RECORD", record.id, "startNumber") ?? record.startNumber;
        const effectiveRawValueText = getCorrectionValue(corrections, "RAW_RECORD", record.id, "rawValueText") ?? record.rawValueText;
        const effectiveValidationStatus = getCorrectionValue(corrections, "RAW_RECORD", record.id, "validationStatus") ?? record.validationStatus;
        return {
          id: record.id,
          rowKey: record.rowKey,
          disciplineCode: record.disciplineCode,
          startNumber: record.startNumber,
          effectiveStartNumber,
          participantId: record.participantId,
          teamId: record.teamId,
          rawValue: record.rawValue,
          rawValueText: record.rawValueText,
          effectiveRawValueText,
          recordedAt: record.recordedAt,
          validationStatus: record.validationStatus,
          effectiveValidationStatus,
          validationMessages: Array.isArray(record.validationMessages) ? record.validationMessages : [],
          rowNumber,
          fields,
          createdAt: record.createdAt,
        };
      }),
      drafts: drafts.map((draft) => {
        const proposedResultSnapshot = asRecord(draft.proposedResultSnapshot);
        const validationMessages = Array.isArray(draft.validationMessages) ? draft.validationMessages : [];
        const rawPayload = asRecord(draft.sourceRawRecord?.payload);
        const sourceFields = asRecord(rawPayload?.fields);
        const sourceRowNumber = asNumber(rawPayload?.rowNumber);
        const team = draft.teamId ? teamById.get(draft.teamId) ?? null : null;
        const participant = draft.participantId ? participantById.get(draft.participantId) ?? null : null;
        const effectiveStartNumber = getCorrectionValue(corrections, "DRAFT", draft.id, "startNumber") ?? draft.startNumber;
        const effectiveRawValueText = getCorrectionValue(corrections, "DRAFT", draft.id, "rawValueText") ?? draft.rawValueText;
        const effectiveResultStatus = getCorrectionValue(corrections, "DRAFT", draft.id, "resultStatus");

        return {
          id: draft.id,
          status: draft.status,
          statusLabel: RESULT_DRAFT_STATUS_LABELS[draft.status],
          conflictStatus: draft.conflictStatus,
          disciplineCode: draft.disciplineCode,
          startNumber: draft.startNumber,
          effectiveStartNumber,
          rawValueText: draft.rawValueText,
          effectiveRawValueText,
          netElapsedMs: draft.netElapsedMs,
          validationMessages,
          proposedResultSnapshot,
          preview: {
            ...getResultPreview({ proposedResultSnapshot }),
            effectiveResultStatus: effectiveResultStatus ?? getResultPreview({ proposedResultSnapshot }).resultStatus,
          },
          sourceRawRecord: draft.sourceRawRecord
            ? {
                id: draft.sourceRawRecord.id,
                rowKey: draft.sourceRawRecord.rowKey,
                rowNumber: sourceRowNumber,
                validationStatus: draft.sourceRawRecord.validationStatus,
                validationMessages: Array.isArray(draft.sourceRawRecord.validationMessages)
                  ? draft.sourceRawRecord.validationMessages
                  : [],
                fields: sourceFields,
              }
            : null,
          team,
          participant,
          createdAt: draft.createdAt,
        };
      }),
      corrections,
    });
  } catch (error) {
    console.error("Failed to load result staging batch details:", error);
    return NextResponse.json({ error: "Ergebnis-Paketdetails konnten nicht geladen werden." }, { status: 500 });
  }
}
