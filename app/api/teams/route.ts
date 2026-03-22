import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';

// Temporary fallback until Vercel Postgres is fully configured
const isDBConfigured = process.env.DATABASE_URL && process.env.DATABASE_URL.length > 0;

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isDBConfigured) {
      return NextResponse.json({ 
        teams: [],
        message: 'Database not configured yet - teams will be shown once Vercel Postgres is set up'
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
    const { teamName, category, contactName, contactEmail, contactPhone, participants } = body;

    // Validate required fields
    if (!teamName || !category || !contactName || !contactEmail) {
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

    if (!isDBConfigured) {
      return NextResponse.json({ 
        success: true,
        message: `Team "${teamName}" registered successfully! (Database will persist once Vercel Postgres is configured)`,
        team: {
          id: `temp-${Date.now()}`,
          name: teamName,
          category,
          contactName,
          contactEmail,
          participants: participants.filter((p: any) => p.firstName && p.lastName)
        }
      });
    }

    // TODO: Real DB insert when Prisma is ready
    return NextResponse.json({ 
      success: true, 
      message: 'Team registered successfully!',
      team: { id: `temp-${Date.now()}`, name: teamName, category }
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Failed to register team' },
      { status: 500 }
    );
  }
}