import { randomUUID } from 'crypto';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import type { Prisma, ShirtSize } from '@prisma/client';
import { authOptions } from '../../auth/[...nextauth]/route';
import { recordAppliedChangeRequest, upsertLegacyParticipantChangeRequest } from '@/lib/change-request';
import {
  TeamRegistrationSchema,
  type TeamRegistrationInput,
  extractBirthYearFromInput,
  formatTeamRegistrationValidationIssues,
  normalizeBirthDateForStorage,
  storedBirthDateToInput,
} from '@/lib/domain/team';
import { evaluateTeamDraft } from '@/lib/domain/classification';
import { sendParticipantChangeSubmittedBatchEmails } from '@/lib/mail/participant-change';
import { sendTeamLifecycleOrgEmail } from '@/lib/mail/team-lifecycle';
import {
  diffParticipantSnapshots,
  hasParticipantChangeData,
  parseSnapshot,
  pickDirectParticipantChangeData,
  serializeSnapshot,
  summarizeDirectParticipantChangeFields,
  summarizeParticipantChanges,
  toParticipantSnapshot,
} from '@/lib/participant-change';
import { validatePendingChangeBundle } from '@/lib/participant-change-bundle';
import {
  createParticipantClaimInvitation,
  getParticipantClaimTokenStatus,
  getParticipantEmailInvitationStatus,
  shouldInviteParticipantClaim,
} from '@/lib/participant-claim-invitation';
import {
  canViewerSeeFullPublication,
  resolveVisibleParticipantName,
  resolveVisibleTeamName,
  splitDisplayName,
} from '@/lib/publication-visibility';
import { canViewerSeeMarketplaceTeam } from '@/lib/marketplace-visibility';
import { normalizeEmail, resolveCurrentUser } from '@/lib/current-user';
import { prisma } from '@/lib/prisma';
import { isRegistrationDeadlineOpen } from '@/lib/registration-deadline';
import { getScopedRoleFlags } from '@/lib/server-permissions';
import { canRoleViewAllTeams, normalizeCompetitionTeamAccessConfig, resolveEffectiveTeamScopeRole } from '@/lib/team-access-config';
import { resolveTeamAccess } from '@/lib/team-manager-access';
import { syncDerivedTeamchefRole } from '@/lib/teamchef-role';

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

function teamNameSnapshot(teamName: string) {
  return { teamName };
}

function participantDisplayName(participant: { firstName: string; lastName: string }) {
  return `${participant.firstName} ${participant.lastName}`.trim();
}

function sortedDisciplineKey(values: string[]) {
  return [...values].sort().join('|');
}

function isCompleteDisciplineSwap(
  changes: Array<{ currentDisciplineCode: string; nextDisciplineCode: string }>,
) {
  if (changes.length < 2) return false;
  if (changes.some((change) => change.currentDisciplineCode === "TBD" || change.nextDisciplineCode === "TBD")) return false;
  return (
    sortedDisciplineKey(changes.map((change) => change.currentDisciplineCode)) ===
    sortedDisciplineKey(changes.map((change) => change.nextDisciplineCode))
  );
}

function marketplaceTeamNameForParticipant(participant: { firstName: string; lastName: string }) {
  return `Sportlerbörse: ${participantDisplayName(participant)}`;
}

function parseShirtSize(value: unknown): ShirtSize | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const validSizes: readonly ShirtSize[] = ["K116", "K128", "K140", "K152", "K164", "XS", "S", "M", "L", "XL", "XXL", "XXXL"];
  return validSizes.includes(normalized as ShirtSize) ? (normalized as ShirtSize) : null;
}

function toDirectParticipantUpdateInput(changeData: Record<string, unknown>): Prisma.ParticipantUpdateInput {
  const data: Prisma.ParticipantUpdateInput = {};

  if (Object.prototype.hasOwnProperty.call(changeData, "email")) {
    data.email = typeof changeData.email === "string" ? changeData.email : null;
  }

  if (Object.prototype.hasOwnProperty.call(changeData, "shirtSize")) {
    data.shirtSize = parseShirtSize(changeData.shirtSize);
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
  birthDate?: string | null;
  userId?: string | null;
  portalAccount?: {
    id: string;
    email: string;
    name?: string | null;
    authentikSub?: string | null;
  } | null;
  hasPlaceholderUser?: boolean;
  participantPublicationPreference?: "NAME_VERBERGEN" | "NAME_VEROEFFENTLICHEN" | null;
  moderationNote?: string | null;
  email?: string | null;
  disciplineCode?: string | null;
  marketplaceReturnDisciplineCode?: string | null;
  shirtSize?: string | null;
  isTeamManager?: boolean;
  canBeTeamManager?: boolean;
  pendingChanges?: SerializedPendingChange[];
  claimTokens?: Array<{
    id: string;
    createdAt: Date;
    expiresAt: Date;
    claimedAt?: Date | null;
    revokedAt?: Date | null;
  }>;
};

type SerializableTeam = {
  id: string;
  name: string;
  teamPublicationLevel?: "TEAM_ANONYM" | "TEAMNAME_OEFFENTLICH" | "ALLES_OEFFENTLICH" | null;
  registrationMode?: "TEAM" | "MARKETPLACE" | null;
  marketplaceVisibility?: "PUBLIC" | "MARKETPLACE_USERS" | "PORTAL_USERS" | "ADMIN_MANAGEMENT_ONLY" | null;
  marketplaceStatus?: "NEW" | "REVIEWED" | "MATCHING" | "MATCHED" | "WITHDRAWN" | null;
  marketplaceMessage?: string | null;
  classificationCode?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  owner?: { email?: string | null; name?: string | null; authentikSub?: string | null } | null;
  ownerId?: string | null;
  teamChiefId?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  participants?: SerializableParticipant[];
  registrationClaimTokens?: Array<{
    id: string;
    suggestedEmail: string;
    suggestedName?: string | null;
    createdAt: Date;
    expiresAt: Date;
    claimedAt?: Date | null;
    revokedAt?: Date | null;
  }>;
  competition?: {
    marketplaceGlobalVisibility?: "SELECTIVE" | "OFFLINE" | null;
  } | null;
};

const teamParticipantInclude = {
  pendingChanges: {
    orderBy: { updatedAt: 'desc' as const },
    take: 1,
    select: { id: true, status: true, updatedAt: true, reviewedAt: true, reviewComment: true },
  },
  claimTokens: {
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    select: { id: true, createdAt: true, expiresAt: true, claimedAt: true, revokedAt: true },
  },
} satisfies Prisma.ParticipantInclude;

function serializeParticipant(
  participant: SerializableParticipant | null | undefined,
  options?: {
    currentUserId?: string | null;
    currentUserEmail?: string | null;
    canSeeFullPublication?: boolean;
    canSeeSensitiveParticipantFields?: boolean;
    teamPublicationLevel?: string | null;
    activeTeamManagerUserIds?: Set<string>;
  },
) {
  if (!participant) return null;
  const canSeeFullPublication = options?.canSeeFullPublication !== false;
  const latestChange = Array.isArray(participant.pendingChanges) ? participant.pendingChanges[0] : null;
  const latestClaimToken = Array.isArray(participant.claimTokens) ? participant.claimTokens[0] : null;
  const canSeeSensitiveParticipantFields = options?.canSeeSensitiveParticipantFields === true;
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
    birthDate: canSeeFullPublication || isCurrentUserParticipant
      ? storedBirthDateToInput(participant.birthDate, participant.birthYear)
      : "",
    moderationNote: canSeeFullPublication ? participant.moderationNote ?? "" : "",
    email: canSeeSensitiveParticipantFields ? participant.email ?? "" : "",
    linkedUserId: canSeeSensitiveParticipantFields ? participant.userId ?? null : null,
    portalAccount: canSeeSensitiveParticipantFields && participant.portalAccount?.authentikSub
      ? {
          id: participant.portalAccount.id,
          email: participant.portalAccount.email,
          name: participant.portalAccount.name ?? null,
        }
      : null,
    hasPlaceholderUser: canSeeSensitiveParticipantFields
      ? Boolean(participant.portalAccount && !participant.portalAccount.authentikSub)
      : false,
    emailInvitation: canSeeSensitiveParticipantFields
      ? {
          status: getParticipantEmailInvitationStatus({
            email: participant.email,
            participantUserId: participant.userId,
            token: latestClaimToken,
          }),
          tokenStatus: getParticipantClaimTokenStatus(latestClaimToken),
          sentAt: latestClaimToken?.createdAt?.toISOString?.() ?? null,
          expiresAt: latestClaimToken?.expiresAt?.toISOString?.() ?? null,
          claimedAt: latestClaimToken?.claimedAt?.toISOString?.() ?? null,
          revokedAt: latestClaimToken?.revokedAt?.toISOString?.() ?? null,
        }
      : null,
    participantPublicationPreference: participant.participantPublicationPreference ?? "NAME_VERBERGEN",
    discipline: participant.disciplineCode ?? "TBD",
    marketplaceReturnDisciplineCode: participant.marketplaceReturnDisciplineCode ?? null,
    shirtSize: canSeeSensitiveParticipantFields ? participant.shirtSize ?? "" : "",
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
    canSeeSensitiveParticipantFields?: boolean;
    canSeeOwnerClaimFields?: boolean;
    canEditAllTeams?: boolean;
    currentUserHasPortalAccount?: boolean;
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
  if (team.teamChiefId) activeTeamManagerUserIds.add(team.teamChiefId);
  const isCurrentUserOwner = Boolean(options?.currentUserId && team.ownerId === options.currentUserId);
  const canFinalizeMarketplaceMatching =
    team.registrationMode === "MARKETPLACE" &&
    isCurrentUserOwner &&
    options?.currentUserHasPortalAccount === true &&
    (team.participants ?? []).length === 5;
  const teamAccess = resolveTeamAccess({
    team: {
      teamChiefId: team.teamChiefId,
      contactEmail: team.contactEmail,
      memberRoles: (team as SerializableTeam & {
        memberRoles?: Array<{ userId: string; revokedAt?: Date | null }>;
      }).memberRoles,
    },
    user: { id: options?.currentUserId },
    userEmail: options?.currentUserEmail,
    canEditAllTeams: options?.canEditAllTeams,
  });
  const canCurrentUserEdit = teamAccess.canEditTeam;
  const isCurrentUserTeam =
    isCurrentUserOwner ||
    teamAccess.isLegacyOwner ||
    teamAccess.isTeamManager ||
    ((team.participants ?? []).some((participant) => {
      const normalizedParticipantEmail = normalizeEmail(participant.email);
      return (
        (!!options?.currentUserId && participant.userId === options.currentUserId) ||
        (!!normalizedCurrentUserEmail && normalizedParticipantEmail === normalizedCurrentUserEmail)
      );
    }));
  const canSeeSensitiveParticipantFields = options?.canSeeSensitiveParticipantFields === true || canCurrentUserEdit;
  const canSeeFullTeamPublication = canSeeFullPublication || isCurrentUserTeam;
  const visibleTeamName = resolveVisibleTeamName({
    actualTeamName: team.name,
    teamPublicationLevel: team.teamPublicationLevel,
    canSeeFullPublication: canSeeFullTeamPublication,
  });
  const latestRegistrationClaimToken = Array.isArray(team.registrationClaimTokens)
    ? team.registrationClaimTokens[0]
    : null;
  const canSeeOwnerClaimFields = options?.canSeeOwnerClaimFields === true;
  return {
    id: team.id,
    name: visibleTeamName,
    teamPublicationLevel: team.teamPublicationLevel ?? "TEAM_ANONYM",
    registrationMode: team.registrationMode ?? "TEAM",
    marketplaceVisibility: team.marketplaceVisibility ?? "ADMIN_MANAGEMENT_ONLY",
    marketplaceStatus: team.marketplaceStatus ?? "NEW",
    marketplaceMessage: canSeeSensitiveParticipantFields ? team.marketplaceMessage ?? "" : "",
    category: team.classificationCode ?? "unclassified",
    contactName: canSeeFullTeamPublication ? team.contactName ?? team.owner?.name ?? "" : "",
    contactEmail: canSeeFullTeamPublication ? team.contactEmail ?? team.owner?.email ?? "" : "",
    contactPhone: canSeeFullTeamPublication ? team.contactPhone ?? "" : "",
    ownerId: canSeeSensitiveParticipantFields ? team.ownerId ?? null : null,
    ownerHasPortalAccount: canSeeOwnerClaimFields ? Boolean(team.owner?.authentikSub) : false,
    ownerEmail: canSeeFullTeamPublication ? team.owner?.email ?? team.contactEmail ?? "" : "",
    ownerName: canSeeFullTeamPublication ? team.owner?.name ?? team.contactName ?? "" : "",
    teamChiefId: canSeeSensitiveParticipantFields ? team.teamChiefId ?? null : null,
    isCurrentUserTeam,
    canCurrentUserEdit,
    canFinalizeMarketplaceMatching,
    canManageTeamManagers: teamAccess.canManageTeamManagers,
    createdAt: team.createdAt?.toISOString?.() ?? new Date().toISOString(),
    updatedAt: team.updatedAt?.toISOString?.() ?? team.createdAt?.toISOString?.() ?? new Date().toISOString(),
    ownerClaim: canSeeOwnerClaimFields && latestRegistrationClaimToken
      ? {
          suggestedEmail: latestRegistrationClaimToken.suggestedEmail,
          suggestedName: latestRegistrationClaimToken.suggestedName ?? null,
          sentAt: latestRegistrationClaimToken.createdAt?.toISOString?.() ?? null,
          expiresAt: latestRegistrationClaimToken.expiresAt?.toISOString?.() ?? null,
          claimedAt: latestRegistrationClaimToken.claimedAt?.toISOString?.() ?? null,
          revokedAt: latestRegistrationClaimToken.revokedAt?.toISOString?.() ?? null,
        }
      : null,
    participants: Array.isArray(team.participants)
      ? team.participants
          .map((participant) =>
            serializeParticipant(participant, {
              ...options,
              teamPublicationLevel: team.teamPublicationLevel,
              canSeeFullPublication: canSeeFullTeamPublication,
              canSeeSensitiveParticipantFields,
              activeTeamManagerUserIds,
            }),
          )
          .filter(Boolean)
      : [],
  };
}

async function attachParticipantPortalAccounts(team: SerializableTeam | null): Promise<SerializableTeam | null> {
  if (!team?.participants?.length) {
    return team;
  }

  const participantEmails = Array.from(
    new Set(
      team.participants
        .map((participant) => normalizeEmail(participant.email))
        .filter((email): email is string => Boolean(email)),
    ),
  );

  if (participantEmails.length === 0) {
    return team;
  }

  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      email: { in: participantEmails, mode: "insensitive" },
    },
    select: { id: true, email: true, name: true, authentikSub: true },
  });
  const usersByEmail = new Map(users.map((user) => [normalizeEmail(user.email), user]));

  return {
    ...team,
    participants: team.participants.map((participant) => ({
      ...participant,
      portalAccount: usersByEmail.get(normalizeEmail(participant.email)) ?? null,
    })),
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
            include: teamParticipantInclude,
          },
          owner: { select: { email: true, name: true, authentikSub: true } },
          registrationClaimTokens: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              suggestedEmail: true,
              suggestedName: true,
              createdAt: true,
              expiresAt: true,
              claimedAt: true,
              revokedAt: true,
            },
          },
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
              marketplaceGlobalVisibility: true,
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
        roleContext
          ? canRoleViewAllTeams(effectiveScopeRole, normalizeCompetitionTeamAccessConfig(team.competition))
          : access.canViewAllTeams || canRoleViewAllTeams(effectiveScopeRole, normalizeCompetitionTeamAccessConfig(team.competition));
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
      const isPrivilegedMarketplaceViewer =
        effectiveScopeRole === "ADMIN" || effectiveScopeRole === "MODERATOR" || access.canEditAllTeams;
      const viewerHasMarketplaceRegistration =
        isPrivilegedMarketplaceViewer
          ? true
          : await prisma.team.count({
              where: {
                competitionId: team.competitionId,
                deletedAt: null,
                registrationMode: "MARKETPLACE",
                OR: [
                  ...(user ? [{ teamChiefId: user.id }] : []),
                  ...(user ? [{ ownerId: user.id }] : []),
                  ...(user
                    ? [{
                        participants: {
                          some: {
                            userId: user.id,
                            deletedAt: null,
                          },
                        },
                      }]
                    : []),
                  ...(normalizedUserEmail
                    ? [{
                        contactEmail: {
                          equals: normalizedUserEmail,
                          mode: 'insensitive' as const,
                        },
                      }]
                    : []),
                ],
              },
            }) > 0;

      const isCurrentUserOwner = Boolean(user?.id && team.ownerId === user.id);
      if (!canViewRequestedScope && !teamAccess.canEditTeam && !isCurrentUserOwner) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (
        team.registrationMode === "MARKETPLACE" &&
        !canViewerSeeMarketplaceTeam({
          globalVisibility: team.competition.marketplaceGlobalVisibility,
          teamVisibility: team.marketplaceVisibility,
          isPrivilegedViewer: isPrivilegedMarketplaceViewer,
          ownsMarketplaceTeam: teamAccess.canEditTeam || isCurrentUserOwner,
          hasMarketplaceRegistration: viewerHasMarketplaceRegistration,
          isAuthenticated: Boolean(userEmail),
        })
      ) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const teamWithParticipantAccounts = await attachParticipantPortalAccounts(team);

      return NextResponse.json({
        team: serializeTeam(teamWithParticipantAccounts, {
          currentUserId: user?.id ?? null,
          currentUserEmail: normalizedUserEmail,
          canSeeFullPublication,
          canEditAllTeams: access.canEditAllTeams,
          currentUserHasPortalAccount: Boolean(user?.authentikSub),
          canSeeSensitiveParticipantFields: access.canEditAllTeams,
          canSeeOwnerClaimFields: effectiveScopeRole === "ADMIN" && access.isAdmin,
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

export async function PATCH(
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

    const existingTeam = await prisma.team.findFirst({
      where: { id, deletedAt: null },
      include: {
        competition: { select: { tenantId: true } },
        participants: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
          include: teamParticipantInclude,
        },
        owner: { select: { email: true, name: true, authentikSub: true } },
        registrationClaimTokens: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            suggestedEmail: true,
            suggestedName: true,
            createdAt: true,
            expiresAt: true,
            claimedAt: true,
            revokedAt: true,
          },
        },
      },
    });

    if (!existingTeam) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const access = await getScopedRoleFlags(userEmail, existingTeam.competition.tenantId, session);
    if (!access.canEditAllTeams) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const allowedStatuses = new Set(["NEW", "REVIEWED", "MATCHING", "MATCHED", "WITHDRAWN"]);
    const allowedVisibilities = new Set(["PUBLIC", "MARKETPLACE_USERS", "PORTAL_USERS", "ADMIN_MANAGEMENT_ONLY"]);
    const allowedPublicationLevels = new Set(["TEAM_ANONYM", "TEAMNAME_OEFFENTLICH", "ALLES_OEFFENTLICH"]);
    const data: Prisma.TeamUpdateInput = {};

    if (typeof body.marketplaceStatus === "string") {
      if (!allowedStatuses.has(body.marketplaceStatus)) {
        return NextResponse.json({ error: 'Ungültiger Sportlerbörse-Status.' }, { status: 400 });
      }
      data.marketplaceStatus = body.marketplaceStatus;
    }

    if (typeof body.marketplaceVisibility === "string") {
      if (!allowedVisibilities.has(body.marketplaceVisibility)) {
        return NextResponse.json({ error: 'Ungültige Sichtbarkeit.' }, { status: 400 });
      }
      data.marketplaceVisibility = body.marketplaceVisibility;
    }

    if (typeof body.teamPublicationLevel === "string") {
      if (!allowedPublicationLevels.has(body.teamPublicationLevel)) {
        return NextResponse.json({ error: 'Ungültige Team-Veröffentlichung.' }, { status: 400 });
      }
      data.teamPublicationLevel = body.teamPublicationLevel;
    }

    if (typeof body.teamName === "string") {
      const teamName = body.teamName.trim();
      if (teamName) {
        data.name = teamName;
      }
    }

    if (typeof body.contactName === "string") {
      data.contactName = body.contactName.trim() || null;
    }

    if (typeof body.contactEmail === "string") {
      data.contactEmail = body.contactEmail.trim() || null;
    }

    if (typeof body.marketplaceMessage === "string") {
      data.marketplaceMessage = body.marketplaceMessage.trim() || null;
      data.notes = body.marketplaceMessage.trim() || null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Keine Änderungen übermittelt.' }, { status: 400 });
    }

    const { user } = await resolveCurrentUser(session, { createIfMissing: true });
    const beforeSnapshot = {
      marketplaceStatus: existingTeam.marketplaceStatus ?? "NEW",
      marketplaceVisibility: existingTeam.marketplaceVisibility ?? "ADMIN_MANAGEMENT_ONLY",
      teamPublicationLevel: existingTeam.teamPublicationLevel ?? "TEAM_ANONYM",
      marketplaceMessage: existingTeam.marketplaceMessage ?? null,
      teamName: existingTeam.name,
      contactName: existingTeam.contactName ?? null,
      contactEmail: existingTeam.contactEmail ?? null,
    };
    const afterSnapshot = {
      marketplaceStatus: typeof body.marketplaceStatus === "string" ? body.marketplaceStatus : beforeSnapshot.marketplaceStatus,
      marketplaceVisibility: typeof body.marketplaceVisibility === "string" ? body.marketplaceVisibility : beforeSnapshot.marketplaceVisibility,
      teamPublicationLevel: typeof body.teamPublicationLevel === "string" ? body.teamPublicationLevel : beforeSnapshot.teamPublicationLevel,
      marketplaceMessage: typeof body.marketplaceMessage === "string" ? body.marketplaceMessage.trim() || null : beforeSnapshot.marketplaceMessage,
      teamName: typeof body.teamName === "string" && body.teamName.trim() ? body.teamName.trim() : beforeSnapshot.teamName,
      contactName: typeof body.contactName === "string" ? body.contactName.trim() || null : beforeSnapshot.contactName,
      contactEmail: typeof body.contactEmail === "string" ? body.contactEmail.trim() || null : beforeSnapshot.contactEmail,
    };

    const updatedTeam = await prisma.$transaction(async (tx) => {
      const updated = await tx.team.update({
        where: { id },
        data,
        include: {
          participants: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'asc' },
            include: teamParticipantInclude,
          },
          owner: { select: { email: true, name: true, authentikSub: true } },
          registrationClaimTokens: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              suggestedEmail: true,
              suggestedName: true,
              createdAt: true,
              expiresAt: true,
              claimedAt: true,
              revokedAt: true,
            },
          },
          memberRoles: {
            where: { role: "TEAM_MANAGER", revokedAt: null },
            select: { userId: true, revokedAt: true },
          },
        },
      });

      await tx.auditEvent.create({
        data: {
          action: "MARKETPLACE_TEAM_UPDATED",
          scopeType: "TEAM",
          scopeId: existingTeam.id,
          entityType: "TEAM",
          entityId: existingTeam.id,
          reason: "marketplace_admin_update",
          beforeData: beforeSnapshot,
          afterData: afterSnapshot,
          meta: {
            teamName: existingTeam.name,
            registrationMode: existingTeam.registrationMode,
            sessionEmail: normalizeEmail(userEmail),
          },
          tenantId: existingTeam.competition.tenantId,
          competitionId: existingTeam.competitionId,
          actorId: user?.id ?? null,
        },
      });

      return updated;
    });

    const updatedTeamWithParticipantAccounts = await attachParticipantPortalAccounts(updatedTeam);

    return NextResponse.json({
      team: serializeTeam(updatedTeamWithParticipantAccounts, {
        currentUserId: user?.id ?? null,
        currentUserEmail: normalizeEmail(userEmail),
        canSeeFullPublication: true,
        canEditAllTeams: true,
        canSeeSensitiveParticipantFields: true,
        canSeeOwnerClaimFields: access.isAdmin,
      }),
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Failed to update marketplace metadata' }, { status: 500 });
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
        { error: formatTeamRegistrationValidationIssues(validation.error.issues), details: validation.error.issues },
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
            include: teamParticipantInclude,
          },
          owner: { select: { email: true, name: true, authentikSub: true } },
          registrationClaimTokens: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              suggestedEmail: true,
              suggestedName: true,
              createdAt: true,
              expiresAt: true,
              claimedAt: true,
              revokedAt: true,
            },
          },
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
              status: true,
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
      const registrationDeadlineOpen = isRegistrationDeadlineOpen(existingTeam.competition.registrationDeadline);
      const canApplyTeamUpdateDirectly = canDirectEdit || registrationDeadlineOpen;
      const directEditActorLabel = canDirectEdit ? "Admin" : "Team Manager:in vor Anmeldeschluss";
      const directEditObsoleteReviewComment = canDirectEdit
        ? "Durch direkte Admin-Änderung überholt"
        : "Durch direkte Änderung vor Anmeldeschluss überholt";
      const requestedTeamState = evaluateTeamDraft({
        mode: canDirectEdit ? "admin-edit" : "team-edit",
        teamName: teamData.teamName,
        contactName: existingTeam.contactName,
        contactEmail: existingTeam.contactEmail,
        participants: teamData.participants,
        oldClassificationCode: existingTeam.classificationCode,
      });

      if (requestedTeamState.blockingErrors.length > 0) {
        return NextResponse.json(
          {
            error: requestedTeamState.blockingErrors.join(' · '),
            blockingErrors: requestedTeamState.blockingErrors,
          },
          { status: 400 }
        );
      }

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
      const teamNameChanged = finalTeamName !== existingTeam.name;
      const teamNameChangeIsDirect = canApplyTeamUpdateDirectly;
      const effectiveTeamName = !canDirectEdit && teamNameChanged && !teamNameChangeIsDirect
        ? existingTeam.name
        : finalTeamName;

      if (teamNameChanged) {
        const duplicateTeam = await prisma.team.findFirst({
          where: {
            id: { not: id },
            competitionId: existingTeam.competitionId,
            deletedAt: null,
            name: {
              equals: finalTeamName,
              mode: "insensitive",
            },
          },
          select: { id: true, name: true },
        });

        if (duplicateTeam) {
          return NextResponse.json(
            { error: `Eine Mannschaft mit dem Namen "${finalTeamName}" existiert in diesem Wettkampf bereits.`, existingTeamId: duplicateTeam.id },
            { status: 409 },
          );
        }
      }

      if (!canDirectEdit && teamNameChanged && !teamNameChangeIsDirect && !user) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }

      // Berechne neues Gesamtalter
      const validParticipants = teamData.participants
        .map((participant) => ({
          participant,
          birthYear: extractBirthYearFromInput(participant.birthDate),
          birthDate: normalizeBirthDateForStorage(participant.birthDate),
        }))
        .filter(({ participant, birthYear }) => participant.firstName && participant.lastName && birthYear !== null);
      const totalAge = validParticipants.reduce((sum, entry) => sum + (2026 - (entry.birthYear as number)), 0);
      const matchedParticipantsResult = resolveSubmittedParticipants(teamData.participants, existingTeam.participants);

      if (matchedParticipantsResult.error) {
        return NextResponse.json({ error: matchedParticipantsResult.error }, { status: 409 });
      }

      const replacementMatches = matchedParticipantsResult.matches.filter(
        ({ submittedParticipant }) => submittedParticipant.replaceParticipant === true,
      );

      if (!canApplyTeamUpdateDirectly && replacementMatches.length > 0) {
        return NextResponse.json(
          { error: 'Teilnehmer ersetzen ist nur fuer Orga/Admin-Direktbearbeitung freigegeben.' },
          { status: 403 },
        );
      }

      if (!canApplyTeamUpdateDirectly) {
        let createdRequests = 0;
        let updatedRequests = 0;
        let directlyAppliedParticipants = 0;
        let updatedTeamPublication = false;
        let directlyUpdatedTeamName = false;
        let createdTeamNameRequest = false;
        let updatedTeamNameRequest = false;
        let bundledSwapRequests = 0;
        const createdChangeMailItems: Array<{
          participantName: string;
          changeSummary: ReturnType<typeof summarizeParticipantChanges>;
        }> = [];
        const pendingBundleCandidates: Array<{
          id: string;
          participantId: string;
          teamId: string;
          status: "PENDING";
          beforeData: string | null;
          changeData: string;
          previousBundleId?: string | null;
        }> = [];
        const participantInviteCandidates: Array<{
          participantId: string;
          previousEmail?: string | null;
          nextEmail?: string | null;
          firstName: string;
          lastName: string;
          userId?: string | null;
        }> = [];
        const disciplineChangeRequests = matchedParticipantsResult.matches
          .map(({ submittedParticipant, existingParticipant }) => ({
            participantId: existingParticipant.id,
            currentDisciplineCode: existingParticipant.disciplineCode || "TBD",
            nextDisciplineCode: mapDiscipline(submittedParticipant.discipline),
          }))
          .filter((change) => change.currentDisciplineCode !== change.nextDisciplineCode);
        const shouldCreateSwapBundle = isCompleteDisciplineSwap(disciplineChangeRequests);
        const swapParticipantIds = new Set(
          shouldCreateSwapBundle ? disciplineChangeRequests.map((change) => change.participantId) : [],
        );
        let swapBundleId: string | null = shouldCreateSwapBundle ? randomUUID() : null;

        if (shouldCreateSwapBundle) {
          const existingBundledSwapChanges = await prisma.pendingChange.findMany({
            where: {
              participantId: { in: [...swapParticipantIds] },
              status: "PENDING",
              bundleId: { not: null },
            },
            select: {
              id: true,
              bundleId: true,
            },
          });
          const existingBundleIds = [
            ...new Set(
              existingBundledSwapChanges
                .map((change) => change.bundleId)
                .filter((bundleId): bundleId is string => typeof bundleId === "string" && bundleId.length > 0),
            ),
          ];

          if (existingBundleIds.length > 1) {
            return NextResponse.json(
              { error: "Der Disziplinstausch betrifft mehrere bestehende Tausch-Bundles. Bitte die offenen Antraege erst entscheiden oder neu laden." },
              { status: 409 },
            );
          }

          if (existingBundleIds.length === 1) {
            const existingBundleId = existingBundleIds[0];
            const existingBundleSize = await prisma.pendingChange.count({
              where: {
                bundleId: existingBundleId,
                status: "PENDING",
              },
            });

            if (existingBundleSize !== existingBundledSwapChanges.length) {
              return NextResponse.json(
                { error: "Ein bestehendes Tausch-Bundle enthaelt weitere Antraege. Bitte die offenen Antraege erst entscheiden oder neu laden." },
                { status: 409 },
              );
            }

            swapBundleId = existingBundleId;
          }
        }

        if (teamNameChanged && teamNameChangeIsDirect) {
          const beforeSnapshot = teamNameSnapshot(existingTeam.name);
          const requestedSnapshot = teamNameSnapshot(finalTeamName);

          await prisma.$transaction(async (tx) => {
            await tx.team.update({
              where: { id },
              data: { name: finalTeamName },
            });

            await tx.auditEvent.create({
              data: {
                action: "TEAM_NAME_CHANGED",
                scopeType: "TEAM",
                scopeId: existingTeam.id,
                entityType: "TEAM",
                entityId: existingTeam.id,
                reason: "team_manager_pre_deadline_rename",
                beforeData: beforeSnapshot,
                afterData: requestedSnapshot,
                meta: {
                  source: "team_manager_pre_deadline",
                  previousTeamName: existingTeam.name,
                  nextTeamName: finalTeamName,
                  sessionEmail: normalizedUserEmail,
                },
                tenantId: existingTeam.competition.tenantId,
                competitionId: existingTeam.competitionId,
                actorId: user!.id,
              },
            });

            await recordAppliedChangeRequest(tx, {
              tenantId: existingTeam.competition.tenantId,
              competitionId: existingTeam.competitionId,
              targetType: "TEAM",
              targetId: existingTeam.id,
              changeType: "UPDATE",
              source: "SELF_SERVICE",
              beforeSnapshot,
              requestedSnapshot,
              metadata: {
                field: "teamName",
                directReason: "before_registration_deadline",
              },
              actorId: user!.id,
              message: "Mannschaftsname vor Anmeldeschluss direkt durch Team Manager:in geaendert",
            });
          });

          directlyUpdatedTeamName = true;
        } else if (teamNameChanged) {
          const beforeSnapshot = teamNameSnapshot(existingTeam.name);
          const requestedSnapshot = teamNameSnapshot(finalTeamName);
          const existingTeamNameRequest = await prisma.changeRequest.findFirst({
            where: {
              targetType: "TEAM",
              targetId: existingTeam.id,
              changeType: "UPDATE",
              status: "PENDING",
              tenantId: existingTeam.competition.tenantId,
            },
            orderBy: { updatedAt: "desc" },
          });

          if (existingTeamNameRequest) {
            await prisma.$transaction(async (tx) => {
              await tx.changeRequest.update({
                where: { id: existingTeamNameRequest.id },
                data: {
                  requestedById: user!.id,
                  beforeSnapshot,
                  requestedSnapshot,
                  metadata: {
                    field: "teamName",
                    previousTeamName: existingTeam.name,
                    requestedTeamName: finalTeamName,
                  },
                  reviewComment: null,
                  reviewedAt: null,
                  reviewedById: null,
                },
              });

              await tx.changeRequestAuditLog.create({
                data: {
                  changeRequestId: existingTeamNameRequest.id,
                  actorId: user!.id,
                  action: "UPDATED",
                  beforeData: existingTeamNameRequest.requestedSnapshot as Prisma.InputJsonValue,
                  afterData: requestedSnapshot,
                  message: "Offener Mannschaftsname-Antrag durch Team Manager:in aktualisiert",
                },
              });
            });
            updatedTeamNameRequest = true;
          } else {
            await prisma.$transaction(async (tx) => {
              const created = await tx.changeRequest.create({
                data: {
                  tenantId: existingTeam.competition.tenantId,
                  competitionId: existingTeam.competitionId,
                  targetType: "TEAM",
                  targetId: existingTeam.id,
                  changeType: "UPDATE",
                  source: "SELF_SERVICE",
                  status: "PENDING",
                  submittedAt: new Date(),
                  beforeSnapshot,
                  requestedSnapshot,
                  metadata: {
                    field: "teamName",
                    previousTeamName: existingTeam.name,
                    requestedTeamName: finalTeamName,
                  },
                  requestedById: user!.id,
                },
              });

              await tx.changeRequestAuditLog.create({
                data: {
                  changeRequestId: created.id,
                  actorId: user!.id,
                  action: "SUBMITTED",
                  afterData: requestedSnapshot,
                  message: "Mannschaftsname-Aenderung durch Team Manager:in eingereicht",
                },
              });
            });
            createdTeamNameRequest = true;
          }
        }

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
          const requestedBirthDate = normalizeBirthDateForStorage(submittedParticipant.birthDate);
          const currentSnapshot = toParticipantSnapshot(existingParticipant);
          const requestedSnapshot = toParticipantSnapshot({
            firstName: normalizeSubmittedText(submittedParticipant.firstName),
            lastName: normalizeSubmittedText(submittedParticipant.lastName),
            birthYear: requestedBirthYear,
            birthDate: requestedBirthDate,
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
                  message: directFieldLabels.join(', ') + ' direkt durch Team Manager:in aktualisiert',
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
            const updatedPendingChange = await prisma.$transaction(async (tx) => {
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
                  message: 'Offene Aenderungsanfrage durch Team Manager:in aktualisiert',
                },
              });

              await upsertLegacyParticipantChangeRequest(tx, {
                tenantId: existingTeam.competition.tenantId,
                competitionId: existingTeam.competitionId,
                participantId: existingParticipant.id,
                requestedById: user!.id,
                beforeSnapshot: approvalBaseSnapshot,
                requestedSnapshot: approvalRequestedSnapshot,
                legacyPendingChangeId: updatedPendingChange.id,
                message: 'Offene Teilnehmer-Aenderungsanfrage durch Team Manager:in aktualisiert',
              });

              return updatedPendingChange;
            });

            pendingBundleCandidates.push({
              id: updatedPendingChange.id,
              participantId: updatedPendingChange.participantId,
              teamId: existingTeam.id,
              status: "PENDING",
              beforeData: updatedPendingChange.beforeData,
              changeData: updatedPendingChange.changeData,
              previousBundleId: existingPendingChange.bundleId,
            });
          } else {
            createdRequests += 1;
            const createdPendingChange = await prisma.$transaction(async (tx) => {
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
                  message: 'Aenderungsanfrage durch Team Manager:in eingereicht',
                },
              });

              await upsertLegacyParticipantChangeRequest(tx, {
                tenantId: existingTeam.competition.tenantId,
                competitionId: existingTeam.competitionId,
                participantId: existingParticipant.id,
                requestedById: user!.id,
                beforeSnapshot: approvalBaseSnapshot,
                requestedSnapshot: approvalRequestedSnapshot,
                legacyPendingChangeId: createdPendingChange.id,
                message: 'Teilnehmer-Aenderungsanfrage durch Team Manager:in eingereicht',
              });

              return createdPendingChange;
            });

            pendingBundleCandidates.push({
              id: createdPendingChange.id,
              participantId: createdPendingChange.participantId,
              teamId: existingTeam.id,
              status: "PENDING",
              beforeData: createdPendingChange.beforeData,
              changeData: createdPendingChange.changeData,
              previousBundleId: null,
            });

            createdChangeMailItems.push({
              participantName: existingParticipant.firstName + ' ' + existingParticipant.lastName,
              changeSummary,
            });
          }
        }

        if (shouldCreateSwapBundle && swapBundleId) {
          const swapCandidates = pendingBundleCandidates.filter((candidate) =>
            swapParticipantIds.has(candidate.participantId),
          );

          if (swapCandidates.length === swapParticipantIds.size) {
            const validation = validatePendingChangeBundle(
              swapCandidates.map((candidate) => ({
                ...candidate,
                beforeData: candidate.beforeData,
                changeData: candidate.changeData,
                liveParticipantSnapshot: candidate.beforeData ? parseSnapshot(candidate.beforeData) : undefined,
              })),
              existingTeam.participants,
              existingTeam.classificationCode,
            );

            if (!validation.valid) {
              return NextResponse.json(
                {
                  error: "Der Disziplinstausch konnte nicht als gemeinsamer Antrag gebuendelt werden.",
                  issues: validation.issues,
                },
                { status: 409 },
              );
            }

            const swapCandidateIds = swapCandidates.map((candidate) => candidate.id);

            await prisma.$transaction(async (tx) => {
              const updated = await tx.pendingChange.updateMany({
                where: {
                  id: { in: swapCandidateIds },
                  status: "PENDING",
                },
                data: {
                  bundleId: swapBundleId,
                  bundleType: "SWAP",
                  bundleStatus: "PENDING",
                },
              });

              if (updated.count !== swapCandidateIds.length) {
                throw new Error("SWAP_BUNDLE_STATE_CHANGED");
              }

              await tx.participantAuditLog.createMany({
                data: swapCandidates.map((candidate) => ({
                  action: 'REQUEST_UPDATED',
                  participantId: candidate.participantId,
                  actorId: user!.id,
                  pendingChangeId: candidate.id,
                  beforeData: candidate.beforeData,
                  afterData: candidate.changeData,
                  message: 'Disziplinstausch automatisch als gemeinsamer Antrag gebuendelt',
                })),
              });
            });

            bundledSwapRequests = swapCandidates.length;
          }
        }

        if (createdChangeMailItems.length > 0) {
          await sendParticipantChangeSubmittedBatchEmails({
            competition: existingTeam.competition,
            teamName: effectiveTeamName,
            teamContactEmail: existingTeam.contactEmail,
            requester: {
              name: user?.name || userEmail || 'Team Manager:in',
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
                name: effectiveTeamName,
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
        const swapBundleMessage = bundledSwapRequests > 0 ? `, Disziplinstausch als ${bundledSwapRequests}er-Bundle gebuendelt` : '';

        const refreshedTeam = await prisma.team.findFirst({
          where: { id, deletedAt: null },
          include: {
          participants: {
              where: { deletedAt: null },
              orderBy: { createdAt: 'asc' },
              include: teamParticipantInclude,
            },
            owner: { select: { email: true, name: true, authentikSub: true } },
            registrationClaimTokens: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: {
                id: true,
                suggestedEmail: true,
                suggestedName: true,
                createdAt: true,
                expiresAt: true,
                claimedAt: true,
                revokedAt: true,
              },
            },
            memberRoles: {
              where: { role: "TEAM_MANAGER", revokedAt: null },
              select: { userId: true, revokedAt: true },
            },
          },
        });

        if (!refreshedTeam) {
          return NextResponse.json({ error: 'Team not found' }, { status: 404 });
        }
        const refreshedTeamWithParticipantAccounts = await attachParticipantPortalAccounts(refreshedTeam);

        const pendingTeamNameRequestCount = (createdTeamNameRequest ? 1 : 0) + (updatedTeamNameRequest ? 1 : 0);
        const directUpdateMessageParts = [
          updatedTeamPublication ? 'Veröffentlichungsgrad aktualisiert' : '',
          directlyUpdatedTeamName ? 'Mannschaftsname aktualisiert' : '',
          directlyAppliedParticipants > 0 ? `${directlyAppliedParticipants} Teilnehmer direkt aktualisiert${invitationMessage}` : '',
        ].filter(Boolean);

        if (createdRequests === 0 && updatedRequests === 0 && pendingTeamNameRequestCount === 0) {
          return NextResponse.json({
            success: true,
            applied: updatedTeamPublication || directlyUpdatedTeamName || directlyAppliedParticipants > 0,
            message:
              directUpdateMessageParts.length > 0
                ? directUpdateMessageParts.join(', ')
                : 'Keine Aenderungen erkannt',
            classificationWarnings: requestedTeamState.classificationWarnings,
            participantClaimMails: participantClaimMailResults,
            team: serializeTeam(refreshedTeamWithParticipantAccounts, {
              currentUserId: user?.id ?? null,
              currentUserEmail: normalizedUserEmail,
              canEditAllTeams: access.canEditAllTeams,
              canSeeOwnerClaimFields: access.isAdmin,
            }),
          });
        }

        return NextResponse.json({
          success: true,
          applied: updatedTeamPublication || directlyUpdatedTeamName || directlyAppliedParticipants > 0,
          message: [
            directUpdateMessageParts.join(', '),
            createdRequests > 0 ? `${createdRequests} Teilnehmer-Aenderungsanfrage(n) zur Genehmigung eingereicht` : '',
            updatedRequests > 0 ? `${updatedRequests} offene Teilnehmer-Anfrage(n) aktualisiert` : '',
            createdTeamNameRequest ? 'Mannschaftsname-Aenderung zur Genehmigung eingereicht' : '',
            updatedTeamNameRequest ? 'offene Mannschaftsname-Aenderung aktualisiert' : '',
            swapBundleMessage ? swapBundleMessage.replace(/^, /, '') : '',
          ].filter(Boolean).join(', '),
          classificationWarnings: requestedTeamState.classificationWarnings,
          pendingCount: createdRequests + updatedRequests + pendingTeamNameRequestCount,
          participantClaimMails: participantClaimMailResults,
          team: serializeTeam(refreshedTeamWithParticipantAccounts, {
            currentUserId: user?.id ?? null,
            currentUserEmail: normalizedUserEmail,
            canEditAllTeams: access.canEditAllTeams,
            canSeeOwnerClaimFields: access.isAdmin,
          }),
        });
      }

      const participantInviteCandidates = matchedParticipantsResult.matches
        .filter(({ submittedParticipant, existingParticipant }) =>
          submittedParticipant.replaceParticipant !== true &&
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

      const invalidShirtSizeEntries = matchedParticipantsResult.matches
        .map(({ submittedParticipant }) => {
          const rawShirtSize = submittedParticipant.shirtSize;
          if (typeof rawShirtSize !== "string") {
            return null;
          }

          const normalizedShirtSize = rawShirtSize.trim();
          if (!normalizedShirtSize) {
            return null;
          }

          const parsedShirtSize = parseShirtSize(rawShirtSize);
          if (parsedShirtSize !== null) {
            return null;
          }

          return {
            participantName: `${normalizeSubmittedText(submittedParticipant.firstName)} ${normalizeSubmittedText(submittedParticipant.lastName)}`.trim(),
            value: normalizedShirtSize,
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

      if (invalidShirtSizeEntries.length > 0) {
        const firstInvalid = invalidShirtSizeEntries[0];
        const allowedSizes = ["K116", "K128", "K140", "K152", "K164", "XS", "S", "M", "L", "XL", "XXL", "XXXL"];
        return NextResponse.json(
          {
            error: `Ungueltige T-Shirt-Groesse "${firstInvalid.value}"${firstInvalid.participantName ? ` bei ${firstInvalid.participantName}` : ""}. Erlaubt sind: ${allowedSizes.join(", ")}.`,
          },
          { status: 400 }
        );
      }

      const participantUpdates = matchedParticipantsResult.matches
        .map(({ submittedParticipant, existingParticipant }) => {
          const birthYear = extractBirthYearFromInput(submittedParticipant.birthDate);
          const birthDate = normalizeBirthDateForStorage(submittedParticipant.birthDate);
          if (birthYear === null || !submittedParticipant.id) return null;
          const beforeSnapshot = toParticipantSnapshot(existingParticipant);
          const afterSnapshot = toParticipantSnapshot({
            firstName: normalizeSubmittedText(submittedParticipant.firstName),
            lastName: normalizeSubmittedText(submittedParticipant.lastName),
            birthYear,
            birthDate,
            gender: mapGender(submittedParticipant.gender),
            disciplineCode: mapDiscipline(submittedParticipant.discipline),
            shirtSize: parseShirtSize(submittedParticipant.shirtSize),
            moderationNote: submittedParticipant.moderationNote?.trim() || null,
            email: normalizeSubmittedText(submittedParticipant.email) || null,
            participantPublicationPreference: submittedParticipant.participantPublicationPreference || "NAME_VERBERGEN",
          });
          const changedFields = diffParticipantSnapshots(beforeSnapshot, afterSnapshot);

          return {
            id: submittedParticipant.id,
            replaceParticipant: submittedParticipant.replaceParticipant === true,
            existingParticipant,
            currentDisciplineCode: existingParticipant.disciplineCode || "TBD",
            nextDisciplineCode: mapDiscipline(submittedParticipant.discipline),
            beforeSnapshot,
            afterSnapshot,
            changedFields,
            data: {
              firstName: normalizeSubmittedText(submittedParticipant.firstName),
              lastName: normalizeSubmittedText(submittedParticipant.lastName),
              birthYear,
              birthDate,
              gender: mapGender(submittedParticipant.gender),
              disciplineCode: mapDiscipline(submittedParticipant.discipline),
              shirtSize: parseShirtSize(submittedParticipant.shirtSize),
              moderationNote: submittedParticipant.moderationNote?.trim() || null,
              consentGiven: true,
              email: normalizeSubmittedText(submittedParticipant.email) || null,
              participantPublicationPreference: submittedParticipant.participantPublicationPreference || "NAME_VERBERGEN",
              deletedAt: null,
            },
          };
        })
        .filter((update): update is NonNullable<typeof update> => update !== null);

      await prisma.$transaction(async (tx) => {
        const now = new Date();
        const replacedUserIds = [
          ...new Set(
            participantUpdates
              .filter((update) => update.replaceParticipant && update.existingParticipant.userId)
              .map((update) => update.existingParticipant.userId as string),
          ),
        ];

        await tx.team.update({
          where: { id },
          data: {
            name: finalTeamName,
            teamPublicationLevel: requestedTeamPublicationLevel,
            contactName: body.contactName || existingTeam.contactName,
            contactEmail: body.contactEmail || existingTeam.contactEmail,
            classificationCode: autoCategory,
            totalAge: totalAge || null,
            ...(existingTeam.teamChiefId && replacedUserIds.includes(existingTeam.teamChiefId)
              ? { teamChiefId: null }
              : {}),
          },
        });

        if (teamNameChanged) {
          const beforeSnapshot = teamNameSnapshot(existingTeam.name);
          const requestedSnapshot = teamNameSnapshot(finalTeamName);
          const overriddenTeamNameRequests = await tx.changeRequest.findMany({
            where: {
              targetType: "TEAM",
              targetId: existingTeam.id,
              changeType: "UPDATE",
              status: "PENDING",
            },
            select: { id: true, requestedSnapshot: true },
          });

          await tx.changeRequest.updateMany({
            where: {
              targetType: "TEAM",
              targetId: existingTeam.id,
              changeType: "UPDATE",
              status: "PENDING",
            },
            data: {
              status: "REJECTED",
              reviewedAt: now,
              reviewedById: user?.id ?? null,
              reviewComment: directEditObsoleteReviewComment,
            },
          });

          for (const changeRequest of overriddenTeamNameRequests) {
            await tx.changeRequestAuditLog.create({
              data: {
                changeRequestId: changeRequest.id,
                actorId: user?.id ?? null,
                action: "REJECTED",
                beforeData: changeRequest.requestedSnapshot as Prisma.InputJsonValue,
                afterData: requestedSnapshot,
                message: directEditObsoleteReviewComment,
              },
            });
          }

          await tx.auditEvent.create({
            data: {
              action: "TEAM_NAME_CHANGED",
              scopeType: "TEAM",
              scopeId: existingTeam.id,
              entityType: "TEAM",
              entityId: existingTeam.id,
              reason: canDirectEdit ? "admin_rename" : "team_manager_pre_deadline_rename",
              beforeData: beforeSnapshot,
              afterData: requestedSnapshot,
              meta: {
                source: canDirectEdit ? "admin" : "team_manager_pre_deadline",
                previousTeamName: existingTeam.name,
                nextTeamName: finalTeamName,
                sessionEmail: normalizedUserEmail,
              },
              tenantId: existingTeam.competition.tenantId,
              competitionId: existingTeam.competitionId,
              actorId: user?.id ?? null,
            },
          });

          await recordAppliedChangeRequest(tx, {
            tenantId: existingTeam.competition.tenantId,
            competitionId: existingTeam.competitionId,
            targetType: "TEAM",
            targetId: existingTeam.id,
            changeType: "UPDATE",
            source: canDirectEdit ? "ADMIN" : "SELF_SERVICE",
            beforeSnapshot,
            requestedSnapshot,
            metadata: {
              field: "teamName",
              directReason: canDirectEdit ? "admin_direct_edit" : "before_registration_deadline",
            },
            actorId: user!.id,
            message: canDirectEdit
              ? "Mannschaftsname direkt durch Admin geaendert"
              : "Mannschaftsname vor Anmeldeschluss direkt durch Team Manager:in geaendert",
          });
        }

        const disciplineSwaps = participantUpdates.filter(
          (update) => !update.replaceParticipant && update.currentDisciplineCode !== update.nextDisciplineCode,
        );

        // Prevent transient discipline collisions during swaps by clearing changed slots first.
        for (const update of disciplineSwaps) {
          await tx.participant.update({
            where: { id: update.id },
            data: { disciplineCode: "TBD" },
          });
        }

        for (const update of participantUpdates) {
          if (update.replaceParticipant) {
            const createdParticipant = await tx.participant.create({
              data: {
                teamId: existingTeam.id,
                firstName: update.data.firstName,
                lastName: update.data.lastName,
                birthYear: update.data.birthYear,
                birthDate: update.data.birthDate,
                gender: update.data.gender,
                disciplineCode: update.data.disciplineCode,
                shirtSize: update.data.shirtSize,
                moderationNote: update.data.moderationNote,
                consentGiven: update.data.consentGiven,
                email: update.data.email,
                participantPublicationPreference: update.data.participantPublicationPreference,
              },
            });

            await tx.participant.update({
              where: { id: update.id },
              data: {
                deletedAt: now,
              },
            });

            await tx.participantClaimToken.updateMany({
              where: { participantId: update.id, revokedAt: null },
              data: { revokedAt: now },
            });

            if (update.existingParticipant.userId) {
              await tx.teamMemberRole.updateMany({
                where: {
                  teamId: existingTeam.id,
                  userId: update.existingParticipant.userId,
                  role: "TEAM_MANAGER",
                  revokedAt: null,
                },
                data: {
                  revokedAt: now,
                  revokedByUserId: user?.id ?? null,
                  reason: "participant_replaced",
                },
              });
            }

            await tx.pendingChange.updateMany({
              where: {
                participantId: update.id,
                status: "PENDING",
              },
              data: {
                status: "REJECTED",
                reviewedAt: now,
                reviewedById: user?.id ?? null,
                reviewComment: "Durch Teilnehmer-Ersetzung ueberholt",
              },
            });

            const overriddenChangeRequests = await tx.changeRequest.findMany({
              where: {
                targetType: "PARTICIPANT",
                targetId: update.id,
                changeType: "UPDATE",
                status: "PENDING",
              },
              select: { id: true, requestedSnapshot: true },
            });

            await tx.changeRequest.updateMany({
              where: {
                targetType: "PARTICIPANT",
                targetId: update.id,
                changeType: "UPDATE",
                status: "PENDING",
              },
              data: {
                status: "REJECTED",
                reviewedAt: now,
                reviewedById: user?.id ?? null,
                reviewComment: "Durch Teilnehmer-Ersetzung ueberholt",
              },
            });

            for (const changeRequest of overriddenChangeRequests) {
              await tx.changeRequestAuditLog.create({
                data: {
                  changeRequestId: changeRequest.id,
                  actorId: user?.id ?? null,
                  action: "REJECTED",
                  beforeData: changeRequest.requestedSnapshot as Prisma.InputJsonValue,
                  afterData: update.beforeSnapshot,
                  message: "Durch Teilnehmer-Ersetzung ueberholt",
                },
              });
            }

            await tx.participantAuditLog.create({
              data: {
                action: "DIRECT_CHANGE",
                participantId: update.id,
                actorId: user?.id ?? null,
                beforeData: serializeSnapshot(update.beforeSnapshot),
                afterData: serializeSnapshot(update.beforeSnapshot),
                message: `Teilnehmer durch neue Person ersetzt; neue Teilnehmer-ID ${createdParticipant.id}`,
              },
            });

            await tx.participantAuditLog.create({
              data: {
                action: "DIRECT_CHANGE",
                participantId: createdParticipant.id,
                actorId: user?.id ?? null,
                beforeData: null,
                afterData: serializeSnapshot(update.afterSnapshot),
                message: `Als Ersatz fuer Teilnehmer-ID ${update.id} angelegt`,
              },
            });

            continue;
          }

          await tx.participant.update({
            where: { id: update.id },
            data: update.data,
          });

          if (Object.keys(update.changedFields).length > 0) {
            await tx.pendingChange.updateMany({
              where: {
                participantId: update.id,
                status: "PENDING",
              },
              data: {
                status: "REJECTED",
                reviewedAt: new Date(),
                reviewedById: user?.id ?? null,
                reviewComment: directEditObsoleteReviewComment,
              },
            });

            const overriddenChangeRequests = await tx.changeRequest.findMany({
              where: {
                targetType: "PARTICIPANT",
                targetId: update.id,
                changeType: "UPDATE",
                status: "PENDING",
              },
              select: { id: true, requestedSnapshot: true },
            });

            await tx.changeRequest.updateMany({
              where: {
                targetType: "PARTICIPANT",
                targetId: update.id,
                changeType: "UPDATE",
                status: "PENDING",
              },
              data: {
                status: "REJECTED",
                reviewedAt: new Date(),
                reviewedById: user?.id ?? null,
                reviewComment: directEditObsoleteReviewComment,
              },
            });

            for (const changeRequest of overriddenChangeRequests) {
              await tx.changeRequestAuditLog.create({
                data: {
                  changeRequestId: changeRequest.id,
                  actorId: user?.id ?? null,
                  action: "REJECTED",
                  beforeData: changeRequest.requestedSnapshot as Prisma.InputJsonValue,
                  afterData: update.afterSnapshot,
                  message: directEditObsoleteReviewComment,
                },
              });
            }

            await tx.participantAuditLog.create({
              data: {
                action: "DIRECT_CHANGE",
                participantId: update.id,
                actorId: user?.id ?? null,
                beforeData: serializeSnapshot(update.beforeSnapshot),
                afterData: serializeSnapshot(update.afterSnapshot),
                message: summarizeParticipantChanges(update.beforeSnapshot, update.afterSnapshot)
                  .map((change) => change.label)
                  .join(", ") + ` direkt durch ${directEditActorLabel} aktualisiert`,
              },
            });
          }
        }

        await Promise.all(
          replacedUserIds.map((replacedUserId) =>
            syncDerivedTeamchefRole(tx, {
              userId: replacedUserId,
              tenantId: existingTeam.competition.tenantId,
            }),
          ),
        );
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
          participants: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' }, include: teamParticipantInclude },
          owner: { select: { email: true, name: true, authentikSub: true } },
          registrationClaimTokens: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              suggestedEmail: true,
              suggestedName: true,
              createdAt: true,
              expiresAt: true,
              claimedAt: true,
              revokedAt: true,
            },
          },
          memberRoles: {
            where: { role: "TEAM_MANAGER", revokedAt: null },
            select: { userId: true, revokedAt: true },
          },
        }
      });

      if (!updatedTeam) {
        return NextResponse.json({ error: 'Team not found' }, { status: 404 });
      }
      const updatedTeamWithParticipantAccounts = await attachParticipantPortalAccounts(updatedTeam);

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
        team: serializeTeam(updatedTeamWithParticipantAccounts, {
          currentUserId: user?.id ?? null,
          currentUserEmail: normalizedUserEmail,
          canEditAllTeams: access.canEditAllTeams,
          canSeeOwnerClaimFields: access.isAdmin,
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
          owner: { select: { id: true, email: true, name: true } },
          participants: {
            where: { deletedAt: null },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              birthYear: true,
              birthDate: true,
              disciplineCode: true,
              email: true,
              moderationNote: true,
              userId: true,
              marketplaceReturnTeamId: true,
              marketplaceReturnDisciplineCode: true,
            },
          },
          memberRoles: {
            where: { role: "TEAM_MANAGER", revokedAt: null },
            select: { userId: true, revokedAt: true },
          },
          competition: {
            select: {
              id: true,
              name: true,
              year: true,
              tenantId: true,
              registrationNotificationEmail: true,
              tenant: { select: { name: true, contactEmail: true } },
            },
          },
        },
      });

      if (!existingTeam) {
        return NextResponse.json({ error: 'Team not found' }, { status: 404 });
      }

      const { user } = await resolveCurrentUser(session, { createIfMissing: true });
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

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

      const now = new Date();
      const isMtcMarketplaceDraft =
        existingTeam.registrationMode === "MARKETPLACE" &&
        existingTeam.marketplaceStatus === "MATCHING";
      const returnableMarketplaceParticipants = isMtcMarketplaceDraft
        ? existingTeam.participants.filter((participant) => participant.marketplaceReturnTeamId)
        : [];
      const nativeParticipantIds = isMtcMarketplaceDraft
        ? existingTeam.participants
            .filter((participant) => !participant.marketplaceReturnTeamId)
            .map((participant) => participant.id)
        : existingTeam.participants.map((participant) => participant.id);
      const linkedParticipantCount = existingTeam.participants.filter((participant) => participant.userId).length;
      const beforeSnapshot = {
        teamName: existingTeam.name,
        deletedAt: null,
        participantIds: existingTeam.participants.map((participant) => participant.id),
        participantCount: existingTeam.participants.length,
      };
      const requestedSnapshot = {
        deletedAt: now.toISOString(),
        deletedParticipants: nativeParticipantIds.length,
        returnedMarketplaceParticipants: returnableMarketplaceParticipants.length,
      };
      const affectedUserIds = Array.from(
        new Set(
          [
            existingTeam.ownerId,
            existingTeam.teamChiefId,
            ...existingTeam.memberRoles.map((memberRole) => memberRole.userId),
          ].filter((value): value is string => Boolean(value)),
        ),
      );

      if (isMtcMarketplaceDraft) {
        for (const participant of returnableMarketplaceParticipants) {
          const restoredContactEmail = normalizeEmail(participant.email ?? existingTeam.contactEmail);
          const restoreCollision = await prisma.team.findFirst({
            where: {
              id: {
                notIn: [id, participant.marketplaceReturnTeamId].filter((value): value is string => Boolean(value)),
              },
              competitionId: existingTeam.competition.id,
              deletedAt: null,
              registrationMode: "MARKETPLACE",
              name: {
                equals: marketplaceTeamNameForParticipant(participant),
                mode: "insensitive",
              },
              ...(restoredContactEmail
                ? {
                    contactEmail: {
                      equals: restoredContactEmail,
                      mode: "insensitive",
                    },
                  }
                : { contactEmail: null }),
            },
            select: { id: true },
          });

          if (restoreCollision) {
            return NextResponse.json(
              {
                error: `Für ${participantDisplayName(participant)} existiert bereits eine freie Sportlerbörsen-Meldung. Bitte zuerst die Dublette bereinigen.`,
                existingTeamId: restoreCollision.id,
              },
              { status: 409 }
            );
          }
        }
      }

      await prisma.$transaction(async (tx) => {
        await tx.team.update({
          where: { id: id },
          data: {
            deletedAt: now,
          },
        });

        if (isMtcMarketplaceDraft) {
          for (const participant of returnableMarketplaceParticipants) {
            const returnTeam = participant.marketplaceReturnTeamId
              ? await tx.team.findFirst({
                  where: {
                    id: participant.marketplaceReturnTeamId,
                    competitionId: existingTeam.competition.id,
                    registrationMode: "MARKETPLACE",
                  },
                  select: { id: true },
                })
              : null;

            const restoredTeam = returnTeam
              ? await tx.team.update({
                  where: { id: returnTeam.id },
                  data: {
                    deletedAt: null,
                    contactName: `${participant.firstName} ${participant.lastName}`.trim(),
                    contactEmail: participant.email ?? existingTeam.contactEmail,
                    totalAge: participant.birthYear ? existingTeam.competition.year - participant.birthYear : null,
                    teamChiefId: participant.userId ?? existingTeam.teamChiefId,
                    marketplaceStatus: "REVIEWED",
                    marketplaceMessage: participant.moderationNote ?? null,
                  },
                  select: { id: true },
                })
              : await tx.team.create({
                  data: {
                    name: marketplaceTeamNameForParticipant(participant),
                    contactName: participantDisplayName(participant),
                    contactEmail: participant.email ?? existingTeam.contactEmail,
                    teamPublicationLevel: existingTeam.teamPublicationLevel,
                    registrationMode: "MARKETPLACE",
                    marketplaceVisibility: existingTeam.marketplaceVisibility,
                    marketplaceStatus: "REVIEWED",
                    marketplaceMessage: participant.moderationNote ?? null,
                    classificationCode: "sportlerboerse",
                    totalAge: participant.birthYear ? existingTeam.competition.year - participant.birthYear : null,
                    competitionId: existingTeam.competition.id,
                    ownerId: existingTeam.ownerId,
                    teamChiefId: participant.userId ?? existingTeam.teamChiefId,
                  },
                  select: { id: true },
                });

            await tx.participant.update({
              where: { id: participant.id },
              data: {
                teamId: restoredTeam.id,
                disciplineCode: participant.marketplaceReturnDisciplineCode ?? participant.disciplineCode,
                marketplaceReturnTeamId: null,
                marketplaceReturnDisciplineCode: null,
                deletedAt: null,
              },
            });
          }

          await tx.registrationClaimToken.updateMany({
            where: { teamId: id, revokedAt: null },
            data: { revokedAt: now },
          });
        }

        if (nativeParticipantIds.length > 0) {
          await tx.participant.updateMany({
            where: { id: { in: nativeParticipantIds }, deletedAt: null },
            data: { deletedAt: now },
          });
        }
        await Promise.all(
          affectedUserIds.map((affectedUserId) =>
            syncDerivedTeamchefRole(tx, {
              userId: affectedUserId,
              tenantId: existingTeam.competition.tenantId,
            }),
          ),
        );
        await tx.auditEvent.create({
          data: {
            action: "TEAM_SOFT_DELETED",
            scopeType: "TEAM",
            scopeId: existingTeam.id,
            entityType: "TEAM",
            entityId: existingTeam.id,
            reason: "team_delete",
            beforeData: beforeSnapshot,
            afterData: requestedSnapshot,
            meta: {
              ownerEmail: existingTeam.owner.email,
              sessionEmail: normalizeEmail(userEmail),
              linkedParticipants: linkedParticipantCount,
              returnedMarketplaceParticipants: returnableMarketplaceParticipants.length,
              nativeDeletedParticipants: nativeParticipantIds.length,
            },
            tenantId: existingTeam.competition.tenantId,
            competitionId: existingTeam.competition.id,
            actorId: user.id,
          },
        });
        await recordAppliedChangeRequest(tx, {
          tenantId: existingTeam.competition.tenantId,
          competitionId: existingTeam.competition.id,
          targetType: "TEAM",
          targetId: existingTeam.id,
          changeType: "DELETE",
          source: access.canEditAllTeams ? "ADMIN" : "SELF_SERVICE",
          beforeSnapshot,
          requestedSnapshot,
          metadata: {
            reason: "team_delete",
            teamName: existingTeam.name,
            ownerEmail: existingTeam.owner.email,
            sessionEmail: normalizeEmail(userEmail),
            linkedParticipants: linkedParticipantCount,
            returnedMarketplaceParticipants: returnableMarketplaceParticipants.length,
            nativeDeletedParticipants: nativeParticipantIds.length,
          },
          actorId: user.id,
          message: "Mannschaft geloescht",
        });
      });

      try {
        const mailResult = await sendTeamLifecycleOrgEmail({
          action: "deleted",
          competition: existingTeam.competition,
          team: {
            name: existingTeam.name,
            ownerEmail: existingTeam.owner.email,
            contactEmail: existingTeam.contactEmail,
            participantCount: existingTeam.participants.length,
            linkedParticipantCount,
          },
          actor: {
            name: user?.name || session.user?.name || null,
            email: userEmail,
          },
        });
        await prisma.auditEvent.create({
          data: {
            action: "TEAM_LIFECYCLE_MAIL",
            scopeType: "TEAM",
            scopeId: existingTeam.id,
            entityType: "TEAM",
            entityId: existingTeam.id,
            reason: "team_deleted_org_mail",
            afterData: {
              mailStatus: mailResult.status,
              recipients: mailResult.recipients,
              subject: mailResult.subject ?? null,
              reason: mailResult.status === "skipped" ? mailResult.reason : null,
              missing: mailResult.status === "skipped" ? mailResult.missing ?? [] : [],
            },
            meta: {
              lifecycleAction: "deleted",
              teamName: existingTeam.name,
              ownerEmail: existingTeam.owner.email,
              sessionEmail: normalizeEmail(userEmail),
            },
            tenantId: existingTeam.competition.tenantId,
            competitionId: existingTeam.competition.id,
            actorId: user.id,
          },
        }).catch((auditError) => console.error("Team delete mail audit failed", auditError));
      } catch (mailError) {
        console.error("Team delete org mail failed", mailError);
        await prisma.auditEvent.create({
          data: {
            action: "TEAM_LIFECYCLE_MAIL",
            scopeType: "TEAM",
            scopeId: existingTeam.id,
            entityType: "TEAM",
            entityId: existingTeam.id,
            reason: "team_deleted_org_mail_failed",
            afterData: {
              mailStatus: "failed",
              recipients: [],
              error: mailError instanceof Error ? mailError.message : String(mailError),
            },
            meta: {
              lifecycleAction: "deleted",
              teamName: existingTeam.name,
              ownerEmail: existingTeam.owner.email,
              sessionEmail: normalizeEmail(userEmail),
            },
            tenantId: existingTeam.competition.tenantId,
            competitionId: existingTeam.competition.id,
            actorId: user.id,
          },
        }).catch((auditError) => console.error("Team delete mail audit failed", auditError));
      }

      return NextResponse.json({
        success: true,
        message: `Team "${existingTeam.name}" wurde archiviert.`
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
