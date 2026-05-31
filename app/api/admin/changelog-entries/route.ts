import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { resolveCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { requireTenantRoles } from "@/lib/server-permissions";

const typeEnum = ["BUG", "REQUEST"] as const;
const statusEnum = ["OPEN", "IN_PROGRESS", "DONE"] as const;

type EntryType = (typeof typeEnum)[number];
type EntryStatus = (typeof statusEnum)[number];

const createSchema = z.object({
  type: z.enum(typeEnum),
  status: z.enum(statusEnum).default("OPEN"),
  title: z.string().trim().max(140).optional(),
  perspective: z.string().trim().max(80).optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH"]).default("NORMAL").optional(),
  description: z.string().min(3).max(2000),
});

function parseDate(value: string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  return isNaN(date.getTime()) ? undefined : date;
}

async function getAdminUser(): Promise<{ id: string } | NextResponse> {
  const session = await getServerSession(authOptions);
  const auth = await requireTenantRoles(session, ["ADMIN", "MODERATOR"]);
  if ("error" in auth) {
    return auth.error;
  }

  return auth.user;
}

async function getAuthenticatedUser(): Promise<{ id: string } | NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { user } = await resolveCurrentUser(session, { createIfMissing: true });
  if (!user) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  return user;
}

function buildEntryDescription(input: {
  title?: string;
  perspective?: string;
  priority?: "LOW" | "NORMAL" | "HIGH";
  description: string;
}) {
  const lines: string[] = [];
  if (input.title?.trim()) lines.push(`Titel: ${input.title.trim()}`);
  if (input.perspective?.trim()) lines.push(`Perspektive: ${input.perspective.trim()}`);
  if (input.priority) lines.push(`Priorität: ${input.priority}`);
  if (lines.length > 0) lines.push("");
  lines.push(input.description.trim());
  return lines.join("\n");
}

export async function GET(request: NextRequest) {
  const user = await getAdminUser();
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
  const user = await getAuthenticatedUser();
  if (user instanceof NextResponse) {
    return user;
  }

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { type, title, perspective, priority, description } = parsed.data;

  const entry = await prisma.changelogEntry.create({
    data: {
      type,
      status: "OPEN",
      description: buildEntryDescription({ title, perspective, priority, description }),
      createdById: user.id,
    },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ entry }, { status: 201 });
}
