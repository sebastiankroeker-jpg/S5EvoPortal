import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { executeResultReset } from "@/lib/result-staging-reset";
import { requireTenantRoles } from "@/lib/server-permissions";

export const dynamic = "force-dynamic";

const RESET_SCOPES = ["RAW_BATCH", "DRAFTS", "PUBLICATION", "OFFICIAL_RESULTS", "TEST_DATA"] as const;
const DISCIPLINE_CODES = ["RUN", "BENCH", "STOCK", "ROAD", "MTB"] as const;

type ResetScope = (typeof RESET_SCOPES)[number];
type DisciplineCode = (typeof DISCIPLINE_CODES)[number];

type ResetBody = {
  competitionId?: unknown;
  scope?: unknown;
  batchId?: unknown;
  publicationId?: unknown;
  disciplineCode?: unknown;
  participantId?: unknown;
  startNumber?: unknown;
  reason?: unknown;
  confirmationText?: unknown;
};

function normalizeBody(value: unknown): ResetBody {
  return value && typeof value === "object" ? value as ResetBody : {};
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
    const auth = await requireTenantRoles(session, ["ADMIN"]);
    if ("error" in auth) return auth.error;

    const body = normalizeBody(await request.json().catch(() => ({})));
    const scope = parseScope(body.scope);
    if (!scope) {
      return NextResponse.json({ error: "Ungueltiger Reset-Scope." }, { status: 400 });
    }

    const reason = parseString(body.reason) || "";
    if (reason.length < 10) {
      return NextResponse.json(
        { error: "Bitte gib eine aussagekraeftige Begruendung mit mindestens 10 Zeichen an." },
        { status: 400 },
      );
    }

    const result = await executeResultReset({
      tenantId: auth.tenantId,
      competitionId: parseString(body.competitionId),
      actorId: auth.user.id,
      scope,
      reason,
      confirmationText: parseString(body.confirmationText),
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
    console.error("Result staging reset failed:", error);

    const message =
      error instanceof Error && error.message === "competition_not_found"
        ? "Kein Wettkampf gefunden."
        : error instanceof Error && error.message === "reset_reason_required"
          ? "Begruendung ist erforderlich."
          : error instanceof Error && error.message === "confirmation_mismatch"
            ? "Bestaetigungstext stimmt nicht ueberein."
            : error instanceof Error && error.message === "scope_not_executable"
              ? "Dieser Reset-Scope ist in V1 nicht zur Ausfuehrung freigeschaltet."
              : error instanceof Error && error.message === "reset_blocked"
                ? "Reset ist durch Preview-Blocker gesperrt."
                : "Result-Staging-Reset fehlgeschlagen.";

    const status =
      error instanceof Error && error.message === "competition_not_found"
        ? 404
        : error instanceof Error && ["confirmation_mismatch", "scope_not_executable", "reset_blocked"].includes(error.message)
          ? 409
          : error instanceof Error && error.message === "reset_reason_required"
            ? 400
            : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
