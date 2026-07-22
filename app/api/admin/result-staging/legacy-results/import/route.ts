import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { $Enums, Prisma } from "@prisma/client";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  parseLegacyResultCsv,
  type LegacyRawResultRecord,
  type LegacyResultDraftPreview,
  type LegacyResultValidationMessage,
} from "@/lib/legacy-result-import";
import { prisma } from "@/lib/prisma";
import { requireCompetitionTenantRoles } from "@/lib/server-permissions";

export const dynamic = "force-dynamic";

type LegacyResultImportBody = {
  competitionId?: unknown;
  csv?: unknown;
  delimiter?: unknown;
  headerRow?: unknown;
  dryRun?: unknown;
  label?: unknown;
};

type StarterMatch = {
  teamId: string | null;
  participantId: string | null;
  messages: LegacyResultValidationMessage[];
};

function parseHeaderRow(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.max(1, Math.floor(value));
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function hasError(messages: LegacyResultValidationMessage[]) {
  return messages.some((message) => message.severity === "error");
}

function validationStatusFor(messages: LegacyResultValidationMessage[]): $Enums.ResultValidationStatus {
  if (messages.some((message) => message.severity === "error")) return "ERROR";
  if (messages.length > 0) return "WARNING";
  return "PENDING";
}

function draftStatusFor(messages: LegacyResultValidationMessage[]): $Enums.ResultDraftStatus {
  return hasError(messages) ? "CONFLICT" : "DRAFT";
}

async function buildStarterMatches(competitionId: string, tenantId: string, records: LegacyRawResultRecord[]) {
  const startNumbers = [...new Set(records.map((record) => record.startNumber).filter((value): value is string => Boolean(value)))];
  if (startNumbers.length === 0) return new Map<string, StarterMatch>();

  const teams = await prisma.team.findMany({
    where: {
      competitionId,
      deletedAt: null,
      startNumber: { in: startNumbers },
      competition: { tenantId },
    },
    select: {
      id: true,
      startNumber: true,
      participants: {
        where: { deletedAt: null },
        select: { id: true, disciplineCode: true },
      },
    },
  });

  const teamsByStartNumber = new Map<string, typeof teams>();
  for (const team of teams) {
    if (!team.startNumber) continue;
    const existing = teamsByStartNumber.get(team.startNumber) || [];
    existing.push(team);
    teamsByStartNumber.set(team.startNumber, existing);
  }

  const matches = new Map<string, StarterMatch>();
  const recordKeys = new Set(
    records
      .filter((record) => record.startNumber && record.disciplineCode)
      .map((record) => `${record.startNumber}:${record.disciplineCode}`),
  );

  for (const key of recordKeys) {
    const [startNumber, disciplineCode] = key.split(":") as [string, $Enums.DisciplineCode];
    const candidates = teamsByStartNumber.get(startNumber) || [];
    if (candidates.length === 0) {
      matches.set(key, {
        teamId: null,
        participantId: null,
        messages: [{ code: "unmatched_start_number", severity: "error" }],
      });
      continue;
    }

    if (candidates.length > 1) {
      matches.set(key, {
        teamId: null,
        participantId: null,
        messages: [{ code: "ambiguous_start_number", severity: "error" }],
      });
      continue;
    }

    const [team] = candidates;
    const participants = team.participants.filter((participant) => participant.disciplineCode === disciplineCode);
    if (participants.length === 0) {
      matches.set(key, {
        teamId: team.id,
        participantId: null,
        messages: [{ code: "missing_discipline_participant", severity: "error" }],
      });
      continue;
    }

    if (participants.length > 1) {
      matches.set(key, {
        teamId: team.id,
        participantId: null,
        messages: [{ code: "ambiguous_discipline_participant", severity: "error" }],
      });
      continue;
    }

    matches.set(key, {
      teamId: team.id,
      participantId: participants[0].id,
      messages: [],
    });
  }

  return matches;
}

function matchKey(record: Pick<LegacyRawResultRecord | LegacyResultDraftPreview, "startNumber" | "disciplineCode">) {
  return record.startNumber && record.disciplineCode ? `${record.startNumber}:${record.disciplineCode}` : null;
}

function mergeMessages(recordMessages: LegacyResultValidationMessage[], match: StarterMatch | undefined) {
  return [...recordMessages, ...(match?.messages ?? [])];
}

function buildProposedResultSnapshot(draft: LegacyResultDraftPreview) {
  return {
    source: "LEGACY_RESULT_CSV_V2",
    disciplineCode: draft.disciplineCode,
    startNumber: draft.startNumber,
    result: {
      rawValue: draft.rawValue,
      rawValueText: draft.rawValueText,
      status: draft.resultStatus,
    },
    classScoring: {
      legacyClassId: draft.legacyClassId,
      points: draft.classPoints,
      rank: draft.classRank,
    },
    overallGenderScoring: {
      points: draft.overallGenderPoints,
      rank: draft.overallGenderRank,
    },
    legacy: {
      participantId: draft.legacyParticipantId,
      sourceRowNumbers: draft.sourceRowNumbers,
      details: draft.details,
    },
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as LegacyResultImportBody | null;
    if (!body) {
      return NextResponse.json({ error: "Ungueltiger Request-Body." }, { status: 400 });
    }

    const competitionId = typeof body.competitionId === "string" ? body.competitionId.trim() : "";
    const csv = typeof body.csv === "string" ? body.csv : "";
    const delimiter = typeof body.delimiter === "string" && body.delimiter.length === 1 ? body.delimiter : ";";
    const headerRow = parseHeaderRow(body.headerRow);
    const dryRun = body.dryRun !== false;
    const label = typeof body.label === "string" && body.label.trim() ? body.label.trim() : null;

    if (!competitionId) {
      return NextResponse.json({ error: "competitionId fehlt." }, { status: 400 });
    }
    if (!csv.trim()) {
      return NextResponse.json({ error: "csv fehlt." }, { status: 400 });
    }
    const session = await getServerSession(authOptions);
    const auth = await requireCompetitionTenantRoles(session, ["ADMIN"], competitionId);
    if ("error" in auth) return auth.error;

    const parsed = parseLegacyResultCsv(csv, { delimiter, headerRow });
    const matches = await buildStarterMatches(competitionId, auth.tenantId, parsed.rawRecords);
    const rawRows = parsed.rawRecords.map((record) => {
      const match = matchKey(record);
      const validationMessages = mergeMessages(record.validationMessages, match ? matches.get(match) : undefined);
      return {
        record,
        match: match ? matches.get(match) : undefined,
        validationMessages,
        validationStatus: validationStatusFor(validationMessages),
      };
    });
    const draftRows = parsed.drafts.map((draft) => {
      const match = matchKey(draft);
      const validationMessages = mergeMessages(draft.validationMessages, match ? matches.get(match) : undefined);
      return {
        draft,
        match: match ? matches.get(match) : undefined,
        validationMessages,
      };
    });
    const warnings = [...rawRows, ...draftRows].reduce(
      (count, row) => count + row.validationMessages.filter((message) => message.severity === "warning").length,
      0,
    );
    const errors = [...rawRows, ...draftRows].reduce(
      (count, row) => count + row.validationMessages.filter((message) => message.severity === "error").length,
      0,
    );
    const matchedDrafts = draftRows.filter((row) => row.match?.participantId).length;
    const unmatchedDrafts = parsed.drafts.length - matchedDrafts;
    const responseSummary = {
      ...parsed.summary,
      warnings,
      errors,
      matchedDrafts,
      unmatchedDrafts,
    };

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        summary: responseSummary,
        validation: {
          status: errors > 0 ? "ERROR" : warnings > 0 ? "WARNING" : "PENDING",
          warnings,
          errors,
        },
        samples: {
          rawRecords: rawRows.slice(0, 5).map(({ record, validationMessages }) => ({
            rowNumber: record.rowNumber,
            rowKey: record.rowKey,
            startNumber: record.startNumber,
            legacyParticipantId: record.legacyParticipantId,
            legacyClassId: record.legacyClassId,
            disciplineCode: record.disciplineCode,
            validationMessages,
          })),
          drafts: draftRows.slice(0, 5).map(({ draft, validationMessages }) => ({
            rowKey: draft.rowKey,
            sourceRowNumbers: draft.sourceRowNumbers,
            startNumber: draft.startNumber,
            legacyParticipantId: draft.legacyParticipantId,
            legacyClassId: draft.legacyClassId,
            disciplineCode: draft.disciplineCode,
            rawValue: draft.rawValue,
            rawValueText: draft.rawValueText,
            resultStatus: draft.resultStatus,
            classPoints: draft.classPoints,
            classRank: draft.classRank,
            validationMessages,
            details: draft.details,
          })),
        },
      });
    }

    const defaultLabel = `Legacy Ergebnis CSV V2 ${parsed.summary.disciplineCode} ${new Date().toISOString().slice(0, 10)}`;
    const result = await prisma.$transaction(async (tx) => {
      const batch = await tx.resultDataBatch.create({
        data: {
          tenantId: auth.tenantId,
          competitionId,
          createdById: auth.user.id,
          source: "LEGACY_IMPORT",
          purpose: "PROD_TEST",
          status: errors > 0 ? "ERROR" : "STAGED",
          label: label || defaultLabel,
          externalRef: `legacy-result-csv-v2:${Date.now()}`,
          sourceVersion: "legacy-result-csv-v2",
          payload: jsonValue({
            type: "LEGACY_RESULT_CSV_V2_IMPORT",
            delimiter,
            headerRow: parsed.summary.headerRow,
            importedAt: new Date().toISOString(),
          }),
          summary: jsonValue(responseSummary),
          validationSummary: jsonValue({
            status: errors > 0 ? "ERROR" : warnings > 0 ? "WARNING" : "PENDING",
            warnings,
            errors,
            matchedDrafts,
            unmatchedDrafts,
          }),
        },
      });

      await tx.resultRawRecord.createMany({
        data: rawRows.map(({ record, match, validationMessages, validationStatus }) => ({
          batchId: batch.id,
          tenantId: auth.tenantId,
          competitionId,
          rowKey: record.rowKey,
          disciplineCode: record.disciplineCode,
          startNumber: record.startNumber,
          participantId: match?.participantId ?? null,
          teamId: match?.teamId ?? null,
          rawValue: null,
          rawValueText: record.raw.AuZeit || record.raw.AuGewicht || record.raw.AuRingeStock || null,
          payload: jsonValue({
            source: "LEGACY_RESULT_CSV_V2",
            rowNumber: record.rowNumber,
            legacyParticipantId: record.legacyParticipantId,
            legacyClassId: record.legacyClassId,
            fields: record.raw,
          }),
          validationStatus,
          validationMessages: jsonValue(validationMessages),
        })),
      });

      const rawRecordIds = await tx.resultRawRecord.findMany({
        where: {
          batchId: batch.id,
          rowKey: { in: rawRows.map(({ record }) => record.rowKey) },
        },
        select: { id: true, rowKey: true },
      });
      const rawRecordIdByRowKey = new Map(rawRecordIds.map((record) => [record.rowKey, record.id]));
      const rawRecordIdByRowNumber = new Map(
        rawRows.map(({ record }) => [record.rowNumber, rawRecordIdByRowKey.get(record.rowKey) ?? null]),
      );

      await tx.resultDraft.createMany({
        data: draftRows.map(({ draft, match, validationMessages }) => {
          const sourceRawRecordId = draft.sourceRowNumbers.length === 1
            ? rawRecordIdByRowNumber.get(draft.sourceRowNumbers[0]) ?? null
            : null;
          const snapshot = buildProposedResultSnapshot(draft);
          return {
            batchId: batch.id,
            sourceRawRecordId,
            tenantId: auth.tenantId,
            competitionId,
            status: draftStatusFor(validationMessages),
            conflictStatus: hasError(validationMessages) ? "CONFLICT" : "UNCHECKED",
            disciplineCode: draft.disciplineCode,
            participantId: match?.participantId ?? null,
            teamId: match?.teamId ?? null,
            startNumber: draft.startNumber,
            rawValue: draft.rawValue,
            rawValueText: draft.rawValueText,
            normalizedValue: draft.rawValue,
            netElapsedMs: typeof draft.rawValue === "number" && ["RUN", "ROAD", "MTB"].includes(draft.disciplineCode)
              ? Math.round(draft.rawValue)
              : null,
            proposedResultSnapshot: jsonValue(snapshot),
            validationMessages: jsonValue(validationMessages),
          };
        }),
      });

      await tx.auditEvent.create({
        data: {
          tenantId: auth.tenantId,
          competitionId,
          actorId: auth.user.id,
          action: "RESULT_LEGACY_RESULT_CSV_V2_STAGED",
          scopeType: "result-staging",
          scopeId: batch.id,
          entityType: "ResultDataBatch",
          entityId: batch.id,
          afterData: jsonValue({
            batchId: batch.id,
            purpose: "PROD_TEST",
            rawRows: parsed.rawRecords.length,
            drafts: parsed.drafts.length,
            matchedDrafts,
            unmatchedDrafts,
            warningCount: warnings,
            errorCount: errors,
          }),
        },
      });

      return {
        batchId: batch.id,
        label: batch.label,
        status: batch.status,
        purpose: batch.purpose,
        dryRun: false,
        summary: responseSummary,
        validation: {
          status: errors > 0 ? "ERROR" : warnings > 0 ? "WARNING" : "PENDING",
          warnings,
          errors,
        },
      };
    }, { timeout: 30_000 });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Legacy Ergebnis CSV:")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Failed to import legacy result CSV:", error);
    return NextResponse.json({ error: "Legacy-Ergebnis-CSV konnte nicht verarbeitet werden." }, { status: 500 });
  }
}
