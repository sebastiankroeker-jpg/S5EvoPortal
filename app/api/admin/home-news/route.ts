import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { getTenantRoleFlagsForUserId, requireTenantRoles } from "@/lib/server-permissions";

const statusSchema = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);

const createSchema = z.object({
  title: z.string().trim().min(3).max(140),
  body: z.string().trim().min(3).max(2000),
  status: statusSchema.default("DRAFT"),
  competitionId: z.string().trim().optional().nullable(),
});

async function resolveScope(userId: string, fallbackTenantId: string, competitionId?: string | null) {
  const normalizedCompetitionId = competitionId?.trim() || null;
  if (!normalizedCompetitionId) return { tenantId: fallbackTenantId, competitionId: null };

  const competition = await prisma.competition.findUnique({
    where: { id: normalizedCompetitionId },
    select: { id: true, tenantId: true },
  });

  if (!competition) {
    return { error: NextResponse.json({ error: "Wettkampf nicht gefunden" }, { status: 404 }) };
  }

  const roleFlags = await getTenantRoleFlagsForUserId(userId, competition.tenantId);
  if (!roleFlags.isAdmin) {
    return { error: NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 }) };
  }

  return { tenantId: competition.tenantId, competitionId: competition.id };
}

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
  const auth = await requireTenantRoles(session, ["ADMIN"]);
  if ("error" in auth) return auth.error;

  const competitionId = request.nextUrl.searchParams.get("competitionId");
  const scope = await resolveScope(auth.user.id, auth.tenantId, competitionId);
  if ("error" in scope) return scope.error;

  const entries = await prisma.homeNewsEntry.findMany({
    where: {
      tenantId: scope.tenantId,
      ...(scope.competitionId ? { competitionId: scope.competitionId } : {}),
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
  const auth = await requireTenantRoles(session, ["ADMIN"]);
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const scope = await resolveScope(auth.user.id, auth.tenantId, parsed.data.competitionId);
  if ("error" in scope) return scope.error;

  const now = new Date();
  const entry = await prisma.homeNewsEntry.create({
    data: {
      title: parsed.data.title,
      body: parsed.data.body,
      status: parsed.data.status,
      publishedAt: parsed.data.status === "PUBLISHED" ? now : null,
      archivedAt: parsed.data.status === "ARCHIVED" ? now : null,
      tenantId: scope.tenantId,
      competitionId: scope.competitionId,
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
