import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { requireCompetitionTenantRoles } from "@/lib/server-permissions";

// GET /api/admin/participants — Alle Teilnehmer flat
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get("search")?.toLowerCase() || "";
  const competitionId = searchParams.get("competitionId");
  const session = await getServerSession(authOptions);
  const auth = await requireCompetitionTenantRoles(session, ["ADMIN", "MODERATOR"], competitionId);
  if ("error" in auth) return auth.error;

  const canSeeAdminOnlyFields = auth.isAdmin;

  const participants = await prisma.participant.findMany({
    where: {
      deletedAt: null,
      team: {
        competition: {
          tenantId: auth.tenantId,
        },
        ...(competitionId ? { competitionId } : {}),
      },
      ...(search ? {
        OR: [
          { firstName: { contains: search, mode: "insensitive" as const } },
          { lastName: { contains: search, mode: "insensitive" as const } },
          ...(canSeeAdminOnlyFields ? [{ email: { contains: search, mode: "insensitive" as const } }] : []),
          { team: { name: { contains: search, mode: "insensitive" as const } } },
        ],
      } : {}),
    },
    include: {
      team: { select: { id: true, name: true, classificationCode: true } },
      pendingChanges: {
        where: { status: "PENDING" },
        select: { id: true, status: true },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return NextResponse.json({
    participants: participants.map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      birthYear: p.birthYear,
      gender: p.gender,
      disciplineCode: p.disciplineCode,
      participantPublicationPreference: p.participantPublicationPreference,
      shirtSize: canSeeAdminOnlyFields ? p.shirtSize : null,
      moderationNote: p.moderationNote,
      email: canSeeAdminOnlyFields ? p.email : null,
      teamId: p.team.id,
      teamName: p.team.name,
      teamCategory: p.team.classificationCode || "–",
      hasPendingChange: p.pendingChanges.length > 0,
    })),
    total: participants.length,
    canSeeAdminOnlyFields,
  });
}
