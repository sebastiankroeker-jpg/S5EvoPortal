import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { requireTenantRoles } from "@/lib/server-permissions";

// GET /api/admin/pending-changes — Änderungsanträge für das Admin-Dashboard
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const auth = await requireTenantRoles(session, ["ADMIN", "MODERATOR"]);
  if ("error" in auth) return auth.error;

  const scope = request.nextUrl.searchParams.get("scope");
  const whereStatus =
    scope === "all"
      ? undefined
      : "PENDING";

  const changes = await prisma.pendingChange.findMany({
    where: {
      ...(whereStatus ? { status: whereStatus } : {}),
      participant: {
        team: {
          competition: {
            tenantId: auth.tenantId,
          },
        },
      },
    },
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
      reviewedBy: { select: { name: true, email: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ changes });
}
