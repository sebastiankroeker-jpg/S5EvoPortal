import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { requireTenantRoles } from '@/lib/server-permissions';

// GET aktueller Tenant
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const auth = await requireTenantRoles(session, ['ADMIN']);
    if ('error' in auth) return auth.error;

    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: auth.tenantId },
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
    const auth = await requireTenantRoles(session, ['ADMIN']);
    if ('error' in auth) return auth.error;

    const body = await request.json();

    // Basic validation
    if (!body.name || !body.slug) {
      return NextResponse.json({ 
        error: 'Name and slug are required' 
      }, { status: 400 });
    }

    try {
      const existingTenant = await prisma.tenant.findUnique({
        where: { id: auth.tenantId },
      });

      if (!existingTenant) {
        return NextResponse.json({ error: 'Tenant nicht gefunden' }, { status: 404 });
      }

      const tenant = await prisma.tenant.update({
        where: { id: existingTenant.id },
        data: {
          name: body.name,
          slug: body.slug,
          primaryColor: body.primaryColor || existingTenant.primaryColor,
          logoUrl: body.logoUrl,
          heroImageUrl: body.heroImageUrl,
          contactEmail: body.contactEmail,
          website: body.website,
          privacyText: body.privacyText,
          defaultTheme: body.defaultTheme || existingTenant.defaultTheme
        }
      });

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
