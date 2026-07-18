import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  RESULT_BATCH_STATUS_LABELS,
  RESULT_PURPOSE_LABELS,
  RESULT_SOURCE_LABELS,
} from "@/lib/result-staging";
import { prisma } from "@/lib/prisma";
import { requireCompetitionTenantRoles } from "@/lib/server-permissions";

export const dynamic = "force-dynamic";

const RESULT_SOURCES = ["LEGACY_IMPORT", "TIMEKEEPING_SYNC", "MANUAL_ADMIN", "SYSTEM_RECALC"] as const;
const RESULT_PURPOSES = ["PRODUCTION", "PROD_TEST", "DRY_RUN"] as const;
const RESULT_BATCH_STATUSES = ["STAGED", "VALIDATED", "REVIEWED", "PUBLISHED", "DISCARDED", "ERROR"] as const;

function parseOption<T extends string>(value: string | null, options: readonly T[]) {
  if (!value?.trim()) return null;
  return options.includes(value.trim() as T) ? value.trim() as T : undefined;
}

async function resolveCompetition(tenantId: string, competitionId: string | null) {
  if (competitionId) {
    return prisma.competition.findFirst({
      where: { id: competitionId, tenantId },
      select: { id: true, name: true, year: true, status: true },
    });
  }

  return prisma.competition.findFirst({
    where: { tenantId },
    orderBy: { year: "desc" },
    select: { id: true, name: true, year: true, status: true },
  });
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const competitionId = request.nextUrl.searchParams.get("competitionId");
    const auth = await requireCompetitionTenantRoles(session, ["ADMIN", "MODERATOR"], competitionId);
    if ("error" in auth) return auth.error;

    const competition = await resolveCompetition(auth.tenantId, competitionId);
    if (!competition) {
      return NextResponse.json({ error: "Kein Wettkampf gefunden." }, { status: 404 });
    }

    const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get("limit") || 50), 1), 100);
    const source = parseOption(request.nextUrl.searchParams.get("source"), RESULT_SOURCES);
    const purpose = parseOption(request.nextUrl.searchParams.get("purpose"), RESULT_PURPOSES);
    const status = parseOption(request.nextUrl.searchParams.get("status"), RESULT_BATCH_STATUSES);
    if (source === undefined || purpose === undefined || status === undefined) {
      return NextResponse.json({ error: "Ungueltiger Filterwert." }, { status: 400 });
    }

    const batches = await prisma.resultDataBatch.findMany({
      where: {
        tenantId: auth.tenantId,
        competitionId: competition.id,
        ...(source ? { source } : {}),
        ...(purpose ? { purpose } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        _count: {
          select: {
            rawRecords: true,
            drafts: true,
            publications: true,
            resetSnapshots: true,
          },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        reviewedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json({
      competition,
      labels: {
        sources: RESULT_SOURCE_LABELS,
        purposes: RESULT_PURPOSE_LABELS,
        statuses: RESULT_BATCH_STATUS_LABELS,
      },
      batches: batches.map((batch) => ({
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
        reviewedAt: batch.reviewedAt,
        publishedAt: batch.publishedAt,
        discardedAt: batch.discardedAt,
        createdAt: batch.createdAt,
        updatedAt: batch.updatedAt,
        createdBy: batch.createdBy,
        reviewedBy: batch.reviewedBy,
        counts: {
          rawRecords: batch._count.rawRecords,
          drafts: batch._count.drafts,
          publications: batch._count.publications,
          resetSnapshots: batch._count.resetSnapshots,
        },
      })),
    });
  } catch (error) {
    console.error("Failed to load result staging batches:", error);
    return NextResponse.json({ error: "Ergebnis-Staging-Pakete konnten nicht geladen werden." }, { status: 500 });
  }
}
