import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { hashRegistrationClaimToken } from "@/lib/registration-claim";

function isExpired(expiresAt: Date) {
  return expiresAt.getTime() < Date.now();
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const session = await getServerSession(authOptions);
  const { token } = await params;
  const tokenHash = hashRegistrationClaimToken(token);

  const claim = await prisma.registrationClaimToken.findUnique({
    where: { tokenHash },
    include: {
      team: {
        select: {
          id: true,
          name: true,
          contactEmail: true,
          competition: { select: { name: true, year: true } },
        },
      },
      claimedByUser: { select: { id: true, email: true, name: true } },
    },
  });

  if (!claim || claim.revokedAt) {
    return NextResponse.json({ error: "Link nicht gefunden oder widerrufen" }, { status: 404 });
  }

  if (isExpired(claim.expiresAt)) {
    return NextResponse.json({ error: "Link ist abgelaufen" }, { status: 410 });
  }

  const sessionEmail = session?.user?.email || null;
  const emailMatches = !!sessionEmail && sessionEmail === claim.suggestedEmail;
  const alreadyClaimedBySessionUser = !!sessionEmail && claim.claimedByUser?.email === sessionEmail;

  return NextResponse.json({
    claim: {
      teamId: claim.team.id,
      teamName: claim.team.name,
      competitionName: claim.team.competition.name,
      competitionYear: claim.team.competition.year,
      suggestedEmail: claim.suggestedEmail,
      suggestedName: claim.suggestedName,
      claimedAt: claim.claimedAt,
      claimedBy: claim.claimedByUser,
      expiresAt: claim.expiresAt,
    },
    session: {
      authenticated: !!sessionEmail,
      email: sessionEmail,
      name: session?.user?.name || null,
    },
    state: {
      emailMatches,
      alreadyClaimedBySessionUser,
      requiresLogin: !sessionEmail,
      alreadyClaimedByOtherUser: !!claim.claimedByUser && claim.claimedByUser.email !== sessionEmail,
    },
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const session = await getServerSession(authOptions);
  const sessionEmail = session?.user?.email;

  if (!sessionEmail) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { token } = await params;
  const tokenHash = hashRegistrationClaimToken(token);

  const claim = await prisma.registrationClaimToken.findUnique({
    where: { tokenHash },
    include: {
      team: {
        select: {
          id: true,
          contactEmail: true,
        },
      },
      claimedByUser: { select: { id: true, email: true } },
    },
  });

  if (!claim || claim.revokedAt) {
    return NextResponse.json({ error: "Link nicht gefunden oder widerrufen" }, { status: 404 });
  }

  if (isExpired(claim.expiresAt)) {
    return NextResponse.json({ error: "Link ist abgelaufen" }, { status: 410 });
  }

  if (claim.suggestedEmail !== sessionEmail) {
    return NextResponse.json({ error: "Dieser Link gehört zu einer anderen E-Mail-Adresse" }, { status: 403 });
  }

  let user = await prisma.user.findUnique({ where: { email: sessionEmail } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: sessionEmail,
        name: session.user?.name || claim.suggestedName || null,
        image: session.user?.image || null,
      },
    });
  }

  if (claim.claimedByUser && claim.claimedByUser.email !== sessionEmail) {
    return NextResponse.json({ error: "Link wurde bereits von einem anderen Account eingelöst" }, { status: 409 });
  }

  await prisma.$transaction([
    prisma.team.update({
      where: { id: claim.team.id },
      data: {
        ownerId: user.id,
        teamChiefId: user.id,
        contactEmail: sessionEmail,
        contactName: session.user?.name || claim.suggestedName || claim.team.contactEmail || "",
      },
    }),
    prisma.registrationClaimToken.update({
      where: { id: claim.id },
      data: {
        claimedAt: claim.claimedAt || new Date(),
        claimedByUserId: user.id,
      },
    }),
  ]);

  return NextResponse.json({ success: true, teamId: claim.team.id });
}
