import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { normalizeEmail, resolveCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const { user } = await resolveCurrentUser(session, { createIfMissing: true });
  if (!user) {
    return NextResponse.json({ error: "User nicht gefunden" }, { status: 404 });
  }

  const lastSeenAt = new Date();
  await prisma.user.updateMany({
    where: {
      id: user.id,
      deletedAt: null,
      email: {
        equals: normalizeEmail(session.user.email) ?? user.email,
        mode: "insensitive",
      },
    },
    data: { lastSeenAt },
  });

  return NextResponse.json({ lastSeenAt });
}
