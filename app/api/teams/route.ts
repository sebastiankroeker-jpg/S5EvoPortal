import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import {
  MarketplaceRegistrationSchema,
  MtcDraftRegistrationSchema,
  TeamRegistrationSchema,
  extractBirthYearFromInput,
  formatTeamRegistrationValidationIssues,
  normalizeBirthDateForStorage,
  storedBirthDateToInput,
} from '@/lib/domain/team';
import { evaluateTeamDraft } from '@/lib/domain/classification';
import { isShirtOrderClosed } from '@/lib/domain/shirts';
import { recordTeamRegistrationMailAuditEvents, resolveRegistrationNotificationEmail, sendTeamRegistrationEmails } from '@/lib/mail/team-registration';
import { sendParticipantClaimEmail } from '@/lib/mail/participant-claim';
import { recordParticipantClaimAuditEvent } from '@/lib/participant-claim-audit';
import { prisma } from '@/lib/prisma';
import { buildMtcAnonymousUrl, buildParticipantClaimUrl, buildPortalHomeUrl, buildRegistrationClaimUrl, createRegistrationClaimToken } from '@/lib/registration-claim';
import { normalizeEmail, resolveCurrentUser } from '@/lib/current-user';
import { getParticipantEmailInvitationStatus, getParticipantClaimTokenStatus } from '@/lib/participant-claim-invitation';
import {
  canViewerSeeFullPublication,
  resolveVisibleParticipantName,
  resolveVisibleTeamName,
  splitDisplayName,
} from '@/lib/publication-visibility';
import { canViewerSeeMarketplaceTeam } from '@/lib/marketplace-visibility';
import { getScopedRoleFlags } from '@/lib/server-permissions';
import {
  canRoleViewAllTeams,
  canRoleViewLiveStartlists,
  canRoleViewLiveTeams,
  normalizeCompetitionTeamAccessConfig,
  resolveEffectiveTeamScopeRole,
} from '@/lib/team-access-config';
import { resolveTeamAccess } from '@/lib/team-manager-access';
import { syncDerivedTeamchefRole } from '@/lib/teamchef-role';
import type { Prisma } from '@prisma/client';

// Map frontend gender ("M"/"W") to Prisma enum
function mapGender(g: string): "MALE" | "FEMALE" {
  return g === "W" ? "FEMALE" : "MALE";
}

// Map frontend discipline to Prisma DisciplineAssignment enum
function mapDiscipline(d: string): "RUN" | "BENCH" | "STOCK" | "ROAD" | "MTB" | "TBD" {
  const valid = ["RUN", "BENCH", "STOCK", "ROAD", "MTB", "TBD"] as const;
  return valid.includes(d as (typeof valid)[number]) ? (d as (typeof valid)[number]) : "TBD";
}

function isRegistrationDeadlineReached(deadline?: Date | null): boolean {
  if (!deadline) return false;
  return new Date(deadline) < new Date();
}

type MarketplaceDuplicateClient = Pick<Prisma.TransactionClient, "team" | "$executeRaw">;

function marketplaceDuplicateKey(input: {
  competitionId: string;
  teamName: string;
  contactEmail: string;
}) {
  return [
    input.competitionId,
    input.teamName.trim().toLowerCase(),
    normalizeEmail(input.contactEmail),
  ].join(":");
}

async function lockMarketplaceDuplicateCheck(
  db: MarketplaceDuplicateClient,
  input: {
    competitionId: string;
    teamName: string;
    contactEmail: string;
  },
) {
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${marketplaceDuplicateKey(input)}))`;
}

async function findActiveMarketplaceDuplicateTeam(db: Pick<MarketplaceDuplicateClient, "team">, input: {
  competitionId: string;
  teamName: string;
  contactEmail: string;
}) {
  return db.team.findFirst({
    where: {
      competitionId: input.competitionId,
      deletedAt: null,
      registrationMode: "MARKETPLACE",
      name: {
        equals: input.teamName.trim(),
        mode: "insensitive",
      },
      contactEmail: {
        equals: normalizeEmail(input.contactEmail),
        mode: "insensitive",
      },
    },
    select: { id: true, name: true },
  });
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
  startNumber?: string | null;
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

function serializeParticipant(
  participant: SerializableParticipant | null | undefined,
  options?: {
    currentUserId?: string | null;
    currentUserEmail?: string | null;
    canSeeFullPublication?: boolean;
    canSeeLiveNames?: boolean;
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
    canSeeFullPublication: options?.canSeeLiveNames === true || canSeeFullPublication || isCurrentUserParticipant,
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
    canSeeLiveNames?: boolean;
    canSeeSensitiveParticipantFields?: boolean;
    canSeeOwnerClaimFields?: boolean;
    canEditAllTeams?: boolean;
    canSeeStartNumber?: boolean;
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
  const canSeeSensitiveParticipantFields = options?.canSeeSensitiveParticipantFields === true || canCurrentUserEdit;
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
  const canSeeFullTeamPublication = canSeeFullPublication || isCurrentUserTeam;
  const visibleTeamName = resolveVisibleTeamName({
    actualTeamName: team.name,
    teamPublicationLevel: team.teamPublicationLevel,
    canSeeFullPublication: options?.canSeeLiveNames === true || canSeeFullTeamPublication,
  });
  const latestRegistrationClaimToken = Array.isArray(team.registrationClaimTokens)
    ? team.registrationClaimTokens[0]
    : null;
  const canSeeOwnerClaimFields = options?.canSeeOwnerClaimFields === true;
  return {
    id: team.id,
    name: visibleTeamName,
    startNumber: options?.canSeeStartNumber === true ? team.startNumber ?? "" : "",
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
    ownerHasPortalAccount: canSeeSensitiveParticipantFields ? Boolean(team.owner?.authentikSub) : false,
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
              canSeeLiveNames: options?.canSeeLiveNames,
              canSeeSensitiveParticipantFields,
              activeTeamManagerUserIds,
            }),
          )
          .filter(Boolean)
      : [],
  };
}

async function ensureDefaultCompetition(): Promise<string> {
  const currentCompetition = await prisma.competition.findFirst({
    where: { status: "OPEN" },
    orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
  });

  if (currentCompetition) {
    return currentCompetition.id;
  }

  let tenant = await prisma.tenant.findFirst({
    orderBy: { createdAt: 'desc' },
  });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: "ESV Rosenheim",
        slug: "esv-rosenheim",
        primaryColor: "#dc2626",
      }
    });
  }

  let competition = await prisma.competition.findFirst({
    where: { tenantId: tenant.id },
    orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
  });
  if (!competition) {
    competition = await prisma.competition.create({
      data: {
        name: "Mannschafts-5-Kampf 2026",
        year: 2026,
        date: new Date("2026-07-24T00:00:00.000Z"),
        dateEnd: new Date("2026-07-25T00:00:00.000Z"),
        registrationDeadline: new Date("2026-07-22T23:59:59.999Z"),
        status: "OPEN",
        location: "Bad Bayersoien",
        tenantId: tenant.id,
      }
    });
  }

  return competition.id;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;

    try {
      const url = new URL(request.url);
      const query = url.searchParams.get("q")?.trim() ?? "";
      const scope = url.searchParams.get('scope');
      const roleContext = url.searchParams.get('roleContext');
      const liveSurface = url.searchParams.get('liveSurface');
      const competitionId = url.searchParams.get('competitionId');
      const wantsAllTeams = scope === 'all';
      const isLiveTeamListRequest = liveSurface === "teams" || liveSurface === "startlists" || liveSurface === "teamLists";
      const competition = competitionId
        ? await prisma.competition.findUnique({
            where: { id: competitionId },
            select: {
              tenantId: true,
              teamOwnerFilterVisibleForTeamchef: true,
              participantsCanViewAllTeams: true,
              spectatorsCanViewAllTeams: true,
              hideForeignTeams: true,
              liveTeamsVisibility: true,
              liveStartlistsVisibility: true,
              marketplaceGlobalVisibility: true,
            },
          })
        : null;
      const competitionTeamAccess = normalizeCompetitionTeamAccessConfig(competition);
      const canSpectatorViewRequestedLiveSurface =
        liveSurface === "teams"
          ? canRoleViewLiveTeams("ZUSCHAUER", competitionTeamAccess)
          : liveSurface === "startlists"
            ? canRoleViewLiveStartlists("ZUSCHAUER", competitionTeamAccess)
            : isLiveTeamListRequest
              ? canRoleViewLiveTeams("ZUSCHAUER", competitionTeamAccess) || canRoleViewLiveStartlists("ZUSCHAUER", competitionTeamAccess)
              : false;
      const publicSpectatorAllTeams =
        !userEmail &&
        wantsAllTeams &&
        canSpectatorViewRequestedLiveSurface;

      if (!userEmail && !publicSpectatorAllTeams) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const { user } = userEmail
        ? await resolveCurrentUser(session, { createIfMissing: true })
        : { user: null };
      const normalizedUserEmail = normalizeEmail(userEmail);
      const access = userEmail
        ? await getScopedRoleFlags(userEmail, competition?.tenantId, session)
        : {
            user: null,
            roles: [],
            isAdmin: false,
            isModerator: false,
            isTimekeeper: false,
            canViewAllTeams: false,
            canEditAllTeams: false,
          };
      const requestedLivePortalRole =
        isLiveTeamListRequest &&
        userEmail &&
        (roleContext === "TEAMCHEF" || roleContext === "TEILNEHMER" || roleContext === "ZEITNAHME")
          ? roleContext
          : null;
      const effectiveScopeRole = requestedLivePortalRole ?? resolveEffectiveTeamScopeRole(roleContext, access.roles);
      const canViewRequestedScope = roleContext
        ? isLiveTeamListRequest
          ? (
              liveSurface === "teams"
                ? canRoleViewLiveTeams(effectiveScopeRole, competitionTeamAccess)
                : liveSurface === "startlists"
                  ? canRoleViewLiveStartlists(effectiveScopeRole, competitionTeamAccess)
                  : canRoleViewLiveTeams(effectiveScopeRole, competitionTeamAccess) || canRoleViewLiveStartlists(effectiveScopeRole, competitionTeamAccess)
            )
          : canRoleViewAllTeams(effectiveScopeRole, competitionTeamAccess)
        : access.canViewAllTeams || canRoleViewAllTeams(effectiveScopeRole, competitionTeamAccess);
      if (wantsAllTeams && !canViewRequestedScope) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const isPrivilegedMarketplaceViewer =
        effectiveScopeRole === "ADMIN" || effectiveScopeRole === "MODERATOR" || access.canEditAllTeams;
      const viewerHasMarketplaceRegistration =
        !userEmail
          ? false
          : isPrivilegedMarketplaceViewer
          ? true
          : await prisma.team.count({
              where: {
                ...(competitionId ? { competitionId } : {}),
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

      const accessFilter = wantsAllTeams
        ? {}
        : {
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
                    participants: {
                      some: {
                        email: {
                          equals: normalizedUserEmail,
                          mode: 'insensitive' as const,
                        },
                        deletedAt: null,
                      },
                    },
                  }]
                : []),
              ...(user
                ? [{
                    memberRoles: {
                      some: {
                        userId: user.id,
                        role: "TEAM_MANAGER" as const,
                        revokedAt: null,
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
          };
      const queryFilter = query
        ? {
            OR: [
              {
                name: {
                  contains: query,
                  mode: "insensitive" as const,
                },
              },
              {
                contactName: {
                  contains: query,
                  mode: "insensitive" as const,
                },
              },
              {
                participants: {
                  some: {
                    deletedAt: null,
                    OR: [
                      {
                        firstName: {
                          contains: query,
                          mode: "insensitive" as const,
                        },
                      },
                      {
                        lastName: {
                          contains: query,
                          mode: "insensitive" as const,
                        },
                      },
                      {
                        email: {
                          contains: query,
                          mode: "insensitive" as const,
                        },
                      },
                    ],
                  },
                },
              },
            ],
          }
        : {};

      const teams = await prisma.team.findMany({
        where: {
          AND: [
            accessFilter,
            queryFilter,
            ...(competitionId ? [{ competitionId }] : []),
            { deletedAt: null },
          ],
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
              },
              claimTokens: {
                orderBy: { createdAt: 'desc' },
                take: 1,
                select: { id: true, createdAt: true, expiresAt: true, claimedAt: true, revokedAt: true }
              }
            }
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
            select: { marketplaceGlobalVisibility: true, hideForeignTeams: true },
          },
        }
      });
      const participantEmails = Array.from(
        new Set(
          teams
            .flatMap((team) => team.participants ?? [])
            .map((participant) => normalizeEmail(participant.email))
            .filter((email): email is string => Boolean(email)),
        ),
      );
      const portalAccountsByEmail = new Map(
        (
          participantEmails.length > 0
            ? await prisma.user.findMany({
                where: {
                  deletedAt: null,
                  email: { in: participantEmails, mode: "insensitive" },
                },
                select: { id: true, email: true, name: true, authentikSub: true },
              })
            : []
        ).map((user) => [normalizeEmail(user.email), user]),
      );

      return NextResponse.json({
        teams: teams.flatMap((team) => {
          const teamAccess = resolveTeamAccess({
            team,
            user,
            userEmail,
            canEditAllTeams: access.canEditAllTeams,
          });
          const ownsMarketplaceTeam = teamAccess.canEditTeam || Boolean(user?.id && team.ownerId === user.id);
          if (
            team.registrationMode === "MARKETPLACE" &&
            !canViewerSeeMarketplaceTeam({
              globalVisibility: team.competition?.marketplaceGlobalVisibility ?? competition?.marketplaceGlobalVisibility,
              teamVisibility: team.marketplaceVisibility,
              isPrivilegedViewer: isPrivilegedMarketplaceViewer,
              ownsMarketplaceTeam,
              hasMarketplaceRegistration: viewerHasMarketplaceRegistration,
              isAuthenticated: Boolean(userEmail),
            })
          ) {
            return [];
          }
          const canSeeFullPublication =
            !wantsAllTeams ||
            canViewerSeeFullPublication({
              isPrivilegedViewer: effectiveScopeRole === "ADMIN" || effectiveScopeRole === "MODERATOR",
              ownsTeam: teamAccess.canEditTeam,
            });
          const canSeeLiveNames = isLiveTeamListRequest && wantsAllTeams && canViewRequestedScope;

          const teamWithParticipantAccounts = {
            ...team,
            participants: team.participants.map((participant) => ({
              ...participant,
              portalAccount: portalAccountsByEmail.get(normalizeEmail(participant.email)) ?? null,
            })),
          };

          return [serializeTeam(teamWithParticipantAccounts, {
            currentUserId: user?.id ?? null,
            currentUserEmail: normalizedUserEmail,
            canSeeFullPublication,
            canSeeLiveNames,
            canEditAllTeams: access.canEditAllTeams,
            canSeeStartNumber: access.isAdmin || (wantsAllTeams && canViewRequestedScope),
            currentUserHasPortalAccount: Boolean(user?.authentikSub),
            canSeeSensitiveParticipantFields: access.canEditAllTeams,
            canSeeOwnerClaimFields: effectiveScopeRole === "ADMIN" && access.isAdmin,
          })];
        }),
      });
    } catch (dbError) {
      console.error('Database error on GET:', dbError);
      return NextResponse.json({ teams: [], message: 'Database temporarily unavailable' });
    }
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'API temporarily unavailable' }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const sessionUserEmail = session?.user?.email;
    const sessionUserName = session?.user?.name;
    const sessionUserImage = session?.user?.image;
    const sessionAuthentikSub =
      typeof (session?.user as { id?: unknown } | undefined)?.id === 'string'
        ? ((session?.user as { id?: string }).id ?? null)
        : null;

    const body = await request.json();

    if (body?.registrationMode === "MARKETPLACE" && body?.marketplaceDraftType === "MTC") {
      const validation = MtcDraftRegistrationSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          { error: formatTeamRegistrationValidationIssues(validation.error.issues), details: validation.error.issues },
          { status: 400 }
        );
      }

      const draftData = validation.data;
      const userEmail = normalizeEmail(sessionUserEmail || draftData.contactEmail.trim());
      const contactPhone = draftData.contactPhone.trim();
      const userName =
        sessionUserName ||
        draftData.contactName?.trim() ||
        [draftData.contactFirstName, draftData.contactLastName].filter(Boolean).join(" ").trim();
      const userImage = sessionUserImage;

      if (!userEmail || !userName || !contactPhone) {
        return NextResponse.json({ error: 'Kontaktname, Kontakt-E-Mail und Telefonnummer sind erforderlich.' }, { status: 400 });
      }

      try {
        const competitionId = await ensureDefaultCompetition();
        const competition = await prisma.competition.findUnique({
          where: { id: competitionId },
          select: {
            tenantId: true,
            name: true,
            year: true,
            date: true,
            dateEnd: true,
            status: true,
            registrationDeadline: true,
            claimTokenExpiryMode: true,
            claimTokenTtlDays: true,
            registrationNotificationEmail: true,
            tenant: {
              select: {
                name: true,
                contactEmail: true,
              },
            },
          },
        });

        if (!competition) {
          return NextResponse.json({ error: 'Kein aktiver Wettkampf gefunden.' }, { status: 503 });
        }

        const registrationStatusAllowsSubmissions =
          competition.status === "DRAFT" || competition.status === "OPEN";

        if (!registrationStatusAllowsSubmissions) {
          return NextResponse.json(
            { error: 'Die Anmeldung ist für diesen Wettkampf aktuell geschlossen.' },
            { status: 409 }
          );
        }

        if (isRegistrationDeadlineReached(competition.registrationDeadline)) {
          return NextResponse.json(
            { error: 'Der Anmeldeschluss für diesen Wettkampf ist bereits erreicht.' },
            { status: 409 }
          );
        }

        const resolved = await resolveCurrentUser(session, { createIfMissing: !!sessionUserEmail });
        let user = resolved.user;
        if (!user) {
          user = await prisma.user.findFirst({
            where: {
              deletedAt: null,
              email: {
                equals: userEmail,
                mode: 'insensitive',
              },
            },
            orderBy: { createdAt: 'asc' },
          });
        }
        if (!user) {
          user = await prisma.user.create({
            data: {
              email: userEmail,
              name: userName || null,
              image: userImage || null,
              authentikSub: sessionAuthentikSub,
            }
          });
        }

        const completeParticipants = draftData.participants
          .map((participant) => ({
            participant,
            firstName: participant.firstName?.trim() || "",
            lastName: participant.lastName?.trim() || "",
            birthYear: extractBirthYearFromInput(participant.birthDate || ""),
            birthDate: normalizeBirthDateForStorage(participant.birthDate || ""),
          }))
          .filter(({ firstName, lastName, birthYear }) => firstName.length >= 2 && lastName.length >= 2 && birthYear !== null);
        const totalAge = completeParticipants.reduce((sum, entry) => sum + (2026 - (entry.birthYear as number)), 0);
        const finalTeamName = draftData.teamName.trim();
        const marketplaceMessage = [
          "MTC-Entwurf aus unvollständiger Mannschaftsanmeldung",
          draftData.marketplaceMessage?.trim(),
        ].filter(Boolean).join("\n\n");
        const claimToken = createRegistrationClaimToken({
          mode: competition.claimTokenExpiryMode || "COMPETITION_END",
          ttlDays: competition.claimTokenTtlDays || null,
          registrationDeadline: competition.registrationDeadline || null,
          competitionEnd: competition.dateEnd || competition.date || null,
          maxExpiresAt: null,
        });

        const mtcCreateResult = await prisma.$transaction(async (tx) => {
          const duplicateInput = { competitionId, teamName: finalTeamName, contactEmail: userEmail };
          await lockMarketplaceDuplicateCheck(tx, duplicateInput);
          const duplicateTeam = await findActiveMarketplaceDuplicateTeam(tx, duplicateInput);
          if (duplicateTeam) return { duplicateTeam, team: null };

          const team = await tx.team.create({
            data: {
              name: finalTeamName,
              contactName: userName || "",
              contactEmail: userEmail,
              contactPhone,
              notes: marketplaceMessage || null,
              teamPublicationLevel: draftData.teamPublicationLevel,
              registrationMode: "MARKETPLACE",
              marketplaceVisibility: draftData.marketplaceVisibility,
              marketplaceStatus: "MATCHING",
              marketplaceMessage: marketplaceMessage || null,
              classificationCode: "sportlerboerse",
              totalAge: totalAge || null,
              competitionId,
              ownerId: user.id,
              teamChiefId: null,
              participants: {
                create: completeParticipants.map(({ participant, firstName, lastName, birthYear, birthDate }) => ({
                  firstName,
                  lastName,
                  birthYear: birthYear as number,
                  birthDate,
                  gender: mapGender(participant.gender),
                  disciplineCode: mapDiscipline(participant.discipline),
                  shirtSize: participant.shirtSize || null,
                  moderationNote: participant.moderationNote?.trim() || null,
                  consentGiven: true,
                  email: participant.email || null,
                  participantPublicationPreference: participant.participantPublicationPreference || "NAME_VERBERGEN",
                })),
              },
            },
            include: {
              participants: true,
              owner: { select: { email: true, name: true } }
            },
          });

          await tx.registrationClaimToken.create({
            data: {
              teamId: team.id,
              tokenHash: claimToken.tokenHash,
              suggestedEmail: userEmail,
              suggestedName: userName || null,
              expiresAt: claimToken.expiresAt,
            },
          });

          return { duplicateTeam: null, team };
        });

        if (mtcCreateResult.duplicateTeam) {
          return NextResponse.json(
            {
              error: `Für "${finalTeamName}" existiert bereits eine Sportlerbörsen-Meldung mit diesem Kontakt.`,
              existingTeamId: mtcCreateResult.duplicateTeam.id,
            },
            { status: 409 }
          );
        }

        const team = mtcCreateResult.team;
        if (!team) {
          return NextResponse.json({ error: 'MTC-Entwurf konnte nicht gespeichert werden.' }, { status: 500 });
        }

        const mtcAnonymousUrl = buildMtcAnonymousUrl(claimToken.rawToken);
        const portalUrl = buildPortalHomeUrl();
        const mailSummary = await sendTeamRegistrationEmails({
          competition,
          team: {
            name: finalTeamName,
            registrationMode: "MARKETPLACE",
            marketplaceVisibility: draftData.marketplaceVisibility,
            marketplaceStatus: "MATCHING",
            marketplaceMessage,
            classificationCode: "sportlerboerse",
            contactName: userName || "",
            contactEmail: userEmail,
            claimUrl: mtcAnonymousUrl,
            portalUrl,
            alreadyLinked: false,
            participants: team.participants.map((participant) => ({
              firstName: participant.firstName,
              lastName: participant.lastName,
              birthYear: participant.birthYear,
              gender: participant.gender,
              disciplineCode: participant.disciplineCode,
              shirtSize: participant.shirtSize,
            })),
          },
        });
        await recordTeamRegistrationMailAuditEvents(prisma, {
          tenantId: competition.tenantId,
          competitionId,
          teamId: team.id,
          teamName: finalTeamName,
          registrationMode: "MARKETPLACE",
          actorId: user.id,
          reason: "mtc_draft_created",
          mailSummary,
        }).catch((auditError) => console.error("MTC draft mail audit failed", auditError));

        if (!mailSummary.ok) {
          console.warn("MTC draft mail delivery incomplete", {
            teamId: team.id,
            competitionId,
            attempts: mailSummary.attempts,
          });
        }

        return NextResponse.json({
          success: true,
          message: `MTC-Entwurf "${finalTeamName}" wurde gespeichert.`,
          mail: mailSummary,
          mtcAnonymousUrl,
          savedParticipantCount: team.participants.length,
          openSlotCount: Math.max(0, 5 - team.participants.length),
          team: serializeTeam(team),
        });
      } catch (dbError) {
        console.error('Database error on MTC draft POST:', dbError);
        return NextResponse.json(
          { error: 'Datenbankfehler beim Speichern des MTC-Entwurfs. Bitte versuche es erneut.' },
          { status: 500 }
        );
      }
    }

    if (body?.registrationMode === "MARKETPLACE") {
      const validation = MarketplaceRegistrationSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          { error: formatTeamRegistrationValidationIssues(validation.error.issues), details: validation.error.issues },
          { status: 400 }
        );
      }

      const marketplaceData = validation.data;
      const userEmail = normalizeEmail(sessionUserEmail || marketplaceData.contactEmail.trim());
      const contactPhone = marketplaceData.contactPhone.trim();
      const userName =
        sessionUserName ||
        marketplaceData.contactName?.trim() ||
        [marketplaceData.contactFirstName, marketplaceData.contactLastName].filter(Boolean).join(" ").trim();
      const userImage = sessionUserImage;

      if (!userEmail || !userName || !contactPhone) {
        return NextResponse.json({ error: 'Kontaktname, Kontakt-E-Mail und Telefonnummer sind erforderlich.' }, { status: 400 });
      }

      try {
        const competitionId = await ensureDefaultCompetition();
        const competition = await prisma.competition.findUnique({
          where: { id: competitionId },
          select: {
            tenantId: true,
            name: true,
            year: true,
            date: true,
            dateEnd: true,
            status: true,
            registrationDeadline: true,
            claimTokenExpiryMode: true,
            claimTokenTtlDays: true,
            registrationNotificationEmail: true,
            tenant: {
              select: {
                name: true,
                contactEmail: true,
              },
            },
          },
        });

        if (!competition) {
          return NextResponse.json({ error: 'Kein aktiver Wettkampf gefunden.' }, { status: 503 });
        }

        const registrationStatusAllowsSubmissions =
          competition.status === "DRAFT" || competition.status === "OPEN";

        if (!registrationStatusAllowsSubmissions) {
          return NextResponse.json(
            { error: 'Die Anmeldung ist für diesen Wettkampf aktuell geschlossen.' },
            { status: 409 }
          );
        }

        if (isRegistrationDeadlineReached(competition.registrationDeadline)) {
          return NextResponse.json(
            { error: 'Der Anmeldeschluss für diesen Wettkampf ist bereits erreicht.' },
            { status: 409 }
          );
        }

        const resolved = await resolveCurrentUser(session, { createIfMissing: !!sessionUserEmail });
        let user = resolved.user;
        if (!user) {
          user = await prisma.user.findFirst({
            where: {
              deletedAt: null,
              email: {
                equals: userEmail,
                mode: 'insensitive',
              },
            },
            orderBy: { createdAt: 'asc' },
          });
        }
        if (!user) {
          user = await prisma.user.create({
            data: {
              email: userEmail,
              name: userName || null,
              image: userImage || null,
              authentikSub: sessionAuthentikSub,
            }
          });
        }

        const birthYear = extractBirthYearFromInput(marketplaceData.birthDate);
        if (!birthYear) {
          return NextResponse.json({ error: 'Geburtsdatum unplausibel.' }, { status: 400 });
        }

        const participantName = `${marketplaceData.contactFirstName} ${marketplaceData.contactLastName}`.trim();
        const finalTeamName = `Sportlerbörse: ${participantName}`;
        const claimToken = createRegistrationClaimToken({
          mode: competition.claimTokenExpiryMode || "COMPETITION_END",
          ttlDays: competition.claimTokenTtlDays || null,
          registrationDeadline: competition.registrationDeadline || null,
          competitionEnd: competition.dateEnd || competition.date || null,
          maxExpiresAt: null,
        });

        const marketplaceCreateResult = await prisma.$transaction(async (tx) => {
          const duplicateInput = { competitionId, teamName: finalTeamName, contactEmail: userEmail };
          await lockMarketplaceDuplicateCheck(tx, duplicateInput);
          const duplicateTeam = await findActiveMarketplaceDuplicateTeam(tx, duplicateInput);
          if (duplicateTeam) return { duplicateTeam, team: null };

          const team = await tx.team.create({
            data: {
              name: finalTeamName,
              contactName: userName || participantName,
              contactEmail: userEmail,
              contactPhone,
              clubName: marketplaceData.clubName?.trim() || null,
              notes: marketplaceData.marketplaceMessage?.trim() || null,
              teamPublicationLevel: "TEAM_ANONYM",
              registrationMode: "MARKETPLACE",
              marketplaceVisibility: marketplaceData.marketplaceVisibility,
              marketplaceStatus: "NEW",
              marketplaceMessage: marketplaceData.marketplaceMessage?.trim() || null,
              classificationCode: "sportlerboerse",
              totalAge: 2026 - birthYear,
              competitionId,
              ownerId: user.id,
              teamChiefId: user.id,
              participants: {
                create: [{
                  firstName: marketplaceData.contactFirstName,
                  lastName: marketplaceData.contactLastName,
                  birthYear,
                  birthDate: normalizeBirthDateForStorage(marketplaceData.birthDate),
                  gender: mapGender(marketplaceData.gender),
                  disciplineCode: mapDiscipline(marketplaceData.discipline),
                  moderationNote: marketplaceData.marketplaceMessage?.trim() || null,
                  consentGiven: true,
                  email: userEmail,
                  participantPublicationPreference: marketplaceData.participantPublicationPreference,
                }],
              },
            },
            include: {
              participants: true,
              owner: { select: { email: true, name: true } }
            },
          });

          await tx.registrationClaimToken.create({
            data: {
              teamId: team.id,
              tokenHash: claimToken.tokenHash,
              suggestedEmail: userEmail,
              suggestedName: userName || null,
              expiresAt: claimToken.expiresAt,
              claimedAt: sessionUserEmail ? new Date() : null,
              claimedByUserId: sessionUserEmail ? user.id : null,
            },
          });

          await syncDerivedTeamchefRole(tx, {
            userId: user.id,
            tenantId: competition.tenantId,
          });

          return { duplicateTeam: null, team };
        });

        if (marketplaceCreateResult.duplicateTeam) {
          return NextResponse.json(
            {
              error: `Für "${participantName}" existiert bereits eine Sportlerbörsen-Meldung mit diesem Kontakt.`,
              existingTeamId: marketplaceCreateResult.duplicateTeam.id,
            },
            { status: 409 }
          );
        }

        const team = marketplaceCreateResult.team;
        if (!team) {
          return NextResponse.json({ error: 'Sportlerbörse-Anmeldung konnte nicht gespeichert werden.' }, { status: 500 });
        }

        const claimUrl = buildRegistrationClaimUrl(claimToken.rawToken);
        const portalUrl = buildPortalHomeUrl();
        const mailSummary = await sendTeamRegistrationEmails({
          competition,
          team: {
            name: finalTeamName,
            registrationMode: "MARKETPLACE",
            marketplaceVisibility: marketplaceData.marketplaceVisibility,
            marketplaceStatus: "NEW",
            marketplaceMessage: marketplaceData.marketplaceMessage?.trim() || null,
            classificationCode: "sportlerboerse",
            contactName: userName || participantName,
            contactEmail: userEmail,
            claimUrl,
            portalUrl,
            alreadyLinked: !!sessionUserEmail,
            participants: team.participants.map((participant) => ({
              firstName: participant.firstName,
              lastName: participant.lastName,
              birthYear: participant.birthYear,
              gender: participant.gender,
              disciplineCode: participant.disciplineCode,
              shirtSize: participant.shirtSize,
            })),
          },
        });
        await recordTeamRegistrationMailAuditEvents(prisma, {
          tenantId: competition.tenantId,
          competitionId,
          teamId: team.id,
          teamName: finalTeamName,
          registrationMode: "MARKETPLACE",
          actorId: user.id,
          reason: "marketplace_registration_created",
          mailSummary,
        }).catch((auditError) => console.error("Marketplace registration mail audit failed", auditError));

        if (!mailSummary.ok) {
          console.warn("Marketplace registration mail delivery incomplete", {
            teamId: team.id,
            competitionId,
            attempts: mailSummary.attempts,
          });
        }

        return NextResponse.json({
          success: true,
          message: `Sportlerbörse-Meldung für "${participantName}" erfolgreich übermittelt.`,
          mail: mailSummary,
          team: serializeTeam(team),
        });
      } catch (dbError) {
        console.error('Database error on marketplace POST:', dbError);
        return NextResponse.json(
          { error: 'Datenbankfehler bei der Sportlerbörse-Anmeldung. Bitte versuche es erneut.' },
          { status: 500 }
        );
      }
    }
    
    const validation = TeamRegistrationSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: formatTeamRegistrationValidationIssues(validation.error.issues), details: validation.error.issues },
        { status: 400 }
      );
    }

    const teamData = validation.data;
    const userEmail = normalizeEmail(sessionUserEmail || teamData.contactEmail?.trim());
    const userName = sessionUserName || teamData.contactName?.trim();
    const contactPhone = teamData.contactPhone.trim();
    const userImage = sessionUserImage;

    if (!userEmail || !userName || !contactPhone) {
      return NextResponse.json({ error: 'Kontaktname, Kontakt-E-Mail und Telefonnummer sind erforderlich.' }, { status: 400 });
    }

    const teamEvaluation = evaluateTeamDraft({
      mode: sessionUserEmail ? "authenticated-create" : "anonymous-create",
      teamName: teamData.teamName,
      contactFirstName: teamData.contactFirstName,
      contactLastName: teamData.contactLastName,
      contactName: userName,
      contactEmail: userEmail,
      participants: teamData.participants,
    });
    const autoCategory = teamEvaluation.classification.code;
    const finalTeamName = teamData.teamName?.trim();

    if (!finalTeamName || finalTeamName.length < 3) {
      return NextResponse.json({ error: 'Mannschaftsname ist erforderlich.' }, { status: 400 });
    }

    if (teamEvaluation.blockingErrors.length > 0) {
      return NextResponse.json(
        {
          error: teamEvaluation.blockingErrors.join(' · '),
          blockingErrors: teamEvaluation.blockingErrors,
        },
        { status: 400 }
      );
    }

    if (!teamEvaluation.discipline.valid) {
      return NextResponse.json(
        {
          error: teamEvaluation.discipline.warnings.join(' · '),
          disciplineWarnings: teamEvaluation.discipline.warnings,
        },
        { status: 409 }
      );
    }

    try {
      // Ensure default competition exists
      const competitionId = await ensureDefaultCompetition();
      const competition = await prisma.competition.findUnique({
        where: { id: competitionId },
        select: {
          tenantId: true,
          name: true,
          year: true,
          date: true,
          dateEnd: true,
          status: true,
          registrationDeadline: true,
          claimTokenExpiryMode: true,
          claimTokenTtlDays: true,
          shirtOrderDeadline: true,
          maxTeams: true,
          registrationNotificationEmail: true,
          tenant: {
            select: {
              name: true,
              contactEmail: true,
            },
          },
        },
      });

      if (!competition) {
        return NextResponse.json({ error: 'Kein aktiver Wettkampf gefunden.' }, { status: 503 });
      }

      const registrationStatusAllowsSubmissions =
        competition.status === "DRAFT" || competition.status === "OPEN";

      if (!registrationStatusAllowsSubmissions) {
        return NextResponse.json(
          { error: 'Die Anmeldung ist für diesen Wettkampf aktuell geschlossen.' },
          { status: 409 }
        );
      }

      if (isRegistrationDeadlineReached(competition.registrationDeadline)) {
        return NextResponse.json(
          { error: 'Der Anmeldeschluss für diesen Wettkampf ist bereits erreicht.' },
          { status: 409 }
        );
      }

      if (competition.maxTeams && competition.maxTeams > 0) {
        const existingTeams = await prisma.team.count({
          where: {
            competitionId,
            deletedAt: null,
            registrationMode: "TEAM",
          },
        });

        if (existingTeams >= competition.maxTeams) {
          return NextResponse.json(
            { error: 'Für diesen Wettkampf sind aktuell keine freien Startplätze mehr verfügbar.' },
            { status: 409 }
          );
        }
      }

      const canEditShirts = !isShirtOrderClosed(competition?.shirtOrderDeadline);

      // Upsert user
      const resolved = await resolveCurrentUser(session, { createIfMissing: !!sessionUserEmail });
      let user = resolved.user;
      if (!user) {
        user = await prisma.user.findFirst({
          where: {
            deletedAt: null,
            email: {
              equals: userEmail,
              mode: 'insensitive',
            },
          },
          orderBy: { createdAt: 'asc' },
        });
      }
      if (!user) {
        user = await prisma.user.create({
          data: {
            email: userEmail,
            name: userName || null,
            image: userImage || null,
            authentikSub: sessionAuthentikSub,
          }
        });
      }

      // Calculate total age
      const validParticipants = teamData.participants
        .map((participant) => ({
          participant,
          birthYear: extractBirthYearFromInput(participant.birthDate),
          birthDate: normalizeBirthDateForStorage(participant.birthDate),
        }))
        .filter(({ participant, birthYear }) => participant.firstName && participant.lastName && birthYear !== null);
      const totalAge = validParticipants.reduce((sum, entry) => sum + (2026 - (entry.birthYear as number)), 0);

      // Create team with participants
      const team = await prisma.team.create({
        data: {
          name: finalTeamName,
          teamPublicationLevel: teamData.teamPublicationLevel,
          contactName: userName || "",
          contactEmail: userEmail,
          contactPhone,
          classificationCode: autoCategory,
          totalAge: totalAge || null,
          competitionId: competitionId,
          ownerId: user.id,
          teamChiefId: user.id,
          participants: {
            create: validParticipants.map(({ participant, birthYear, birthDate }) => ({
              firstName: participant.firstName,
              lastName: participant.lastName,
              birthYear: birthYear as number,
              birthDate,
              gender: mapGender(participant.gender),
              disciplineCode: mapDiscipline(participant.discipline),
              shirtSize: canEditShirts && participant.shirtSize ? participant.shirtSize : null,
              moderationNote: participant.moderationNote?.trim() || null,
              consentGiven: true,
              email: participant.email || null,
              participantPublicationPreference: participant.participantPublicationPreference || "NAME_VERBERGEN",
            }))
          }
        },
        include: {
          participants: true,
          owner: { select: { email: true, name: true } }
        }
      });

      const claimToken = createRegistrationClaimToken({
        mode: competition?.claimTokenExpiryMode || "COMPETITION_END",
        ttlDays: competition?.claimTokenTtlDays || null,
        registrationDeadline: competition?.registrationDeadline || null,
        competitionEnd: competition?.dateEnd || competition?.date || null,
        maxExpiresAt: null,
      });
      await prisma.registrationClaimToken.create({
        data: {
          teamId: team.id,
          tokenHash: claimToken.tokenHash,
          suggestedEmail: userEmail,
          suggestedName: userName || null,
          expiresAt: claimToken.expiresAt,
          claimedAt: sessionUserEmail ? new Date() : null,
          claimedByUserId: sessionUserEmail ? user.id : null,
        },
      });

      const claimUrl = buildRegistrationClaimUrl(claimToken.rawToken);
      const portalUrl = buildPortalHomeUrl();
      const participantClaimMailResults: Array<{
        participantId: string;
        email: string;
        status: "sent" | "skipped" | "failed";
        reason?: string;
      }> = [];

      let mailSummary = null;

      if (competition) {
        await syncDerivedTeamchefRole(prisma, {
          userId: user.id,
          tenantId: competition.tenantId,
        });

        const participantClaimTokens = await Promise.all(
          team.participants
            .filter((participant) => !!participant.email)
            .map(async (participant) => {
              const participantClaimToken = createRegistrationClaimToken({
                mode: competition.claimTokenExpiryMode || "COMPETITION_END",
                ttlDays: competition.claimTokenTtlDays || null,
                registrationDeadline: competition.registrationDeadline || null,
                competitionEnd: competition.dateEnd || competition.date || null,
                maxExpiresAt: null,
              });

              const createdToken = await prisma.participantClaimToken.create({
                data: {
                  participantId: participant.id,
                  tokenHash: participantClaimToken.tokenHash,
                  suggestedEmail: participant.email!,
                  suggestedName: `${participant.firstName} ${participant.lastName}`.trim() || null,
                  expiresAt: participantClaimToken.expiresAt,
                },
              });

              await recordParticipantClaimAuditEvent({
                request,
                eventType: "CLAIM_CREATE",
                outcome: "SUCCESS",
                tokenId: createdToken.id,
                participantId: participant.id,
                teamId: team.id,
                userId: user.id,
                sessionEmail: userEmail,
              });

              return {
                participant,
                claimUrl: buildParticipantClaimUrl(participantClaimToken.rawToken),
              };
            }),
        );

        mailSummary = await sendTeamRegistrationEmails({
          competition,
          team: {
            name: finalTeamName,
            classificationCode: autoCategory,
            contactName: userName || "",
            contactEmail: userEmail,
            claimUrl,
            portalUrl,
            alreadyLinked: !!sessionUserEmail,
            participants: team.participants.map((participant) => ({
              firstName: participant.firstName,
              lastName: participant.lastName,
              birthYear: participant.birthYear,
              gender: participant.gender,
              disciplineCode: participant.disciplineCode,
              shirtSize: participant.shirtSize,
            })),
          },
        });
        await recordTeamRegistrationMailAuditEvents(prisma, {
          tenantId: competition.tenantId,
          competitionId,
          teamId: team.id,
          teamName: finalTeamName,
          registrationMode: "TEAM",
          actorId: user.id,
          reason: "team_registration_created",
          mailSummary,
        }).catch((auditError) => console.error("Team registration mail audit failed", auditError));

        const participantClaimReplyTo = resolveRegistrationNotificationEmail(competition)[0] || competition.tenant?.contactEmail || null;
        const participantMailResults = await Promise.allSettled(
          participantClaimTokens.map(({ participant, claimUrl }) =>
            sendParticipantClaimEmail({
              participantName: `${participant.firstName} ${participant.lastName}`.trim(),
              participantEmail: participant.email!,
              teamName: finalTeamName,
              competitionName: competition.name,
              competitionYear: competition.year,
              claimUrl,
              orgReplyTo: participantClaimReplyTo,
            }),
          ),
        );

        participantMailResults.forEach((result, index) => {
          const email = participantClaimTokens[index]?.participant.email || "";
          const participantId = participantClaimTokens[index]?.participant.id || "";

          if (result.status === "rejected") {
            participantClaimMailResults.push({
              participantId,
              email,
              status: "failed",
              reason: result.reason instanceof Error ? result.reason.message : String(result.reason),
            });
            return;
          }

          if (result.value.status === "skipped") {
            participantClaimMailResults.push({
              participantId,
              email,
              status: "skipped",
              reason: result.value.reason,
            });
            return;
          }

          participantClaimMailResults.push({
            participantId,
            email,
            status: "sent",
          });
        });

        if (!mailSummary.ok) {
          console.warn("Team registration mail delivery incomplete", {
            teamId: team.id,
            competitionId,
            attempts: mailSummary.attempts,
          });
        }
      }

      return NextResponse.json({ 
        success: true,
        message: `Team "${finalTeamName}" erfolgreich angemeldet! Klasse: ${autoCategory}`,
        classificationWarnings: teamEvaluation.classificationWarnings,
        mail: mailSummary,
        participantClaimMail: participantClaimMailResults,
        team: serializeTeam(team)
      });

    } catch (dbError) {
      console.error('Database error on POST:', dbError);
      return NextResponse.json(
        { error: 'Datenbankfehler bei der Anmeldung. Bitte versuche es erneut.' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Failed to register team' }, { status: 500 });
  }
}

export async function PUT() {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // This would be for bulk operations - not implemented yet
    return NextResponse.json({ error: 'Bulk PUT not implemented' }, { status: 501 });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Failed to update teams' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // This would be for bulk operations - not implemented yet
    return NextResponse.json({ error: 'Bulk DELETE not implemented' }, { status: 501 });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Failed to delete teams' }, { status: 500 });
  }
}
