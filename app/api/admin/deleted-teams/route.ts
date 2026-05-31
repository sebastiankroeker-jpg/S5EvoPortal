import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { requireTenantRoles } from "@/lib/server-permissions";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const auth = await requireTenantRoles(session, ["ADMIN"]);
  if ("error" in auth) return auth.error;

  const competitionId = request.nextUrl.searchParams.get("competitionId");

  const teams = await prisma.team.findMany({
    where: {
      deletedAt: { not: null },
      competition: {
        tenantId: auth.tenantId,
        ...(competitionId ? { id: competitionId } : {}),
      },
    },
    orderBy: { deletedAt: "desc" },
    take: 100,
    select: {
      id: true,
      name: true,
      contactName: true,
      contactEmail: true,
      createdAt: true,
      updatedAt: true,
      deletedAt: true,
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
          deletedAt: true,
        },
      },
      competition: {
        select: {
          id: true,
          name: true,
          year: true,
        },
      },
      participants: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          deletedAt: true,
          userId: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  return NextResponse.json({
    teams: teams.map((team) => {
      const deletedParticipants = team.participants.filter((participant) => participant.deletedAt);
      const linkedParticipants = team.participants.filter((participant) => participant.userId);

      return {
        id: team.id,
        name: team.name,
        contactName: team.contactName,
        contactEmail: team.contactEmail,
        createdAt: team.createdAt,
        updatedAt: team.updatedAt,
        deletedAt: team.deletedAt,
        owner: team.owner,
        competition: team.competition,
        participantCount: team.participants.length,
        deletedParticipantCount: deletedParticipants.length,
        linkedParticipantCount: linkedParticipants.length,
        participants: team.participants.map((participant) => ({
          id: participant.id,
          name: `${participant.firstName} ${participant.lastName}`.trim(),
          deletedAt: participant.deletedAt,
          linkedToUser: Boolean(participant.userId),
        })),
      };
    }),
  });
}
