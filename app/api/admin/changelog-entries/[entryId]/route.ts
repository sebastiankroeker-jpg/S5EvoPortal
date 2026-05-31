import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { requireTenantRoles } from "@/lib/server-permissions";

const typeEnum = ["BUG", "REQUEST"] as const;
const statusEnum = ["OPEN", "IN_PROGRESS", "DONE"] as const;

const updateSchema = z
  .object({
    type: z.enum(typeEnum).optional(),
    status: z.enum(statusEnum).optional(),
    description: z.string().min(3).max(2000).optional(),
  })
  .refine((data) => Boolean(data.type || data.status || data.description), {
    message: "Keine Änderungen übermittelt",
  });

async function getAdminUser(): Promise<{ id: string } | NextResponse> {
  const session = await getServerSession(authOptions);
  const auth = await requireTenantRoles(session, ["ADMIN", "MODERATOR"]);
  if ("error" in auth) {
    return auth.error;
  }

  return auth.user;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ entryId: string }> }
) {
  const { entryId } = await params;

  const user = await getAdminUser();
  if (user instanceof NextResponse) {
    return user;
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { type, status, description } = parsed.data;
  const data: Prisma.ChangelogEntryUpdateInput = {};

  if (type) data.type = type;
  if (description) data.description = description;
  if (status) {
    data.status = status;
    if (status === "DONE") {
      data.resolvedAt = new Date();
      data.resolvedBy = { connect: { id: user.id } };
    } else {
      data.resolvedAt = null;
      data.resolvedBy = { disconnect: true };
    }
  }

  try {
    const entry = await prisma.changelogEntry.update({
      where: { id: entryId },
      data,
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        resolvedBy: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({ entry });
  } catch {
    return NextResponse.json({ error: "Eintrag nicht gefunden" }, { status: 404 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ entryId: string }> }
) {
  const { entryId } = await params;

  const user = await getAdminUser();
  if (user instanceof NextResponse) {
    return user;
  }

  try {
    await prisma.changelogEntry.delete({
      where: { id: entryId },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Eintrag nicht gefunden" }, { status: 404 });
  }
}
