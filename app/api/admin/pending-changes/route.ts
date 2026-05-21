import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

// GET /api/admin/pending-changes — Alle offenen Änderungsanträge
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { tenantRoles: true },
  });

  const isAdmin = user?.tenantRoles.some((role) => role.role === "ADMIN" || role.role === "MODERATOR");
  if (!isAdmin) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const changes = await prisma.pendingChange.findMany({
    where: { status: "PENDING" },
    include: {
      participant: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          team: {
            select: {
              id: true,
              name: true,
              contactEmail: true,
            },
          },
        },
      },
      requestedBy: { select: { name: true, email: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ changes });
}
