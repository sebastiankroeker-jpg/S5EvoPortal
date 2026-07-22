import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

function serializeEntry(entry: {
  id: string;
  title: string;
  body: string;
  publishedAt: Date | null;
  updatedAt: Date;
}) {
  return {
    id: entry.id,
    title: entry.title,
    body: entry.body,
    publishedAt: entry.publishedAt,
    updatedAt: entry.updatedAt,
  };
}

export async function GET(request: NextRequest) {
  const competitionId = request.nextUrl.searchParams.get("competitionId")?.trim() || null;

  const entries = await prisma.homeNewsEntry.findMany({
    where: {
      status: "PUBLISHED",
      archivedAt: null,
      ...(competitionId ? { competitionId } : {}),
    },
    orderBy: [
      { publishedAt: "desc" },
      { updatedAt: "desc" },
    ],
    take: 3,
    select: {
      id: true,
      title: true,
      body: true,
      publishedAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ entries: entries.map(serializeEntry) });
}
