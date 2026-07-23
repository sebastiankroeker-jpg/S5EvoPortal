import { NextRequest, NextResponse } from "next/server";
import { ConsentCategory, ConsentSource } from "@prisma/client";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  CONSENT_CATEGORIES,
  DEFAULT_CONSENT_STATE,
  PRIVACY_NOTICE_VERSION,
  normalizeConsentState,
  type ConsentCategoryKey,
} from "@/lib/privacy-consent";
import { prisma } from "@/lib/prisma";
import { resolveCurrentUser } from "@/lib/current-user";

const CATEGORY_BY_KEY: Record<ConsentCategoryKey, ConsentCategory> = {
  FUNCTIONAL_STORAGE: ConsentCategory.FUNCTIONAL_STORAGE,
  EXTERNAL_MAPS: ConsentCategory.EXTERNAL_MAPS,
  LOCAL_OFFLINE: ConsentCategory.LOCAL_OFFLINE,
  PORTAL_MESSAGE_EMAIL: ConsentCategory.PORTAL_MESSAGE_EMAIL,
};

function categoryKey(category: ConsentCategory): ConsentCategoryKey | null {
  return CONSENT_CATEGORIES.find((entry) => CATEGORY_BY_KEY[entry] === category) ?? null;
}

async function resolveTenantContext(userId: string) {
  const tenantRole = await prisma.tenantRole.findFirst({
    where: { userId },
    select: { tenantId: true },
    orderBy: { createdAt: "asc" },
  });

  if (tenantRole?.tenantId) {
    return tenantRole.tenantId;
  }

  const linkedParticipant = await prisma.participant.findFirst({
    where: { userId, deletedAt: null },
    select: { team: { select: { competition: { select: { tenantId: true } } } } },
    orderBy: { createdAt: "asc" },
  });

  if (linkedParticipant?.team.competition.tenantId) {
    return linkedParticipant.team.competition.tenantId;
  }

  const tenant = await prisma.tenant.findFirst({
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  return tenant?.id ?? null;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resolved = await resolveCurrentUser(session, { createIfMissing: true });
  if (!resolved.user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const preferences = await prisma.consentPreference.findMany({
    where: { userId: resolved.user.id },
    select: {
      category: true,
      granted: true,
      noticeVersion: true,
      grantedAt: true,
      withdrawnAt: true,
      updatedAt: true,
    },
  });

  const categories = { ...DEFAULT_CONSENT_STATE };
  let decidedAt: string | null = null;
  let version = PRIVACY_NOTICE_VERSION;

  for (const preference of preferences) {
    const key = categoryKey(preference.category);
    if (!key) continue;
    categories[key] = preference.granted;
    version = preference.noticeVersion || version;
    const timestamp = preference.grantedAt ?? preference.withdrawnAt ?? preference.updatedAt;
    if (timestamp && (!decidedAt || timestamp.toISOString() > decidedAt)) {
      decidedAt = timestamp.toISOString();
    }
  }

  return NextResponse.json({
    version,
    decidedAt,
    categories,
  });
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resolved = await resolveCurrentUser(session, { createIfMissing: true });
  if (!resolved.user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const categories = normalizeConsentState(body?.categories);
  const source = body?.source === "PROFILE" ? ConsentSource.PROFILE : ConsentSource.BANNER;
  const now = new Date();
  const tenantId = await resolveTenantContext(resolved.user.id);

  await prisma.$transaction(
    CONSENT_CATEGORIES.map((key) => {
      const granted = categories[key];
      return prisma.consentPreference.upsert({
        where: {
          userId_category: {
            userId: resolved.user.id,
            category: CATEGORY_BY_KEY[key],
          },
        },
        create: {
          userId: resolved.user.id,
          tenantId,
          category: CATEGORY_BY_KEY[key],
          granted,
          noticeVersion: PRIVACY_NOTICE_VERSION,
          source,
          grantedAt: granted ? now : null,
          withdrawnAt: granted ? null : now,
        },
        update: {
          tenantId,
          granted,
          noticeVersion: PRIVACY_NOTICE_VERSION,
          source,
          grantedAt: granted ? now : null,
          withdrawnAt: granted ? null : now,
        },
      });
    }),
  );

  if (tenantId) {
    await prisma.auditEvent.create({
      data: {
        tenantId,
        actorId: resolved.user.id,
        action: "privacy.consent.update",
        scopeType: "user",
        scopeId: resolved.user.id,
        entityType: "ConsentPreference",
        entityId: resolved.user.id,
        meta: {
          categories,
          noticeVersion: PRIVACY_NOTICE_VERSION,
          source,
        },
      },
    });
  }

  return NextResponse.json({
    version: PRIVACY_NOTICE_VERSION,
    decidedAt: now.toISOString(),
    categories,
  });
}
