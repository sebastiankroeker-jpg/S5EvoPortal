import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  LEGACY_COMPETITION_CLASSIFICATIONS,
  resolveCompetitionClassifications,
  toPublicCompetitionClassifications,
  type CompetitionClassification,
} from "@/lib/competition-classifications";
import { prisma } from "@/lib/prisma";
import { requireCompetitionRoles } from "@/lib/server-permissions";

const TYPES = new Set(["AGE_INDIVIDUAL", "AGE_TEAM", "COMBINED"]);

function parseClassifications(value: unknown): CompetitionClassification[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 30) return null;
  const codes = new Set<string>();
  const parsed: CompetitionClassification[] = [];

  for (const [index, item] of value.entries()) {
    if (!item || typeof item !== "object") return null;
    const candidate = item as Record<string, unknown>;
    const code = typeof candidate.code === "string" ? candidate.code.trim().toLowerCase() : "";
    const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
    const type = candidate.type;
    const minAge = typeof candidate.minAge === "number" && Number.isInteger(candidate.minAge) ? candidate.minAge : null;
    const maxAge = typeof candidate.maxAge === "number" && Number.isInteger(candidate.maxAge) ? candidate.maxAge : null;
    const genderRestriction = candidate.genderRestriction === "FEMALE_ONLY" ? "FEMALE_ONLY" : null;
    const sourceClassCodes = Array.isArray(candidate.sourceClassCodes)
      ? candidate.sourceClassCodes.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.trim().toLowerCase()).filter(Boolean)
      : [];
    const displayEmoji = typeof candidate.displayEmoji === "string" ? candidate.displayEmoji.trim().slice(0, 12) || null : null;

    if (!/^[a-z0-9-]{2,48}$/.test(code) || !name || name.length > 80 || !TYPES.has(String(type))) return null;
    if (minAge !== null && (minAge < 0 || minAge > 200)) return null;
    if (maxAge !== null && (maxAge < 0 || maxAge > 200)) return null;
    if (minAge !== null && maxAge !== null && minAge > maxAge) return null;
    if (codes.has(code) || sourceClassCodes.some((sourceCode) => sourceCode === code)) return null;
    if (type === "COMBINED" ? sourceClassCodes.length === 0 : sourceClassCodes.length > 0) return null;
    codes.add(code);
    parsed.push({
      code,
      name,
      type: type as CompetitionClassification["type"],
      minAge,
      maxAge,
      genderRestriction,
      sourceClassCodes,
      sortOrder: index * 10,
      displayEmoji,
    });
  }

  const availableCodes = new Set(parsed.map((entry) => entry.code));
  if (parsed.some((entry) => entry.sourceClassCodes.some((sourceCode) => !availableCodes.has(sourceCode)))) return null;
  return parsed;
}

function isLegacyEquivalent(entries: readonly CompetitionClassification[]) {
  const comparable = (entry: CompetitionClassification) => ({
    code: entry.code,
    name: entry.name,
    type: entry.type,
    minAge: entry.minAge,
    maxAge: entry.maxAge,
    genderRestriction: entry.genderRestriction,
    sourceClassCodes: [...entry.sourceClassCodes],
    sortOrder: entry.sortOrder,
    displayEmoji: entry.displayEmoji,
  });
  return JSON.stringify(entries.map(comparable)) === JSON.stringify(LEGACY_COMPETITION_CLASSIFICATIONS.map(comparable));
}

export async function GET(request: NextRequest) {
  const competitionId = request.nextUrl.searchParams.get("competitionId");
  const session = await getServerSession(authOptions);
  const auth = await requireCompetitionRoles(session, ["ADMIN"], competitionId);
  if ("error" in auth) return auth.error;

  const competition = await prisma.competition.findUnique({
    where: { id: auth.competitionId },
    select: {
      year: true,
      classifications: {
        select: {
          code: true, name: true, type: true, minAge: true, maxAge: true,
          genderRestriction: true, sourceClassCodes: true, sortOrder: true, displayEmoji: true,
        },
        orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
      },
    },
  });
  if (!competition) return NextResponse.json({ error: "Wettkampf nicht gefunden" }, { status: 404 });

  return NextResponse.json({
    source: competition.classifications.length > 0 ? "PERSISTED" : "LEGACY_FALLBACK",
    classifications: toPublicCompetitionClassifications(
      resolveCompetitionClassifications(competition.classifications),
      competition.year,
    ),
  });
}

export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const competitionId = typeof body?.competitionId === "string" ? body.competitionId : null;
  const classifications = parseClassifications(body?.classifications);
  if (!classifications) {
    return NextResponse.json({ error: "Ungültige Klassenregeln" }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  const auth = await requireCompetitionRoles(session, ["ADMIN"], competitionId);
  if ("error" in auth) return auth.error;

  const competition = await prisma.competition.findUnique({
    where: { id: auth.competitionId },
    select: { id: true, classifications: { select: { id: true } }, _count: { select: { teams: true } } },
  });
  if (!competition) return NextResponse.json({ error: "Wettkampf nicht gefunden" }, { status: 404 });

  // A live team must never be silently reclassified by a configuration edit.
  // The one safe exception is seeding the byte-for-byte legacy rules into a
  // competition that has no persisted rules yet.
  if (competition._count.teams > 0 && (competition.classifications.length > 0 || !isLegacyEquivalent(classifications))) {
    return NextResponse.json(
      { error: "Klassen eines Wettkampfs mit Mannschaften können nur über einen separaten Umklassifizierungs-CR geändert werden." },
      { status: 409 },
    );
  }

  await prisma.$transaction(async (tx) => {
    if (competition.classifications.length === 0) {
      await tx.classification.createMany({
        data: classifications.map((classification) => ({ ...classification, competitionId: auth.competitionId })),
      });
      return;
    }

    await tx.classification.deleteMany({ where: { competitionId: auth.competitionId } });
    await tx.classification.createMany({
      data: classifications.map((classification) => ({ ...classification, competitionId: auth.competitionId })),
    });
  });

  return NextResponse.json({ success: true, classifications });
}
