import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { resolveCurrentUser } from "@/lib/current-user";
import {
  buildMessagePreview,
  canManageSupportConversations,
  getDefaultMessagingTenantId,
  getSupportContextsForUser,
  normalizeMessageBody,
  normalizeMessageSubject,
  serializeConversation,
} from "@/lib/messaging";
import { sendMessageNotificationEmail } from "@/lib/mail/message-notification";
import { prisma } from "@/lib/prisma";

async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  const resolved = await resolveCurrentUser(session, { createIfMissing: true });
  return resolved.user;
}

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

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") === "admin" ? "admin" : "mine";
  const requestedStatus = url.searchParams.get("status");
  const allowedStatuses = new Set(["OPEN", "WAITING_FOR_ADMIN", "WAITING_FOR_USER", "CLOSED"]);
  const status = allowedStatuses.has(requestedStatus || "") ? requestedStatus : null;
  const tenantId = await getDefaultMessagingTenantId(user.id, user.email);

  if (!tenantId) {
    return NextResponse.json({ conversations: [], canManageSupport: false });
  }

  const canManageSupport = await canManageSupportConversations(user.id, tenantId);
  if (mode === "admin" && !canManageSupport) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const conversations = await prisma.conversation.findMany({
    where: {
      deletedAt: null,
      tenantId,
      ...(status ? { status: status as "OPEN" | "WAITING_FOR_ADMIN" | "WAITING_FOR_USER" | "CLOSED" } : {}),
      ...(mode === "admin"
        ? { type: "SUPPORT" as const }
        : { participants: { some: { userId: user.id, leftAt: null } } }),
    },
    include: conversationInclude(),
    orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
  });

  return NextResponse.json({
    canManageSupport,
    conversations: conversations.map((conversation) => serializeConversation(conversation, user.id)),
  });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const messageBody = normalizeMessageBody(body.body);
  if (messageBody.length < 2) {
    return NextResponse.json({ error: "Nachricht ist zu kurz" }, { status: 400 });
  }

  const contexts = await getSupportContextsForUser(user.id, user.email);
  const requestedContextId = typeof body.contextId === "string" ? body.contextId : null;
  const context = contexts.find((entry) => `${entry.type}:${entry.id}` === requestedContextId) ?? contexts[0] ?? null;

  if (!context) {
    return NextResponse.json({ error: "Kein verknüpfter Teilnehmer- oder Team-Kontext gefunden" }, { status: 403 });
  }

  const now = new Date();
  const subject = normalizeMessageSubject(body.subject);
  const conversation = await prisma.$transaction(async (tx) => {
    const created = await tx.conversation.create({
      data: {
        type: "SUPPORT",
        status: "WAITING_FOR_ADMIN",
        subject,
        tenantId: context.tenantId,
        competitionId: context.competitionId,
        teamId: context.teamId,
        participantId: context.type === "participant" ? context.participantId : null,
        createdById: user.id,
        lastMessageAt: now,
        participants: {
          create: {
            userId: user.id,
            role: "OWNER",
            lastReadAt: now,
          },
        },
        messages: {
          create: {
            senderId: user.id,
            body: messageBody,
            bodyPreview: buildMessagePreview(messageBody),
          },
        },
      },
    });

    const adminRoles = await tx.tenantRole.findMany({
      where: {
        tenantId: context.tenantId,
        role: { in: ["ADMIN", "MODERATOR"] },
        user: { deletedAt: null },
      },
      select: { userId: true, role: true },
    });

    for (const adminRole of adminRoles) {
      if (adminRole.userId === user.id) continue;
      await tx.conversationParticipant.create({
        data: {
          conversationId: created.id,
          userId: adminRole.userId,
          role: adminRole.role === "ADMIN" ? "ADMIN" : "MODERATOR",
        },
      });
    }

    return tx.conversation.findUniqueOrThrow({
      where: { id: created.id },
      include: conversationInclude(),
    });
  });

  const recipients = conversation.participants
    .filter((participant) => participant.userId !== user.id)
    .map((participant) => participant.user.email);
  await sendMessageNotificationEmail({
    to: recipients,
    subject: "Neue Support-Nachricht im S5Evo-Portal",
    conversationSubject: conversation.subject,
    actorName: user.name || user.email,
  }).catch((error) => {
    console.warn("Message notification skipped/failed", error);
  });

  return NextResponse.json({ conversation: serializeConversation(conversation, user.id) }, { status: 201 });
}
