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

  // Nur Admin/Moderator
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { tenantRoles: true },
  });

  const isAdmin = user?.tenantRoles.some(r => r.role === "ADMIN" || r.role === "MODERATOR");
  if (!isAdmin) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const changes = await prisma.pendingChange.findMany({
    where: { status: "PENDING" },
    include: {
      participant: {
        select: { id: true, firstName: true, lastName: true, team: { select: { name: true } } },
      },
      requestedBy: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ changes });
}
