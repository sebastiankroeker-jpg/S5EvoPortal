import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

// GET all competitions (for admin switcher)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const competitions = await prisma.competition.findMany({
      orderBy: { year: "desc" },
      include: {
        tenant: { select: { name: true, slug: true } },
        _count: { select: { teams: true } },
      },
    });

    return NextResponse.json({ competitions });
  } catch (error) {
    console.error("Failed to load competitions:", error);
    return NextResponse.json({ error: "Failed to load competitions" }, { status: 500 });
  }
}
