import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { TeamRegistrationSchema, type TeamRegistrationInput, birthYearToBirthDateInput, extractBirthYearFromInput } from '@/lib/domain/team';
import { classifyTeam as classifyTeamShared, evaluateTeamState } from '@/lib/domain/classification';
import { isShirtOrderClosed } from '@/lib/domain/shirts';
import { sendTeamRegistrationEmails } from '@/lib/mail/team-registration';
import { prisma } from '@/lib/prisma';
import { buildRegistrationClaimUrl, createRegistrationClaimToken } from '@/lib/registration-claim';
import { normalizeEmail, resolveCurrentUser } from '@/lib/current-user';
import { getScopedRoleFlags } from '@/lib/server-permissions';

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
  moderationNote?: string | null;
  email?: string | null;
  phone?: string | null;
  disciplineCode?: string | null;
  shirtSize?: string | null;
  pendingChanges?: SerializedPendingChange[];
};

type SerializableTeam = {
  id: string;
  name: string;
  classificationCode?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  owner?: { email?: string | null; name?: string | null } | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  participants?: SerializableParticipant[];
};

function serializeParticipant(participant: SerializableParticipant | null | undefined) {
  if (!participant) return null;
  const latestChange = Array.isArray(participant.pendingChanges) ? participant.pendingChanges[0] : null;
  return {
    id: participant.id,
    firstName: participant.firstName,
    lastName: participant.lastName,
    gender: participant.gender === "MALE" ? "M" : "W",
    birthDate: birthYearToBirthDateInput(participant.birthYear),
    moderationNote: participant.moderationNote ?? "",
    email: participant.email ?? "",
    phone: participant.phone ?? "",
    discipline: participant.disciplineCode ?? "TBD",
    shirtSize: participant.shirtSize ?? "",
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

function serializeTeam(team: SerializableTeam | null | undefined) {
  if (!team) return null;
  return {
    id: team.id,
    name: team.name,
    category: team.classificationCode ?? "unclassified",
    contactName: team.contactName ?? team.owner?.name ?? "",
    contactEmail: team.contactEmail ?? team.owner?.email ?? "",
    contactPhone: team.contactPhone ?? "",
    ownerEmail: team.owner?.email ?? team.contactEmail ?? "",
    ownerName: team.owner?.name ?? team.contactName ?? "",
    createdAt: team.createdAt?.toISOString?.() ?? new Date().toISOString(),
    updatedAt: team.updatedAt?.toISOString?.() ?? team.createdAt?.toISOString?.() ?? new Date().toISOString(),
    participants: Array.isArray(team.participants)
      ? team.participants.map(serializeParticipant).filter(Boolean)
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
      const competitionId = url.searchParams.get('competitionId');
      const wantsAllTeams = scope === 'all';
      const competition = competitionId
        ? await prisma.competition.findUnique({
            where: { id: competitionId },
            select: { tenantId: true },
          })
        : null;
      const { user } = await resolveCurrentUser(session, { createIfMissing: true });
      const normalizedUserEmail = normalizeEmail(userEmail);
      const access = await getScopedRoleFlags(userEmail, competition?.tenantId, session);

      if (wantsAllTeams && !access.canViewAllTeams) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const teams = await prisma.team.findMany({
        where: {
          ...(wantsAllTeams
            ? {}
            : {
                OR: [
                  ...(user ? [{ ownerId: user.id }] : []),
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
              }
            }
          },
          owner: { select: { email: true, name: true } }
        }
      });

      return NextResponse.json({ teams: teams.map(serializeTeam) });
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
          status: true,
          registrationDeadline: true,
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
              phone: participant.phone || null,
            }))
          }
        },
        include: {
          participants: true,
          owner: { select: { email: true, name: true } }
        }
      });

      const claimToken = createRegistrationClaimToken({
        maxExpiresAt: competition?.registrationDeadline || null,
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

      let mailSummary = null;

      if (competition) {
        await Promise.all([
          ensureTenantRole(user.id, competition.tenantId, "TEAMCHEF"),
        ]);

        mailSummary = await sendTeamRegistrationEmails({
          competition,
          team: {
            name: finalTeamName,
            classificationCode: autoCategory,
            contactName: userName || "",
            contactEmail: userEmail,
            claimUrl,
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
