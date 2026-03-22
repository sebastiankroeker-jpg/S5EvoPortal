import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { TeamRegistrationSchema, type TeamRegistrationInput } from '@/lib/domain/team';
import { prisma } from '@/lib/prisma';

// Global temp storage (until DB ready)
declare global {
  var tempTeams: any[] | undefined;
}

if (!global.tempTeams) {
  global.tempTeams = [];
}

// 2026 Classification Logic
function classifyTeam(participants: TeamRegistrationInput['participants']): string {
  const participantsWithData = participants.filter(p => p.firstName && p.lastName && p.birthDate);
  
  if (participantsWithData.length === 0) {
    return "unclassified";
  }

  const ages = participantsWithData.map(p => 2026 - new Date(p.birthDate).getFullYear());
  const birthYears = participantsWithData.map(p => new Date(p.birthDate).getFullYear());
  const totalAge = ages.reduce((sum, age) => sum + age, 0);
  const isMaleOnly = participantsWithData.every(p => p.gender === "M");
  const isFemaleOnly = participantsWithData.every(p => p.gender === "W");
  
  // Jahrgänge-basierte Klassen
  if (birthYears.every(year => year >= 2016 && year <= 2018)) {
    return "schueler-a";
  } else if (birthYears.every(year => year >= 2013 && year <= 2015)) {
    return "schueler-b";
  } else if (birthYears.every(year => year >= 2009 && year <= 2012)) {
    return "jugend";
  }
  // Altersklassen (Gesamtalter)
  else if (totalAge <= 125) {
    return "jungsters";
  } else if (totalAge >= 226) {
    return "masters";
  } else if (isFemaleOnly && totalAge <= 150) {
    return "damen-a";
  } else if (isFemaleOnly && totalAge > 150) {
    return "damen-b";
  } else if (isMaleOnly) {
    return "herren";
  } else {
    return "herren"; // Default fallback
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Try Prisma first, fallback to temp storage
    try {
      const teams = await prisma.team.findMany({
        where: {
          owner: {
            email: session.user.email
          },
          deletedAt: null
        },
        include: {
          participants: {
            where: { deletedAt: null }
          }
        }
      });

      return NextResponse.json({ teams });
    } catch (dbError) {
      // Fallback to temp storage
      const userTeams = global.tempTeams?.filter(t => t.ownerId === session.user.email) || [];
      return NextResponse.json({ 
        teams: userTeams,
        message: userTeams.length === 0 ? 'No teams registered yet' : undefined
      });
    }
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'API temporarily unavailable' },
      { status: 503 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    
    // Validate with Zod schema
    const validation = TeamRegistrationSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          details: validation.error.issues 
        },
        { status: 400 }
      );
    }

    const teamData = validation.data;
    const autoCategory = classifyTeam(teamData.participants);

    // Try Prisma first
    try {
      // Check if user exists, create if not
      let user = await prisma.user.findUnique({
        where: { email: session.user.email }
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            email: session.user.email,
            name: session.user.name || null,
            image: session.user.image || null
          }
        });
      }

      // Create team with participants
      const team = await prisma.team.create({
        data: {
          name: teamData.teamName,
          category: autoCategory,
          contactName: session.user.name || "",
          contactEmail: session.user.email,
          ownerId: user.id,
          participants: {
            create: teamData.participants
              .filter(p => p.firstName && p.lastName)
              .map(p => ({
                firstName: p.firstName,
                lastName: p.lastName,
                birthDate: new Date(p.birthDate),
                gender: p.gender,
                email: p.email || null,
                phone: p.phone || null,
                discipline: p.discipline
              }))
          }
        },
        include: {
          participants: true
        }
      });

      return NextResponse.json({ 
        success: true,
        message: `Team "${teamData.teamName}" erfolgreich angemeldet! Klasse: ${autoCategory}`,
        team
      });

    } catch (dbError) {
      console.warn('Database not available, using temp storage:', dbError);
      
      // Fallback: Store in temp storage
      const newTeam = {
        id: `temp-${Date.now()}`,
        name: teamData.teamName,
        category: autoCategory,
        contactName: session.user.name || "",
        contactEmail: session.user.email,
        participants: teamData.participants
          .filter(p => p.firstName && p.lastName)
          .map(p => ({
            ...p,
            birthDate: p.birthDate
          })),
        ownerId: session.user.email,
        createdAt: new Date().toISOString()
      };

      global.tempTeams = global.tempTeams || [];
      global.tempTeams.push(newTeam);

      return NextResponse.json({ 
        success: true,
        message: `Team "${teamData.teamName}" erfolgreich angemeldet! Klasse: ${autoCategory} (Temporär gespeichert)`,
        team: newTeam
      });
    }

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Failed to register team' },
      { status: 500 }
    );
  }
}