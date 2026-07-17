import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { sanitizeTeamDashboardLayoutConfig, TEAM_DASHBOARD_KEY } from "@/lib/dashboard-layout-config";
import { prisma } from "@/lib/prisma";
import {
  buildCompetitionTeamsLayoutCsvAttachment,
  buildCompetitionTeamsCsvAttachment,
  loadCompetitionsForDailyExport,
  loadTeamStartNumbersForCompetition,
} from "@/lib/team-csv-export";
import { requireCompetitionTenantRoles } from "@/lib/server-permissions";
import { z } from "zod";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const competitionId = request.nextUrl.searchParams.get("competitionId")?.trim();
  if (!competitionId) {
    return NextResponse.json({ error: "competitionId fehlt" }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  const auth = await requireCompetitionTenantRoles(session, ["ADMIN", "MODERATOR"], competitionId);
  if ("error" in auth) return auth.error;

  try {
    const competitions = await loadCompetitionsForDailyExport({
      competitionId,
      tenantId: auth.tenantId,
      openOnly: false,
    });
    const competition = competitions[0];

    if (!competition) {
      return NextResponse.json({ error: "Wettkampf nicht gefunden" }, { status: 404 });
    }

    const startNumberByTeamId = await loadTeamStartNumbersForCompetition(competition.id);
    const attachment = buildCompetitionTeamsCsvAttachment(competition, startNumberByTeamId);
    const body = Buffer.from(attachment.content, "base64");

    return new NextResponse(body, {
      headers: {
        "Content-Type": attachment.contentType,
        "Content-Disposition": `attachment; filename="${attachment.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Team CSV export failed", error);
    return NextResponse.json({ error: "CSV-Export fehlgeschlagen" }, { status: 500 });
  }
}

const layoutExportSchema = z.object({
  competitionId: z.string().trim().min(1),
  layoutId: z.string().trim().min(1),
  teamIds: z.array(z.string().trim().min(1)).max(1000).default([]),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = layoutExportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { competitionId, layoutId, teamIds } = parsed.data;

  const session = await getServerSession(authOptions);
  const auth = await requireCompetitionTenantRoles(session, ["ADMIN", "MODERATOR"], competitionId);
  if ("error" in auth) return auth.error;

  try {
    const competitions = await loadCompetitionsForDailyExport({
      competitionId,
      tenantId: auth.tenantId,
      openOnly: false,
    });
    const competition = competitions[0];

    if (!competition) {
      return NextResponse.json({ error: "Wettkampf nicht gefunden" }, { status: 404 });
    }

    const layout = await prisma.dashboardLayout.findFirst({
      where: {
        id: layoutId,
        tenantId: auth.tenantId,
        dashboardKey: TEAM_DASHBOARD_KEY,
        deletedAt: null,
        OR: [
          { scope: "GLOBAL", competitionId: null },
          { scope: "GLOBAL", competitionId },
          { scope: "PERSONAL", ownerId: auth.user.id, competitionId: null },
          { scope: "PERSONAL", ownerId: auth.user.id, competitionId },
        ],
      },
    });

    if (!layout) {
      return NextResponse.json({ error: "Layout nicht gefunden" }, { status: 404 });
    }

    const validTeamIds = new Set(competition.teams.map((team) => team.id));
    const uniqueTeamIds = [...new Set(teamIds)];
    const invalidTeamIds = uniqueTeamIds.filter((teamId) => !validTeamIds.has(teamId));
    if (invalidTeamIds.length > 0) {
      return NextResponse.json({ error: "Export enthaelt ungueltige Mannschaften." }, { status: 400 });
    }

    const config = sanitizeTeamDashboardLayoutConfig(layout.config, { isAdmin: auth.isAdmin });
    const startNumberByTeamId = await loadTeamStartNumbersForCompetition(competition.id);
    const attachment = buildCompetitionTeamsLayoutCsvAttachment(competition, config.exportColumns, {
      startNumberByTeamId,
      teamIds: uniqueTeamIds,
      layoutName: layout.name,
    });
    const responseBody = Buffer.from(attachment.content, "base64");

    return new NextResponse(responseBody, {
      headers: {
        "Content-Type": attachment.contentType,
        "Content-Disposition": `attachment; filename="${attachment.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Team layout CSV export failed", error);
    return NextResponse.json({ error: "CSV-Export fehlgeschlagen" }, { status: 500 });
  }
}
