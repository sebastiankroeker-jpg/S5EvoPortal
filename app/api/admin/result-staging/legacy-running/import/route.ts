import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { $Enums, Prisma } from "@prisma/client";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  LEGACY_RUNNING_DISCIPLINE_CODE,
  parseLegacyRunningCsv,
  type LegacyRunningNormalizedRecord,
  type LegacyRunningValidationMessage,
} from "@/lib/legacy-running-result-import";
import { prisma } from "@/lib/prisma";
import { requireCompetitionTenantRoles } from "@/lib/server-permissions";

export const dynamic = "force-dynamic";

const RESULT_PURPOSES = ["PROD_TEST"] as const;

type ResultPurpose = (typeof RESULT_PURPOSES)[number];

type LegacyRunningImportBody = {
  competitionId?: unknown;
  csv?: unknown;
  delimiter?: unknown;
  headerRow?: unknown;
  purpose?: unknown;
  label?: unknown;
  dryRun?: unknown;
};

type StarterMatch = {
  teamId: string | null;
  participantId: string | null;
  messages: LegacyRunningValidationMessage[];
};

function parsePurpose(value: unknown): ResultPurpose | null {
  if (typeof value !== "string") return "PROD_TEST";
  return RESULT_PURPOSES.includes(value as ResultPurpose) ? value as ResultPurpose : null;
}

function parseHeaderRow(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.max(1, Math.floor(value));
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function hasError(messages: LegacyRunningValidationMessage[]) {
  return messages.some((message) => message.severity === "error");
}

function validationStatusFor(messages: LegacyRunningValidationMessage[]): $Enums.ResultValidationStatus {
  if (messages.some((message) => message.severity === "error")) return "ERROR";
  if (messages.length > 0) return "WARNING";
  return "PENDING";
}

function buildProposedResultSnapshot(record: LegacyRunningNormalizedRecord) {
  return {
    source: "LEGACY_RUNNING_CSV",
    disciplineCode: record.disciplineCode,
    startNumber: record.startNumber,
    result: {
      rawTimeText: record.rawTimeText,
      elapsedMs: record.elapsedMs,
      status: record.resultStatus,
    },
    classScoring: {
      legacyClassId: record.legacyClassId,
      classCode: record.classCode,
      classLabel: record.classLabel,
      points: record.classPoints,
      rank: record.classRank,
      tied: record.legacyTieClass,
    },
    overallGenderScoring: {
      group: record.overallGroup,
      points: record.overallGenderPoints,
      rank: record.overallGenderRank,
      tied: record.legacyTieOverall,
    },
    legacy: {
      rowNumber: record.rowNumber,
      participantId: record.legacyParticipantId,
      rawTimeText: record.rawTimeText,
      uhrGueltig: record.raw.AuUhrGueltig || null,
      stopzeitUhr1: record.raw.AuStopzeit || null,
      stopzeitUhr2: record.raw.AuStopzeitUhr2 || null,
      zeitBasis: record.raw.AuZeitBasis || null,
      zeitBasisUhr2: record.raw.AuZeitBasisUhr2 || null,
      zeitBasisZiel: record.raw.AuZeitBasisZiel || null,
    },
  };
}

async function buildStarterMatches(competitionId: string, tenantId: string, records: LegacyRunningNormalizedRecord[]) {
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
      classificationCode: true,
      participants: {
        where: {
          deletedAt: null,
          disciplineCode: LEGACY_RUNNING_DISCIPLINE_CODE,
        },
        select: { id: true },
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
  for (const startNumber of startNumbers) {
    const candidates = teamsByStartNumber.get(startNumber) || [];
    if (candidates.length === 0) {
      matches.set(startNumber, {
        teamId: null,
        participantId: null,
        messages: [{ code: "unmatched_start_number", severity: "error" }],
      });
      continue;
    }

    if (candidates.length > 1) {
      matches.set(startNumber, {
        teamId: null,
        participantId: null,
        messages: [{ code: "ambiguous_start_number", severity: "error" }],
      });
      continue;
    }

    const [team] = candidates;
    if (team.participants.length === 0) {
      matches.set(startNumber, {
        teamId: team.id,
        participantId: null,
        messages: [{ code: "missing_run_participant", severity: "error" }],
      });
      continue;
    }

    if (team.participants.length > 1) {
      matches.set(startNumber, {
        teamId: team.id,
        participantId: null,
        messages: [{ code: "ambiguous_run_participant", severity: "error" }],
      });
      continue;
    }

    matches.set(startNumber, {
      teamId: team.id,
      participantId: team.participants[0].id,
      messages: [],
    });
  }

  return matches;
}

function mergeMessages(record: LegacyRunningNormalizedRecord, match: StarterMatch | undefined) {
  return [...record.validationMessages, ...(match?.messages ?? [])];
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as LegacyRunningImportBody | null;
    if (!body) {
      return NextResponse.json({ error: "Ungueltiger Request-Body." }, { status: 400 });
    }

    const competitionId = typeof body.competitionId === "string" ? body.competitionId.trim() : "";
    const csv = typeof body.csv === "string" ? body.csv : "";
    const delimiter = typeof body.delimiter === "string" && body.delimiter.length === 1 ? body.delimiter : ";";
    const headerRow = parseHeaderRow(body.headerRow);
    const purpose = parsePurpose(body.purpose);
    const label = typeof body.label === "string" && body.label.trim() ? body.label.trim() : null;
    const dryRun = body.dryRun !== false;

    if (!competitionId) {
      return NextResponse.json({ error: "competitionId fehlt." }, { status: 400 });
    }
    if (!csv.trim()) {
      return NextResponse.json({ error: "csv fehlt." }, { status: 400 });
    }
    if (!purpose) {
      return NextResponse.json({ error: "Ungueltiger purpose." }, { status: 400 });
    }

    const session = await getServerSession(authOptions);
    const auth = await requireCompetitionTenantRoles(session, ["ADMIN"], competitionId);
    if ("error" in auth) return auth.error;

    const parsed = parseLegacyRunningCsv(csv, { delimiter, headerRow });
    const matches = await buildStarterMatches(competitionId, auth.tenantId, parsed.records);
    const recordsWithMessages = parsed.records.map((record) => ({
      record,
      match: record.startNumber ? matches.get(record.startNumber) : undefined,
      validationMessages: mergeMessages(record, record.startNumber ? matches.get(record.startNumber) : undefined),
    }));
    const errors = recordsWithMessages.reduce(
      (count, entry) => count + entry.validationMessages.filter((message) => message.severity === "error").length,
      0,
    );
    const warnings = recordsWithMessages.reduce(
      (count, entry) => count + entry.validationMessages.filter((message) => message.severity === "warning").length,
      0,
    );
    const matchedRecords = recordsWithMessages.filter((entry) => entry.match?.participantId).length;
    const unmatchedRecords = parsed.records.length - matchedRecords;

    const responseSummary = {
      ...parsed.summary,
      warnings,
      errors,
      matchedRecords,
      unmatchedRecords,
      dryRun,
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
      });
    }

    const defaultLabel = `Legacy Laufen CSV ${new Date().toISOString().slice(0, 10)}`;
    const result = await prisma.$transaction(async (tx) => {
      const batch = await tx.resultDataBatch.create({
        data: {
          tenantId: auth.tenantId,
          competitionId,
          createdById: auth.user.id,
          source: "LEGACY_IMPORT",
          purpose,
          status: errors > 0 ? "ERROR" : "STAGED",
          label: label || defaultLabel,
          externalRef: `legacy-running-csv:${Date.now()}`,
          sourceVersion: "legacy-running-csv-v1",
          payload: jsonValue({
            type: "LEGACY_RUNNING_CSV_IMPORT",
            disciplineCode: LEGACY_RUNNING_DISCIPLINE_CODE,
            delimiter,
            headerRow: parsed.summary.headerRow,
            importedAt: new Date().toISOString(),
          }),
          summary: jsonValue(responseSummary),
          validationSummary: jsonValue({
            status: errors > 0 ? "ERROR" : warnings > 0 ? "WARNING" : "PENDING",
            warnings,
            errors,
            matchedRecords,
            unmatchedRecords,
          }),
        },
      });

      const normalizedRows = recordsWithMessages.map((entry) => {
        const { record, match, validationMessages } = entry;
        const proposedSnapshot = buildProposedResultSnapshot(record);
        return {
          record,
          match,
          validationMessages,
          proposedSnapshot,
          validationStatus: validationStatusFor(validationMessages),
        };
      });

      await tx.resultRawRecord.createMany({
        data: normalizedRows.map(({ record, match, validationMessages, proposedSnapshot, validationStatus }) => ({
          batchId: batch.id,
          tenantId: auth.tenantId,
          competitionId,
          rowKey: record.rowKey,
          disciplineCode: record.disciplineCode,
          startNumber: record.startNumber,
          participantId: match?.participantId ?? null,
          teamId: match?.teamId ?? null,
          rawValue: record.elapsedMs,
          rawValueText: record.rawTimeText,
          payload: jsonValue({
            source: "LEGACY_RUNNING_CSV",
            rowNumber: record.rowNumber,
            fields: record.raw,
            normalized: proposedSnapshot,
          }),
          validationStatus,
          validationMessages: jsonValue(validationMessages),
        })),
      });

      const rawRecordIds = await tx.resultRawRecord.findMany({
        where: {
          batchId: batch.id,
          rowKey: { in: normalizedRows.map(({ record }) => record.rowKey) },
        },
        select: {
          id: true,
          rowKey: true,
        },
      });
      const rawRecordIdByRowKey = new Map(rawRecordIds.map((rawRecord) => [rawRecord.rowKey, rawRecord.id]));

      await tx.resultDraft.createMany({
        data: normalizedRows.map(({ record, match, validationMessages, proposedSnapshot }) => ({
          batchId: batch.id,
          sourceRawRecordId: rawRecordIdByRowKey.get(record.rowKey) ?? null,
          tenantId: auth.tenantId,
          competitionId,
          status: hasError(validationMessages) ? "CONFLICT" : "DRAFT",
          conflictStatus: hasError(validationMessages) ? "CONFLICT" : "UNCHECKED",
          disciplineCode: record.disciplineCode,
          participantId: match?.participantId ?? null,
          teamId: match?.teamId ?? null,
          startNumber: record.startNumber,
          rawValue: record.elapsedMs,
          rawValueText: record.rawTimeText,
          normalizedValue: record.elapsedMs,
          netElapsedMs: record.elapsedMs,
          proposedResultSnapshot: jsonValue(proposedSnapshot),
          validationMessages: jsonValue(validationMessages),
        })),
      });

      await tx.auditEvent.create({
        data: {
          tenantId: auth.tenantId,
          competitionId,
          actorId: auth.user.id,
          action: "RESULT_LEGACY_RUNNING_CSV_STAGED",
          scopeType: "result-staging",
          scopeId: batch.id,
          entityType: "ResultDataBatch",
          entityId: batch.id,
          afterData: jsonValue({
            batchId: batch.id,
            purpose,
            importedRecords: parsed.records.length,
            matchedRecords,
            unmatchedRecords,
            warningCount: warnings,
            errorCount: errors,
          }),
        },
      });

      return {
        batchId: batch.id,
        label: batch.label,
        status: batch.status,
        summary: responseSummary,
      };
    }, { timeout: 30_000 });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Legacy Laufen CSV:")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Failed to import legacy running CSV into result staging:", error);
    return NextResponse.json({ error: "Legacy-Lauf-Ergebnisse konnten nicht ins Ergebnis-Staging uebernommen werden." }, { status: 500 });
  }
}
