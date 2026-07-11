import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { resolveCurrentUser } from "@/lib/current-user";
import { ensureConversationAccess, serializeConversation } from "@/lib/messaging";
import { prisma } from "@/lib/prisma";

async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  const resolved = await resolveCurrentUser(session, { createIfMissing: true });
  return resolved.user;
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const loaded = await ensureConversationAccess(id, user.id);
  if (!loaded.access || !loaded.conversation) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }

  return NextResponse.json({
    canManageSupport: loaded.canManage,
    conversation: serializeConversation(loaded.conversation, user.id),
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const nextStatus = body.status === "CLOSED" ? "CLOSED" : body.status === "OPEN" ? "OPEN" : null;
  if (!nextStatus) {
    return NextResponse.json({ error: "Ungültiger Status" }, { status: 400 });
  }

  const loaded = await ensureConversationAccess(id, user.id);
  if (!loaded.access || !loaded.conversation || !loaded.canManage) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const now = new Date();
  await prisma.conversation.update({
    where: { id },
    data: {
      status: nextStatus,
      closedAt: nextStatus === "CLOSED" ? now : null,
      closedById: nextStatus === "CLOSED" ? user.id : null,
    },
  });

  const reloaded = await ensureConversationAccess(id, user.id);
  return NextResponse.json({ conversation: serializeConversation(reloaded.conversation, user.id) });
}
