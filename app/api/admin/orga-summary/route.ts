import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { requireTenantRoles } from "@/lib/server-permissions";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const auth = await requireTenantRoles(session, ["ADMIN", "MODERATOR"]);
  if ("error" in auth) return auth.error;

  const competitionId = request.nextUrl.searchParams.get("competitionId");
  const now = new Date();

  const competitionWhere = competitionId
    ? { id: competitionId, tenantId: auth.tenantId }
    : { tenantId: auth.tenantId };

  const competition = competitionId
    ? await prisma.competition.findFirst({
        where: competitionWhere,
        select: { id: true },
      })
    : await prisma.competition.findFirst({
        where: { tenantId: auth.tenantId, status: "OPEN" },
        orderBy: [{ year: "desc" }, { createdAt: "desc" }],
        select: { id: true },
      }) ??
      await prisma.competition.findFirst({
        where: { tenantId: auth.tenantId },
        orderBy: [{ year: "desc" }, { createdAt: "desc" }],
        select: { id: true },
      });

  if (!competition) {
    return NextResponse.json({
      summary: {
        teamsTotal: 0,
        participantsTotal: 0,
        pendingChanges: 0,
        openClaimLinks: 0,
      },
    });
  }

  const [teamsTotal, participantsTotal, pendingChanges, teamClaimLinks, participantClaimLinks] =
    await prisma.$transaction([
      prisma.team.count({
        where: {
          competitionId: competition.id,
          deletedAt: null,
        },
      }),
      prisma.participant.count({
        where: {
          deletedAt: null,
          team: {
            competitionId: competition.id,
            deletedAt: null,
          },
        },
      }),
      prisma.pendingChange.count({
        where: {
          status: "PENDING",
          participant: {
            team: {
              competitionId: competition.id,
              competition: { tenantId: auth.tenantId },
            },
          },
        },
      }),
      prisma.registrationClaimToken.count({
        where: {
          claimedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
          team: {
            competitionId: competition.id,
            deletedAt: null,
          },
        },
      }),
      prisma.participantClaimToken.count({
        where: {
          claimedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
          participant: {
            deletedAt: null,
            team: {
              competitionId: competition.id,
              deletedAt: null,
            },
          },
        },
      }),
    ]);

  return NextResponse.json({
    summary: {
      teamsTotal,
      participantsTotal,
      pendingChanges,
      openClaimLinks: teamClaimLinks + participantClaimLinks,
    },
  });
}
