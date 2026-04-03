import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

// GET /api/admin/participants — Alle Teilnehmer flat
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { tenantRoles: true },
  });

  const isAdmin = user?.tenantRoles.some(r => r.role === "ADMIN" || r.role === "MODERATOR");
  if (!isAdmin) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get("search")?.toLowerCase() || "";
  const competitionId = searchParams.get("competitionId");

  const participants = await prisma.participant.findMany({
    where: {
      deletedAt: null,
      // Filter by competition if specified
      ...(competitionId ? { team: { competitionId } } : {}),
      ...(search ? {
        OR: [
          { firstName: { contains: search, mode: "insensitive" as const } },
          { lastName: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
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
      email: p.email,
      phone: p.phone,
      teamId: p.team.id,
      teamName: p.team.name,
      teamCategory: p.team.classificationCode || "–",
      hasPendingChange: p.pendingChanges.length > 0,
    })),
    total: participants.length,
  });
}
