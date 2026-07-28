import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { cloneCompetition, previewCompetitionClone } from "@/lib/competition-clone";
import { requireTenantRoles } from "@/lib/server-permissions";

const cloneSchema = z.object({
  name: z.string().trim().min(3).max(140),
  year: z.number().int().min(2020).max(2100),
  dryRun: z.boolean().optional().default(false),
  confirmationText: z.string().optional(),
});

function cloneErrorResponse(error: unknown) {
  if (error instanceof Error && error.message === "competition_clone_source_not_found") {
    return NextResponse.json({ error: "Quellwettkampf nicht gefunden." }, { status: 404 });
  }
  if (error instanceof Error && error.message === "competition_clone_target_year_exists") {
    return NextResponse.json({ error: "Für dieses Jahr existiert bereits ein Wettkampf in diesem Tenant." }, { status: 409 });
  }
  return null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  const auth = await requireTenantRoles(session, ["ADMIN"]);
  if ("error" in auth) return auth.error;

  const { id: sourceCompetitionId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = cloneSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const target = { name: parsed.data.name, year: parsed.data.year };
  try {
    if (parsed.data.dryRun) {
      const preview = await previewCompetitionClone({
        tenantId: auth.tenantId,
        sourceCompetitionId,
        target,
      });
      return NextResponse.json({ dryRun: true, ...preview });
    }

    if (parsed.data.confirmationText?.trim() !== target.name) {
      return NextResponse.json(
        { error: "Bestätigungstext stimmt nicht mit dem Namen des neuen Wettkampfs überein." },
        { status: 400 },
      );
    }

    const result = await cloneCompetition({
      tenantId: auth.tenantId,
      sourceCompetitionId,
      actorId: auth.user.id,
      target,
    });
    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error) {
    const known = cloneErrorResponse(error);
    if (known) return known;
    console.error("Competition clone failed:", error);
    return NextResponse.json({ error: "Wettkampf konnte nicht geklont werden." }, { status: 500 });
  }
}
