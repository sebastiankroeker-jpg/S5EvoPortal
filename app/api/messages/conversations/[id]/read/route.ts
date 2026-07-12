import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { resolveCurrentUser } from "@/lib/current-user";
import { ensureConversationAccess, serializeConversation, upsertConversationParticipant } from "@/lib/messaging";

async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  const resolved = await resolveCurrentUser(session, { createIfMissing: true });
  return resolved.user;
}

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const loaded = await ensureConversationAccess(id, user.id);
  if (!loaded.access || !loaded.conversation) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }

  await upsertConversationParticipant({
    conversationId: id,
    userId: user.id,
    role: loaded.participant && ["OWNER", "MEMBER"].includes(loaded.participant.role)
      ? loaded.participant.role
      : loaded.canManage ? "ADMIN" : loaded.participant?.role ?? "MEMBER",
    lastReadAt: new Date(),
  });

  const reloaded = await ensureConversationAccess(id, user.id);
  return NextResponse.json({ conversation: serializeConversation(reloaded.conversation, user.id) });
}
