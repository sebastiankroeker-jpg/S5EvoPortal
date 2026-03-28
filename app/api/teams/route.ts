import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import {
  TeamRegistrationSchema,
  type TeamRegistrationInput,
  type ParticipantInput,
  type DisciplineId,
  generateTeamName,
} from '@/lib/domain/team';
import { prisma } from '@/lib/prisma';

type SerializableParticipant = {
  firstName?: string;
  lastName?: string;
  gender?: ParticipantInput['gender'] | string;
  birthDate?: string | Date;
  email?: string | null;
  phone?: string | null;
  discipline?: DisciplineId | string;
};

type SerializableTeam = {
  id?: string;
  name?: string;
  category?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string | null;
  ownerEmail?: string | null;
  ownerName?: string | null;
  ownerId?: string;
  owner?: { email?: string | null; name?: string | null } | null;
  createdAt?: string | Date;
  participants?: SerializableParticipant[];
};

type TempTeam = SerializableTeam & {
  participants: SerializableParticipant[];
};


// Global temp storage (until DB ready)
declare global {
  var tempTeams: TempTeam[] | undefined;
}

if (!global.tempTeams) {
  global.tempTeams = [];
}

function serializeParticipant(participant: SerializableParticipant | null) {
  if (!participant) return null;
  return {
    firstName: participant.firstName,
    lastName: participant.lastName,
    gender: participant.gender,
    birthDate:
      typeof participant.birthDate === "string"
        ? participant.birthDate
        : participant.birthDate?.toISOString?.() ?? "",
    email: participant.email ?? "",
    phone: participant.phone ?? "",
    discipline: participant.discipline,
  };
}

function serializeTeam(team: SerializableTeam | null) {
  if (!team) return null;
  return {
    id: team.id,
    name: team.name,
    category: team.category,
    contactName: team.contactName,
    contactEmail: team.contactEmail,
    contactPhone: team.contactPhone ?? "",
    ownerEmail: team.owner?.email ?? team.ownerEmail ?? team.contactEmail,
    ownerName: team.owner?.name ?? team.ownerName ?? team.contactName,
    createdAt:
      team.createdAt instanceof Date
        ? team.createdAt.toISOString()
        : typeof team.createdAt === 'string'
        ? team.createdAt
        : new Date().toISOString(),
    participants: Array.isArray(team.participants)
      ? team.participants.map(serializeParticipant).filter(Boolean)
      : [],
  };
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

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Try Prisma first, fallback to temp storage
    try {
      const teams = await prisma.team.findMany({
        where: {
          owner: {
            email: userEmail
          },
          deletedAt: null
        },
        include: {
          participants: {
            where: { deletedAt: null }
          },
          owner: {
            select: { email: true, name: true }
          }
        }
      });

      return NextResponse.json({ teams: teams.map(serializeTeam) });
    } catch (dbError) {
      // Fallback to temp storage
      const userEmailFallback = session.user?.email;
      const userTeams = userEmailFallback
        ? global.tempTeams?.filter(t => t.ownerEmail === userEmailFallback || t.ownerId === userEmailFallback) || []
        : [];
      return NextResponse.json({ 
        teams: userTeams.map(serializeTeam),
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
    const userEmail = session?.user?.email;
    const userName = session?.user?.name;
    const userImage = session?.user?.image;

    if (!userEmail) {
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
    const normalizedTeamName = teamData.teamName?.trim();
    const finalTeamName = normalizedTeamName && normalizedTeamName.length >= 3
      ? normalizedTeamName
      : generateTeamName(autoCategory);

    // Try Prisma first
    try {
      // Check if user exists, create if not
      let user = await prisma.user.findUnique({
        where: { email: userEmail }
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            email: userEmail,
            name: userName || null,
            image: userImage || null
          }
        });
      }

      // Create team with participants
      const team = await prisma.team.create({
        data: {
          name: finalTeamName,
          category: autoCategory,
          contactName: userName || "",
          contactEmail: userEmail,
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
        message: `Team "${finalTeamName}" erfolgreich angemeldet! Klasse: ${autoCategory}`,
        team: serializeTeam(team)
      });

    } catch (dbError) {
      console.warn('Database not available, using temp storage:', dbError);
      
      // Fallback: Store in temp storage
      const newTeam = {
        id: `temp-${Date.now()}`,
        name: finalTeamName,
        category: autoCategory,
        contactName: userName || "",
        contactEmail: userEmail,
        contactPhone: "",
        participants: teamData.participants
          .filter(p => p.firstName && p.lastName)
          .map(p => ({
            ...p,
            birthDate: p.birthDate
          })),
        ownerEmail: userEmail,
        ownerName: userName || "Teamchef",
        createdAt: new Date().toISOString()
      };

      global.tempTeams = global.tempTeams || [];
      global.tempTeams.push(newTeam);

      return NextResponse.json({ 
        success: true,
        message: `Team "${finalTeamName}" erfolgreich angemeldet! Klasse: ${autoCategory} (Temporär gespeichert)`,
        team: serializeTeam(newTeam)
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