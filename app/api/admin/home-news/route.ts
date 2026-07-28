import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { requireCompetitionRoles } from "@/lib/server-permissions";

const statusSchema = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);

const createSchema = z.object({
  title: z.string().trim().min(3).max(140),
  body: z.string().trim().min(3).max(2000),
  status: statusSchema.default("DRAFT"),
  competitionId: z.string().trim().optional().nullable(),
});

function serializeEntry(entry: {
  id: string;
  title: string;
  body: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  publishedAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  competitionId: string | null;
  createdBy: { id: string; name: string | null; email: string };
  updatedBy: { id: string; name: string | null; email: string } | null;
}) {
  return {
    id: entry.id,
    title: entry.title,
    body: entry.body,
    status: entry.status,
    publishedAt: entry.publishedAt,
    archivedAt: entry.archivedAt,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    competitionId: entry.competitionId,
    createdBy: entry.createdBy,
    updatedBy: entry.updatedBy,
  };
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const auth = await requireCompetitionRoles(session, ["ADMIN"], request.nextUrl.searchParams.get("competitionId"));
  if ("error" in auth) return auth.error;

  const entries = await prisma.homeNewsEntry.findMany({
    where: {
      tenantId: auth.tenantId,
      competitionId: auth.competitionId,
    },
    orderBy: [
      { status: "asc" },
      { publishedAt: "desc" },
      { updatedAt: "desc" },
    ],
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      updatedBy: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ entries: entries.map(serializeEntry) });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const auth = await requireCompetitionRoles(session, ["ADMIN"], parsed.data.competitionId);
  if ("error" in auth) return auth.error;

  const now = new Date();
  const entry = await prisma.homeNewsEntry.create({
    data: {
      title: parsed.data.title,
      body: parsed.data.body,
      status: parsed.data.status,
      publishedAt: parsed.data.status === "PUBLISHED" ? now : null,
      archivedAt: parsed.data.status === "ARCHIVED" ? now : null,
      tenantId: auth.tenantId,
      competitionId: auth.competitionId,
      createdById: auth.user.id,
      updatedById: auth.user.id,
    },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      updatedBy: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ entry: serializeEntry(entry) }, { status: 201 });
}
