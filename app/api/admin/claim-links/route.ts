import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { buildRegistrationClaimUrl, createRegistrationClaimToken } from "@/lib/registration-claim";
import { requireTenantRoles } from "@/lib/server-permissions";

function isExpired(value?: Date | string | null) {
  if (!value) return false;
  return new Date(value).getTime() < Date.now();
}

function getTokenStatus(token?: {
  claimedAt?: Date | string | null;
  revokedAt?: Date | string | null;
  expiresAt?: Date | string | null;
} | null) {
  if (!token) return "none";
  if (token.revokedAt) return "revoked";
  if (token.claimedAt) return "claimed";
  if (isExpired(token.expiresAt)) return "expired";
  return "active";
}

async function requireAdminAccess() {
  const session = await getServerSession(authOptions);
  return requireTenantRoles(session, ["ADMIN", "MODERATOR"]);
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminAccess();
  if ("error" in auth) return auth.error;

  const competitionId = request.nextUrl.searchParams.get("competitionId");
  const tenant = await prisma.tenant.findUnique({
    where: { id: auth.tenantId },
    select: { claimLinksEnabled: true },
  });

  const teams = await prisma.team.findMany({
    where: {
      deletedAt: null,
      competition: {
        tenantId: auth.tenantId,
        ...(competitionId ? { id: competitionId } : {}),
      },
    },
    include: {
      owner: { select: { email: true, name: true } },
      registrationClaimTokens: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          claimedByUser: { select: { email: true, name: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({
    claimLinksEnabled: tenant?.claimLinksEnabled ?? true,
    items: teams.map((team) => {
      const latestToken = team.registrationClaimTokens[0] ?? null;
      return {
        teamId: team.id,
        teamName: team.name,
        category: team.classificationCode || "–",
        contactEmail: team.contactEmail || team.owner?.email || "",
        contactName: team.contactName || team.owner?.name || "",
        ownerEmail: team.owner?.email || "",
        token: latestToken
          ? {
              id: latestToken.id,
              status: getTokenStatus(latestToken),
              suggestedEmail: latestToken.suggestedEmail,
              suggestedName: latestToken.suggestedName,
              createdAt: latestToken.createdAt,
              expiresAt: latestToken.expiresAt,
              claimedAt: latestToken.claimedAt,
              revokedAt: latestToken.revokedAt,
              claimedBy: latestToken.claimedByUser,
            }
          : null,
      };
    }),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminAccess();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => ({}));
  const teamId = typeof body.teamId === "string" ? body.teamId : null;

  if (!teamId) {
    return NextResponse.json({ error: "teamId fehlt" }, { status: 400 });
  }

  const team = await prisma.team.findFirst({
    where: {
      id: teamId,
      deletedAt: null,
      competition: {
        tenantId: auth.tenantId,
      },
    },
    include: {
      owner: { select: { email: true, name: true } },
      competition: { select: { registrationDeadline: true } },
    },
  });

  if (!team) {
    return NextResponse.json({ error: "Team nicht gefunden" }, { status: 404 });
  }

  const suggestedEmail = team.contactEmail || team.owner?.email || "";
  if (!suggestedEmail) {
    return NextResponse.json({ error: "Für dieses Team ist keine Kontakt-E-Mail hinterlegt" }, { status: 400 });
  }

  await prisma.registrationClaimToken.updateMany({
    where: {
      teamId,
      revokedAt: null,
      claimedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });

  const claimToken = createRegistrationClaimToken({
    maxExpiresAt: team.competition.registrationDeadline || null,
  });

  const tokenRecord = await prisma.registrationClaimToken.create({
    data: {
      tokenHash: claimToken.tokenHash,
      suggestedEmail,
      suggestedName: team.contactName || team.owner?.name || null,
      expiresAt: claimToken.expiresAt,
      teamId: team.id,
    },
  });

  return NextResponse.json({
    success: true,
    token: {
      id: tokenRecord.id,
      status: getTokenStatus(tokenRecord),
      suggestedEmail: tokenRecord.suggestedEmail,
      suggestedName: tokenRecord.suggestedName,
      createdAt: tokenRecord.createdAt,
      expiresAt: tokenRecord.expiresAt,
      claimedAt: tokenRecord.claimedAt,
      revokedAt: tokenRecord.revokedAt,
    },
    claimUrl: buildRegistrationClaimUrl(claimToken.rawToken),
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminAccess();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => ({}));
  if (body.action === "toggleGlobal") {
    const enabled = Boolean(body.enabled);
    const tenant = await prisma.tenant.findUnique({
      where: { id: auth.tenantId },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Tenant nicht gefunden" }, { status: 404 });
    }

    const updatedTenant = await prisma.tenant.update({
      where: { id: tenant.id },
      data: { claimLinksEnabled: enabled },
    });

    return NextResponse.json({
      success: true,
      claimLinksEnabled: updatedTenant.claimLinksEnabled,
    });
  }

  const tokenId = typeof body.tokenId === "string" ? body.tokenId : null;

  if (!tokenId) {
    return NextResponse.json({ error: "tokenId fehlt" }, { status: 400 });
  }

  const token = await prisma.registrationClaimToken.findUnique({
    where: { id: tokenId },
    include: {
      team: {
        include: {
          competition: {
            select: { tenantId: true },
          },
        },
      },
    },
  });

  if (!token) {
    return NextResponse.json({ error: "Claim-Link nicht gefunden" }, { status: 404 });
  }

  if (token.team.competition.tenantId !== auth.tenantId) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const updated = await prisma.registrationClaimToken.update({
    where: { id: tokenId },
    data: { revokedAt: token.revokedAt || new Date() },
  });

  return NextResponse.json({
    success: true,
    token: {
      id: updated.id,
      status: getTokenStatus(updated),
      createdAt: updated.createdAt,
      expiresAt: updated.expiresAt,
      claimedAt: updated.claimedAt,
      revokedAt: updated.revokedAt,
    },
  });
}
