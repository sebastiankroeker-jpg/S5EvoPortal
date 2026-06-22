import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { requireTenantRoles } from "@/lib/server-permissions";

type TeamScope = {
  id: string;
  name: string;
  registrationMode: string;
  marketplaceStatus: string | null;
  contactEmail: string | null;
  participantCount: number;
  relations: string[];
  isOwner: boolean;
  isLegacyTeamChief: boolean;
  isParticipant: boolean;
  isTeamManager: boolean;
  ownerClaim: {
    suggestedEmail: string;
    suggestedName: string | null;
    sentAt: Date;
    expiresAt: Date;
    claimedAt: Date | null;
    revokedAt: Date | null;
  } | null;
  participantLink: {
    participantId: string;
    email: string | null;
    linkedUserId: string | null;
    claim: {
      sentAt: Date;
      expiresAt: Date;
      claimedAt: Date | null;
      revokedAt: Date | null;
    } | null;
  } | null;
};

const teamScopeSelect = {
  id: true,
  name: true,
  registrationMode: true,
  marketplaceStatus: true,
  contactEmail: true,
  ownerId: true,
  teamChiefId: true,
  owner: { select: { authentikSub: true } },
  _count: { select: { participants: { where: { deletedAt: null } } } },
  registrationClaimTokens: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: {
      suggestedEmail: true,
      suggestedName: true,
      createdAt: true,
      expiresAt: true,
      claimedAt: true,
      revokedAt: true,
    },
  },
};

// GET /api/admin/users — Alle User mit Rollen laden
export async function GET() {
  const session = await getServerSession(authOptions);
  const auth = await requireTenantRoles(session, ["ADMIN"]);
  if ("error" in auth) return auth.error;

  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      tenantRoles: {
        some: { tenantId: auth.tenantId },
      },
    },
    include: {
      tenantRoles: {
        where: { tenantId: auth.tenantId },
        include: { tenant: { select: { name: true } } },
      },
      ownedTeams: {
        where: { deletedAt: null, competition: { tenantId: auth.tenantId } },
        select: teamScopeSelect,
      },
      chiefOfTeams: {
        where: { deletedAt: null, competition: { tenantId: auth.tenantId } },
        select: teamScopeSelect,
      },
      linkedParticipants: {
        where: {
          deletedAt: null,
          team: {
            deletedAt: null,
            competition: { tenantId: auth.tenantId },
          },
        },
        select: {
          id: true,
          email: true,
          userId: true,
          claimTokens: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              createdAt: true,
              expiresAt: true,
              claimedAt: true,
              revokedAt: true,
            },
          },
          team: { select: teamScopeSelect },
        },
      },
      teamMemberRoles: {
        where: {
          role: "TEAM_MANAGER",
          revokedAt: null,
          team: { deletedAt: null },
        },
        select: {
          id: true,
          role: true,
          team: { select: teamScopeSelect },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const adminCount = users.filter((user) => user.tenantRoles.some((role) => role.role === "ADMIN")).length;

  return NextResponse.json({
    currentUserId: auth.user.id,
    tenantId: auth.tenantId,
    adminCount,
    users: users.map((u) => {
      const teamScopes = new Map<string, TeamScope>();

      const upsertTeamScope = (
        team: {
          id: string;
          name: string;
          registrationMode: string;
          marketplaceStatus: string | null;
          contactEmail: string | null;
          ownerId?: string | null;
          teamChiefId?: string | null;
          owner?: { authentikSub: string | null } | null;
          _count?: { participants: number };
          registrationClaimTokens?: Array<{
            suggestedEmail: string;
            suggestedName: string | null;
            createdAt: Date;
            expiresAt: Date;
            claimedAt: Date | null;
            revokedAt: Date | null;
          }>;
        },
        relation: string,
        flags: Partial<Omit<TeamScope, "id" | "name" | "registrationMode" | "marketplaceStatus" | "contactEmail" | "participantCount" | "relations" | "ownerClaim">>,
      ) => {
        const latestOwnerClaim = team.registrationClaimTokens?.[0] ?? null;
        const existing = teamScopes.get(team.id) ?? {
          id: team.id,
          name: team.name,
          registrationMode: team.registrationMode,
          marketplaceStatus: team.marketplaceStatus,
          contactEmail: team.contactEmail,
          participantCount: team._count?.participants ?? 0,
          relations: [],
          isOwner: false,
          isLegacyTeamChief: false,
          isParticipant: false,
          isTeamManager: false,
          ownerClaim: latestOwnerClaim
            ? {
                suggestedEmail: latestOwnerClaim.suggestedEmail,
                suggestedName: latestOwnerClaim.suggestedName,
                sentAt: latestOwnerClaim.createdAt,
                expiresAt: latestOwnerClaim.expiresAt,
                claimedAt: latestOwnerClaim.claimedAt,
                revokedAt: latestOwnerClaim.revokedAt,
              }
            : null,
          participantLink: null,
        };
        if (!existing.relations.includes(relation)) {
          existing.relations.push(relation);
        }
        teamScopes.set(team.id, { ...existing, ...flags });
      };

      for (const team of u.ownedTeams) {
        upsertTeamScope(team, "Owner", { isOwner: true, isTeamManager: true });
      }
      for (const team of u.chiefOfTeams) {
        upsertTeamScope(team, "Teamchef:in", { isLegacyTeamChief: true, isTeamManager: true });
      }
      for (const participant of u.linkedParticipants) {
        const latestClaim = participant.claimTokens[0] ?? null;
        upsertTeamScope(participant.team, "Teilnehmer:in", {
          isParticipant: true,
          participantLink: {
            participantId: participant.id,
            email: participant.email,
            linkedUserId: participant.userId,
            claim: latestClaim
              ? {
                  sentAt: latestClaim.createdAt,
                  expiresAt: latestClaim.expiresAt,
                  claimedAt: latestClaim.claimedAt,
                  revokedAt: latestClaim.revokedAt,
                }
              : null,
          },
        });
      }
      for (const memberRole of u.teamMemberRoles) {
        upsertTeamScope(memberRole.team, "Team Manager:in", { isTeamManager: true });
      }

      const visibleRoles = u.tenantRoles.filter((tenantRole) => tenantRole.role !== "TEAMCHEF" || teamScopes.size > 0);

      return {
        id: u.id,
        email: u.email,
        name: u.name,
        authentikSub: u.authentikSub,
        createdAt: u.createdAt,
        roles: visibleRoles.map((tr) => ({
          id: tr.id,
          role: tr.role,
          tenantId: tr.tenantId,
          tenantName: tr.tenant.name,
        })),
        teamCount: teamScopes.size,
        teamScopes: Array.from(teamScopes.values()),
      };
    }),
  });
}
