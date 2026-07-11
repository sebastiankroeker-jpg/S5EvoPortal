import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { resolveCurrentUser } from "@/lib/current-user";
import { getUnreadMessageCountForUser } from "@/lib/messaging";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { user } = await resolveCurrentUser(session, { createIfMissing: true });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const unreadCount = await getUnreadMessageCountForUser(user.id);
  return NextResponse.json({ unreadCount });
}
