import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { getUtcDayStart, resolveVisitorCounterCompetition } from "@/lib/server-visitor-counter";
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

function parseDateParam(value: string | null) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return parsed;
}

function formatDay(value: Date) {
  return value.toISOString().slice(0, 10);
}

function sumCount(entry: { _sum: { count: number | null } } | null | undefined) {
  return entry?._sum.count ?? 0;
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const competition = await resolveVisitorCounterCompetition();
    const auth = await requireTenantRoles(session, ["ADMIN"], competition ? { tenantId: competition.tenantId } : {});
    if ("error" in auth) return auth.error;

    const url = new URL(request.url);
    const today = getUtcDayStart();
    const last7Start = addUtcDays(today, -6);
    const requestedFrom = parseDateParam(url.searchParams.get("from"));
    const requestedTo = parseDateParam(url.searchParams.get("to"));
    let rangeFrom = requestedFrom ?? addUtcDays(today, -13);
    let rangeTo = requestedTo ?? today;
    if (rangeFrom > rangeTo) {
      [rangeFrom, rangeTo] = [rangeTo, rangeFrom];
    }
    const maxRangeDays = 120;
    const dayCount = Math.floor((rangeTo.getTime() - rangeFrom.getTime()) / 86_400_000) + 1;
    if (dayCount > maxRangeDays) {
      rangeFrom = addUtcDays(rangeTo, -(maxRangeDays - 1));
    }
    const rangeToExclusive = addUtcDays(rangeTo, 1);

    const baseWhere = {
      tenantId: auth.tenantId,
      ...(competition ? { competitionId: competition.id } : {}),
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
        where: { ...baseWhere, day: { gte: rangeFrom, lt: rangeToExclusive } },
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
    const dailyByDay = new Map(dailyRows.map((row) => [formatDay(row.day), row._sum.count ?? 0]));
    const daily = [];
    for (let cursor = new Date(rangeFrom); cursor <= rangeTo; cursor = addUtcDays(cursor, 1)) {
      const day = formatDay(cursor);
      daily.push({ day, count: dailyByDay.get(day) ?? 0 });
    }
    const rangeTotal = daily.reduce((sum, row) => sum + row.count, 0);

    return NextResponse.json(
      {
        summary: {
          today: sumCount(todayAggregate),
          last7Days: sumCount(last7Aggregate),
          total: sumCount(totalAggregate),
          range: rangeTotal,
        },
        byRoute,
        daily,
        range: {
          from: formatDay(rangeFrom),
          to: formatDay(rangeTo),
          maxDays: maxRangeDays,
        },
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error("Failed to load visitor counters:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Besucherzaehler konnte nicht geladen werden" }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
