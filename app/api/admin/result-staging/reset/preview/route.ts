import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { previewResultReset } from "@/lib/result-staging-reset";
import { requireCompetitionTenantRoles } from "@/lib/server-permissions";

export const dynamic = "force-dynamic";

const RESET_SCOPES = ["RAW_BATCH", "DRAFTS", "PUBLICATION", "OFFICIAL_RESULTS", "TEST_DATA"] as const;
const DISCIPLINE_CODES = ["RUN", "BENCH", "STOCK", "ROAD", "MTB"] as const;

type ResetScope = (typeof RESET_SCOPES)[number];
type DisciplineCode = (typeof DISCIPLINE_CODES)[number];

type PreviewBody = {
  competitionId?: unknown;
  scope?: unknown;
  batchId?: unknown;
  publicationId?: unknown;
  disciplineCode?: unknown;
  participantId?: unknown;
  startNumber?: unknown;
};

function normalizeBody(value: unknown): PreviewBody {
  return value && typeof value === "object" ? value as PreviewBody : {};
}

function parseString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseScope(value: unknown): ResetScope | null {
  if (typeof value !== "string") return null;
  return RESET_SCOPES.includes(value as ResetScope) ? value as ResetScope : null;
}

function parseDiscipline(value: unknown): DisciplineCode | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return DISCIPLINE_CODES.includes(value as DisciplineCode) ? value as DisciplineCode : null;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const body = normalizeBody(await request.json().catch(() => ({})));
    const competitionId = parseString(body.competitionId);
    const auth = await requireCompetitionTenantRoles(session, ["ADMIN", "MODERATOR"], competitionId);
    if ("error" in auth) return auth.error;

    const scope = parseScope(body.scope);
    if (!scope) {
      return NextResponse.json({ error: "Ungueltiger Reset-Scope." }, { status: 400 });
    }

    const result = await previewResultReset({
      tenantId: auth.tenantId,
      competitionId,
      scope,
      filter: {
        batchId: parseString(body.batchId),
        publicationId: parseString(body.publicationId),
        disciplineCode: parseDiscipline(body.disciplineCode),
        participantId: parseString(body.participantId),
        startNumber: parseString(body.startNumber),
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to preview result staging reset:", error);
    const message =
      error instanceof Error && error.message === "competition_not_found"
        ? "Kein Wettkampf gefunden."
        : "Reset-Preview konnte nicht berechnet werden.";
    return NextResponse.json({ error: message }, { status: error instanceof Error && error.message === "competition_not_found" ? 404 : 500 });
  }
}
