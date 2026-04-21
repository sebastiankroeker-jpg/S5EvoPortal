import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

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

async function getAdminUser(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { tenantRoles: true },
  });

  const isAdmin = user?.tenantRoles.some((role) => role.role === "ADMIN" || role.role === "MODERATOR");
  if (!user || !isAdmin) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  return user;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ entryId: string }> }
) {
  const { entryId } = await params;

  const user = await getAdminUser(request);
  if (user instanceof NextResponse) {
    return user;
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { type, status, description } = parsed.data;
  const data: any = {};

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
  } catch (error) {
    return NextResponse.json({ error: "Eintrag nicht gefunden" }, { status: 404 });
  }
}
