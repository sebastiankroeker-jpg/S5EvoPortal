import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

// GET /api/participants/[id] — Teilnehmerdaten laden
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id } = await params;
  const participant = await prisma.participant.findUnique({
    where: { id, deletedAt: null },
    include: {
      team: { select: { id: true, name: true, contactEmail: true } },
      pendingChanges: {
        where: { status: "PENDING" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!participant) {
    return NextResponse.json({ error: "Teilnehmer nicht gefunden" }, { status: 404 });
  }

  // Berechtigung prüfen: eigene Daten oder Team-Owner oder Admin
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { tenantRoles: true },
  });

  const isAdmin = user?.tenantRoles.some(r => r.role === "ADMIN" || r.role === "MODERATOR");
  const isTeamOwner = participant.team.contactEmail === session.user.email;
  const isSelf = participant.email === session.user.email;

  if (!isAdmin && !isTeamOwner && !isSelf) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  return NextResponse.json(participant);
}

// PUT /api/participants/[id] — Teilnehmerdaten ändern
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { firstName, lastName, birthYear, gender, disciplineCode, email, phone } = body;

  // Teilnehmer laden
  const participant = await prisma.participant.findUnique({
    where: { id, deletedAt: null },
    include: {
      team: { select: { id: true, contactEmail: true } },
    },
  });

  if (!participant) {
    return NextResponse.json({ error: "Teilnehmer nicht gefunden" }, { status: 404 });
  }

  // User + Rollen laden
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { tenantRoles: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User nicht gefunden" }, { status: 404 });
  }

  const isAdmin = user.tenantRoles.some(r => r.role === "ADMIN" || r.role === "MODERATOR");
  const isTeamOwner = participant.team.contactEmail === session.user.email;
  const isSelf = participant.email === session.user.email;

  if (!isAdmin && !isTeamOwner && !isSelf) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const changeData = {
    ...(firstName !== undefined && { firstName }),
    ...(lastName !== undefined && { lastName }),
    ...(birthYear !== undefined && { birthYear: Number(birthYear) }),
    ...(gender !== undefined && { gender }),
    ...(disciplineCode !== undefined && { disciplineCode }),
    ...(email !== undefined && { email }),
    ...(phone !== undefined && { phone }),
  };

  // Admin/Moderator + Teamchef: direkt ändern
  if (isAdmin || isTeamOwner) {
    const updated = await prisma.participant.update({
      where: { id },
      data: changeData,
    });
    return NextResponse.json({ participant: updated, applied: true });
  }

  // Teilnehmer: PendingChange erstellen (Approval-Workflow)
  const pendingChange = await prisma.pendingChange.create({
    data: {
      changeData: JSON.stringify(changeData),
      status: "PENDING",
      participantId: id,
      requestedById: user.id,
    },
  });

  return NextResponse.json({
    pendingChange,
    applied: false,
    message: "Änderung zur Genehmigung eingereicht",
  });
}
