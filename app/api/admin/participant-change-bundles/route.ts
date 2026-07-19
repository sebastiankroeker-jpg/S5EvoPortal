import { randomUUID } from "crypto";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { validatePendingChangeBundle } from "@/lib/participant-change-bundle";
import { prisma } from "@/lib/prisma";
import { requirePendingChangesTenantRoles } from "@/lib/server-permissions";

const BUNDLE_FEATURE_FLAG = process.env.ENABLE_PENDING_CHANGE_BUNDLES === "true";

type CreateBundleBody = {
  pendingChangeIds?: unknown;
  bundleType?: unknown;
};

export async function POST(request: NextRequest) {
  if (!BUNDLE_FEATURE_FLAG) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as CreateBundleBody;
  const pendingChangeIds = Array.isArray(body.pendingChangeIds)
    ? body.pendingChangeIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    : [];
  const uniquePendingChangeIds = [...new Set(pendingChangeIds)];

  if (uniquePendingChangeIds.length < 2) {
    return NextResponse.json(
      { error: "Bitte mindestens zwei gueltige pendingChangeIds uebergeben." },
      { status: 400 },
    );
  }

  if (body.bundleType !== undefined && body.bundleType !== "SWAP") {
    return NextResponse.json({ error: "Ungueltiger bundleType." }, { status: 400 });
  }

  const auth = await requirePendingChangesTenantRoles(session, ["ADMIN", "MODERATOR"], uniquePendingChangeIds);
  if ("error" in auth) return auth.error;

  const pendingChanges = await prisma.pendingChange.findMany({
    where: {
      id: { in: uniquePendingChangeIds },
      participant: {
        team: {
          competition: {
            tenantId: auth.tenantId,
          },
        },
      },
    },
    include: {
      participant: {
        select: {
          id: true,
          birthYear: true,
          gender: true,
          disciplineCode: true,
          team: {
            select: {
              id: true,
              classificationCode: true,
              participants: {
                where: { deletedAt: null },
                select: {
                  id: true,
                  birthYear: true,
                  gender: true,
                  disciplineCode: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (pendingChanges.length !== uniquePendingChangeIds.length) {
    return NextResponse.json(
      { error: "Mindestens ein Antrag wurde nicht gefunden oder ist ausserhalb des Tenant-Scope." },
      { status: 404 },
    );
  }

  const alreadyBundled = pendingChanges.find((change) => typeof change.bundleId === "string" && change.bundleId.length > 0);
  if (alreadyBundled) {
    return NextResponse.json(
      { error: "Mindestens ein Antrag ist bereits einem Bundle zugeordnet.", pendingChangeId: alreadyBundled.id },
      { status: 409 },
    );
  }

  const firstTeam = pendingChanges[0]?.participant.team;
  if (!firstTeam) {
    return NextResponse.json({ error: "Ungueltige Teamdaten fuer Bundle-Erstellung." }, { status: 400 });
  }

  const validation = validatePendingChangeBundle(
    pendingChanges.map((change) => ({
      id: change.id,
      participantId: change.participantId,
      teamId: change.participant.team.id,
      status: change.status,
      beforeData: change.beforeData,
      changeData: change.changeData,
    })),
    firstTeam.participants,
    firstTeam.classificationCode,
  );

  if (!validation.valid) {
    return NextResponse.json(
      { error: "Bundle-Validierung fehlgeschlagen.", issues: validation.issues },
      { status: 409 },
    );
  }

  const bundleId = randomUUID();
  const bundleType = "SWAP";

  try {
    await prisma.$transaction(async (tx) => {
      const stillOpenAndUnbundled = await tx.pendingChange.count({
        where: {
          id: { in: uniquePendingChangeIds },
          status: "PENDING",
          bundleId: null,
        },
      });

      if (stillOpenAndUnbundled !== uniquePendingChangeIds.length) {
        throw new Error("BUNDLE_STATE_CHANGED");
      }

      const updated = await tx.pendingChange.updateMany({
        where: {
          id: { in: uniquePendingChangeIds },
          status: "PENDING",
          bundleId: null,
        },
        data: {
          bundleId,
          bundleType,
          bundleStatus: "PENDING",
        },
      });

      if (updated.count !== uniquePendingChangeIds.length) {
        throw new Error("BUNDLE_STATE_CHANGED");
      }

      await tx.participantAuditLog.createMany({
        data: pendingChanges.map((change) => ({
          action: "REQUEST_UPDATED",
          participantId: change.participantId,
          actorId: auth.user.id,
          pendingChangeId: change.id,
          beforeData: change.beforeData,
          afterData: change.changeData,
          message: "Aenderungsanfrage in Tausch-Bundle gruppiert",
        })),
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "BUNDLE_STATE_CHANGED") {
      return NextResponse.json(
        { error: "Bundle konnte nicht erstellt werden, weil sich der Antragsstatus geaendert hat. Bitte neu laden." },
        { status: 409 },
      );
    }
    throw error;
  }

  return NextResponse.json({
    bundleId,
    bundleType,
    bundleStatus: "PENDING",
    pendingChangeCount: uniquePendingChangeIds.length,
  });
}
