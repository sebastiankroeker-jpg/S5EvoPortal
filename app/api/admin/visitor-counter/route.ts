import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { getUtcDayStart } from "@/lib/server-visitor-counter";
import { getVisitorRouteLabel, normalizeVisitorRouteKey, VISITOR_ROUTE_CONFIG } from "@/lib/visitor-counter";
import { requireTenantRoles } from "@/lib/server-permissions";

export const runtime = "nodejs";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
};

function addUtcDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function sumCount(entry: { _sum: { count: number | null } } | null | undefined) {
  return entry?._sum.count ?? 0;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const auth = await requireTenantRoles(session, ["ADMIN"]);
    if ("error" in auth) return auth.error;

    const today = getUtcDayStart();
    const last7Start = addUtcDays(today, -6);
    const last14Start = addUtcDays(today, -13);

    const baseWhere = {
      tenantId: auth.tenantId,
      surface: "portal",
    };

    const [
      totalAggregate,
      todayAggregate,
      last7Aggregate,
      routeTotalRows,
      routeTodayRows,
      routeLast7Rows,
      dailyRows,
    ] = await Promise.all([
      prisma.pageViewCounter.aggregate({
        where: baseWhere,
        _sum: { count: true },
      }),
      prisma.pageViewCounter.aggregate({
        where: { ...baseWhere, day: today },
        _sum: { count: true },
      }),
      prisma.pageViewCounter.aggregate({
        where: { ...baseWhere, day: { gte: last7Start } },
        _sum: { count: true },
      }),
      prisma.pageViewCounter.groupBy({
        by: ["routeKey"],
        where: baseWhere,
        _sum: { count: true },
      }),
      prisma.pageViewCounter.groupBy({
        by: ["routeKey"],
        where: { ...baseWhere, day: today },
        _sum: { count: true },
      }),
      prisma.pageViewCounter.groupBy({
        by: ["routeKey"],
        where: { ...baseWhere, day: { gte: last7Start } },
        _sum: { count: true },
      }),
      prisma.pageViewCounter.groupBy({
        by: ["day"],
        where: { ...baseWhere, day: { gte: last14Start } },
        _sum: { count: true },
        orderBy: { day: "asc" },
      }),
    ]);

    const todayByRoute = new Map(routeTodayRows.map((row) => [row.routeKey, row._sum.count ?? 0]));
    const last7ByRoute = new Map(routeLast7Rows.map((row) => [row.routeKey, row._sum.count ?? 0]));
    const totalByRoute = new Map(routeTotalRows.map((row) => [row.routeKey, row._sum.count ?? 0]));
    const routeKeys = new Set([...Object.keys(VISITOR_ROUTE_CONFIG), ...totalByRoute.keys()]);

    const byRoute = [...routeKeys]
      .map((routeKey) => {
        const normalized = normalizeVisitorRouteKey(routeKey);
        return {
          routeKey,
          label: normalized ? getVisitorRouteLabel(normalized) : routeKey,
          today: todayByRoute.get(routeKey) ?? 0,
          last7Days: last7ByRoute.get(routeKey) ?? 0,
          total: totalByRoute.get(routeKey) ?? 0,
        };
      })
      .filter((entry) => entry.today > 0 || entry.last7Days > 0 || entry.total > 0)
      .sort((left, right) => right.last7Days - left.last7Days || right.total - left.total || left.label.localeCompare(right.label, "de"));

    return NextResponse.json(
      {
        summary: {
          today: sumCount(todayAggregate),
          last7Days: sumCount(last7Aggregate),
          total: sumCount(totalAggregate),
        },
        byRoute,
        daily: dailyRows.map((row) => ({
          day: row.day.toISOString().slice(0, 10),
          count: row._sum.count ?? 0,
        })),
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error("Failed to load visitor counters:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Besucherzaehler konnte nicht geladen werden" }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
