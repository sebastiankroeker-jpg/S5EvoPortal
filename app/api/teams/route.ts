import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { TeamRegistrationSchema, type TeamRegistrationInput, generateTeamName } from '@/lib/domain/team';
import { classifyTeam as classifyTeamShared, validateDisciplineAssignment } from '@/lib/domain/classification';
import { isShirtOrderClosed } from '@/lib/domain/shirts';
import { prisma } from '@/lib/prisma';

// Map frontend gender ("M"/"W") to Prisma enum
function mapGender(g: string): "MALE" | "FEMALE" {
  return g === "W" ? "FEMALE" : "MALE";
}

// Map frontend discipline to Prisma DisciplineAssignment enum
function mapDiscipline(d: string): "RUN" | "BENCH" | "STOCK" | "ROAD" | "MTB" | "TBD" {
  const valid = ["RUN", "BENCH", "STOCK", "ROAD", "MTB", "TBD"];
  return valid.includes(d) ? (d as any) : "TBD";
}

// Extract birth year from date string
function extractBirthYear(birthDate: string): number {
  return new Date(birthDate).getFullYear();
}

// 2026 Classification Logic
function classifyTeam(participants: TeamRegistrationInput['participants']): string {
  const inputs = participants
    .filter(p => p.firstName && p.lastName && p.birthDate)
    .map(p => ({
      birthYear: new Date(p.birthDate).getFullYear(),
      gender: p.gender as "M" | "W" | "D",
    }));
  return classifyTeamShared(inputs).code;
}

function serializeParticipant(participant: any) {
  if (!participant) return null;
  return {
    id: participant.id,
    firstName: participant.firstName,
    lastName: participant.lastName,
    gender: participant.gender === "MALE" ? "M" : "W",
    birthDate: participant.birthYear ? `${participant.birthYear}-01-01` : "",
    email: participant.email ?? "",
    phone: participant.phone ?? "",
    discipline: participant.disciplineCode ?? "TBD",
    shirtSize: participant.shirtSize ?? "",
  };
}

function serializeTeam(team: any) {
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
  let tenant = await prisma.tenant.findFirst();
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
    orderBy: { year: 'desc' }
  });
  if (!competition) {
    competition = await prisma.competition.create({
      data: {
        name: "Mannschafts-5-Kampf 2026",
        year: 2026,
        status: "OPEN",
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
      // Check URL search params to determine if we want all teams or just own teams
      const url = new URL(request.url);
      const scope = url.searchParams.get('scope');
      
      // Optional competition filter (admin context)
      const competitionId = url.searchParams.get('competitionId');

      const teams = await prisma.team.findMany({
        where: {
          // If scope=all, show all teams. Otherwise, show only own teams
          ...(scope === 'all' ? {} : { owner: { email: userEmail } }),
          // Filter by competition if specified
          ...(competitionId ? { competitionId } : {}),
          deletedAt: null
        },
        include: {
          participants: { where: { deletedAt: null } },
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
    const userEmail = session?.user?.email;
    const userName = session?.user?.name;
    const userImage = session?.user?.image;

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

    const teamData = validation.data;
    const autoCategory = classifyTeam(teamData.participants);
    const normalizedTeamName = teamData.teamName?.trim();
    const finalTeamName = normalizedTeamName && normalizedTeamName.length >= 3
      ? normalizedTeamName
      : generateTeamName(autoCategory);

    try {
      // Ensure default competition exists
      const competitionId = await ensureDefaultCompetition();
      const competition = await prisma.competition.findUnique({
        where: { id: competitionId },
        select: { tenantId: true, shirtOrderDeadline: true },
      });

      const canEditShirts = !isShirtOrderClosed(competition?.shirtOrderDeadline);

      // Upsert user
      let user = await prisma.user.findUnique({ where: { email: userEmail } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            email: userEmail,
            name: userName || null,
            image: userImage || null
          }
        });
      }

      // Calculate total age
      const validParticipants = teamData.participants.filter(p => p.firstName && p.lastName && p.birthDate);
      const totalAge = validParticipants.reduce((sum, p) => sum + (2026 - extractBirthYear(p.birthDate)), 0);

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
            create: validParticipants.map(p => ({
              firstName: p.firstName,
              lastName: p.lastName,
              birthYear: extractBirthYear(p.birthDate),
              gender: mapGender(p.gender),
              disciplineCode: mapDiscipline(p.discipline),
              shirtSize: canEditShirts && p.shirtSize ? p.shirtSize : null,
              consentGiven: true,
              email: p.email || null,
              phone: p.phone || null,
            }))
          }
        },
        include: {
          participants: true,
          owner: { select: { email: true, name: true } }
        }
      });

      if (competition) {
        await Promise.all([
          ensureTenantRole(user.id, competition.tenantId, "TEAMCHEF"),
          ensureTenantRole(user.id, competition.tenantId, "ADMIN"),
        ]);
      }

      return NextResponse.json({ 
        success: true,
        message: `Team "${finalTeamName}" erfolgreich angemeldet! Klasse: ${autoCategory}`,
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
