import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  TEAM_DASHBOARD_KEY,
  TeamDashboardLayoutConfigSchema,
  DASHBOARD_LAYOUT_SCOPES,
  sanitizeTeamDashboardLayoutConfig,
} from "@/lib/dashboard-layout-config";
import { prisma } from "@/lib/prisma";
import { requireTenantRoles, type AppRole } from "@/lib/server-permissions";

export const runtime = "nodejs";

const DASHBOARD_ACCESS_ROLES: AppRole[] = ["ADMIN", "MODERATOR", "TEAMCHEF", "TEILNEHMER"];

const createLayoutSchema = z.object({
  name: z.string().trim().min(1, "Name fehlt").max(80, "Name zu lang"),
  scope: z.enum(DASHBOARD_LAYOUT_SCOPES).default("PERSONAL"),
  competitionId: z.string().trim().min(1).optional().nullable(),
  isDefault: z.boolean().optional(),
  config: TeamDashboardLayoutConfigSchema,
});

async function resolveLayoutAuth(competitionId?: string | null) {
  const session = await getServerSession(authOptions);
  const competition = competitionId
    ? await prisma.competition.findUnique({
        where: { id: competitionId },
        select: { id: true, tenantId: true },
      })
    : null;

  if (competitionId && !competition) {
    return { error: NextResponse.json({ error: "Wettkampf nicht gefunden" }, { status: 404 }) };
  }

  const auth = await requireTenantRoles(session, DASHBOARD_ACCESS_ROLES, {
    tenantId: competition?.tenantId,
    createIfMissing: true,
  });
  if ("error" in auth) return auth;

  return { ...auth, competition };
}

function serializeLayout(
  layout: {
    id: string;
    name: string;
    scope: "PERSONAL" | "GLOBAL";
    competitionId: string | null;
    ownerId: string | null;
    isDefault: boolean;
    configVersion: number;
    config: unknown;
    createdAt: Date;
    updatedAt: Date;
  },
  options: { isAdmin: boolean },
) {
  return {
    id: layout.id,
    name: layout.name,
    scope: layout.scope,
    competitionId: layout.competitionId,
    ownerId: layout.ownerId,
    isDefault: layout.isDefault,
    configVersion: layout.configVersion,
    config: sanitizeTeamDashboardLayoutConfig(layout.config, options),
    createdAt: layout.createdAt.toISOString(),
    updatedAt: layout.updatedAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const competitionId = request.nextUrl.searchParams.get("competitionId")?.trim() || null;
  const auth = await resolveLayoutAuth(competitionId);
  if ("error" in auth) return auth.error;

  const layouts = await prisma.dashboardLayout.findMany({
    where: {
      tenantId: auth.tenantId,
      dashboardKey: TEAM_DASHBOARD_KEY,
      deletedAt: null,
      OR: [
        { scope: "GLOBAL", competitionId: null },
        ...(competitionId ? [{ scope: "GLOBAL" as const, competitionId }] : []),
        { scope: "PERSONAL", ownerId: auth.user.id, competitionId: null },
        ...(competitionId ? [{ scope: "PERSONAL" as const, ownerId: auth.user.id, competitionId }] : []),
      ],
    },
    orderBy: [{ scope: "asc" }, { isDefault: "desc" }, { name: "asc" }],
  });

  return NextResponse.json({
    layouts: layouts.map((layout) => serializeLayout(layout, { isAdmin: auth.isAdmin })),
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = createLayoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const auth = await resolveLayoutAuth(data.competitionId || null);
  if ("error" in auth) return auth.error;

  if (data.scope === "GLOBAL" && !auth.isAdmin) {
    return NextResponse.json({ error: "Nur Admins duerfen globale Layouts speichern." }, { status: 403 });
  }

  const config = sanitizeTeamDashboardLayoutConfig(data.config, { isAdmin: auth.isAdmin });
  const competitionId = data.competitionId || null;
  const ownerId = data.scope === "PERSONAL" ? auth.user.id : null;

  try {
    const layout = await prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.dashboardLayout.updateMany({
          where: {
            tenantId: auth.tenantId,
            dashboardKey: TEAM_DASHBOARD_KEY,
            scope: data.scope,
            ownerId,
            competitionId,
            deletedAt: null,
          },
          data: { isDefault: false },
        });
      }

      return tx.dashboardLayout.create({
        data: {
          tenantId: auth.tenantId,
          dashboardKey: TEAM_DASHBOARD_KEY,
          scope: data.scope,
          name: data.name,
          configVersion: config.version,
          config,
          ownerId,
          createdById: auth.user.id,
          competitionId,
          isDefault: data.isDefault ?? false,
        },
      });
    });

    return NextResponse.json({ layout: serializeLayout(layout, { isAdmin: auth.isAdmin }) }, { status: 201 });
  } catch (error) {
    console.error("Dashboard layout create failed", error);
    return NextResponse.json({ error: "Layout konnte nicht gespeichert werden." }, { status: 500 });
  }
}
