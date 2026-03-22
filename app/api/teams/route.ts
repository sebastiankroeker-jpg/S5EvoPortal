import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';

// Temporary fallback until Vercel Postgres is fully configured
const isDBConfigured = process.env.DATABASE_URL && process.env.DATABASE_URL.length > 0;

// Global temp storage (until DB ready)
declare global {
  var tempTeams: any[] | undefined;
}

if (!global.tempTeams) {
  global.tempTeams = [];
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Return stored teams from session/memory (temporary until DB is ready)
    const storedTeams = global.tempTeams || [];
    
    if (!isDBConfigured) {
      return NextResponse.json({ 
        teams: storedTeams,
        message: storedTeams.length === 0 ? 'No teams registered yet' : undefined
      });
    }

    // TODO: Real DB query when Prisma is ready
    return NextResponse.json({ teams: [] });
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
    const { teamName, contactName, contactEmail, contactPhone, participants } = body;

    // Validate required fields
    if (!teamName || !contactName || !contactEmail) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate participants (should be exactly 5)
    if (!participants || participants.length !== 5) {
      return NextResponse.json(
        { error: 'Team must have exactly 5 participants' },
        { status: 400 }
      );
    }

    // Auto-detect class based on participants (2026 rules)
    const participantsWithData = participants.filter((p: any) => p.firstName && p.lastName && p.birthDate);
    
    if (participantsWithData.length === 0) {
      return NextResponse.json(
        { error: 'Team needs at least one complete participant' },
        { status: 400 }
      );
    }

    const ages = participantsWithData.map((p: any) => 2026 - new Date(p.birthDate).getFullYear());
    const birthYears = participantsWithData.map((p: any) => new Date(p.birthDate).getFullYear());
    const totalAge = ages.reduce((sum: number, age: number) => sum + age, 0);
    const isMaleOnly = participantsWithData.every((p: any) => p.gender === "M");
    const isFemaleOnly = participantsWithData.every((p: any) => p.gender === "W");
    
    let autoCategory = "herren"; // default
    
    // Jahrgänge-basierte Klassen (Schüler/Jugend)
    if (birthYears.every(year => year >= 2016 && year <= 2018)) {
      autoCategory = "schueler-a";
    } else if (birthYears.every(year => year >= 2013 && year <= 2015)) {
      autoCategory = "schueler-b";
    } else if (birthYears.every(year => year >= 2009 && year <= 2012)) {
      autoCategory = "jugend";
    }
    // Altersklassen (Gesamtalter der Teams)
    else if (totalAge <= 125) {
      autoCategory = "jungsters";
    } else if (totalAge >= 226) {
      autoCategory = "masters";
    } else if (isFemaleOnly && totalAge <= 150) {
      autoCategory = "damen-a";
    } else if (isFemaleOnly && totalAge > 150) {
      autoCategory = "damen-b";
    } else if (isMaleOnly) {
      autoCategory = "herren";
    }
    // Fallback für Mixed (eigentlich nicht mehr erlaubt)
    else {
      autoCategory = "herren"; // Default wenn Gender gemischt
    }

    const newTeam = {
      id: `temp-${Date.now()}`,
      name: teamName,
      category: autoCategory,
      contactName,
      contactEmail,
      contactPhone: contactPhone || null,
      participants: participants.filter((p: any) => p.firstName && p.lastName),
      ownerId: session.user.email
    };

    // Store in global temp storage
    global.tempTeams = global.tempTeams || [];
    global.tempTeams.push(newTeam);

    if (!isDBConfigured) {
      return NextResponse.json({ 
        success: true,
        message: `Team "${teamName}" registered successfully! Klasse: ${autoCategory}`,
        team: newTeam
      });
    }

    // TODO: Real DB insert when Prisma is ready
    return NextResponse.json({ 
      success: true, 
      message: 'Team registered successfully!',
      team: { id: `temp-${Date.now()}`, name: teamName, category: autoCategory }
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Failed to register team' },
      { status: 500 }
    );
  }
}