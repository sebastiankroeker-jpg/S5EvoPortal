import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import type { Prisma, ShirtSize } from '@prisma/client';
import { authOptions } from '../../auth/[...nextauth]/route';
import { TeamRegistrationSchema, type TeamRegistrationInput, birthYearToBirthDateInput, extractBirthYearFromInput } from '@/lib/domain/team';
import { classifyTeam as classifyTeamShared, evaluateTeamState } from '@/lib/domain/classification';
import { sendParticipantChangeSubmittedBatchEmails } from '@/lib/mail/participant-change';
import {
  diffParticipantSnapshots,
  hasParticipantChangeData,
  pickDirectParticipantChangeData,
  serializeSnapshot,
  summarizeDirectParticipantChangeFields,
  summarizeParticipantChanges,
  toParticipantSnapshot,
} from '@/lib/participant-change';
import { createParticipantClaimInvitation, shouldInviteParticipantClaim } from '@/lib/participant-claim-invitation';
import {
  canViewerSeeFullPublication,
  resolveVisibleParticipantName,
  resolveVisibleTeamName,
  splitDisplayName,
} from '@/lib/publication-visibility';
import { normalizeEmail, resolveCurrentUser } from '@/lib/current-user';
import { prisma } from '@/lib/prisma';
import { getScopedRoleFlags } from '@/lib/server-permissions';
import { canRoleViewAllTeams, normalizeCompetitionTeamAccessConfig, resolveEffectiveTeamScopeRole } from '@/lib/team-access-config';
import { resolveTeamAccess } from '@/lib/team-manager-access';

// Map frontend gender ("M"/"W") to Prisma enum
function mapGender(g: string): "MALE" | "FEMALE" {
  return g === "W" ? "FEMALE" : "MALE";
}

// Map frontend discipline to Prisma DisciplineAssignment enum
function mapDiscipline(d: string): "RUN" | "BENCH" | "STOCK" | "ROAD" | "MTB" | "TBD" {
  const valid = ["RUN", "BENCH", "STOCK", "ROAD", "MTB", "TBD"] as const;
  return valid.includes(d as (typeof valid)[number]) ? (d as (typeof valid)[number]) : "TBD";
}

function normalizeSubmittedText(value?: string | null) {
  return value?.normalize("NFC").trim() || "";
}

function toDirectParticipantUpdateInput(changeData: Record<string, unknown>): Prisma.ParticipantUpdateInput {
  const data: Prisma.ParticipantUpdateInput = {};

  if (Object.prototype.hasOwnProperty.call(changeData, "email")) {
    data.email = typeof changeData.email === "string" ? changeData.email : null;
  }

  if (Object.prototype.hasOwnProperty.call(changeData, "shirtSize")) {
    data.shirtSize = typeof changeData.shirtSize === "string" ? (changeData.shirtSize as ShirtSize) : null;
  }

  if (Object.prototype.hasOwnProperty.call(changeData, "moderationNote")) {
    data.moderationNote = typeof changeData.moderationNote === "string" ? changeData.moderationNote : null;
  }

  if (Object.prototype.hasOwnProperty.call(changeData, "participantPublicationPreference")) {
    data.participantPublicationPreference =
      changeData.participantPublicationPreference === "NAME_VEROEFFENTLICHEN"
        ? "NAME_VEROEFFENTLICHEN"
        : "NAME_VERBERGEN";
  }

  return data;
}

function resolveSubmittedParticipants(
  submittedParticipants: TeamRegistrationInput["participants"],
  existingParticipants: Array<SerializableParticipant>,
) {
  if (submittedParticipants.length !== existingParticipants.length) {
    return {
      error: "Teilnehmerzahl passt nicht mehr zum gespeicherten Team. Bitte Seite neu laden.",
      matches: [] as Array<{
        submittedParticipant: TeamRegistrationInput["participants"][number];
        existingParticipant: SerializableParticipant;
      }>,
    };
  }

  const existingById = new Map(existingParticipants.map((participant) => [participant.id, participant]));
  const seenIds = new Set<string>();
  const matches: Array<{
    submittedParticipant: TeamRegistrationInput["participants"][number];
    existingParticipant: SerializableParticipant;
  }> = [];

  for (const submittedParticipant of submittedParticipants) {
    if (!submittedParticipant?.id) {
      return {
        error: "Teilnehmerdaten ohne stabile ID koennen nicht sicher zugeordnet werden. Bitte Team neu laden und erneut versuchen.",
        matches: [] as Array<{
          submittedParticipant: TeamRegistrationInput["participants"][number];
          existingParticipant: SerializableParticipant;
        }>,
      };
    }

    if (seenIds.has(submittedParticipant.id)) {
      return {
        error: "Teilnehmerdaten enthalten doppelte IDs. Bitte Team neu laden und erneut versuchen.",
        matches: [] as Array<{
          submittedParticipant: TeamRegistrationInput["participants"][number];
          existingParticipant: SerializableParticipant;
        }>,
      };
    }

    const existingParticipant = existingById.get(submittedParticipant.id);
    if (!existingParticipant) {
      return {
        error: "Teilnehmerdaten passen nicht mehr zum aktuellen Teamstand. Bitte Team neu laden.",
        matches: [] as Array<{
          submittedParticipant: TeamRegistrationInput["participants"][number];
          existingParticipant: SerializableParticipant;
        }>,
      };
    }

    seenIds.add(submittedParticipant.id);
    matches.push({ submittedParticipant, existingParticipant });
  }

  return { error: null, matches };
}

function classifyTeam(participants: TeamRegistrationInput['participants']): string {
  const inputs = participants
    .map((participant) => ({
      participant,
      birthYear: extractBirthYearFromInput(participant.birthDate),
    }))
    .filter(({ participant, birthYear }) => participant.firstName && participant.lastName && birthYear !== null)
    .map(({ participant, birthYear }) => ({
      birthYear: birthYear as number,
      gender: participant.gender as "M" | "W" | "D",
    }));

  return classifyTeamShared(inputs).code;
}

type SerializedPendingChange = {
  id: string;
  status: string;
  updatedAt?: Date | null;
  reviewedAt?: Date | null;
  reviewComment?: string | null;
};

type SerializableParticipant = {
  id: string;
  firstName: string;
  lastName: string;
  gender: "MALE" | "FEMALE";
  birthYear: number | null;
  userId?: string | null;
  participantPublicationPreference?: "NAME_VERBERGEN" | "NAME_VEROEFFENTLICHEN" | null;
  moderationNote?: string | null;
  email?: string | null;
  disciplineCode?: string | null;
  shirtSize?: string | null;
  isTeamManager?: boolean;
  canBeTeamManager?: boolean;
  pendingChanges?: SerializedPendingChange[];
};

type SerializableTeam = {
  id: string;
  name: string;
  teamPublicationLevel?: "TEAM_ANONYM" | "TEAMNAME_OEFFENTLICH" | "ALLES_OEFFENTLICH" | null;
  classificationCode?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  owner?: { email?: string | null; name?: string | null } | null;
  ownerId?: string | null;
  teamChiefId?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  participants?: SerializableParticipant[];
};

function serializeParticipant(
  participant: SerializableParticipant | null | undefined,
  options?: {
    currentUserId?: string | null;
    currentUserEmail?: string | null;
    canSeeFullPublication?: boolean;
    teamPublicationLevel?: string | null;
    activeTeamManagerUserIds?: Set<string>;
  },
) {
  if (!participant) return null;
  const canSeeFullPublication = options?.canSeeFullPublication !== false;
  const latestChange = Array.isArray(participant.pendingChanges) ? participant.pendingChanges[0] : null;
  const normalizedParticipantEmail = participant.email ? normalizeEmail(participant.email) : null;
  const normalizedCurrentUserEmail = options?.currentUserEmail ? normalizeEmail(options.currentUserEmail) : null;
  const isCurrentUserParticipant =
    (!!options?.currentUserId && participant.userId === options.currentUserId) ||
    (!!normalizedParticipantEmail && normalizedParticipantEmail === normalizedCurrentUserEmail);
  const visibleParticipantName = resolveVisibleParticipantName({
    actualName: `${participant.firstName} ${participant.lastName}`.trim(),
    teamPublicationLevel: options?.teamPublicationLevel,
    participantPublicationPreference: participant.participantPublicationPreference,
    canSeeFullPublication: canSeeFullPublication || isCurrentUserParticipant,
  });
  const splitName = splitDisplayName(visibleParticipantName);
  return {
    id: participant.id,
    firstName: splitName.firstName,
    lastName: splitName.lastName,
    gender: participant.gender === "MALE" ? "M" : "W",
    birthDate: birthYearToBirthDateInput(participant.birthYear),
    moderationNote: canSeeFullPublication ? participant.moderationNote ?? "" : "",
    email: canSeeFullPublication ? participant.email ?? "" : "",
    participantPublicationPreference: participant.participantPublicationPreference ?? "NAME_VERBERGEN",
    discipline: participant.disciplineCode ?? "TBD",
    shirtSize: participant.shirtSize ?? "",
    isTeamManager: !!participant.userId && options?.activeTeamManagerUserIds?.has(participant.userId) === true,
    canBeTeamManager: !!participant.userId,
    isCurrentUserParticipant,
    latestChange: latestChange
      ? {
          id: latestChange.id,
          status: latestChange.status,
          updatedAt: latestChange.updatedAt?.toISOString?.() ?? null,
          reviewedAt: latestChange.reviewedAt?.toISOString?.() ?? null,
          reviewComment: latestChange.reviewComment ?? null,
        }
      : null,
  };
}

function serializeTeam(
  team: SerializableTeam | null | undefined,
  options?: {
    currentUserId?: string | null;
    currentUserEmail?: string | null;
    canSeeFullPublication?: boolean;
    canEditAllTeams?: boolean;
  },
) {
  if (!team) return null;
  const canSeeFullPublication = options?.canSeeFullPublication !== false;
  const normalizedCurrentUserEmail = normalizeEmail(options?.currentUserEmail);
  const activeTeamManagerUserIds = new Set(
    (team as SerializableTeam & { memberRoles?: Array<{ userId: string; revokedAt?: Date | null }> }).memberRoles
      ?.filter((memberRole) => !memberRole.revokedAt)
      .map((memberRole) => memberRole.userId) ?? [],
  );
  const visibleTeamName = resolveVisibleTeamName({
    actualTeamName: team.name,
    teamPublicationLevel: team.teamPublicationLevel,
    canSeeFullPublication,
  });
  return {
    id: team.id,
    name: visibleTeamName,
    teamPublicationLevel: team.teamPublicationLevel ?? "TEAM_ANONYM",
    category: team.classificationCode ?? "unclassified",
    contactName: canSeeFullPublication ? team.contactName ?? team.owner?.name ?? "" : "",
    contactEmail: canSeeFullPublication ? team.contactEmail ?? team.owner?.email ?? "" : "",
    contactPhone: canSeeFullPublication ? team.contactPhone ?? "" : "",
    ownerEmail: canSeeFullPublication ? team.owner?.email ?? team.contactEmail ?? "" : "",
    ownerName: canSeeFullPublication ? team.owner?.name ?? team.contactName ?? "" : "",
    canCurrentUserEdit:
      options?.canEditAllTeams === true ||
      (!!options?.currentUserId && (team.ownerId === options.currentUserId || team.teamChiefId === options.currentUserId)) ||
      (!!options?.currentUserId && activeTeamManagerUserIds.has(options.currentUserId)) ||
      (!!normalizedCurrentUserEmail &&
        (normalizeEmail(team.owner?.email) === normalizedCurrentUserEmail ||
          normalizeEmail(team.contactEmail) === normalizedCurrentUserEmail)),
    canManageTeamManagers:
      options?.canEditAllTeams === true ||
      (!!options?.currentUserId && (team.ownerId === options.currentUserId || team.teamChiefId === options.currentUserId)) ||
      (!!normalizedCurrentUserEmail &&
        (normalizeEmail(team.owner?.email) === normalizedCurrentUserEmail ||
          normalizeEmail(team.contactEmail) === normalizedCurrentUserEmail)),
    createdAt: team.createdAt?.toISOString?.() ?? new Date().toISOString(),
    updatedAt: team.updatedAt?.toISOString?.() ?? team.createdAt?.toISOString?.() ?? new Date().toISOString(),
    participants: Array.isArray(team.participants)
      ? team.participants
          .map((participant) =>
            serializeParticipant(participant, {
              ...options,
              teamPublicationLevel: team.teamPublicationLevel,
              activeTeamManagerUserIds,
            }),
          )
          .filter(Boolean)
      : [],
  };
}

// GET einzelnes Team
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const roleContext = request.nextUrl.searchParams.get("roleContext");
    
    try {
      const team = await prisma.team.findFirst({
        where: {
          id: id,
          deletedAt: null
        },
        include: {
          participants: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'asc' },
            include: {
              pendingChanges: {
                orderBy: { updatedAt: 'desc' },
                take: 1,
                select: { id: true, status: true, updatedAt: true, reviewedAt: true, reviewComment: true }
              }
            }
          },
          owner: { select: { email: true, name: true } },
          memberRoles: {
            where: { role: "TEAM_MANAGER", revokedAt: null },
            select: { userId: true, revokedAt: true },
          },
          competition: {
            select: {
              tenantId: true,
              teamOwnerFilterVisibleForTeamchef: true,
              participantsCanViewAllTeams: true,
              spectatorsCanViewAllTeams: true,
            },
          },
        }
      });

      if (!team) {
        return NextResponse.json({ error: 'Team not found' }, { status: 404 });
      }

      const { user } = await resolveCurrentUser(session, { createIfMissing: true });
      const access = await getScopedRoleFlags(userEmail, team.competition.tenantId, session);
      const effectiveScopeRole = resolveEffectiveTeamScopeRole(roleContext, access.roles);
      const canViewRequestedScope =
        access.canViewAllTeams || canRoleViewAllTeams(effectiveScopeRole, normalizeCompetitionTeamAccessConfig(team.competition));
      const normalizedUserEmail = normalizeEmail(userEmail);
      const teamAccess = resolveTeamAccess({
        team,
        user,
        userEmail,
        canEditAllTeams: access.canEditAllTeams,
      });
      const canSeeFullPublication = canViewerSeeFullPublication({
        isPrivilegedViewer: effectiveScopeRole === "ADMIN" || effectiveScopeRole === "MODERATOR",
        ownsTeam: teamAccess.canEditTeam,
      });

      if (!canViewRequestedScope && !teamAccess.canEditTeam) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      return NextResponse.json({
        team: serializeTeam(team, {
          currentUserId: user?.id ?? null,
          currentUserEmail: normalizedUserEmail,
          canSeeFullPublication,
          canEditAllTeams: access.canEditAllTeams,
        }),
      });
    } catch (dbError) {
      console.error('Database error on GET:', dbError);
      return NextResponse.json({ error: 'Database temporarily unavailable' }, { status: 503 });
    }
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'API temporarily unavailable' }, { status: 503 });
  }
}

// PUT Team aktualisieren
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    
    const validation = TeamRegistrationSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    const teamData = validation.data;

    try {
      // Prüfe ob Team existiert und dem User gehört
      const existingTeam = await prisma.team.findFirst({
        where: {
          id: id,
          deletedAt: null
        },
        include: {
          participants: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'asc' },
            include: {
              pendingChanges: {
                orderBy: { updatedAt: 'desc' },
                take: 1,
                select: { id: true, status: true, updatedAt: true, reviewedAt: true, reviewComment: true }
              }
            }
          },
          owner: { select: { email: true, name: true } },
          memberRoles: {
            where: { role: "TEAM_MANAGER", revokedAt: null },
            select: { userId: true, revokedAt: true },
          },
          competition: {
            select: {
              tenantId: true,
              name: true,
              year: true,
              date: true,
              dateEnd: true,
              registrationDeadline: true,
              registrationNotificationEmail: true,
              claimTokenExpiryMode: true,
              claimTokenTtlDays: true,
              tenant: {
                select: {
                  name: true,
                  contactEmail: true,
                },
              },
            },
          },
        }
      });

      if (!existingTeam) {
        return NextResponse.json({ error: 'Team not found' }, { status: 404 });
      }

      const { user } = await resolveCurrentUser(session, { createIfMissing: true });
      const access = await getScopedRoleFlags(userEmail, existingTeam.competition.tenantId, session);
      const normalizedUserEmail = normalizeEmail(userEmail);
      const teamAccess = resolveTeamAccess({
        team: existingTeam,
        user,
        userEmail,
        canEditAllTeams: access.canEditAllTeams,
      });

      if (!teamAccess.canEditTeam) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const canDirectEdit = access.canEditAllTeams;
      const requestedTeamState = evaluateTeamState(
        teamData.participants.map((participant) => ({
          birthYear: extractBirthYearFromInput(participant.birthDate),
          gender: participant.gender,
          disciplineCode: participant.discipline,
        })),
        existingTeam.classificationCode,
      );

      if (!requestedTeamState.discipline.valid) {
        return NextResponse.json(
          {
            error: requestedTeamState.discipline.warnings.join(' · '),
            disciplineWarnings: requestedTeamState.discipline.warnings,
          },
          { status: 409 }
        );
      }

      // Neue Klassifizierung berechnen
      const autoCategory = requestedTeamState.classification.code;
      const normalizedTeamName = teamData.teamName?.trim();
      const requestedTeamPublicationLevel = teamData.teamPublicationLevel || existingTeam.teamPublicationLevel;
      
      // Team-Name beibehalten wenn leer
      const finalTeamName = normalizedTeamName && normalizedTeamName.length >= 3
        ? normalizedTeamName
        : existingTeam.name;

      if (!canDirectEdit && finalTeamName !== existingTeam.name) {
        return NextResponse.json(
          { error: 'Teamname-Aenderungen laufen fuer Teamchefs noch nicht ueber den Genehmigungsworkflow. Bitte nur Teilnehmerdaten aendern.' },
          { status: 409 }
        );
      }

      // Berechne neues Gesamtalter
      const validParticipants = teamData.participants
        .map((participant) => ({
          participant,
          birthYear: extractBirthYearFromInput(participant.birthDate),
        }))
        .filter(({ participant, birthYear }) => participant.firstName && participant.lastName && birthYear !== null);
      const totalAge = validParticipants.reduce((sum, entry) => sum + (2026 - (entry.birthYear as number)), 0);
      const matchedParticipantsResult = resolveSubmittedParticipants(teamData.participants, existingTeam.participants);

      if (matchedParticipantsResult.error) {
        return NextResponse.json({ error: matchedParticipantsResult.error }, { status: 409 });
      }

      if (!canDirectEdit) {
        let createdRequests = 0;
        let updatedRequests = 0;
        let directlyAppliedParticipants = 0;
        let updatedTeamPublication = false;
        const createdChangeMailItems: Array<{
          participantName: string;
          changeSummary: ReturnType<typeof summarizeParticipantChanges>;
        }> = [];
        const participantInviteCandidates: Array<{
          participantId: string;
          previousEmail?: string | null;
          nextEmail?: string | null;
          firstName: string;
          lastName: string;
          userId?: string | null;
        }> = [];

        if (requestedTeamPublicationLevel !== existingTeam.teamPublicationLevel) {
          await prisma.team.update({
            where: { id },
            data: {
              teamPublicationLevel: requestedTeamPublicationLevel,
            },
          });
          updatedTeamPublication = true;
        }

        for (const { submittedParticipant, existingParticipant } of matchedParticipantsResult.matches) {
          const requestedBirthYear = extractBirthYearFromInput(submittedParticipant.birthDate);
          const currentSnapshot = toParticipantSnapshot(existingParticipant);
          const requestedSnapshot = toParticipantSnapshot({
            firstName: normalizeSubmittedText(submittedParticipant.firstName),
            lastName: normalizeSubmittedText(submittedParticipant.lastName),
            birthYear: requestedBirthYear,
            gender: mapGender(submittedParticipant.gender),
            disciplineCode: mapDiscipline(submittedParticipant.discipline),
            shirtSize: submittedParticipant.shirtSize || null,
            moderationNote: submittedParticipant.moderationNote?.trim() || null,
            email: normalizeSubmittedText(submittedParticipant.email) || null,
            participantPublicationPreference: submittedParticipant.participantPublicationPreference || "NAME_VERBERGEN",
          });

          const changedFields = diffParticipantSnapshots(currentSnapshot, requestedSnapshot);
          if (Object.keys(changedFields).length === 0) {
            continue;
          }

          const directlyAppliedChangeData = pickDirectParticipantChangeData(changedFields, requestedSnapshot);
          let approvalBaseSnapshot = currentSnapshot;
          let approvalRequestedSnapshot = requestedSnapshot;

          if (hasParticipantChangeData(directlyAppliedChangeData)) {
            const directAppliedSnapshot = {
              ...currentSnapshot,
              ...directlyAppliedChangeData,
            };
            const directFieldLabels = summarizeDirectParticipantChangeFields(directlyAppliedChangeData);

            await prisma.$transaction(async (tx) => {
              await tx.participant.update({
                where: { id: existingParticipant.id },
                data: toDirectParticipantUpdateInput(directlyAppliedChangeData),
              });

              await tx.participantAuditLog.create({
                data: {
                  action: 'DIRECT_CHANGE',
                  participantId: existingParticipant.id,
                  actorId: user!.id,
                  beforeData: serializeSnapshot(currentSnapshot),
                  afterData: serializeSnapshot(directAppliedSnapshot),
                  message: directFieldLabels.join(', ') + ' direkt durch Teamchef aktualisiert',
                },
              });
            });

            directlyAppliedParticipants += 1;

            if (
              Object.prototype.hasOwnProperty.call(directlyAppliedChangeData, 'email') &&
              shouldInviteParticipantClaim({
                previousEmail: existingParticipant.email,
                nextEmail: submittedParticipant.email,
                participantUserId: existingParticipant.userId,
              })
            ) {
              participantInviteCandidates.push({
                participantId: existingParticipant.id,
                previousEmail: existingParticipant.email,
                nextEmail: normalizeEmail(submittedParticipant.email),
                firstName: normalizeSubmittedText(submittedParticipant.firstName),
                lastName: normalizeSubmittedText(submittedParticipant.lastName),
                userId: existingParticipant.userId,
              });
            }

            approvalBaseSnapshot = directAppliedSnapshot;
            approvalRequestedSnapshot = {
              ...requestedSnapshot,
              ...directlyAppliedChangeData,
            };
          }

          const changeSummary = summarizeParticipantChanges(approvalBaseSnapshot, approvalRequestedSnapshot);
          if (changeSummary.length === 0) {
            continue;
          }

          const existingPendingChange = await prisma.pendingChange.findFirst({
            where: {
              participantId: existingParticipant.id,
              status: 'PENDING',
            },
            orderBy: { createdAt: 'desc' },
          });

          if (existingPendingChange) {
            updatedRequests += 1;
            await prisma.$transaction(async (tx) => {
              const updatedPendingChange = await tx.pendingChange.update({
                where: { id: existingPendingChange.id },
                data: {
                  beforeData: serializeSnapshot(approvalBaseSnapshot),
                  changeData: serializeSnapshot(approvalRequestedSnapshot),
                  requestedById: user!.id,
                  reviewComment: null,
                  reviewedAt: null,
                  reviewedById: null,
                },
              });

              await tx.participantAuditLog.create({
                data: {
                  action: 'REQUEST_UPDATED',
                  participantId: existingParticipant.id,
                  actorId: user!.id,
                  pendingChangeId: updatedPendingChange.id,
                  beforeData: serializeSnapshot(approvalBaseSnapshot),
                  afterData: serializeSnapshot(approvalRequestedSnapshot),
                  message: 'Offene Aenderungsanfrage durch Teamchef aktualisiert',
                },
              });
            });
          } else {
            createdRequests += 1;
            await prisma.$transaction(async (tx) => {
              const createdPendingChange = await tx.pendingChange.create({
                data: {
                  beforeData: serializeSnapshot(approvalBaseSnapshot),
                  changeData: serializeSnapshot(approvalRequestedSnapshot),
                  status: 'PENDING',
                  participantId: existingParticipant.id,
                  requestedById: user!.id,
                },
              });

              await tx.participantAuditLog.create({
                data: {
                  action: 'REQUEST_SUBMITTED',
                  participantId: existingParticipant.id,
                  actorId: user!.id,
                  pendingChangeId: createdPendingChange.id,
                  beforeData: serializeSnapshot(approvalBaseSnapshot),
                  afterData: serializeSnapshot(approvalRequestedSnapshot),
                  message: 'Aenderungsanfrage durch Teamchef eingereicht',
                },
              });
            });

            createdChangeMailItems.push({
              participantName: existingParticipant.firstName + ' ' + existingParticipant.lastName,
              changeSummary,
            });
          }
        }

        if (createdChangeMailItems.length > 0) {
          await sendParticipantChangeSubmittedBatchEmails({
            competition: existingTeam.competition,
            teamName: finalTeamName,
            teamContactEmail: existingTeam.contactEmail,
            requester: {
              name: user?.name || userEmail || 'Teamchef',
              email: userEmail,
            },
            participants: createdChangeMailItems,
          });
        }

        const participantClaimMailResults: Array<unknown> = [];
        for (const inviteCandidate of participantInviteCandidates) {
          try {
            const participantClaimMail = await createParticipantClaimInvitation({
              request,
              participant: {
                id: inviteCandidate.participantId,
                firstName: inviteCandidate.firstName,
                lastName: inviteCandidate.lastName,
                email: inviteCandidate.nextEmail,
                userId: inviteCandidate.userId,
              },
              team: {
                id: existingTeam.id,
                name: finalTeamName,
              },
              competition: existingTeam.competition,
              actorUserId: user?.id ?? null,
              sessionEmail: userEmail,
              previousEmail: inviteCandidate.previousEmail,
            });
            participantClaimMailResults.push(participantClaimMail);
          } catch (error) {
            console.error("Participant claim invitation failed after direct team-owner participant update", {
              participantId: inviteCandidate.participantId,
              error,
            });
            participantClaimMailResults.push({
              status: "failed",
              participantId: inviteCandidate.participantId,
              error: error instanceof Error ? error.message : "Einladung konnte nicht gesendet werden",
            });
          }
        }

        const invitationStatuses = participantClaimMailResults.map((result) =>
          result && typeof result === "object" && "status" in result ? result.status : null,
        );
        const sentInvitationCount = invitationStatuses.filter((status) => status !== null && status !== "failed" && status !== "skipped").length;
        const failedInvitationCount = invitationStatuses.filter((status) => status === "failed").length;
        const invitationNoun = sentInvitationCount === 1 ? "Einladung" : "Einladungen";
        const invitationMessage =
          sentInvitationCount > 0 || failedInvitationCount > 0
            ? `, ${sentInvitationCount} ${invitationNoun} versendet${failedInvitationCount > 0 ? `, ${failedInvitationCount} fehlgeschlagen` : ''}`
            : '';

        const refreshedTeam = await prisma.team.findFirst({
          where: { id, deletedAt: null },
          include: {
          participants: {
              where: { deletedAt: null },
              orderBy: { createdAt: 'asc' },
              include: {
                pendingChanges: {
                  orderBy: { updatedAt: 'desc' },
                  take: 1,
                  select: { id: true, status: true, updatedAt: true, reviewedAt: true, reviewComment: true },
                },
              },
            },
            owner: { select: { email: true, name: true } },
            memberRoles: {
              where: { role: "TEAM_MANAGER", revokedAt: null },
              select: { userId: true, revokedAt: true },
            },
          },
        });

        if (!refreshedTeam) {
          return NextResponse.json({ error: 'Team not found' }, { status: 404 });
        }

        if (createdRequests === 0 && updatedRequests === 0) {
          return NextResponse.json({
            success: true,
            applied: updatedTeamPublication || directlyAppliedParticipants > 0,
            message:
              updatedTeamPublication || directlyAppliedParticipants > 0
                ? `${updatedTeamPublication ? 'Veröffentlichungsgrad aktualisiert' : ''}${updatedTeamPublication && directlyAppliedParticipants > 0 ? ', ' : ''}${directlyAppliedParticipants > 0 ? `${directlyAppliedParticipants} Teilnehmer direkt aktualisiert${invitationMessage}` : ''}`
                : 'Keine Aenderungen erkannt',
            classificationWarnings: requestedTeamState.classificationWarnings,
            participantClaimMails: participantClaimMailResults,
            team: serializeTeam(refreshedTeam, {
              currentUserId: user?.id ?? null,
              currentUserEmail: normalizedUserEmail,
              canEditAllTeams: access.canEditAllTeams,
            }),
          });
        }

        return NextResponse.json({
          success: true,
          applied: updatedTeamPublication || directlyAppliedParticipants > 0,
          message:
            createdRequests > 0 && updatedRequests > 0
              ? `${updatedTeamPublication ? 'Veröffentlichungsgrad aktualisiert, ' : ''}${directlyAppliedParticipants > 0 ? `${directlyAppliedParticipants} Teilnehmer direkt aktualisiert${invitationMessage}, ` : ''}${createdRequests} Aenderungsanfrage(n) eingereicht, ${updatedRequests} offene Anfrage(n) aktualisiert`
              : createdRequests > 0
                ? `${updatedTeamPublication ? 'Veröffentlichungsgrad aktualisiert, ' : ''}${directlyAppliedParticipants > 0 ? `${directlyAppliedParticipants} Teilnehmer direkt aktualisiert${invitationMessage}, ` : ''}${createdRequests} Aenderungsanfrage(n) zur Genehmigung eingereicht`
                : `${updatedTeamPublication ? 'Veröffentlichungsgrad aktualisiert, ' : ''}${directlyAppliedParticipants > 0 ? `${directlyAppliedParticipants} Teilnehmer direkt aktualisiert${invitationMessage}, ` : ''}${updatedRequests} offene Aenderungsanfrage(n) aktualisiert`,
          classificationWarnings: requestedTeamState.classificationWarnings,
          pendingCount: createdRequests + updatedRequests,
          participantClaimMails: participantClaimMailResults,
          team: serializeTeam(refreshedTeam, {
            currentUserId: user?.id ?? null,
            currentUserEmail: normalizedUserEmail,
            canEditAllTeams: access.canEditAllTeams,
          }),
        });
      }

      const participantInviteCandidates = matchedParticipantsResult.matches
        .filter(({ submittedParticipant, existingParticipant }) =>
          shouldInviteParticipantClaim({
            previousEmail: existingParticipant.email,
            nextEmail: submittedParticipant.email,
            participantUserId: existingParticipant.userId,
          }),
        )
        .map(({ submittedParticipant, existingParticipant }) => ({
          participantId: existingParticipant.id,
          previousEmail: existingParticipant.email,
          nextEmail: normalizeEmail(submittedParticipant.email),
          firstName: normalizeSubmittedText(submittedParticipant.firstName),
          lastName: normalizeSubmittedText(submittedParticipant.lastName),
          userId: existingParticipant.userId,
        }));

      await prisma.$transaction(async (tx) => {
        await tx.team.update({
          where: { id },
          data: {
            name: finalTeamName,
            teamPublicationLevel: requestedTeamPublicationLevel,
            contactName: body.contactName || existingTeam.contactName,
            contactEmail: body.contactEmail || existingTeam.contactEmail,
            classificationCode: autoCategory,
            totalAge: totalAge || null,
          },
        });

        for (const { submittedParticipant } of matchedParticipantsResult.matches) {
          const birthYear = extractBirthYearFromInput(submittedParticipant.birthDate);
          if (birthYear === null || !submittedParticipant.id) continue;

          await tx.participant.update({
            where: { id: submittedParticipant.id },
            data: {
              firstName: normalizeSubmittedText(submittedParticipant.firstName),
              lastName: normalizeSubmittedText(submittedParticipant.lastName),
              birthYear,
              gender: mapGender(submittedParticipant.gender),
              disciplineCode: mapDiscipline(submittedParticipant.discipline),
              shirtSize: submittedParticipant.shirtSize || null,
              moderationNote: submittedParticipant.moderationNote?.trim() || null,
              consentGiven: true,
              email: normalizeSubmittedText(submittedParticipant.email) || null,
              participantPublicationPreference: submittedParticipant.participantPublicationPreference || "NAME_VERBERGEN",
              deletedAt: null,
            },
          });
        }
      });

      const participantClaimMailResults: Array<unknown> = [];
      for (const inviteCandidate of participantInviteCandidates) {
        try {
          const participantClaimMail = await createParticipantClaimInvitation({
            request,
            participant: {
              id: inviteCandidate.participantId,
              firstName: inviteCandidate.firstName,
              lastName: inviteCandidate.lastName,
              email: inviteCandidate.nextEmail,
              userId: inviteCandidate.userId,
            },
            team: {
              id: existingTeam.id,
              name: finalTeamName,
            },
            competition: existingTeam.competition,
            actorUserId: user?.id ?? null,
            sessionEmail: userEmail,
            previousEmail: inviteCandidate.previousEmail,
          });
          participantClaimMailResults.push(participantClaimMail);
        } catch (error) {
          console.error("Participant claim invitation failed after team update", {
            participantId: inviteCandidate.participantId,
            error,
          });
          participantClaimMailResults.push({
            status: "failed",
            participantId: inviteCandidate.participantId,
            error: error instanceof Error ? error.message : "Einladung konnte nicht gesendet werden",
          });
        }
      }

      const updatedTeam = await prisma.team.findFirst({
        where: { id, deletedAt: null },
        include: {
          participants: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
          owner: { select: { email: true, name: true } },
          memberRoles: {
            where: { role: "TEAM_MANAGER", revokedAt: null },
            select: { userId: true, revokedAt: true },
          },
        }
      });

      if (!updatedTeam) {
        return NextResponse.json({ error: 'Team not found' }, { status: 404 });
      }

      const invitationStatuses = participantClaimMailResults.map((result) =>
        result && typeof result === "object" && "status" in result ? result.status : null,
      );
      const sentInvitationCount = invitationStatuses.filter((status) => status !== null && status !== "failed" && status !== "skipped").length;
      const failedInvitationCount = invitationStatuses.filter((status) => status === "failed").length;
      const invitationNoun = sentInvitationCount === 1 ? "Einladung" : "Einladungen";
      const invitationMessage =
        sentInvitationCount > 0 || failedInvitationCount > 0
          ? ` ${sentInvitationCount} ${invitationNoun} versendet${failedInvitationCount > 0 ? `, ${failedInvitationCount} fehlgeschlagen` : ''}.`
          : '';

      return NextResponse.json({ 
        success: true,
        applied: true,
        message: `Team "${finalTeamName}" erfolgreich aktualisiert!${invitationMessage} Klasse: ${autoCategory}`,
        classificationWarnings: requestedTeamState.classificationWarnings,
        participantClaimMails: participantClaimMailResults,
        team: serializeTeam(updatedTeam, {
          currentUserId: user?.id ?? null,
          currentUserEmail: normalizedUserEmail,
          canEditAllTeams: access.canEditAllTeams,
        })
      });

    } catch (dbError) {
      console.error('Database error on PUT:', dbError);
      return NextResponse.json(
        { error: 'Datenbankfehler bei der Aktualisierung. Bitte versuche es erneut.' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Failed to update team' }, { status: 500 });
  }
}

// DELETE Team (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    try {
      // Prüfe ob Team existiert und dem User gehört
      const existingTeam = await prisma.team.findFirst({
        where: {
          id: id,
          deletedAt: null
        },
        include: {
          owner: { select: { email: true, name: true } },
          memberRoles: {
            where: { role: "TEAM_MANAGER", revokedAt: null },
            select: { userId: true, revokedAt: true },
          },
          competition: { select: { tenantId: true } },
        },
      });

      if (!existingTeam) {
        return NextResponse.json({ error: 'Team not found' }, { status: 404 });
      }

      const { user } = await resolveCurrentUser(session, { createIfMissing: true });
      const access = await getScopedRoleFlags(userEmail, existingTeam.competition.tenantId, session);
      const teamAccess = resolveTeamAccess({
        team: existingTeam,
        user,
        userEmail,
        canEditAllTeams: access.canEditAllTeams,
      });

      if (!teamAccess.canManageTeamManagers) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      // Soft delete: setze deletedAt
      await prisma.team.update({
        where: { id: id },
        data: { 
          deletedAt: new Date()
        }
      });

      // Auch alle Participants des Teams soft-deleten
      await prisma.participant.updateMany({
        where: { teamId: id },
        data: { deletedAt: new Date() }
      });

      return NextResponse.json({ 
        success: true,
        message: `Team "${existingTeam.name}" wurde gelöscht.`
      });

    } catch (dbError) {
      console.error('Database error on DELETE:', dbError);
      return NextResponse.json(
        { error: 'Datenbankfehler beim Löschen. Bitte versuche es erneut.' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Failed to delete team' }, { status: 500 });
  }
}
