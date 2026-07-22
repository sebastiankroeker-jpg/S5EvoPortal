import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { parseLegacyResultCsv } from "@/lib/legacy-result-import";
import { requireCompetitionTenantRoles } from "@/lib/server-permissions";

export const dynamic = "force-dynamic";

type LegacyResultImportBody = {
  competitionId?: unknown;
  csv?: unknown;
  delimiter?: unknown;
  headerRow?: unknown;
  dryRun?: unknown;
};

function parseHeaderRow(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.max(1, Math.floor(value));
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

    if (!competitionId) {
      return NextResponse.json({ error: "competitionId fehlt." }, { status: 400 });
    }
    if (!csv.trim()) {
      return NextResponse.json({ error: "csv fehlt." }, { status: 400 });
    }
    if (!dryRun) {
      return NextResponse.json({ error: "Legacy-Ergebnisimport V2 unterstützt aktuell nur Dry-run." }, { status: 409 });
    }

    const session = await getServerSession(authOptions);
    const auth = await requireCompetitionTenantRoles(session, ["ADMIN"], competitionId);
    if ("error" in auth) return auth.error;

    const parsed = parseLegacyResultCsv(csv, { delimiter, headerRow });

    return NextResponse.json({
      dryRun: true,
      summary: parsed.summary,
      validation: {
        status: parsed.summary.errors > 0 ? "ERROR" : parsed.summary.warnings > 0 ? "WARNING" : "PENDING",
        warnings: parsed.summary.warnings,
        errors: parsed.summary.errors,
      },
      samples: {
        rawRecords: parsed.rawRecords.slice(0, 5).map((record) => ({
          rowNumber: record.rowNumber,
          rowKey: record.rowKey,
          startNumber: record.startNumber,
          legacyParticipantId: record.legacyParticipantId,
          legacyClassId: record.legacyClassId,
          disciplineCode: record.disciplineCode,
          validationMessages: record.validationMessages,
        })),
        drafts: parsed.drafts.slice(0, 5).map((draft) => ({
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
          validationMessages: draft.validationMessages,
          details: draft.details,
        })),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Legacy Ergebnis CSV:")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Failed to dry-run legacy result CSV:", error);
    return NextResponse.json({ error: "Legacy-Ergebnis-CSV konnte nicht geprüft werden." }, { status: 500 });
  }
}
