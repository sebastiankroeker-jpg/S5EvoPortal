import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { RESULT_RESET_SCOPE_LABELS, requiresResultResetSnapshot } from "@/lib/result-staging";
import { prisma } from "@/lib/prisma";
import { requireTenantRoles } from "@/lib/server-permissions";

export const dynamic = "force-dynamic";

const RESET_SCOPES = ["RAW_BATCH", "DRAFTS", "PUBLICATION", "OFFICIAL_RESULTS", "TEST_DATA"] as const;
const DISCIPLINE_CODES = ["RUN", "BENCH", "STOCK", "ROAD", "MTB"] as const;

type ResetScope = (typeof RESET_SCOPES)[number];
type DisciplineCode = (typeof DISCIPLINE_CODES)[number];

type PreviewBody = {
  competitionId?: unknown;
  scope?: unknown;
  batchId?: unknown;
  publicationId?: unknown;
  disciplineCode?: unknown;
  participantId?: unknown;
  startNumber?: unknown;
};

function normalizeBody(value: unknown): PreviewBody {
  return value && typeof value === "object" ? value as PreviewBody : {};
}

function parseString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseScope(value: unknown): ResetScope | null {
  if (typeof value !== "string") return null;
  return RESET_SCOPES.includes(value as ResetScope) ? value as ResetScope : null;
}

function parseDiscipline(value: unknown): DisciplineCode | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return DISCIPLINE_CODES.includes(value as DisciplineCode) ? value as DisciplineCode : null;
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

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const auth = await requireTenantRoles(session, ["ADMIN", "MODERATOR"]);
    if ("error" in auth) return auth.error;

    const body = normalizeBody(await request.json().catch(() => ({})));
    const scope = parseScope(body.scope);
    if (!scope) {
      return NextResponse.json({ error: "Ungueltiger Reset-Scope." }, { status: 400 });
    }

    const competition = await resolveCompetition(auth.tenantId, parseString(body.competitionId));
    if (!competition) {
      return NextResponse.json({ error: "Kein Wettkampf gefunden." }, { status: 404 });
    }

    const batchId = parseString(body.batchId);
    const publicationId = parseString(body.publicationId);
    const disciplineCode = parseDiscipline(body.disciplineCode);
    const participantId = parseString(body.participantId);
    const startNumber = parseString(body.startNumber);
    const warnings: string[] = [];

    const baseFilter = {
      tenantId: auth.tenantId,
      competitionId: competition.id,
    };

    const resultFilter = {
      participant: {
        team: {
          tenantId: auth.tenantId,
          competitionId: competition.id,
        },
        ...(participantId ? { id: participantId } : {}),
        ...(startNumber ? { startNumber } : {}),
      },
      ...(disciplineCode ? { discipline: { code: disciplineCode } } : {}),
    };

    let counts: Record<string, number> = {};
    let scopeEntity: Record<string, unknown> | null = null;

    if (scope === "RAW_BATCH") {
      if (!batchId) return NextResponse.json({ error: "batchId ist fuer RAW_BATCH erforderlich." }, { status: 400 });
      const batch = await prisma.resultDataBatch.findFirst({
        where: { ...baseFilter, id: batchId },
        select: { id: true, source: true, purpose: true, status: true, label: true },
      });
      if (!batch) return NextResponse.json({ error: "Batch nicht gefunden." }, { status: 404 });
      scopeEntity = batch;
      const [rawRecords, drafts, publications, publicationItems, resetSnapshots] = await Promise.all([
        prisma.resultRawRecord.count({ where: { ...baseFilter, batchId } }),
        prisma.resultDraft.count({ where: { ...baseFilter, batchId } }),
        prisma.resultPublication.count({ where: { ...baseFilter, sourceBatchId: batchId } }),
        prisma.resultPublicationItem.count({ where: { publication: { ...baseFilter, sourceBatchId: batchId } } }),
        prisma.resultResetSnapshot.count({ where: { ...baseFilter, batchId } }),
      ]);
      counts = { rawRecords, drafts, publications, publicationItems, resetSnapshots };
      if (publications > 0 || publicationItems > 0) warnings.push("Batch wurde bereits publiziert oder ist mit Publikationen verbunden.");
    }

    if (scope === "DRAFTS") {
      const draftWhere = {
        ...baseFilter,
        ...(batchId ? { batchId } : {}),
        ...(disciplineCode ? { disciplineCode } : {}),
        ...(participantId ? { participantId } : {}),
        ...(startNumber ? { startNumber } : {}),
      };
      const [drafts, approvedDrafts, publishedDrafts, publicationItems] = await Promise.all([
        prisma.resultDraft.count({ where: draftWhere }),
        prisma.resultDraft.count({ where: { ...draftWhere, status: "APPROVED" } }),
        prisma.resultDraft.count({ where: { ...draftWhere, status: "PUBLISHED" } }),
        prisma.resultPublicationItem.count({ where: { draft: draftWhere } }),
      ]);
      counts = { drafts, approvedDrafts, publishedDrafts, publicationItems };
      if (publishedDrafts > 0 || publicationItems > 0) warnings.push("Ein Teil der Drafts ist bereits publiziert oder referenziert.");
    }

    if (scope === "PUBLICATION") {
      if (!publicationId) return NextResponse.json({ error: "publicationId ist fuer PUBLICATION erforderlich." }, { status: 400 });
      const publication = await prisma.resultPublication.findFirst({
        where: { ...baseFilter, id: publicationId },
        select: { id: true, version: true, status: true, label: true, publishedAt: true },
      });
      if (!publication) return NextResponse.json({ error: "Publikation nicht gefunden." }, { status: 404 });
      scopeEntity = publication;
      const items = await prisma.resultPublicationItem.count({ where: { publicationId } });
      counts = { publications: 1, publicationItems: items };
      warnings.push("Publikations-Reset wuerde offizielle Ergebnisversionen beruehren und braucht vor Ausfuehrung ein Backup.");
    }

    if (scope === "OFFICIAL_RESULTS") {
      const officialResults = await prisma.disciplineResult.count({ where: resultFilter });
      counts = { officialResults };
      warnings.push("Official-Results-Reset betrifft den offiziellen Read-Stand und darf nur mit Snapshot/Backup ausgefuehrt werden.");
    }

    if (scope === "TEST_DATA") {
      const testPurposes = ["PROD_TEST", "DRY_RUN"] as const;
      const testBatchWhere = {
        ...baseFilter,
        purpose: { in: [...testPurposes] },
      };
      const [batches, rawRecords, drafts, publications, publicationItems, resetSnapshots] = await Promise.all([
        prisma.resultDataBatch.count({ where: testBatchWhere }),
        prisma.resultRawRecord.count({ where: { ...baseFilter, batch: { purpose: { in: [...testPurposes] } } } }),
        prisma.resultDraft.count({ where: { ...baseFilter, batch: { purpose: { in: [...testPurposes] } } } }),
        prisma.resultPublication.count({ where: { ...baseFilter, sourceBatch: { purpose: { in: [...testPurposes] } } } }),
        prisma.resultPublicationItem.count({ where: { publication: { ...baseFilter, sourceBatch: { purpose: { in: [...testPurposes] } } } } }),
        prisma.resultResetSnapshot.count({ where: { ...baseFilter, batch: { purpose: { in: [...testPurposes] } } } }),
      ]);
      counts = { batches, rawRecords, drafts, publications, publicationItems, resetSnapshots };
      if (publications > 0 || publicationItems > 0) warnings.push("Testdaten sind mit Publikationen verbunden; vor Reset offizielle Ergebniswirkung pruefen.");
    }

    return NextResponse.json({
      mode: "PREVIEW",
      destructive: false,
      competition,
      scope,
      scopeLabel: RESULT_RESET_SCOPE_LABELS[scope],
      scopeEntity,
      filter: {
        batchId,
        publicationId,
        disciplineCode,
        participantId,
        startNumber,
      },
      counts,
      warnings,
      requiresSnapshotBeforeExecution: requiresResultResetSnapshot(scope),
    });
  } catch (error) {
    console.error("Failed to preview result staging reset:", error);
    return NextResponse.json({ error: "Reset-Preview konnte nicht berechnet werden." }, { status: 500 });
  }
}
