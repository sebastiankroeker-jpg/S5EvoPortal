import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import type { DisciplineAssignment } from "@prisma/client";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { evaluateTeamDraft } from "@/lib/domain/classification";
import { birthYearToBirthDateInput } from "@/lib/domain/team";
import { normalizeEmail, resolveCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { getScopedRoleFlags } from "@/lib/server-permissions";
import { syncDerivedTeamchefRole } from "@/lib/teamchef-role";

const AVAILABLE_MARKETPLACE_STATUSES = ["NEW", "REVIEWED", "MATCHING"] as const;
const VALID_PUBLICATION_LEVELS = new Set(["TEAM_ANONYM", "TEAMNAME_OEFFENTLICH", "ALLES_OEFFENTLICH"]);

type MarketplaceMatchingAction = "createDraft" | "addParticipant" | "removeParticipant" | "finalize";

function participantName(participant: { firstName: string; lastName: string }) {
  return `${participant.firstName} ${participant.lastName}`.trim();
}

function toTeamDraftParticipant(participant: {
  firstName: string;
  lastName: string;
  birthYear: number | null;
  gender: "MALE" | "FEMALE";
  disciplineCode: DisciplineAssignment | null;
}) {
  return {
    firstName: participant.firstName,
    lastName: participant.lastName,
    birthDate: birthYearToBirthDateInput(participant.birthYear),
    gender: participant.gender === "FEMALE" ? ("W" as const) : ("M" as const),
    discipline: participant.disciplineCode || ("TBD" as const),
  };
}

async function requireMatchingAdmin(session: Session | null, competitionId?: string | null) {
  const userEmail = session?.user?.email;
  if (!userEmail) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const competition = competitionId
    ? await prisma.competition.findUnique({
        where: { id: competitionId },
        select: { id: true, tenantId: true, year: true },
      })
    : await prisma.competition.findFirst({
        where: { status: { in: ["DRAFT", "OPEN"] } },
        orderBy: [{ year: "desc" }, { createdAt: "desc" }],
        select: { id: true, tenantId: true, year: true },
      });

  if (!competition) {
    return { error: NextResponse.json({ error: "Kein Wettkampf gefunden." }, { status: 404 }) };
  }

  const { user } = await resolveCurrentUser(session, { createIfMissing: true });
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const access = await getScopedRoleFlags(userEmail, competition.tenantId, session);
  if (!access.canEditAllTeams) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { user, userEmail, competition, access };
}

async function loadAvailableMarketplaceParticipants(competitionId: string, targetTeamId?: string | null) {
  const teams = await prisma.team.findMany({
    where: {
      competitionId,
      deletedAt: null,
      registrationMode: "MARKETPLACE",
      marketplaceStatus: { in: [...AVAILABLE_MARKETPLACE_STATUSES] },
      ...(targetTeamId ? { id: { not: targetTeamId } } : {}),
    },
    orderBy: [{ marketplaceStatus: "asc" }, { updatedAt: "desc" }],
    include: {
      participants: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          birthYear: true,
          gender: true,
          disciplineCode: true,
          email: true,
          shirtSize: true,
          participantPublicationPreference: true,
        },
      },
    },
  });

  return teams.flatMap((team) => {
    if (team.participants.length !== 1) {
      return [];
    }

    const participant = team.participants[0];
    return [{
      id: participant.id,
      teamId: team.id,
      teamName: team.name,
      marketplaceStatus: team.marketplaceStatus,
      name: participantName(participant),
      firstName: participant.firstName,
      lastName: participant.lastName,
      birthDate: birthYearToBirthDateInput(participant.birthYear),
      gender: participant.gender === "FEMALE" ? "W" : "M",
      disciplineCode: participant.disciplineCode || "TBD",
      email: participant.email ?? "",
      shirtSize: participant.shirtSize ?? "",
      participantPublicationPreference: participant.participantPublicationPreference ?? "NAME_VERBERGEN",
    }];
  });
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const url = new URL(request.url);
  const competitionId = url.searchParams.get("competitionId");
  const targetTeamId = url.searchParams.get("targetTeamId");
  const auth = await requireMatchingAdmin(session, competitionId);

  if ("error" in auth) return auth.error;

  const availableParticipants = await loadAvailableMarketplaceParticipants(auth.competition.id, targetTeamId);

  return NextResponse.json({ availableParticipants });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const body = await request.json().catch(() => null) as {
    action?: MarketplaceMatchingAction;
    competitionId?: string;
    targetTeamId?: string;
    participantId?: string;
    teamName?: string;
    contactName?: string;
    contactEmail?: string;
    teamPublicationLevel?: string;
  } | null;

  const auth = await requireMatchingAdmin(session, body?.competitionId);
  if ("error" in auth) return auth.error;

  const action = body?.action;

  if (action === "createDraft") {
    const draftName = body?.teamName?.trim() || "Börsen-Mannschaft";
    const team = await prisma.team.create({
      data: {
        name: draftName,
        contactName: body?.contactName?.trim() || auth.user.name || auth.userEmail,
        contactEmail: normalizeEmail(body?.contactEmail) || normalizeEmail(auth.userEmail) || auth.user.email,
        teamPublicationLevel: "TEAM_ANONYM",
        registrationMode: "MARKETPLACE",
        marketplaceVisibility: "ADMIN_MANAGEMENT_ONLY",
        marketplaceStatus: "MATCHING",
        marketplaceMessage: "Matching-Entwurf aus der Sportlerbörse",
        classificationCode: "sportlerboerse",
        competitionId: auth.competition.id,
        ownerId: auth.user.id,
        teamChiefId: auth.user.id,
      },
    });

    await prisma.auditEvent.create({
      data: {
        action: "MARKETPLACE_MATCHING_DRAFT_CREATED",
        scopeType: "TEAM",
        scopeId: team.id,
        entityType: "TEAM",
        entityId: team.id,
        reason: "marketplace_matching_create",
        afterData: { teamName: team.name, marketplaceStatus: team.marketplaceStatus },
        meta: { sessionEmail: normalizeEmail(auth.userEmail) },
        tenantId: auth.competition.tenantId,
        competitionId: auth.competition.id,
        actorId: auth.user.id,
      },
    });

    return NextResponse.json({ success: true, teamId: team.id, message: "Börsen-Mannschaft angelegt." });
  }

  if (!body?.targetTeamId) {
    return NextResponse.json({ error: "Ziel-Mannschaft fehlt." }, { status: 400 });
  }

  const targetTeam = await prisma.team.findFirst({
    where: {
      id: body.targetTeamId,
      competitionId: auth.competition.id,
      deletedAt: null,
      registrationMode: "MARKETPLACE",
    },
    include: {
      participants: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!targetTeam) {
    return NextResponse.json({ error: "Börsen-Mannschaft nicht gefunden." }, { status: 404 });
  }

  if (action === "addParticipant") {
    if (!body.participantId) {
      return NextResponse.json({ error: "Teilnehmer fehlt." }, { status: 400 });
    }
    if (targetTeam.participants.some((participant) => participant.id === body.participantId)) {
      return NextResponse.json({ error: "Teilnehmer ist bereits in dieser Börsen-Mannschaft." }, { status: 409 });
    }
    if (targetTeam.participants.length >= 5) {
      return NextResponse.json({ error: "Die Börsen-Mannschaft ist bereits voll." }, { status: 409 });
    }

    const sourceParticipant = await prisma.participant.findFirst({
      where: {
        id: body.participantId,
        deletedAt: null,
        team: {
          competitionId: auth.competition.id,
          deletedAt: null,
          registrationMode: "MARKETPLACE",
          marketplaceStatus: { in: [...AVAILABLE_MARKETPLACE_STATUSES] },
        },
      },
      include: {
        team: {
          include: {
            participants: {
              where: { deletedAt: null },
              select: { id: true },
            },
          },
        },
      },
    });

    if (!sourceParticipant) {
      return NextResponse.json({ error: "Teilnehmer ist nicht als freie Börsen-Meldung verfügbar." }, { status: 404 });
    }

    if (sourceParticipant.teamId === targetTeam.id) {
      return NextResponse.json({ error: "Teilnehmer ist bereits in dieser Börsen-Mannschaft." }, { status: 409 });
    }

    const sourceTeam = sourceParticipant.team;
    const sourceTeamWillBeEmpty = sourceTeam.participants.length === 1;
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.participant.update({
        where: { id: sourceParticipant.id },
        data: { teamId: targetTeam.id },
      });

      await tx.team.update({
        where: { id: targetTeam.id },
        data: {
          marketplaceStatus: "MATCHING",
          updatedAt: now,
        },
      });

      if (sourceTeamWillBeEmpty) {
        await tx.team.update({
          where: { id: sourceTeam.id },
          data: {
            marketplaceStatus: "MATCHING",
            deletedAt: now,
          },
        });
      }

      await tx.auditEvent.create({
        data: {
          action: "MARKETPLACE_PARTICIPANT_ASSIGNED",
          scopeType: "TEAM",
          scopeId: targetTeam.id,
          entityType: "PARTICIPANT",
          entityId: sourceParticipant.id,
          reason: "marketplace_matching_assign",
          beforeData: {
            sourceTeamId: sourceTeam.id,
            sourceTeamName: sourceTeam.name,
            sourceTeamArchived: sourceTeamWillBeEmpty,
          },
          afterData: {
            targetTeamId: targetTeam.id,
            targetTeamName: targetTeam.name,
          },
          meta: {
            participantName: participantName(sourceParticipant),
            sessionEmail: normalizeEmail(auth.userEmail),
          },
          tenantId: auth.competition.tenantId,
          competitionId: auth.competition.id,
          actorId: auth.user.id,
        },
      });
    });

    return NextResponse.json({ success: true, message: `${participantName(sourceParticipant)} wurde zugeordnet.` });
  }

  if (action === "removeParticipant") {
    if (!body.participantId) {
      return NextResponse.json({ error: "Teilnehmer fehlt." }, { status: 400 });
    }

    const participant = targetTeam.participants.find((entry) => entry.id === body.participantId);
    if (!participant) {
      return NextResponse.json({ error: "Teilnehmer gehört nicht zu dieser Börsen-Mannschaft." }, { status: 404 });
    }

    if (targetTeam.participants.length <= 1) {
      await prisma.$transaction(async (tx) => {
        await tx.team.update({
          where: { id: targetTeam.id },
          data: {
            marketplaceStatus: "REVIEWED",
            marketplaceMessage: participant.moderationNote ?? null,
          },
        });

        await tx.auditEvent.create({
          data: {
            action: "MARKETPLACE_PARTICIPANT_UNASSIGNED",
            scopeType: "TEAM",
            scopeId: targetTeam.id,
            entityType: "PARTICIPANT",
            entityId: participant.id,
            reason: "marketplace_matching_unassign_single",
            beforeData: {
              targetTeamId: targetTeam.id,
              targetTeamName: targetTeam.name,
              participantCount: targetTeam.participants.length,
            },
            afterData: {
              restoredTeamId: targetTeam.id,
              restoredTeamName: targetTeam.name,
              participantCount: targetTeam.participants.length,
            },
            meta: {
              participantName: participantName(participant),
              sessionEmail: normalizeEmail(auth.userEmail),
            },
            tenantId: auth.competition.tenantId,
            competitionId: auth.competition.id,
            actorId: auth.user.id,
          },
        });
      });

      return NextResponse.json({
        success: true,
        teamId: targetTeam.id,
        message: `${participantName(participant)} ist bereits eine freie Börsen-Meldung.`,
      });
    }

    const newTeam = await prisma.$transaction(async (tx) => {
      const restored = await tx.team.create({
        data: {
          name: `Sportlerbörse: ${participantName(participant)}`,
          contactName: participantName(participant),
          contactEmail: participant.email ?? targetTeam.contactEmail,
          teamPublicationLevel: targetTeam.teamPublicationLevel,
          registrationMode: "MARKETPLACE",
          marketplaceVisibility: targetTeam.marketplaceVisibility,
          marketplaceStatus: "REVIEWED",
          marketplaceMessage: participant.moderationNote ?? null,
          classificationCode: "sportlerboerse",
          totalAge: participant.birthYear ? auth.competition.year - participant.birthYear : null,
          competitionId: auth.competition.id,
          ownerId: targetTeam.ownerId,
          teamChiefId: participant.userId ?? targetTeam.teamChiefId,
        },
      });

      await tx.participant.update({
        where: { id: participant.id },
        data: { teamId: restored.id },
      });

      await tx.auditEvent.create({
        data: {
          action: "MARKETPLACE_PARTICIPANT_UNASSIGNED",
          scopeType: "TEAM",
          scopeId: targetTeam.id,
          entityType: "PARTICIPANT",
          entityId: participant.id,
          reason: "marketplace_matching_unassign",
          beforeData: { targetTeamId: targetTeam.id, targetTeamName: targetTeam.name },
          afterData: { restoredTeamId: restored.id, restoredTeamName: restored.name },
          meta: {
            participantName: participantName(participant),
            sessionEmail: normalizeEmail(auth.userEmail),
          },
          tenantId: auth.competition.tenantId,
          competitionId: auth.competition.id,
          actorId: auth.user.id,
        },
      });

      return restored;
    });

    return NextResponse.json({ success: true, teamId: newTeam.id, message: `${participantName(participant)} wurde wieder freigegeben.` });
  }

  if (action === "finalize") {
    if (targetTeam.participants.length !== 5) {
      return NextResponse.json({ error: "Eine echte Mannschaft braucht genau 5 Teilnehmer." }, { status: 400 });
    }

    const finalTeamName = body.teamName?.trim() || targetTeam.name.replace(/^Börsen-Mannschaft:?\s*/i, "").trim();
    const contactName = body.contactName?.trim() || targetTeam.contactName || auth.user.name || auth.userEmail;
    const contactEmail = normalizeEmail(body.contactEmail) || normalizeEmail(targetTeam.contactEmail) || normalizeEmail(auth.userEmail);
    const teamPublicationLevel = VALID_PUBLICATION_LEVELS.has(body.teamPublicationLevel || "")
      ? body.teamPublicationLevel as "TEAM_ANONYM" | "TEAMNAME_OEFFENTLICH" | "ALLES_OEFFENTLICH"
      : targetTeam.teamPublicationLevel;

    if (finalTeamName.length < 3) {
      return NextResponse.json({ error: "Mannschaftsname zu kurz." }, { status: 400 });
    }
    if (!contactName || !contactEmail) {
      return NextResponse.json({ error: "Kontaktname und Kontakt-E-Mail sind erforderlich." }, { status: 400 });
    }

    const draftParticipants = targetTeam.participants.map(toTeamDraftParticipant);
    const evaluation = evaluateTeamDraft({
      mode: "admin-edit",
      teamName: finalTeamName,
      participants: draftParticipants,
      oldClassificationCode: targetTeam.classificationCode ?? undefined,
    });

    if (evaluation.blockingErrors.length > 0) {
      return NextResponse.json(
        {
          error: evaluation.blockingErrors.join(" "),
          classificationWarnings: evaluation.warnings,
        },
        { status: 400 },
      );
    }

    const totalAge = evaluation.classification.totalAge;
    const affectedUserIds = Array.from(new Set([
      targetTeam.ownerId,
      targetTeam.teamChiefId,
      ...targetTeam.participants.map((participant) => participant.userId),
    ].filter((value): value is string => Boolean(value))));

    await prisma.$transaction(async (tx) => {
      await tx.team.update({
        where: { id: targetTeam.id },
        data: {
          name: finalTeamName,
          contactName,
          contactEmail,
          teamPublicationLevel,
          registrationMode: "TEAM",
          marketplaceStatus: "MATCHED",
          marketplaceMessage: null,
          classificationCode: evaluation.classification.code,
          totalAge,
        },
      });

      await Promise.all(
        affectedUserIds.map((userId) =>
          syncDerivedTeamchefRole(tx, {
            userId,
            tenantId: auth.competition.tenantId,
          }),
        ),
      );

      await tx.auditEvent.create({
        data: {
          action: "MARKETPLACE_MATCHING_FINALIZED",
          scopeType: "TEAM",
          scopeId: targetTeam.id,
          entityType: "TEAM",
          entityId: targetTeam.id,
          reason: "marketplace_matching_finalize",
          beforeData: {
            registrationMode: targetTeam.registrationMode,
            marketplaceStatus: targetTeam.marketplaceStatus,
            participantIds: targetTeam.participants.map((participant) => participant.id),
          },
          afterData: {
            registrationMode: "TEAM",
            teamName: finalTeamName,
            classificationCode: evaluation.classification.code,
            totalAge,
          },
          meta: {
            sessionEmail: normalizeEmail(auth.userEmail),
            classificationWarnings: evaluation.warnings,
          },
          tenantId: auth.competition.tenantId,
          competitionId: auth.competition.id,
          actorId: auth.user.id,
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: `Börsen-Mannschaft wurde als echte Mannschaft "${finalTeamName}" übernommen.`,
      classificationWarnings: evaluation.warnings,
    });
  }

  return NextResponse.json({ error: "Unbekannte Aktion." }, { status: 400 });
}
