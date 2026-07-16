import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { requireTenantRoles } from "@/lib/server-permissions";

const ALLOWED_ACTIONS = new Set([
  "TEAM_SOFT_DELETED",
  "TEAM_RESTORED",
  "TEAM_LIFECYCLE_MAIL",
  "TEAM_MANAGER_GRANTED",
  "TEAM_MANAGER_REVOKED",
  "MARKETPLACE_TEAM_UPDATED",
  "PARTICIPANT_CHANGE_MAIL",
  "COMPETITION_RESET_DRY_RUN",
  "COMPETITION_RESET_STARTED",
  "COMPETITION_RESET_COMPLETED",
  "RESULT_STAGING_RESET_EXECUTED",
]);

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const auth = await requireTenantRoles(session, ["ADMIN"]);
  if ("error" in auth) return auth.error;

  const searchParams = request.nextUrl.searchParams;
  const competitionId = searchParams.get("competitionId");
  const scopeType = searchParams.get("scopeType");
  const scopeId = searchParams.get("scopeId");
  const actionParams = searchParams.getAll("action").filter((action) => ALLOWED_ACTIONS.has(action));
  const limitParam = Number(searchParams.get("limit") || 30);
  const take = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 30;

  const events = await prisma.auditEvent.findMany({
    where: {
      tenantId: auth.tenantId,
      ...(competitionId ? { competitionId } : {}),
      ...(scopeType ? { scopeType } : {}),
      ...(scopeId ? { scopeId } : {}),
      ...(actionParams.length > 0 ? { action: { in: actionParams } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      action: true,
      scopeType: true,
      scopeId: true,
      entityType: true,
      entityId: true,
      reason: true,
      beforeData: true,
      afterData: true,
      meta: true,
      createdAt: true,
      actor: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      competition: {
        select: {
          id: true,
          name: true,
          year: true,
        },
      },
    },
  });

  return NextResponse.json({ events });
}
