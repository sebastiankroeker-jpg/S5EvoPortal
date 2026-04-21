import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

const typeEnum = ["BUG", "REQUEST"] as const;
const statusEnum = ["OPEN", "IN_PROGRESS", "DONE"] as const;

type EntryType = (typeof typeEnum)[number];
type EntryStatus = (typeof statusEnum)[number];

const createSchema = z.object({
  type: z.enum(typeEnum),
  status: z.enum(statusEnum).default("OPEN"),
  description: z.string().min(3).max(2000),
});

function parseDate(value: string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  return isNaN(date.getTime()) ? undefined : date;
}

async function getAdminUser(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { tenantRoles: true },
  });

  const isAdmin = user?.tenantRoles.some((role) => role.role === "ADMIN" || role.role === "MODERATOR");
  if (!user || !isAdmin) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  return user;
}

export async function GET(request: NextRequest) {
  const user = await getAdminUser(request);
  if (user instanceof NextResponse) {
    return user;
  }

  const searchParams = request.nextUrl.searchParams;
  const typeParam = searchParams.get("type") as EntryType | null;
  const statusParam = searchParams.get("status") as EntryStatus | null;
  const createdBy = searchParams.get("createdBy");
  const resolvedBy = searchParams.get("resolvedBy");
  const createdFrom = parseDate(searchParams.get("createdFrom"));
  const createdTo = parseDate(searchParams.get("createdTo"));
  const resolvedFrom = parseDate(searchParams.get("resolvedFrom"));
  const resolvedTo = parseDate(searchParams.get("resolvedTo"));

  const entries = await prisma.changelogEntry.findMany({
    where: {
      ...(typeParam ? { type: typeParam } : {}),
      ...(statusParam ? { status: statusParam } : {}),
      ...(createdBy
        ? createdBy.includes("@")
          ? { createdBy: { email: { contains: createdBy, mode: "insensitive" as const } } }
          : { createdById: createdBy }
        : {}),
      ...(resolvedBy
        ? resolvedBy.includes("@")
          ? { resolvedBy: { email: { contains: resolvedBy, mode: "insensitive" as const } } }
          : { resolvedById: resolvedBy }
        : {}),
      ...(createdFrom || createdTo
        ? {
            createdAt: {
              ...(createdFrom ? { gte: createdFrom } : {}),
              ...(createdTo ? { lte: createdTo } : {}),
            },
          }
        : {}),
      ...(resolvedFrom || resolvedTo
        ? {
            resolvedAt: {
              ...(resolvedFrom ? { gte: resolvedFrom } : {}),
              ...(resolvedTo ? { lte: resolvedTo } : {}),
            },
          }
        : {}),
    },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      resolvedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  return NextResponse.json({ entries });
}

export async function POST(request: NextRequest) {
  const user = await getAdminUser(request);
  if (user instanceof NextResponse) {
    return user;
  }

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { type, status, description } = parsed.data;

  const entry = await prisma.changelogEntry.create({
    data: {
      type,
      status,
      description,
      createdById: user.id,
    },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ entry }, { status: 201 });
}
