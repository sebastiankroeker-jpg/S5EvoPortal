import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
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

  const url = new URL(request.url);
  const suspiciousOnly = url.searchParams.get("suspiciousOnly") === "true";
  const limit = Math.min(Number(url.searchParams.get("limit") || 50), 200);

  const events = await prisma.registrationClaimAuditEvent.findMany({
    where: suspiciousOnly ? { suspicious: true } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ events });
}
