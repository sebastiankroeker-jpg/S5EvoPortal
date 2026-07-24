import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getUtcDayStart, resolveVisitorCounterCompetition } from "@/lib/server-visitor-counter";
import { normalizeVisitorRouteKey } from "@/lib/visitor-counter";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const routeKey = normalizeVisitorRouteKey(body?.routeKey);
    if (!routeKey) {
      return NextResponse.json({ error: "invalid_route_key" }, { status: 400 });
    }

    const competition = await resolveVisitorCounterCompetition();
    if (!competition) {
      return new NextResponse(null, { status: 204 });
    }

    const day = getUtcDayStart();
    await prisma.pageViewCounter.upsert({
      where: {
        tenantId_competitionId_day_surface_routeKey: {
          tenantId: competition.tenantId,
          competitionId: competition.id,
          day,
          surface: "portal",
          routeKey,
        },
      },
      create: {
        tenantId: competition.tenantId,
        competitionId: competition.id,
        day,
        surface: "portal",
        routeKey,
        count: 1,
      },
      update: {
        count: { increment: 1 },
      },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Failed to increment visitor counter:", error instanceof Error ? error.message : "unknown");
    return new NextResponse(null, { status: 204 });
  }
}
