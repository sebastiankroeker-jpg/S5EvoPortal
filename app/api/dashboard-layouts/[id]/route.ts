import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  TEAM_DASHBOARD_KEY,
  TeamDashboardLayoutConfigSchema,
  sanitizeTeamDashboardLayoutConfig,
} from "@/lib/dashboard-layout-config";
import { prisma } from "@/lib/prisma";
import { requireTenantRoles, type AppRole } from "@/lib/server-permissions";

export const runtime = "nodejs";

const DASHBOARD_ACCESS_ROLES: AppRole[] = ["ADMIN", "MODERATOR", "TEAMCHEF", "TEILNEHMER"];

const updateLayoutSchema = z.object({
  name: z.string().trim().min(1, "Name fehlt").max(80, "Name zu lang").optional(),
  isDefault: z.boolean().optional(),
  config: TeamDashboardLayoutConfigSchema.optional(),
});

async function loadLayoutForMutation(id: string) {
  const layout = await prisma.dashboardLayout.findFirst({
    where: { id, dashboardKey: TEAM_DASHBOARD_KEY, deletedAt: null },
  });
  if (!layout) {
    return { error: NextResponse.json({ error: "Layout nicht gefunden" }, { status: 404 }) };
  }

  const session = await getServerSession(authOptions);
  const auth = await requireTenantRoles(session, DASHBOARD_ACCESS_ROLES, {
    tenantId: layout.tenantId,
    createIfMissing: true,
  });
  if ("error" in auth) return auth;

  if (layout.scope === "GLOBAL" && !auth.isAdmin) {
    return { error: NextResponse.json({ error: "Nur Admins duerfen globale Layouts verwalten." }, { status: 403 }) };
  }

  if (layout.scope === "PERSONAL" && layout.ownerId !== auth.user.id) {
    return { error: NextResponse.json({ error: "Layout nicht gefunden" }, { status: 404 }) };
  }

  return { layout, auth };
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const loaded = await loadLayoutForMutation(id);
  if ("error" in loaded) return loaded.error;

  const body = await request.json().catch(() => null);
  const parsed = updateLayoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const nextConfig = data.config
    ? sanitizeTeamDashboardLayoutConfig(data.config, { isAdmin: loaded.auth.isAdmin })
    : undefined;

  try {
    const layout = await prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.dashboardLayout.updateMany({
          where: {
            tenantId: loaded.layout.tenantId,
            dashboardKey: TEAM_DASHBOARD_KEY,
            scope: loaded.layout.scope,
            ownerId: loaded.layout.ownerId,
            competitionId: loaded.layout.competitionId,
            deletedAt: null,
            NOT: { id: loaded.layout.id },
          },
          data: { isDefault: false },
        });
      }

      return tx.dashboardLayout.update({
        where: { id: loaded.layout.id },
        data: {
          ...(data.name ? { name: data.name } : {}),
          ...(typeof data.isDefault === "boolean" ? { isDefault: data.isDefault } : {}),
          ...(nextConfig ? { config: nextConfig, configVersion: nextConfig.version } : {}),
          updatedById: loaded.auth.user.id,
        },
      });
    });

    return NextResponse.json({ layout: serializeLayout(layout, { isAdmin: loaded.auth.isAdmin }) });
  } catch (error) {
    console.error("Dashboard layout update failed", error);
    return NextResponse.json({ error: "Layout konnte nicht gespeichert werden." }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const loaded = await loadLayoutForMutation(id);
  if ("error" in loaded) return loaded.error;

  await prisma.dashboardLayout.update({
    where: { id: loaded.layout.id },
    data: {
      deletedAt: new Date(),
      updatedById: loaded.auth.user.id,
      isDefault: false,
    },
  });

  return NextResponse.json({ success: true });
}
