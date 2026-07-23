import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { $Enums } from "@prisma/client";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { requireCompetitionTenantRoles } from "@/lib/server-permissions";

export const dynamic = "force-dynamic";

type PreviewItem = {
  draftId: string;
  action: "CREATE" | "UPDATE" | "UNCHANGED" | "SKIP";
  executable: boolean;
  blockers: string[];
  disciplineCode: $Enums.DisciplineCode;
  startNumber: string | null;
  participantId: string | null;
  participantName: string | null;
  teamId: string | null;
  teamName: string | null;
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

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getSnapshotResult(snapshot: unknown) {
  const record = asRecord(snapshot);
  const result = asRecord(record?.result);
  const classScoring = asRecord(record?.classScoring);

  return {
    rawValue: asNumber(result?.rawValue),
    rawValueText: typeof result?.rawValueText === "string" ? result.rawValueText : null,
    resultStatus: typeof result?.status === "string" ? result.status : null,
    points: asNumber(classScoring?.points),
    rank: asNumber(classScoring?.rank),
  };
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
      select: {
        id: true,
        source: true,
        purpose: true,
        status: true,
        label: true,
        externalRef: true,
      },
    });

    if (!batch) {
      return NextResponse.json({ error: "Ergebnis-Paket nicht gefunden." }, { status: 404 });
    }

    const drafts = await prisma.resultDraft.findMany({
      where: {
        batchId: batch.id,
        tenantId: auth.tenantId,
        competitionId,
      },
      orderBy: [
        { disciplineCode: "asc" },
        { startNumber: "asc" },
        { createdAt: "asc" },
      ],
    });

    const disciplines = await prisma.discipline.findMany({
      where: { competitionId },
      select: { id: true, code: true },
    });
    const disciplineIdByCode = new Map(disciplines.map((discipline) => [discipline.code, discipline.id]));
    const participantIds = [...new Set(drafts.map((draft) => draft.participantId).filter((id): id is string => Boolean(id)))];
    const teamIds = [...new Set(drafts.map((draft) => draft.teamId).filter((id): id is string => Boolean(id)))];

    const targetKeys = drafts
      .filter((draft) => draft.participantId)
      .map((draft) => `${draft.disciplineCode}:${draft.participantId}`);
    const duplicateTargetKeys = new Set(targetKeys.filter((key, index) => targetKeys.indexOf(key) !== index));

    const [existingResults, participants, teams] = await Promise.all([
      participantIds.length > 0
        ? prisma.disciplineResult.findMany({
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
            select: { id: true, firstName: true, lastName: true },
          })
        : Promise.resolve([]),
      teamIds.length > 0
        ? prisma.team.findMany({
            where: {
              id: { in: teamIds },
              competitionId,
              competition: { tenantId: auth.tenantId },
            },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
    ]);
    const resultByTarget = new Map(existingResults.map((result) => [`${result.discipline.code}:${result.participantId}`, result]));
    const participantById = new Map(participants.map((participant) => [participant.id, participant]));
    const teamById = new Map(teams.map((team) => [team.id, team]));

    const items: PreviewItem[] = drafts.map((draft) => {
      const after = getSnapshotResult(draft.proposedResultSnapshot);
      const blockers: string[] = [];
      const targetKey = draft.participantId ? `${draft.disciplineCode}:${draft.participantId}` : null;
      const existingResult = targetKey ? resultByTarget.get(targetKey) ?? null : null;
      const participant = draft.participantId ? participantById.get(draft.participantId) ?? null : null;
      const team = draft.teamId ? teamById.get(draft.teamId) ?? null : null;
      const before = existingResult
        ? {
            rawValue: existingResult.rawValue,
            points: existingResult.points,
            rank: existingResult.rank,
          }
        : null;

      if (batch.status === "PUBLISHED" || batch.status === "DISCARDED" || batch.status === "ERROR") {
        blockers.push("Paketstatus erlaubt keine Publikation.");
      }
      if (draft.status === "CONFLICT" || draft.conflictStatus === "CONFLICT") {
        blockers.push("Draft hat Konfliktstatus.");
      }
      if (draft.status === "REJECTED" || draft.status === "DISCARDED" || draft.status === "PUBLISHED") {
        blockers.push("Draft ist nicht mehr publizierbar.");
      }
      if (!draft.participantId) blockers.push("Teilnehmer-Zuordnung fehlt.");
      if (!disciplineIdByCode.has(draft.disciplineCode)) blockers.push("Disziplin im Wettkampf fehlt.");
      if (targetKey && duplicateTargetKeys.has(targetKey)) blockers.push("Mehrere Drafts zielen auf dasselbe offizielle Ergebnis.");
      if (after.rawValue === null && after.resultStatus !== "dnf") blockers.push("Publizierbarer Wert fehlt.");

      const executable = blockers.length === 0;
      const action = !executable
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
        participantName: participant ? `${participant.firstName} ${participant.lastName}`.trim() : null,
        teamId: draft.teamId,
        teamName: team?.name ?? null,
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
      blockers: items.reduce((sum, item) => sum + item.blockers.length, 0),
    };

    return NextResponse.json({
      batch,
      executable: counts.blockers === 0,
      counts,
      warnings: [
        "Preview schreibt keine offiziellen Ergebnisse.",
        "Manuelle Overlay-Korrekturen werden angezeigt, aber noch nicht in die numerische Publikation eingerechnet.",
      ],
      items,
    });
  } catch (error) {
    console.error("Failed to build result publish preview:", error);
    return NextResponse.json({ error: "Publish-Preview konnte nicht erstellt werden." }, { status: 500 });
  }
}
