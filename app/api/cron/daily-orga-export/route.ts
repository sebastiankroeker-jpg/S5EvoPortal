import { NextRequest, NextResponse } from "next/server";

import { sendDailyCompetitionExportEmail } from "@/lib/mail/daily-orga-export";
import { loadCompetitionsForDailyExport } from "@/lib/team-csv-export";

export const runtime = "nodejs";

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const competitionId = request.nextUrl.searchParams.get("competitionId") || undefined;
    const competitions = await loadCompetitionsForDailyExport(competitionId);

    if (competitions.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No open competitions found for daily export",
        processed: 0,
      });
    }

    const results = await Promise.allSettled(
      competitions.map(async (competition) => {
        const mailResult = await sendDailyCompetitionExportEmail(competition);
        return {
          competitionId: competition.id,
          competition: competition.name,
          year: competition.year,
          teamCount: competition.teams.length,
          ...mailResult,
        };
      }),
    );

    const summary = results.map((result) => {
      if (result.status === "rejected") {
        return {
          status: "failed" as const,
          reason: result.reason instanceof Error ? result.reason.message : String(result.reason),
        };
      }

      return result.value;
    });

    return NextResponse.json({
      ok: summary.every((item) => item.status !== "failed"),
      processed: summary.length,
      results: summary,
    });
  } catch (error) {
    console.error("Daily orga export failed", error);
    return NextResponse.json(
      { error: "Daily orga export failed" },
      { status: 500 },
    );
  }
}
