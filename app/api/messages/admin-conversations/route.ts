import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  buildMessagePreview,
  normalizeSenderDisplayMode,
  ORG_MESSAGE_SENDER_LABEL,
  normalizeMessageBody,
  normalizeMessageSubject,
  serializeConversation,
} from "@/lib/messaging";
import { sendMessageNotificationEmail } from "@/lib/mail/message-notification";
import { prisma } from "@/lib/prisma";
import { requireTenantRoles } from "@/lib/server-permissions";

function conversationInclude() {
  return {
    createdBy: { select: { id: true, name: true, email: true } },
    closedBy: { select: { id: true, name: true, email: true } },
    tenant: { select: { id: true, name: true } },
    competition: { select: { id: true, name: true, year: true } },
    team: { select: { id: true, name: true } },
    participant: { select: { id: true, firstName: true, lastName: true } },
    participants: {
      where: { leftAt: null },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { joinedAt: "asc" as const },
    },
    messages: {
      where: { deletedAt: null },
      include: { sender: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" as const },
    },
  };
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const auth = await requireTenantRoles(session, ["ADMIN", "MODERATOR"]);
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => ({}));
  const targetUserId = typeof body.targetUserId === "string" ? body.targetUserId : "";
  const teamId = typeof body.teamId === "string" && body.teamId ? body.teamId : null;
  const participantId = typeof body.participantId === "string" && body.participantId ? body.participantId : null;
  const messageBody = normalizeMessageBody(body.body);
  const senderDisplayMode = normalizeSenderDisplayMode(body.senderDisplayMode, true);

  if (!targetUserId) {
    return NextResponse.json({ error: "Zielperson fehlt" }, { status: 400 });
  }
  if (targetUserId === auth.user.id) {
    return NextResponse.json({ error: "Du kannst dir hier keine Nachricht selbst senden" }, { status: 400 });
  }
  if (messageBody.length < 2) {
    return NextResponse.json({ error: "Nachricht ist zu kurz" }, { status: 400 });
  }

  const [targetUser, tenantRole, participant, team] = await Promise.all([
    prisma.user.findFirst({
      where: { id: targetUserId, deletedAt: null },
      select: { id: true, name: true, email: true, authentikSub: true },
    }),
    prisma.tenantRole.findFirst({
      where: { userId: targetUserId, tenantId: auth.tenantId },
      select: { id: true },
    }),
    participantId
      ? prisma.participant.findFirst({
          where: {
            id: participantId,
            deletedAt: null,
            userId: targetUserId,
            team: { deletedAt: null, competition: { tenantId: auth.tenantId } },
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            teamId: true,
            team: { select: { competitionId: true } },
          },
        })
      : null,
    teamId
      ? prisma.team.findFirst({
          where: {
            id: teamId,
            deletedAt: null,
            competition: { tenantId: auth.tenantId },
          },
          select: {
            id: true,
            name: true,
            competitionId: true,
            ownerId: true,
            teamChiefId: true,
            memberRoles: {
              where: { userId: targetUserId, role: "TEAM_MANAGER", revokedAt: null },
              select: { id: true },
            },
          },
        })
      : null,
  ]);

  if (!targetUser) {
    return NextResponse.json({ error: "Zielperson nicht gefunden" }, { status: 404 });
  }
  if (!targetUser.authentikSub) {
    return NextResponse.json({ error: "Zielperson hat kein registriertes Portal-Konto" }, { status: 403 });
  }

  if (participantId && !participant) {
    return NextResponse.json({ error: "Teilnehmer passt nicht zur Zielperson" }, { status: 403 });
  }
  if (teamId && !team) {
    return NextResponse.json({ error: "Mannschaft nicht gefunden" }, { status: 404 });
  }

  const teamUserMatch = Boolean(
    team &&
      (team.ownerId === targetUserId ||
        team.teamChiefId === targetUserId ||
        team.memberRoles.length > 0),
  );
  const contextAllowsTarget = Boolean(tenantRole || participant || teamUserMatch);
  if (!contextAllowsTarget) {
    return NextResponse.json({ error: "Zielperson gehoert nicht zum aktuellen Kontext" }, { status: 403 });
  }

  const competitionId = participant?.team.competitionId ?? team?.competitionId ?? null;
  const resolvedTeamId = participant?.teamId ?? team?.id ?? null;
  const now = new Date();
  const subject = normalizeMessageSubject(
    body.subject,
    senderDisplayMode === "ORG" ? "Nachricht vom Orga-Team" : "Persoenliche Nachricht",
  );

  const conversation = await prisma.$transaction(async (tx) => {
    const created = await tx.conversation.create({
      data: {
        type: "SUPPORT",
        status: "WAITING_FOR_USER",
        subject,
        tenantId: auth.tenantId,
        competitionId,
        teamId: resolvedTeamId,
        participantId: participant?.id ?? null,
        createdById: auth.user.id,
        lastMessageAt: now,
        messages: {
          create: {
            senderId: auth.user.id,
            senderDisplayMode,
            body: messageBody,
            bodyPreview: buildMessagePreview(messageBody),
          },
        },
      },
    });

    const participantRows = new Map<string, "OWNER" | "MEMBER" | "ADMIN" | "MODERATOR">();
    participantRows.set(targetUser.id, "OWNER");
    if (senderDisplayMode === "PERSONAL") {
      participantRows.set(auth.user.id, "MEMBER");
    } else {
      const adminRoles = await tx.tenantRole.findMany({
        where: {
          tenantId: auth.tenantId,
          role: { in: ["ADMIN", "MODERATOR"] },
          user: { deletedAt: null },
        },
        select: { userId: true, role: true },
      });

      for (const adminRole of adminRoles) {
        participantRows.set(adminRole.userId, adminRole.role === "ADMIN" ? "ADMIN" : "MODERATOR");
      }
    }

    await tx.conversationParticipant.createMany({
      data: Array.from(participantRows.entries()).map(([userId, role]) => ({
        conversationId: created.id,
        userId,
        role,
        lastReadAt: userId === auth.user.id ? now : null,
      })),
      skipDuplicates: true,
    });

    return tx.conversation.findUniqueOrThrow({
      where: { id: created.id },
      include: conversationInclude(),
    });
  });

  await sendMessageNotificationEmail({
    to: [targetUser.email],
    subject: "Neue Nachricht im S5Evo-Portal",
    conversationSubject: conversation.subject,
    actorName: senderDisplayMode === "ORG" ? ORG_MESSAGE_SENDER_LABEL : auth.user.name || "Kontakt",
    messages: conversation.messages.map((message) => ({
      id: message.id,
      body: message.body,
      bodyPreview: message.bodyPreview,
      createdAt: message.createdAt,
      senderDisplayName:
        message.senderDisplayMode === "ORG"
          ? ORG_MESSAGE_SENDER_LABEL
          : message.sender.name || "Kontakt",
    })),
  }).catch((error) => {
    console.warn("Admin message notification skipped/failed", error);
  });

  return NextResponse.json({ conversation: serializeConversation(conversation, auth.user.id) }, { status: 201 });
}
