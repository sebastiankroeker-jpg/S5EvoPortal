import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { parseDateInputEndOfDay } from '@/lib/domain/shirts';
import { requireTenantRoles } from '@/lib/server-permissions';
import { normalizeCompetitionTeamAccessConfig } from '@/lib/team-access-config';
import { normalizeMarketplaceGlobalVisibility } from '@/lib/marketplace-visibility';

function normalizeNotificationEmails(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = [...new Set(
    value
      .split(/[;,]/)
      .map((recipient) => recipient.trim())
      .filter(Boolean),
  )].join(', ');

  return normalized || null;
}

function normalizeClaimTokenExpiryMode(value: unknown) {
  const validModes = ["FIXED_DAYS", "REGISTRATION_DEADLINE", "COMPETITION_END"] as const;
  return validModes.includes(value as (typeof validModes)[number])
    ? (value as (typeof validModes)[number])
    : "COMPETITION_END";
}

function normalizeClaimTokenTtlDays(value: unknown) {
  const parsed = typeof value === "number" ? value : parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 7;
  }

  return Math.min(Math.max(Math.floor(parsed), 1), 60);
}

// GET aktuelle Competition
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const auth = await requireTenantRoles(session, ['ADMIN']);
    if ('error' in auth) return auth.error;

    try {
      // If ?id= is provided, load that specific competition (admin switcher)
      const competitionId = request.nextUrl.searchParams.get('id');
      
      const competition = competitionId
        ? await prisma.competition.findFirst({ where: { id: competitionId, tenantId: auth.tenantId } })
        : await prisma.competition.findFirst({ where: { tenantId: auth.tenantId }, orderBy: { year: 'desc' } });

      if (!competition) {
        return NextResponse.json({ error: 'No competition found' }, { status: 404 });
      }

      return NextResponse.json({
        competition: {
          ...competition,
          ...normalizeCompetitionTeamAccessConfig(competition),
        },
      });
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
    const auth = await requireTenantRoles(session, ['ADMIN']);
    if ('error' in auth) return auth.error;

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

    const claimTokenExpiryMode = normalizeClaimTokenExpiryMode(body.claimTokenExpiryMode);
    const claimTokenTtlDays = normalizeClaimTokenTtlDays(body.claimTokenTtlDays);
    const marketplaceGlobalVisibility = normalizeMarketplaceGlobalVisibility(body.marketplaceGlobalVisibility);

    try {
      // Load specific competition by id, or fall back to latest
      let competition = body.id
        ? await prisma.competition.findFirst({ where: { id: body.id, tenantId: auth.tenantId } })
        : await prisma.competition.findFirst({ where: { tenantId: auth.tenantId }, orderBy: { year: 'desc' } });

      if (!competition) {
        // Erstelle neue Competition wenn keine existiert
        competition = await prisma.competition.create({
          data: {
            name: body.name,
            year: parseInt(body.year) || 2026,
            date: body.date ? new Date(body.date) : null,
            dateEnd: body.dateEnd ? new Date(body.dateEnd) : null,
            registrationDeadline: body.registrationDeadline ? new Date(body.registrationDeadline) : null,
            claimTokenExpiryMode,
            claimTokenTtlDays,
            teamOwnerFilterVisibleForTeamchef: Boolean(body.teamOwnerFilterVisibleForTeamchef),
            participantsCanViewAllTeams: Boolean(body.participantsCanViewAllTeams),
            spectatorsCanViewAllTeams: Boolean(body.spectatorsCanViewAllTeams),
            hideForeignTeams: Boolean(body.hideForeignTeams),
            marketplaceGlobalVisibility,
            registrationNotificationEmail: normalizeNotificationEmails(body.registrationNotificationEmail),
            shirtOrderDeadline: parseDateInputEndOfDay(body.shirtOrderDeadline),
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
            tenantId: auth.tenantId
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
            claimTokenExpiryMode,
            claimTokenTtlDays,
            teamOwnerFilterVisibleForTeamchef: body.teamOwnerFilterVisibleForTeamchef !== undefined
              ? Boolean(body.teamOwnerFilterVisibleForTeamchef)
              : competition.teamOwnerFilterVisibleForTeamchef,
            participantsCanViewAllTeams: body.participantsCanViewAllTeams !== undefined
              ? Boolean(body.participantsCanViewAllTeams)
              : competition.participantsCanViewAllTeams,
            spectatorsCanViewAllTeams: body.spectatorsCanViewAllTeams !== undefined
              ? Boolean(body.spectatorsCanViewAllTeams)
              : competition.spectatorsCanViewAllTeams,
            hideForeignTeams: body.hideForeignTeams !== undefined
              ? Boolean(body.hideForeignTeams)
              : competition.hideForeignTeams,
            marketplaceGlobalVisibility: body.marketplaceGlobalVisibility !== undefined
              ? marketplaceGlobalVisibility
              : competition.marketplaceGlobalVisibility,
            registrationNotificationEmail: body.registrationNotificationEmail !== undefined
              ? normalizeNotificationEmails(body.registrationNotificationEmail)
              : competition.registrationNotificationEmail,
            shirtOrderDeadline: body.shirtOrderDeadline !== undefined
              ? parseDateInputEndOfDay(body.shirtOrderDeadline)
              : competition.shirtOrderDeadline,
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
