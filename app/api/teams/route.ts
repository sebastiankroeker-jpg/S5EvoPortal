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

    // Auto-detect class based on participants
    const ages = participants.map((p: any) => {
      if (p.birthDate) {
        return new Date().getFullYear() - new Date(p.birthDate).getFullYear();
      }
      return 25; // default
    });
    
    const avgAge = ages.reduce((a: number, b: number) => a + b, 0) / ages.length;
    const autoCategory = avgAge <= 16 ? "jugend" : 
                        avgAge >= 50 ? "senioren" :
                        participants.every((p: any) => p.gender === "M") ? "herren" :
                        participants.every((p: any) => p.gender === "W") ? "damen" : "mixed";

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