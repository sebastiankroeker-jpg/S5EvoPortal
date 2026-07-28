import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { parseDateInputEndOfDay } from '@/lib/domain/shirts';
import { requireCompetitionRoles } from '@/lib/server-permissions';
import { normalizeCompetitionTeamAccessConfig } from '@/lib/team-access-config';
import { normalizeMarketplaceGlobalVisibility } from '@/lib/marketplace-visibility';
import { normalizeLiveResultDisciplines } from '@/lib/live-results-disciplines';

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

function normalizeLivePublicationVisibility(value: unknown) {
  const validVisibilities = ["ADMINS", "PORTAL_USERS", "SPECTATORS"] as const;
  return validVisibilities.includes(value as (typeof validVisibilities)[number])
    ? (value as (typeof validVisibilities)[number])
    : "ADMINS";
}

function normalizePortalVisibility(value: unknown) {
  const values = ["PRIVATE", "PORTAL_USERS", "PUBLIC"] as const;
  return values.includes(value as (typeof values)[number]) ? value as (typeof values)[number] : "PRIVATE";
}

function normalizeRegistrationVisibility(value: unknown) {
  const values = ["CLOSED", "PORTAL_USERS", "PUBLIC"] as const;
  return values.includes(value as (typeof values)[number]) ? value as (typeof values)[number] : "CLOSED";
}

async function loadCompetition(competitionId: string) {
  const competition = await prisma.competition.findUnique({
    where: { id: competitionId },
    include: { tenant: { select: { publicPortalRegistrationEnabled: true } } },
  });

  if (!competition) {
    return { error: NextResponse.json({ error: 'No competition found' }, { status: 404 }) };
  }

  return { competition };
}

// GET aktuelle Competition
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    try {
      const competitionId = request.nextUrl.searchParams.get('id');
      const auth = await requireCompetitionRoles(session, ['ADMIN'], competitionId);
      if ('error' in auth) return auth.error;
      const scopedCompetition = await loadCompetition(auth.competitionId);
      if ('error' in scopedCompetition) return scopedCompetition.error;
      const competition = scopedCompetition.competition;

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
    const body = await request.json();
    const auth = await requireCompetitionRoles(session, ['ADMIN'], typeof body.id === 'string' ? body.id : null);
    if ('error' in auth) return auth.error;

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
    const liveTeamsVisibility = normalizeLivePublicationVisibility(body.liveTeamsVisibility);
    const liveStartlistsVisibility = normalizeLivePublicationVisibility(body.liveStartlistsVisibility);
    const liveResultsVisibility = normalizeLivePublicationVisibility(body.liveResultsVisibility);
    const liveResultsDisciplines = normalizeLiveResultDisciplines(body.liveResultsDisciplines);
    const portalVisibility = normalizePortalVisibility(body.portalVisibility);
    const registrationVisibility = normalizeRegistrationVisibility(body.registrationVisibility);

    try {
      const scopedCompetition = await loadCompetition(auth.competitionId);
      if ('error' in scopedCompetition) return scopedCompetition.error;
      const currentCompetition = scopedCompetition.competition;
      const competition = await prisma.competition.update({
        where: { id: currentCompetition.id },
        data: {
          name: body.name,
          year: parseInt(body.year) || currentCompetition.year,
          date: body.date ? new Date(body.date) : currentCompetition.date,
          dateEnd: body.dateEnd !== undefined ? (body.dateEnd ? new Date(body.dateEnd) : null) : currentCompetition.dateEnd,
          registrationDeadline: body.registrationDeadline ? new Date(body.registrationDeadline) : currentCompetition.registrationDeadline,
          claimTokenExpiryMode,
          claimTokenTtlDays,
          teamOwnerFilterVisibleForTeamchef: body.teamOwnerFilterVisibleForTeamchef !== undefined
            ? Boolean(body.teamOwnerFilterVisibleForTeamchef)
            : currentCompetition.teamOwnerFilterVisibleForTeamchef,
          participantsCanViewAllTeams: body.participantsCanViewAllTeams !== undefined
            ? Boolean(body.participantsCanViewAllTeams)
            : currentCompetition.participantsCanViewAllTeams,
          spectatorsCanViewAllTeams: body.spectatorsCanViewAllTeams !== undefined
            ? Boolean(body.spectatorsCanViewAllTeams)
            : currentCompetition.spectatorsCanViewAllTeams,
          hideForeignTeams: body.hideForeignTeams !== undefined
            ? Boolean(body.hideForeignTeams)
            : currentCompetition.hideForeignTeams,
          liveTeamsVisibility: body.liveTeamsVisibility !== undefined
            ? liveTeamsVisibility
            : currentCompetition.liveTeamsVisibility,
          liveStartlistsVisibility: body.liveStartlistsVisibility !== undefined
            ? liveStartlistsVisibility
            : currentCompetition.liveStartlistsVisibility,
          liveResultsVisibility: body.liveResultsVisibility !== undefined
            ? liveResultsVisibility
            : currentCompetition.liveResultsVisibility,
          liveResultsDisciplines: body.liveResultsDisciplines !== undefined
            ? liveResultsDisciplines
            : undefined,
          marketplaceGlobalVisibility: body.marketplaceGlobalVisibility !== undefined
            ? marketplaceGlobalVisibility
            : currentCompetition.marketplaceGlobalVisibility,
          registrationNotificationEmail: body.registrationNotificationEmail !== undefined
            ? normalizeNotificationEmails(body.registrationNotificationEmail)
            : currentCompetition.registrationNotificationEmail,
          shirtOrderDeadline: body.shirtOrderDeadline !== undefined
            ? parseDateInputEndOfDay(body.shirtOrderDeadline)
            : currentCompetition.shirtOrderDeadline,
          status: body.status || currentCompetition.status,
          portalVisibility: body.portalVisibility !== undefined
            ? portalVisibility
            : currentCompetition.portalVisibility,
          registrationVisibility: body.registrationVisibility !== undefined
            ? registrationVisibility
            : currentCompetition.registrationVisibility,
          maxTeams: body.maxTeams !== undefined ? parseInt(body.maxTeams) || null : currentCompetition.maxTeams,
          teamSize: body.teamSize !== undefined ? parseInt(body.teamSize) || 5 : currentCompetition.teamSize,
          ageReferenceDate: body.ageReferenceDate ? new Date(body.ageReferenceDate) : currentCompetition.ageReferenceDate,
          benchPressTara: body.benchPressTara !== undefined ? parseFloat(body.benchPressTara) || 20.0 : currentCompetition.benchPressTara,
          benchPressMode: body.benchPressMode || currentCompetition.benchPressMode,
          stockShotsCount: body.stockShotsCount !== undefined ? parseInt(body.stockShotsCount) || 11 : currentCompetition.stockShotsCount,
          stockStrikeoutCount: body.stockShotsCount !== undefined ? parseInt(body.stockStrikeoutCount) || 1 : currentCompetition.stockStrikeoutCount,
          location: body.location !== undefined ? body.location : currentCompetition.location,
          publicResults: body.publicResults !== undefined ? Boolean(body.publicResults) : currentCompetition.publicResults,
        },
      });

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
