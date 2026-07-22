import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { requireCompetitionTenantRoles } from "@/lib/server-permissions";

export const dynamic = "force-dynamic";

const APPLY_ACTION = "RESULT_STAGING_CORRECTION_APPLIED";
const REVERT_ACTION = "RESULT_STAGING_CORRECTION_REVERTED";
const SCOPE_TYPE = "result-staging-batch";
const DRAFT_FIELDS = new Set(["startNumber", "rawValueText", "resultStatus"]);
const RAW_RECORD_FIELDS = new Set(["startNumber", "rawValueText", "validationStatus"]);

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function stringValue(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function getDraftBeforeValue(field: string, draft: {
  startNumber: string | null;
  rawValueText: string | null;
  proposedResultSnapshot: Prisma.JsonValue | null;
}) {
  if (field === "startNumber") return draft.startNumber ?? "";
  if (field === "rawValueText") return draft.rawValueText ?? "";
  if (field === "resultStatus") {
    const snapshot = asRecord(draft.proposedResultSnapshot);
    const result = asRecord(snapshot?.result);
    return typeof result?.status === "string" ? result.status : "";
  }
  return "";
}

function getRawBeforeValue(field: string, record: {
  startNumber: string | null;
  rawValueText: string | null;
  validationStatus: string;
}) {
  if (field === "startNumber") return record.startNumber ?? "";
  if (field === "rawValueText") return record.rawValueText ?? "";
  if (field === "validationStatus") return record.validationStatus;
  return "";
}

export async function POST(
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

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const operation = stringValue(body.operation || "apply") || "apply";

    const batch = await prisma.resultDataBatch.findFirst({
      where: {
        id: batchId,
        tenantId: auth.tenantId,
        competitionId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!batch) {
      return NextResponse.json({ error: "Ergebnis-Paket nicht gefunden." }, { status: 404 });
    }
    if (batch.status === "PUBLISHED" || batch.status === "DISCARDED") {
      return NextResponse.json({ error: "Für publizierte oder verworfene Pakete sind Korrekturen gesperrt." }, { status: 409 });
    }

    if (operation === "revert") {
      const correctionId = stringValue(body.correctionId);
      if (!correctionId) {
        return NextResponse.json({ error: "correctionId fehlt." }, { status: 400 });
      }
      const correction = await prisma.auditEvent.findFirst({
        where: {
          id: correctionId,
          tenantId: auth.tenantId,
          competitionId,
          scopeType: SCOPE_TYPE,
          scopeId: batch.id,
          action: APPLY_ACTION,
        },
      });
      if (!correction) {
        return NextResponse.json({ error: "Korrektur nicht gefunden." }, { status: 404 });
      }
      const existingRevert = await prisma.auditEvent.findFirst({
        where: {
          tenantId: auth.tenantId,
          competitionId,
          scopeType: SCOPE_TYPE,
          scopeId: batch.id,
          action: REVERT_ACTION,
          afterData: {
            path: ["correctionId"],
            equals: correctionId,
          },
        },
        select: { id: true },
      });
      if (existingRevert) {
        return NextResponse.json({ error: "Korrektur ist bereits zurückgenommen." }, { status: 409 });
      }

      await prisma.auditEvent.create({
        data: {
          tenantId: auth.tenantId,
          competitionId,
          actorId: auth.user.id,
          action: REVERT_ACTION,
          scopeType: SCOPE_TYPE,
          scopeId: batch.id,
          entityType: "ResultStagingCorrection",
          entityId: correctionId,
          reason: stringValue(body.reason) || null,
          afterData: jsonValue({
            correctionId,
            revertedAt: new Date().toISOString(),
          }),
        },
      });

      return NextResponse.json({ ok: true, revertedCorrectionId: correctionId });
    }

    const targetType = stringValue(body.targetType);
    const targetId = stringValue(body.targetId);
    const field = stringValue(body.field);
    const afterValue = stringValue(body.value);
    const reason = stringValue(body.reason);

    if (!targetId || !field) {
      return NextResponse.json({ error: "targetId und field sind erforderlich." }, { status: 400 });
    }

    let beforeValue = "";
    if (targetType === "DRAFT") {
      if (!DRAFT_FIELDS.has(field)) {
        return NextResponse.json({ error: "Dieses Draft-Feld ist nicht für manuelle Korrekturen freigegeben." }, { status: 400 });
      }
      const draft = await prisma.resultDraft.findFirst({
        where: {
          id: targetId,
          batchId: batch.id,
          tenantId: auth.tenantId,
          competitionId,
        },
        select: {
          id: true,
          startNumber: true,
          rawValueText: true,
          proposedResultSnapshot: true,
        },
      });
      if (!draft) {
        return NextResponse.json({ error: "Draft nicht gefunden." }, { status: 404 });
      }
      beforeValue = getDraftBeforeValue(field, draft);
    } else if (targetType === "RAW_RECORD") {
      if (!RAW_RECORD_FIELDS.has(field)) {
        return NextResponse.json({ error: "Dieses Raw-Record-Feld ist nicht für manuelle Korrekturen freigegeben." }, { status: 400 });
      }
      const record = await prisma.resultRawRecord.findFirst({
        where: {
          id: targetId,
          batchId: batch.id,
          tenantId: auth.tenantId,
          competitionId,
        },
        select: {
          id: true,
          startNumber: true,
          rawValueText: true,
          validationStatus: true,
        },
      });
      if (!record) {
        return NextResponse.json({ error: "Raw Record nicht gefunden." }, { status: 404 });
      }
      beforeValue = getRawBeforeValue(field, record);
    } else {
      return NextResponse.json({ error: "targetType muss DRAFT oder RAW_RECORD sein." }, { status: 400 });
    }

    if (beforeValue === afterValue) {
      return NextResponse.json({ error: "Der neue Wert entspricht dem aktuellen Wert." }, { status: 400 });
    }

    const correction = await prisma.auditEvent.create({
      data: {
        tenantId: auth.tenantId,
        competitionId,
        actorId: auth.user.id,
        action: APPLY_ACTION,
        scopeType: SCOPE_TYPE,
        scopeId: batch.id,
        entityType: targetType === "DRAFT" ? "ResultDraft" : "ResultRawRecord",
        entityId: targetId,
        reason: reason || null,
        beforeData: jsonValue({
          targetType,
          targetId,
          field,
          value: beforeValue,
        }),
        afterData: jsonValue({
          targetType,
          targetId,
          field,
          value: afterValue,
        }),
      },
    });

    return NextResponse.json({ ok: true, correctionId: correction.id });
  } catch (error) {
    console.error("Failed to write result staging correction:", error);
    return NextResponse.json({ error: "Korrektur konnte nicht gespeichert werden." }, { status: 500 });
  }
}
