import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  buildCompetitionTeamsCsvAttachment,
  loadCompetitionsForDailyExport,
  loadParticipantStartNumbersForCompetition,
} from "@/lib/team-csv-export";
import { requireTenantRoles } from "@/lib/server-permissions";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const auth = await requireTenantRoles(session, ["ADMIN", "MODERATOR"]);
  if ("error" in auth) return auth.error;

  const competitionId = request.nextUrl.searchParams.get("competitionId")?.trim();
  if (!competitionId) {
    return NextResponse.json({ error: "competitionId fehlt" }, { status: 400 });
  }

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

    const startNumberByParticipantId = await loadParticipantStartNumbersForCompetition(competition.id);
    const attachment = buildCompetitionTeamsCsvAttachment(competition, startNumberByParticipantId);
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
