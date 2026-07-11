import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { resolveCurrentUser } from "@/lib/current-user";
import {
  buildMessagePreview,
  ensureConversationAccess,
  normalizeSenderDisplayMode,
  ORG_MESSAGE_SENDER_LABEL,
  normalizeMessageBody,
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

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const loaded = await ensureConversationAccess(id, user.id);
  if (!loaded.access || !loaded.conversation) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }

  if (loaded.conversation.status === "CLOSED" && !loaded.canManage) {
    return NextResponse.json({ error: "Diese Unterhaltung ist geschlossen" }, { status: 409 });
  }

  const body = await request.json().catch(() => ({}));
  const messageBody = normalizeMessageBody(body.body);
  const senderDisplayMode = normalizeSenderDisplayMode(body.senderDisplayMode, loaded.canManage);
  if (messageBody.length < 2) {
    return NextResponse.json({ error: "Nachricht ist zu kurz" }, { status: 400 });
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    if (loaded.canManage) {
      await tx.conversationParticipant.upsert({
        where: { conversationId_userId: { conversationId: id, userId: user.id } },
        create: {
          conversationId: id,
          userId: user.id,
          role: "ADMIN",
          lastReadAt: now,
        },
        update: {
          role: "ADMIN",
          lastReadAt: now,
          leftAt: null,
        },
      });
    }

    await tx.message.create({
      data: {
        conversationId: id,
        senderId: user.id,
        senderDisplayMode,
        body: messageBody,
        bodyPreview: buildMessagePreview(messageBody),
      },
    });

    await tx.conversation.update({
      where: { id },
      data: {
        status: loaded.canManage ? "WAITING_FOR_USER" : "WAITING_FOR_ADMIN",
        lastMessageAt: now,
        closedAt: null,
        closedById: null,
      },
    });

    await tx.conversationParticipant.updateMany({
      where: { conversationId: id, userId: user.id },
      data: { lastReadAt: now, leftAt: null },
    });
  });

  const reloaded = await ensureConversationAccess(id, user.id);
  const recipients = reloaded.conversation?.participants
    .filter((participant) => participant.userId !== user.id)
    .map((participant) => participant.user.email) ?? [];
  await sendMessageNotificationEmail({
    to: recipients,
    subject: "Neue Antwort im S5Evo-Portal",
    conversationSubject: reloaded.conversation?.subject || loaded.conversation.subject,
    actorName: senderDisplayMode === "ORG" ? ORG_MESSAGE_SENDER_LABEL : user.name || user.email,
  }).catch((error) => {
    console.warn("Message notification skipped/failed", error);
  });

  return NextResponse.json({ conversation: serializeConversation(reloaded.conversation, user.id) }, { status: 201 });
}
