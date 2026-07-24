import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { $Enums, Prisma } from "@prisma/client";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { requireCompetitionTenantRoles } from "@/lib/server-permissions";

export const dynamic = "force-dynamic";

const DISCIPLINE_CODES = new Set<$Enums.DisciplineCode>(["RUN", "BENCH", "STOCK", "ROAD", "MTB"]);
const SUPERSEDED_DRAFT_BLOCKER = "Aelterer Draft fuer dasselbe offizielle Ergebnis; neuerer Draft wird verwendet.";

type PublishItem = {
  draftId: string;
  action: "CREATE" | "UPDATE" | "UNCHANGED" | "SKIP";
  executable: boolean;
  blockers: string[];
  disciplineCode: $Enums.DisciplineCode;
  startNumber: string | null;
  participantId: string | null;
  teamId: string | null;
  resultId: string | null;
  before: {
    rawValue: number | null;
    points: number | null;
    rank: number | null;
  } | null;
  after: {
    rawValue: number | null;
    rawValueText: string | null;
    points: number | null;
    rank: number | null;
    resultStatus: string | null;
  };
};

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isLegacyZeroPointTime(rawValueText: string | null) {
  if (!rawValueText) return false;
  const normalized = rawValueText.trim().replace(",", ".");
  return normalized === "99:99.99" || normalized === "99:99:99.99";
}

function getSnapshotResult(snapshot: unknown) {
  const record = asRecord(snapshot);
  const result = asRecord(record?.result);
  const classScoring = asRecord(record?.classScoring);

  return {
    rawValue: asNumber(result?.rawValue) ?? asNumber(result?.elapsedMs),
    rawValueText: typeof result?.rawValueText === "string"
      ? result.rawValueText
      : typeof result?.rawTimeText === "string"
        ? result.rawTimeText
        : null,
    resultStatus: typeof result?.status === "string" ? result.status : null,
    points: asNumber(classScoring?.points),
    rank: asNumber(classScoring?.rank),
  };
}

function normalizeExpectedZeroPointResult(result: ReturnType<typeof getSnapshotResult>) {
  if (result.rawValue !== null || !isLegacyZeroPointTime(result.rawValueText)) return result;
  return {
    ...result,
    resultStatus: "dnf",
    points: 0,
    rank: null,
  };
}

function validationErrorCodes(messages: unknown) {
  return asArray(messages)
    .map((message) => asRecord(message))
    .filter((message): message is Record<string, unknown> => Boolean(message))
    .filter((message) => message.severity === "error")
    .map((message) => typeof message.code === "string" ? message.code : null)
    .filter((code): code is string => Boolean(code));
}

function isExpectedZeroPointConflict(draft: { validationMessages: unknown }, after: ReturnType<typeof getSnapshotResult>) {
  if (!isLegacyZeroPointTime(after.rawValueText)) return false;
  const errorCodes = validationErrorCodes(draft.validationMessages);
  return errorCodes.length > 0 && errorCodes.every((code) => code === "invalid_time");
}

function valuesEqual(left: number | null, right: number | null) {
  if (left === null || right === null) return left === right;
  return Math.abs(left - right) < 0.000001;
}

function resultUnchanged(
  before: { rawValue: number | null; points: number | null; rank: number | null },
  after: { rawValue: number | null; points: number | null; rank: number | null },
) {
  return valuesEqual(before.rawValue, after.rawValue) && before.points === after.points && before.rank === after.rank;
}

function targetKeyFor(draft: { disciplineCode: $Enums.DisciplineCode; participantId: string | null }) {
  return draft.participantId ? `${draft.disciplineCode}:${draft.participantId}` : null;
}

function isBlockingPublish(message: string) {
  return message !== SUPERSEDED_DRAFT_BLOCKER;
}

async function buildPublishPreview(batchId: string, competitionId: string, tenantId: string) {
  const batch = await prisma.resultDataBatch.findFirst({
    where: {
      id: batchId,
      tenantId,
      competitionId,
    },
    select: {
      id: true,
      status: true,
      label: true,
      externalRef: true,
    },
  });

  if (!batch) return null;

  const drafts = await prisma.resultDraft.findMany({
    where: {
      batchId: batch.id,
      tenantId,
      competitionId,
    },
    orderBy: [
      { disciplineCode: "asc" },
      { startNumber: "asc" },
      { createdAt: "asc" },
    ],
  });

  const participantIds = [...new Set(drafts.map((draft) => draft.participantId).filter((id): id is string => Boolean(id)))];
  const publishableDraftByTarget = new Map<string, { id: string; createdAt: Date }>();
  const duplicateTargetKeys = new Set<string>();

  for (const draft of drafts) {
    const targetKey = targetKeyFor(draft);
    if (!targetKey) continue;
    const current = publishableDraftByTarget.get(targetKey);
    if (!current) {
      publishableDraftByTarget.set(targetKey, { id: draft.id, createdAt: draft.createdAt });
      continue;
    }
    duplicateTargetKeys.add(targetKey);
    if (draft.createdAt > current.createdAt || (draft.createdAt.getTime() === current.createdAt.getTime() && draft.id > current.id)) {
      publishableDraftByTarget.set(targetKey, { id: draft.id, createdAt: draft.createdAt });
    }
  }

  const existingResults = participantIds.length > 0
    ? await prisma.disciplineResult.findMany({
        where: {
          participantId: { in: participantIds },
          discipline: {
            competitionId,
          },
        },
        select: {
          id: true,
          rawValue: true,
          points: true,
          rank: true,
          participantId: true,
          discipline: {
            select: {
              code: true,
            },
          },
        },
      })
    : [];
  const resultByTarget = new Map(existingResults.map((result) => [`${result.discipline.code}:${result.participantId}`, result]));

  const items: PublishItem[] = drafts.map((draft) => {
    const after = normalizeExpectedZeroPointResult(getSnapshotResult(draft.proposedResultSnapshot));
    const blockers: string[] = [];
    const targetKey = targetKeyFor(draft);
    const existingResult = targetKey ? resultByTarget.get(targetKey) ?? null : null;
    const before = existingResult
      ? {
          rawValue: existingResult.rawValue,
          points: existingResult.points,
          rank: existingResult.rank,
        }
      : null;

    if (batch.status === "PUBLISHED" || batch.status === "DISCARDED") {
      blockers.push("Paketstatus erlaubt keine Publikation.");
    }
    if ((draft.status === "CONFLICT" || draft.conflictStatus === "CONFLICT") && !isExpectedZeroPointConflict(draft, after)) {
      blockers.push("Draft hat Konfliktstatus.");
    }
    if (draft.status === "REJECTED" || draft.status === "DISCARDED" || draft.status === "PUBLISHED") {
      blockers.push("Draft ist nicht mehr publizierbar.");
    }
    if (!draft.participantId) blockers.push("Teilnehmer-Zuordnung fehlt.");
    if (!DISCIPLINE_CODES.has(draft.disciplineCode)) blockers.push("Disziplin-Code ist ungueltig.");
    if (targetKey && duplicateTargetKeys.has(targetKey) && publishableDraftByTarget.get(targetKey)?.id !== draft.id) {
      blockers.push(SUPERSEDED_DRAFT_BLOCKER);
    }
    if (after.rawValue === null && after.resultStatus !== "dnf") blockers.push("Publizierbarer Wert fehlt.");

    const executable = blockers.every((blocker) => !isBlockingPublish(blocker));
    const action = !executable
      ? "SKIP"
      : blockers.includes(SUPERSEDED_DRAFT_BLOCKER)
        ? "SKIP"
      : before
        ? resultUnchanged(before, after) ? "UNCHANGED" : "UPDATE"
        : "CREATE";

    return {
      draftId: draft.id,
      action,
      executable,
      blockers,
      disciplineCode: draft.disciplineCode,
      startNumber: draft.startNumber,
      participantId: draft.participantId,
      teamId: draft.teamId,
      resultId: existingResult?.id ?? null,
      before,
      after,
    };
  });

  const counts = {
    drafts: items.length,
    create: items.filter((item) => item.action === "CREATE").length,
    update: items.filter((item) => item.action === "UPDATE").length,
    unchanged: items.filter((item) => item.action === "UNCHANGED").length,
    skipped: items.filter((item) => item.action === "SKIP").length,
    blockers: items.reduce((sum, item) => sum + item.blockers.filter(isBlockingPublish).length, 0),
  };

  return {
    batch,
    executable: counts.blockers === 0,
    counts,
    items,
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> },
) {
  try {
    const { batchId } = await params;
    const competitionId = request.nextUrl.searchParams.get("competitionId");
    const session = await getServerSession(authOptions);
    const auth = await requireCompetitionTenantRoles(session, ["ADMIN"], competitionId);
    if ("error" in auth) return auth.error;

    if (!competitionId) {
      return NextResponse.json({ error: "competitionId fehlt." }, { status: 400 });
    }

    const preview = await buildPublishPreview(batchId, competitionId, auth.tenantId);
    if (!preview) {
      return NextResponse.json({ error: "Ergebnis-Paket nicht gefunden." }, { status: 404 });
    }
    if (!preview.executable) {
      return NextResponse.json({
        error: "Publish durch Blocker gesperrt.",
        counts: preview.counts,
        items: preview.items,
      }, { status: 409 });
    }

    const publishableItems = preview.items.filter((item) => item.executable && item.action !== "SKIP");
    const writeItems = publishableItems.filter((item) => item.action === "CREATE" || item.action === "UPDATE");
    if (publishableItems.length === 0) {
      return NextResponse.json({ error: "Keine publizierbaren Drafts vorhanden." }, { status: 409 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const disciplines = await tx.discipline.findMany({
        where: {
          competitionId,
          code: { in: [...new Set(publishableItems.map((item) => item.disciplineCode))] },
        },
        select: {
          id: true,
          code: true,
        },
      });
      const disciplineIdByCode = new Map(disciplines.map((discipline) => [discipline.code, discipline.id]));
      const missingDisciplines = [...new Set(publishableItems.map((item) => item.disciplineCode))]
        .filter((code) => !disciplineIdByCode.has(code));
      if (missingDisciplines.length > 0) {
        throw new Error(`Disziplin fehlt: ${missingDisciplines.join(", ")}`);
      }

      const latestPublication = await tx.resultPublication.findFirst({
        where: { competitionId },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      const version = (latestPublication?.version ?? 0) + 1;
      const now = new Date();
      const resultIdByDraftId = new Map<string, string | null>();

      for (const item of writeItems) {
        if (!item.participantId) continue;
        const disciplineId = disciplineIdByCode.get(item.disciplineCode);
        if (!disciplineId) continue;
        const saved = await tx.disciplineResult.upsert({
          where: {
            disciplineId_participantId: {
              disciplineId,
              participantId: item.participantId,
            },
          },
          create: {
            disciplineId,
            participantId: item.participantId,
            rawValue: item.after.rawValue,
            points: item.after.points,
            rank: item.after.rank,
          },
          update: {
            rawValue: item.after.rawValue,
            points: item.after.points,
            rank: item.after.rank,
          },
          select: { id: true },
        });
        resultIdByDraftId.set(item.draftId, saved.id);
      }

      for (const item of publishableItems) {
        if (!resultIdByDraftId.has(item.draftId)) {
          resultIdByDraftId.set(item.draftId, item.resultId);
        }
      }

      const publication = await tx.resultPublication.create({
        data: {
          tenantId: auth.tenantId,
          competitionId,
          sourceBatchId: preview.batch.id,
          createdById: auth.user.id,
          version,
          label: preview.batch.label || preview.batch.externalRef || `Publish ${version}`,
          summary: jsonValue({
            counts: preview.counts,
            created: preview.counts.create,
            updated: preview.counts.update,
            unchanged: preview.counts.unchanged,
            skipped: preview.counts.skipped,
          }),
        },
        select: { id: true, version: true, publishedAt: true },
      });

      await tx.resultPublicationItem.createMany({
        data: publishableItems.map((item) => ({
          publicationId: publication.id,
          draftId: item.draftId,
          action: "UPSERT",
          disciplineCode: item.disciplineCode,
          participantId: item.participantId,
          teamId: item.teamId,
          startNumber: item.startNumber,
          resultId: resultIdByDraftId.get(item.draftId) ?? null,
          beforeData: item.before ? jsonValue(item.before) : undefined,
          afterData: jsonValue(item.after),
        })),
      });

      await tx.resultDraft.updateMany({
        where: {
          id: { in: publishableItems.map((item) => item.draftId) },
          tenantId: auth.tenantId,
          competitionId,
        },
        data: {
          status: "PUBLISHED",
          publishedAt: now,
        },
      });

      await tx.resultDataBatch.update({
        where: { id: preview.batch.id },
        data: {
          status: "PUBLISHED",
          publishedAt: now,
        },
      });

      await tx.auditEvent.create({
        data: {
          tenantId: auth.tenantId,
          competitionId,
          actorId: auth.user.id,
          action: "RESULT_STAGING_PUBLISHED",
          scopeType: "result-staging",
          scopeId: preview.batch.id,
          entityType: "ResultPublication",
          entityId: publication.id,
          afterData: jsonValue({
            batchId: preview.batch.id,
            publicationId: publication.id,
            version: publication.version,
            counts: preview.counts,
          }),
        },
      });

      return {
        publication,
        counts: preview.counts,
      };
    }, { timeout: 30_000 });

    return NextResponse.json({
      ok: true,
      publication: result.publication,
      counts: result.counts,
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Disziplin fehlt:")) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Failed to publish result staging batch:", error);
    return NextResponse.json({ error: "Ergebnis-Paket konnte nicht publiziert werden." }, { status: 500 });
  }
}
