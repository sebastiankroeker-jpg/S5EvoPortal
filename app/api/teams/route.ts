import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { TeamRegistrationSchema, type TeamRegistrationInput, birthYearToBirthDateInput, extractBirthYearFromInput } from '@/lib/domain/team';
import { classifyTeam as classifyTeamShared, evaluateTeamState } from '@/lib/domain/classification';
import { isShirtOrderClosed } from '@/lib/domain/shirts';
import { resolveRegistrationNotificationEmail, sendTeamRegistrationEmails } from '@/lib/mail/team-registration';
import { sendParticipantClaimEmail } from '@/lib/mail/participant-claim';
import { recordParticipantClaimAuditEvent } from '@/lib/participant-claim-audit';
import { prisma } from '@/lib/prisma';
import { buildParticipantClaimUrl, buildPortalHomeUrl, buildRegistrationClaimUrl, createRegistrationClaimToken } from '@/lib/registration-claim';
import { normalizeEmail, resolveCurrentUser } from '@/lib/current-user';
import { getParticipantEmailInvitationStatus, getParticipantClaimTokenStatus } from '@/lib/participant-claim-invitation';
import {
  canViewerSeeFullPublication,
  resolveVisibleParticipantName,
  resolveVisibleTeamName,
  splitDisplayName,
} from '@/lib/publication-visibility';
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

function isRegistrationDeadlineReached(deadline?: Date | null): boolean {
  if (!deadline) return false;
  return new Date(deadline) < new Date();
}

// 2026 Classification Logic
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
    birthDate: canSeeFullPublication || isCurrentUserParticipant ? birthYearToBirthDateInput(participant.birthYear) : "",
    moderationNote: canSeeFullPublication ? participant.moderationNote ?? "" : "",
    email: canSeeSensitiveParticipantFields ? participant.email ?? "" : "",
    linkedUserId: canSeeSensitiveParticipantFields ? participant.userId ?? null : null,
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
  if (team.ownerId) activeTeamManagerUserIds.add(team.ownerId);
  if (team.teamChiefId) activeTeamManagerUserIds.add(team.teamChiefId);
  const isCurrentUserTeam =
    (!!options?.currentUserId && (team.ownerId === options.currentUserId || team.teamChiefId === options.currentUserId)) ||
    (!!options?.currentUserId && activeTeamManagerUserIds.has(options.currentUserId)) ||
    (!!normalizedCurrentUserEmail &&
      (normalizeEmail(team.owner?.email) === normalizedCurrentUserEmail ||
        normalizeEmail(team.contactEmail) === normalizedCurrentUserEmail)) ||
    ((team.participants ?? []).some((participant) => {
      const normalizedParticipantEmail = normalizeEmail(participant.email);
      return (
        (!!options?.currentUserId && participant.userId === options.currentUserId) ||
        (!!normalizedCurrentUserEmail && normalizedParticipantEmail === normalizedCurrentUserEmail)
      );
    }));
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
    isCurrentUserTeam,
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
              canSeeSensitiveParticipantFields: options?.canEditAllTeams === true,
              activeTeamManagerUserIds,
            }),
          )
          .filter(Boolean)
      : [],
  };
}

// Ensure a default tenant + competition exist
async function ensureTenantRole(userId: string, tenantId: string, role: 'ADMIN' | 'TEAMCHEF') {
  const existingRole = await prisma.tenantRole.findFirst({
    where: { userId, tenantId, role },
  });

  if (!existingRole) {
    await prisma.tenantRole.create({
      data: { userId, tenantId, role },
    });
  }
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

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      const url = new URL(request.url);
      const scope = url.searchParams.get('scope');
      const roleContext = url.searchParams.get('roleContext');
      const competitionId = url.searchParams.get('competitionId');
      const wantsAllTeams = scope === 'all';
      const competition = competitionId
        ? await prisma.competition.findUnique({
            where: { id: competitionId },
            select: {
              tenantId: true,
              teamOwnerFilterVisibleForTeamchef: true,
              participantsCanViewAllTeams: true,
              spectatorsCanViewAllTeams: true,
            },
          })
        : null;
      const { user } = await resolveCurrentUser(session, { createIfMissing: true });
      const normalizedUserEmail = normalizeEmail(userEmail);
      const access = await getScopedRoleFlags(userEmail, competition?.tenantId, session);
      const effectiveScopeRole = resolveEffectiveTeamScopeRole(roleContext, access.roles);
      const competitionTeamAccess = normalizeCompetitionTeamAccessConfig(competition);
      const canViewRequestedScope =
        roleContext
          ? canRoleViewAllTeams(effectiveScopeRole, competitionTeamAccess)
          : access.canViewAllTeams || canRoleViewAllTeams(effectiveScopeRole, competitionTeamAccess);
      if (wantsAllTeams && !canViewRequestedScope) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const teams = await prisma.team.findMany({
        where: {
          ...(wantsAllTeams
            ? {}
            : {
                OR: [
                  ...(user ? [{ ownerId: user.id }] : []),
                  ...(user ? [{ teamChiefId: user.id }] : []),
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
              }),
          ...(competitionId ? { competitionId } : {}),
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
              },
              claimTokens: {
                orderBy: { createdAt: 'desc' },
                take: 1,
                select: { id: true, createdAt: true, expiresAt: true, claimedAt: true, revokedAt: true }
              }
            }
          },
          owner: { select: { email: true, name: true } },
          memberRoles: {
            where: { role: "TEAM_MANAGER", revokedAt: null },
            select: { userId: true, revokedAt: true },
          },
        }
      });

      return NextResponse.json({
        teams: teams.map((team) => {
          const teamAccess = resolveTeamAccess({
            team,
            user,
            userEmail,
            canEditAllTeams: access.canEditAllTeams,
          });
          const canSeeFullPublication =
            !wantsAllTeams ||
            canViewerSeeFullPublication({
              isPrivilegedViewer: effectiveScopeRole === "ADMIN" || effectiveScopeRole === "MODERATOR",
              ownsTeam: teamAccess.canEditTeam,
            });

          return serializeTeam(team, {
            currentUserId: user?.id ?? null,
            currentUserEmail: normalizedUserEmail,
            canSeeFullPublication,
            canEditAllTeams: access.canEditAllTeams,
            canSeeSensitiveParticipantFields: access.canEditAllTeams,
          });
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
    
    const validation = TeamRegistrationSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    const teamData = validation.data;
    const userEmail = normalizeEmail(sessionUserEmail || teamData.contactEmail?.trim());
    const userName = sessionUserName || teamData.contactName?.trim();
    const userImage = sessionUserImage;

    if (!userEmail || !userName) {
      return NextResponse.json({ error: 'Kontaktname und Kontakt-E-Mail sind erforderlich.' }, { status: 400 });
    }

    const teamEvaluation = evaluateTeamState(
      teamData.participants.map((participant) => ({
        birthYear: extractBirthYearFromInput(participant.birthDate),
        gender: participant.gender,
        disciplineCode: participant.discipline,
      })),
    );
    const autoCategory = teamEvaluation.classification.code;
    const finalTeamName = teamData.teamName?.trim();

    if (!finalTeamName || finalTeamName.length < 3) {
      return NextResponse.json({ error: 'Mannschaftsname ist erforderlich.' }, { status: 400 });
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
          classificationCode: autoCategory,
          totalAge: totalAge || null,
          competitionId: competitionId,
          ownerId: user.id,
          teamChiefId: user.id,
          participants: {
            create: validParticipants.map(({ participant, birthYear }) => ({
              firstName: participant.firstName,
              lastName: participant.lastName,
              birthYear: birthYear as number,
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
        await Promise.all([
          ensureTenantRole(user.id, competition.tenantId, "TEAMCHEF"),
        ]);

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

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    
    const validation = TeamRegistrationSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    // This would be for bulk operations - not implemented yet
    return NextResponse.json({ error: 'Bulk PUT not implemented' }, { status: 501 });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Failed to update teams' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
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
