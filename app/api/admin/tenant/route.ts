import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

// GET aktueller Tenant
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      // Hole ersten/aktuellen Tenant
      const tenant = await prisma.tenant.findFirst({
        orderBy: { createdAt: 'asc' }
      });

      if (!tenant) {
        return NextResponse.json({ error: 'No tenant found' }, { status: 404 });
      }

      return NextResponse.json({ tenant });
    } catch (dbError) {
      console.error('Database error on GET tenant:', dbError);
      return NextResponse.json({ error: 'Database temporarily unavailable' }, { status: 503 });
    }
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'API temporarily unavailable' }, { status: 503 });
  }
}

// PUT Tenant aktualisieren
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Basic validation
    if (!body.name || !body.slug) {
      return NextResponse.json({ 
        error: 'Name and slug are required' 
      }, { status: 400 });
    }

    try {
      // Hole ersten/aktuellen Tenant
      let tenant = await prisma.tenant.findFirst({
        orderBy: { createdAt: 'asc' }
      });

      if (!tenant) {
        // Erstelle neuen Tenant wenn keiner existiert
        tenant = await prisma.tenant.create({
          data: {
            name: body.name,
            slug: body.slug,
            primaryColor: body.primaryColor || "#dc2626",
            logoUrl: body.logoUrl || null,
            heroImageUrl: body.heroImageUrl || null,
            contactEmail: body.contactEmail || null,
            website: body.website || null,
            privacyText: body.privacyText || null,
            defaultTheme: body.defaultTheme || "DARK"
          }
        });
      } else {
        // Update existierenden Tenant
        tenant = await prisma.tenant.update({
          where: { id: tenant.id },
          data: {
            name: body.name,
            slug: body.slug,
            primaryColor: body.primaryColor || tenant.primaryColor,
            logoUrl: body.logoUrl,
            heroImageUrl: body.heroImageUrl,
            contactEmail: body.contactEmail,
            website: body.website,
            privacyText: body.privacyText,
            defaultTheme: body.defaultTheme || tenant.defaultTheme
          }
        });
      }

      return NextResponse.json({ 
        success: true,
        message: `Tenant "${tenant.name}" erfolgreich gespeichert.`,
        tenant 
      });

    } catch (dbError) {
      console.error('Database error on PUT tenant:', dbError);
      return NextResponse.json(
        { error: 'Datenbankfehler beim Speichern. Bitte versuche es erneut.' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Failed to update tenant' }, { status: 500 });
  }
}