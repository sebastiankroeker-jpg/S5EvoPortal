import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

// GET: Profildaten laden
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true, email: true, image: true, createdAt: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Profile GET error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// PUT: Profil aktualisieren (nur Name)
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name } = body;

    if (typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json({ error: 'Name muss mindestens 2 Zeichen lang sein' }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { email: session.user.email },
      data: { name: name.trim() },
      select: { id: true, name: true, email: true },
    });

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error('Profile PUT error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// DELETE: Konto löschen (Soft-Delete User + alle Teams + Participants)
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { ownedTeams: { select: { id: true } } },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const now = new Date();

    // Soft-delete all owned teams + their participants
    for (const team of user.ownedTeams) {
      await prisma.participant.updateMany({
        where: { teamId: team.id },
        data: { deletedAt: now },
      });
      await prisma.team.update({
        where: { id: team.id },
        data: { deletedAt: now },
      });
    }

    // Soft-delete user
    await prisma.user.update({
      where: { id: user.id },
      data: { deletedAt: now },
    });

    return NextResponse.json({ success: true, message: 'Konto und alle zugehörigen Daten wurden gelöscht' });
  } catch (error) {
    console.error('Profile DELETE error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
