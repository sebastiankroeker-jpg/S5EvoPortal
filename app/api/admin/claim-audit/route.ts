import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { requireTenantRoles } from "@/lib/server-permissions";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const auth = await requireTenantRoles(session, ["ADMIN", "MODERATOR"]);
  if ("error" in auth) return auth.error;

  const url = new URL(request.url);
  const suspiciousOnly = url.searchParams.get("suspiciousOnly") === "true";
  const limit = Math.min(Number(url.searchParams.get("limit") || 50), 200);
  const tenantTeams = await prisma.team.findMany({
    where: {
      competition: {
        tenantId: auth.tenantId,
      },
    },
    select: { id: true },
  });

  const events = await prisma.registrationClaimAuditEvent.findMany({
    where: {
      ...(suspiciousOnly ? { suspicious: true } : {}),
      teamId: { in: tenantTeams.map((team) => team.id) },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ events });
}
