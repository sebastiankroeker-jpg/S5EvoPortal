import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

// PUT /api/admin/pending-changes/[id] — Approve oder Reject
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { tenantRoles: true },
  });

  const isAdmin = user?.tenantRoles.some(r => r.role === "ADMIN" || r.role === "MODERATOR");
  if (!isAdmin || !user) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { action } = body; // "approve" | "reject"

  if (!["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Ungültige Aktion" }, { status: 400 });
  }

  const pendingChange = await prisma.pendingChange.findUnique({
    where: { id },
    include: { participant: true },
  });

  if (!pendingChange || pendingChange.status !== "PENDING") {
    return NextResponse.json({ error: "Änderungsantrag nicht gefunden oder bereits bearbeitet" }, { status: 404 });
  }

  if (action === "approve") {
    // Änderungen auf Teilnehmer anwenden
    const changeData = JSON.parse(pendingChange.changeData);
    await prisma.$transaction([
      prisma.participant.update({
        where: { id: pendingChange.participantId },
        data: changeData,
      }),
      prisma.pendingChange.update({
        where: { id },
        data: {
          status: "APPROVED",
          reviewedAt: new Date(),
          reviewedById: user.id,
        },
      }),
    ]);

    return NextResponse.json({ status: "approved", message: "Änderung genehmigt und angewendet" });
  }

  // Reject
  await prisma.pendingChange.update({
    where: { id },
    data: {
      status: "REJECTED",
      reviewedAt: new Date(),
      reviewedById: user.id,
    },
  });

  return NextResponse.json({ status: "rejected", message: "Änderung abgelehnt" });
}
