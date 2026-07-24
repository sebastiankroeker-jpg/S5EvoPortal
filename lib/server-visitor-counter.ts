import { prisma } from "@/lib/prisma";

export async function resolveVisitorCounterCompetition() {
  return (
    (await prisma.competition.findFirst({
      where: { status: "OPEN" },
      orderBy: [{ year: "desc" }, { createdAt: "desc" }],
      select: { id: true, tenantId: true },
    })) ??
    (await prisma.competition.findFirst({
      orderBy: [{ year: "desc" }, { createdAt: "desc" }],
      select: { id: true, tenantId: true },
    }))
  );
}

export function getUtcDayStart(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
