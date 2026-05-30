import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { resetCompetitionData } from "@/lib/competition-reset";
import { prisma } from "@/lib/prisma";
import { requireTenantRoles } from "@/lib/server-permissions";

type ResetRequestBody = {
  id?: string;
  reason?: string;
  dryRun?: boolean;
  force?: boolean;
  confirmationText?: string;
};

function normalizeBody(value: unknown): ResetRequestBody {
  if (!value || typeof value !== "object") {
    return {};
  }

  return value as ResetRequestBody;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const auth = await requireTenantRoles(session, ["ADMIN"]);
    if ("error" in auth) return auth.error;

    const competitionId = request.nextUrl.searchParams.get("id");
    const competition = competitionId
      ? await prisma.competition.findFirst({
          where: { id: competitionId, tenantId: auth.tenantId },
          select: { id: true, name: true, year: true, status: true },
        })
      : await prisma.competition.findFirst({
          where: { tenantId: auth.tenantId },
          orderBy: { year: "desc" },
          select: { id: true, name: true, year: true, status: true },
        });

    if (!competition) {
      return NextResponse.json({ error: "Kein Wettkampf fuer Reset-Daten gefunden." }, { status: 404 });
    }

    const snapshots = await prisma.competitionResetSnapshot.findMany({
      where: {
        tenantId: auth.tenantId,
        competitionId: competition.id,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    const auditEvents = await prisma.auditEvent.findMany({
      where: {
        tenantId: auth.tenantId,
        competitionId: competition.id,
        action: {
          in: ["COMPETITION_RESET_DRY_RUN", "COMPETITION_RESET_STARTED", "COMPETITION_RESET_COMPLETED"],
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        action: true,
        reason: true,
        createdAt: true,
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({
      competition,
      snapshots,
      auditEvents,
    });
  } catch (error) {
    console.error("Failed to load competition reset metadata:", error);
    return NextResponse.json({ error: "Reset-Daten konnten nicht geladen werden." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const auth = await requireTenantRoles(session, ["ADMIN"]);
    if ("error" in auth) return auth.error;

    const body = normalizeBody(await request.json().catch(() => ({})));
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    const dryRun = body.dryRun === true;
    const force = body.force === true;

    if (reason.length < 10) {
      return NextResponse.json(
        { error: "Bitte gib eine aussagekraeftige Begruendung mit mindestens 10 Zeichen an." },
        { status: 400 },
      );
    }

    const competition = body.id
      ? await prisma.competition.findFirst({
          where: { id: body.id, tenantId: auth.tenantId },
        })
      : await prisma.competition.findFirst({
          where: { tenantId: auth.tenantId },
          orderBy: { year: "desc" },
        });

    if (!competition) {
      return NextResponse.json({ error: "Kein Wettkampf fuer den Reset gefunden." }, { status: 404 });
    }

    const expectedConfirmationText = competition.name;
    if (!dryRun && body.confirmationText !== expectedConfirmationText) {
      return NextResponse.json(
        {
          error: "Bestaetigungstext stimmt nicht ueberein.",
          expectedConfirmationText,
        },
        { status: 400 },
      );
    }

    if (!dryRun && !force && (competition.status === "RUNNING" || competition.status === "CLOSED")) {
      return NextResponse.json(
        {
          error: `Reset fuer Status ${competition.status} ist nur mit force=true erlaubt.`,
          requiresForce: true,
        },
        { status: 409 },
      );
    }

    const result = await resetCompetitionData({
      tenantId: auth.tenantId,
      competitionId: competition.id,
      actorId: auth.user.id,
      reason,
      dryRun,
    });

    return NextResponse.json({
      success: true,
      expectedConfirmationText,
      competition: {
        id: competition.id,
        name: competition.name,
        year: competition.year,
        status: competition.status,
      },
      ...result,
    });
  } catch (error) {
    console.error("Competition reset failed:", error);

    const message =
      error instanceof Error && error.message === "competition_not_found"
        ? "Wettkampf nicht gefunden."
        : error instanceof Error && error.message === "reset_reason_required"
          ? "Begruendung ist erforderlich."
          : "Competition Reset fehlgeschlagen.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
