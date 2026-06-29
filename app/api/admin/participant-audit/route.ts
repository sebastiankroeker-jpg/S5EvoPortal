import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { requireTenantRoles } from "@/lib/server-permissions";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const auth = await requireTenantRoles(session, ["ADMIN", "MODERATOR"]);
  if ("error" in auth) return auth.error;

  const searchParams = request.nextUrl.searchParams;
  const competitionId = searchParams.get("competitionId");
  const action = searchParams.get("action") || "DIRECT_CHANGE";
  const limitParam = Number(searchParams.get("limit") || 20);
  const take = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 20;

  const logs = await prisma.participantAuditLog.findMany({
    where: {
      action: action === "DIRECT_CHANGE" ? "DIRECT_CHANGE" : undefined,
      participant: {
        team: {
          competition: {
            tenantId: auth.tenantId,
            ...(competitionId ? { id: competitionId } : {}),
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      action: true,
      beforeData: true,
      afterData: true,
      message: true,
      createdAt: true,
      actor: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      participant: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          team: {
            select: {
              id: true,
              name: true,
              competition: {
                select: {
                  id: true,
                  name: true,
                  year: true,
                },
              },
            },
          },
        },
      },
    },
  });

  return NextResponse.json({ logs });
}
