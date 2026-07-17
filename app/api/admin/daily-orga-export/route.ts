import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { sendDailyCompetitionExportEmail } from "@/lib/mail/daily-orga-export";
import { loadCompetitionsForDailyExport } from "@/lib/team-csv-export";
import { requireCompetitionTenantRoles } from "@/lib/server-permissions";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const competitionId =
    typeof body.competitionId === "string" && body.competitionId.trim().length > 0
      ? body.competitionId.trim()
      : null;

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

    const result = await sendDailyCompetitionExportEmail(competition);
    if (result.status === "sent") {
      return NextResponse.json({
        success: true,
        result,
        message: `CSV an ${result.recipients.length} Empfänger versendet.`,
      });
    }

    if (result.reason === "missing_recipients") {
      return NextResponse.json(
        {
          error: "Keine Empfänger hinterlegt. Bitte zuerst Orga-Mails im Wettkampf pflegen.",
          result,
        },
        { status: 400 },
      );
    }

    if (result.reason === "missing_env") {
      return NextResponse.json(
        {
          error: "Mailversand ist nicht vollständig konfiguriert.",
          result,
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      {
        error: "CSV-Versand wurde übersprungen.",
        result,
      },
      { status: 500 },
    );
  } catch (error) {
    console.error("Manual daily orga export failed", error);
    return NextResponse.json(
      { error: "CSV-Versand fehlgeschlagen" },
      { status: 500 },
    );
  }
}
