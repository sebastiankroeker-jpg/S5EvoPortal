import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';

// Prisma Client - graceful fallback if not configured
let prisma: any = null;
try {
  const { PrismaClient } = require('@prisma/client');
  prisma = new PrismaClient();
} catch (error) {
  console.warn('Prisma not configured:', error);
}

export async function GET(request: NextRequest) {
  try {
    if (!prisma) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Database unavailable' },
      { status: 503 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!prisma) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

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
        name: teamName,
        category,
        contactName,
        contactEmail,
        contactPhone: contactPhone || null,
        ownerId: user.id,
        participants: {
          create: participants.map((p: any) => ({
            firstName: p.firstName,
            lastName: p.lastName,
            birthDate: new Date(p.birthDate),
            gender: p.gender,
            email: p.email || null,
            phone: p.phone || null
          }))
        }
      },
      include: {
        participants: true
      }
    });

    return NextResponse.json({ 
      success: true, 
      team,
      message: 'Team successfully registered!'
    });

  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to create team' },
      { status: 500 }
    );
  }
}