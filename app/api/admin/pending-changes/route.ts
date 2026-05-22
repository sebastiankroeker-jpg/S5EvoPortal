import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { requireTenantRoles } from "@/lib/server-permissions";

// GET /api/admin/pending-changes — Alle offenen Änderungsanträge
export async function GET() {
  const session = await getServerSession(authOptions);
  const auth = await requireTenantRoles(session, ["ADMIN", "MODERATOR"]);
  if ("error" in auth) return auth.error;

  const changes = await prisma.pendingChange.findMany({
    where: {
      status: "PENDING",
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
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ changes });
}
