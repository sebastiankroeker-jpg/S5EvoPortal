import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { classifyTeam, compareClassification } from "@/lib/domain/classification";
import { isShirtOrderClosed } from "@/lib/domain/shirts";

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
      team: {
        select: {
          id: true,
          name: true,
          contactEmail: true,
          competition: {
            select: {
              id: true,
              status: true,
              shirtOrderDeadline: true,
            },
          },
        },
      },
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
  const { firstName, lastName, birthYear, gender, disciplineCode, shirtSize, email, phone } = body;

  // Teilnehmer laden
  const participant = await prisma.participant.findUnique({
    where: { id, deletedAt: null },
    include: {
      team: {
        select: {
          id: true,
          contactEmail: true,
          competition: {
            select: {
              shirtOrderDeadline: true,
            },
          },
        },
      },
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
  const shirtOrderClosed = isShirtOrderClosed(participant.team.competition?.shirtOrderDeadline);

  if (!isAdmin && !isTeamOwner && !isSelf) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  if (!isAdmin && shirtOrderClosed && shirtSize !== undefined && shirtSize !== participant.shirtSize) {
    return NextResponse.json({ error: "T-Shirt-Bestellfrist abgeschlossen" }, { status: 403 });
  }

  const changeData = {
    ...(firstName !== undefined && { firstName }),
    ...(lastName !== undefined && { lastName }),
    ...(birthYear !== undefined && { birthYear: Number(birthYear) }),
    ...(gender !== undefined && { gender }),
    ...(disciplineCode !== undefined && { disciplineCode }),
    ...(shirtSize !== undefined && { shirtSize }),
    ...(email !== undefined && { email }),
    ...(phone !== undefined && { phone }),
  };

  // Admin/Moderator + Teamchef: direkt ändern
  if (isAdmin || isTeamOwner) {
    const updated = await prisma.participant.update({
      where: { id },
      data: changeData,
    });

    // Reklassifikation prüfen wenn relevante Felder geändert wurden
    let classificationWarnings: string[] = [];
    if (changeData.birthYear !== undefined || changeData.gender !== undefined) {
      const teamWithParticipants = await prisma.team.findUnique({
        where: { id: participant.team.id },
        include: { participants: { where: { deletedAt: null } } },
      });

      if (teamWithParticipants) {
        const inputs = teamWithParticipants.participants.map(p => ({
          birthYear: p.birthYear,
          gender: p.gender as "M" | "W" | "D" | "MALE" | "FEMALE" | "DIVERSE",
        }));
        const newClassification = classifyTeam(inputs);
        const oldCode = teamWithParticipants.classificationCode || "unclassified";
        classificationWarnings = compareClassification(oldCode, newClassification);

        // Klasse aktualisieren wenn geändert
        if (newClassification.code !== oldCode) {
          await prisma.team.update({
            where: { id: participant.team.id },
            data: {
              classificationCode: newClassification.code,
              totalAge: newClassification.totalAge,
            },
          });
        }
      }
    }

    return NextResponse.json({
      participant: updated,
      applied: true,
      classificationWarnings,
    });
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
