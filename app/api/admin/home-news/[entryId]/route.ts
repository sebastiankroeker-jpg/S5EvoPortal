import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { getTenantRoleFlagsForUserId, requireTenantRoles } from "@/lib/server-permissions";

const updateSchema = z
  .object({
    title: z.string().trim().min(3).max(140).optional(),
    body: z.string().trim().min(3).max(2000).optional(),
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
    competitionId: z.string().trim().optional().nullable(),
  })
  .refine((data) => Boolean(data.title || data.body || data.status), {
    message: "Keine Änderungen übermittelt",
  });

async function ensureAdminScope(userId: string, fallbackTenantId: string, entryId: string, competitionId?: string | null) {
  const entry = await prisma.homeNewsEntry.findUnique({
    where: { id: entryId },
    select: { id: true, tenantId: true, competitionId: true },
  });

  if (!entry) {
    return { error: NextResponse.json({ error: "Nachricht nicht gefunden" }, { status: 404 }) };
  }

  const normalizedCompetitionId = competitionId?.trim() || entry.competitionId;
  if (!normalizedCompetitionId) {
    if (entry.tenantId !== fallbackTenantId) {
      return { error: NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 }) };
    }
    return { entry, tenantId: entry.tenantId };
  }

  const competition = await prisma.competition.findUnique({
    where: { id: normalizedCompetitionId },
    select: { id: true, tenantId: true },
  });

  if (!competition || competition.tenantId !== entry.tenantId) {
    return { error: NextResponse.json({ error: "Wettkampf nicht gefunden" }, { status: 404 }) };
  }

  const roleFlags = await getTenantRoleFlagsForUserId(userId, competition.tenantId);
  if (!roleFlags.isAdmin) {
    return { error: NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 }) };
  }

  return { entry, tenantId: competition.tenantId, competitionId: competition.id };
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ entryId: string }> },
) {
  const session = await getServerSession(authOptions);
  const auth = await requireTenantRoles(session, ["ADMIN"]);
  if ("error" in auth) return auth.error;

  const { entryId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const scope = await ensureAdminScope(auth.user.id, auth.tenantId, entryId, parsed.data.competitionId);
  if ("error" in scope) return scope.error;

  const now = new Date();
  const data: Prisma.HomeNewsEntryUpdateInput = {
    updatedBy: { connect: { id: auth.user.id } },
  };

  if (parsed.data.title) data.title = parsed.data.title;
  if (parsed.data.body) data.body = parsed.data.body;
  if (parsed.data.status) {
    data.status = parsed.data.status;
    data.publishedAt = parsed.data.status === "PUBLISHED" ? now : null;
    data.archivedAt = parsed.data.status === "ARCHIVED" ? now : null;
  }

  const entry = await prisma.homeNewsEntry.update({
    where: { id: entryId },
    data,
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      updatedBy: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ entry: serializeEntry(entry) });
}
