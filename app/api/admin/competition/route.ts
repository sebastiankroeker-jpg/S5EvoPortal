import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

// GET aktuelle Competition
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      // If ?id= is provided, load that specific competition (admin switcher)
      const competitionId = request.nextUrl.searchParams.get('id');
      
      const competition = competitionId
        ? await prisma.competition.findUnique({ where: { id: competitionId } })
        : await prisma.competition.findFirst({ orderBy: { year: 'desc' } });

      if (!competition) {
        return NextResponse.json({ error: 'No competition found' }, { status: 404 });
      }

      return NextResponse.json({ competition });
    } catch (dbError) {
      console.error('Database error on GET competition:', dbError);
      return NextResponse.json({ error: 'Database temporarily unavailable' }, { status: 503 });
    }
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'API temporarily unavailable' }, { status: 503 });
  }
}

// PUT Competition aktualisieren
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Basic validation
    if (!body.name || !body.year) {
      return NextResponse.json({ 
        error: 'Name and year are required' 
      }, { status: 400 });
    }

    // Validate status
    const validStatuses = ["DRAFT", "OPEN", "RUNNING", "CLOSED"];
    if (body.status && !validStatuses.includes(body.status)) {
      return NextResponse.json({ 
        error: 'Invalid status. Must be one of: ' + validStatuses.join(', ') 
      }, { status: 400 });
    }

    // Validate benchPressMode
    const validBenchModes = ["GROSS", "NETTO"];
    if (body.benchPressMode && !validBenchModes.includes(body.benchPressMode)) {
      return NextResponse.json({ 
        error: 'Invalid benchPressMode. Must be one of: ' + validBenchModes.join(', ') 
      }, { status: 400 });
    }

    try {
      // Load specific competition by id, or fall back to latest
      let competition = body.id
        ? await prisma.competition.findUnique({ where: { id: body.id } })
        : await prisma.competition.findFirst({ orderBy: { year: 'desc' } });

      // Für Competition brauchen wir einen Tenant
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

      if (!competition) {
        // Erstelle neue Competition wenn keine existiert
        competition = await prisma.competition.create({
          data: {
            name: body.name,
            year: parseInt(body.year) || 2026,
            date: body.date ? new Date(body.date) : null,
            dateEnd: body.dateEnd ? new Date(body.dateEnd) : null,
            registrationDeadline: body.registrationDeadline ? new Date(body.registrationDeadline) : null,
            status: body.status || "DRAFT",
            maxTeams: parseInt(body.maxTeams) || null,
            teamSize: parseInt(body.teamSize) || 5,
            ageReferenceDate: body.ageReferenceDate ? new Date(body.ageReferenceDate) : null,
            benchPressTara: parseFloat(body.benchPressTara) || 20.0,
            benchPressMode: body.benchPressMode || "GROSS",
            stockShotsCount: parseInt(body.stockShotsCount) || 11,
            stockStrikeoutCount: parseInt(body.stockStrikeoutCount) || 1,
            location: body.location || null,
            publicResults: Boolean(body.publicResults),
            tenantId: tenant.id
          }
        });
      } else {
        // Update existierende Competition
        competition = await prisma.competition.update({
          where: { id: competition.id },
          data: {
            name: body.name,
            year: parseInt(body.year) || competition.year,
            date: body.date ? new Date(body.date) : competition.date,
            dateEnd: body.dateEnd !== undefined ? (body.dateEnd ? new Date(body.dateEnd) : null) : competition.dateEnd,
            registrationDeadline: body.registrationDeadline ? new Date(body.registrationDeadline) : competition.registrationDeadline,
            status: body.status || competition.status,
            maxTeams: body.maxTeams !== undefined ? parseInt(body.maxTeams) || null : competition.maxTeams,
            teamSize: body.teamSize !== undefined ? parseInt(body.teamSize) || 5 : competition.teamSize,
            ageReferenceDate: body.ageReferenceDate ? new Date(body.ageReferenceDate) : competition.ageReferenceDate,
            benchPressTara: body.benchPressTara !== undefined ? parseFloat(body.benchPressTara) || 20.0 : competition.benchPressTara,
            benchPressMode: body.benchPressMode || competition.benchPressMode,
            stockShotsCount: body.stockShotsCount !== undefined ? parseInt(body.stockShotsCount) || 11 : competition.stockShotsCount,
            stockStrikeoutCount: body.stockStrikeoutCount !== undefined ? parseInt(body.stockStrikeoutCount) || 1 : competition.stockStrikeoutCount,
            location: body.location !== undefined ? body.location : competition.location,
            publicResults: body.publicResults !== undefined ? Boolean(body.publicResults) : competition.publicResults,
          }
        });
      }

      return NextResponse.json({ 
        success: true,
        message: `Wettkampf "${competition.name}" erfolgreich gespeichert.`,
        competition 
      });

    } catch (dbError) {
      console.error('Database error on PUT competition:', dbError);
      return NextResponse.json(
        { error: 'Datenbankfehler beim Speichern. Bitte versuche es erneut.' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Failed to update competition' }, { status: 500 });
  }
}