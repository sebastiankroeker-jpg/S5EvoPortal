import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { COMPETITION_SCOPED_ROLES, requireCompetitionRoles } from "@/lib/server-permissions";

type TeamScope = {
  id: string;
  name: string;
  classificationCode: string | null;
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
  classificationCode: true,
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
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const url = new URL(request.url);
  const auth = await requireCompetitionRoles(session, ["ADMIN"], url.searchParams.get("competitionId"));
  if ("error" in auth) return auth.error;
  const scopedTenantId = auth.tenantId;
  const scopedCompetitionId = auth.competitionId;
  const teamCompetitionScope = {
    tenantId: scopedTenantId,
    ...(scopedCompetitionId ? { id: scopedCompetitionId } : {}),
  };

  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      OR: [
        { tenantRoles: { some: { tenantId: scopedTenantId } } },
        { competitionRoles: { some: { competitionId: scopedCompetitionId } } },
        {
          ownedTeams: {
            some: {
              deletedAt: null,
              competition: teamCompetitionScope,
            },
          },
        },
        {
          chiefOfTeams: {
            some: {
              deletedAt: null,
              competition: teamCompetitionScope,
            },
          },
        },
        {
          linkedParticipants: {
            some: {
              deletedAt: null,
              team: {
                deletedAt: null,
                competition: teamCompetitionScope,
              },
            },
          },
        },
        {
          teamMemberRoles: {
            some: {
              revokedAt: null,
              team: {
                deletedAt: null,
                competition: teamCompetitionScope,
              },
            },
          },
        },
        {
          tenantRoles: { none: {} },
          ownedTeams: { none: {} },
          chiefOfTeams: { none: {} },
          linkedParticipants: { none: {} },
          teamMemberRoles: { none: {} },
        },
      ],
    },
    include: {
      tenantRoles: {
        where: { tenantId: scopedTenantId },
        include: { tenant: { select: { name: true } } },
      },
      competitionRoles: {
        where: { competitionId: scopedCompetitionId },
        include: {
          competition: {
            select: {
              id: true,
              tenantId: true,
              tenant: { select: { name: true } },
            },
          },
        },
      },
      ownedTeams: {
        where: {
          deletedAt: null,
          competition: {
            tenantId: scopedTenantId,
            ...(scopedCompetitionId ? { id: scopedCompetitionId } : {}),
          },
        },
        select: teamScopeSelect,
      },
      chiefOfTeams: {
        where: {
          deletedAt: null,
          competition: {
            tenantId: scopedTenantId,
            ...(scopedCompetitionId ? { id: scopedCompetitionId } : {}),
          },
        },
        select: teamScopeSelect,
      },
      linkedParticipants: {
        where: {
          deletedAt: null,
          team: {
            deletedAt: null,
            competition: {
              tenantId: scopedTenantId,
              ...(scopedCompetitionId ? { id: scopedCompetitionId } : {}),
            },
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
          team: {
            deletedAt: null,
            competition: {
              tenantId: scopedTenantId,
              ...(scopedCompetitionId ? { id: scopedCompetitionId } : {}),
            },
          },
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
    tenantId: scopedTenantId,
    competitionId: scopedCompetitionId,
    adminCount,
    users: users.map((u) => {
      const teamScopes = new Map<string, TeamScope>();

      const upsertTeamScope = (
        team: {
          id: string;
          name: string;
          classificationCode: string | null;
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
          classificationCode: team.classificationCode,
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
        upsertTeamScope(team, "Owner", { isOwner: true, isTeamManager: team.registrationMode !== "MARKETPLACE" });
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

      const visibleTenantRoles = u.tenantRoles.filter(
        (tenantRole) =>
          !COMPETITION_SCOPED_ROLES.includes(
            tenantRole.role as (typeof COMPETITION_SCOPED_ROLES)[number],
          ) && (tenantRole.role !== "TEAMCHEF" || teamScopes.size > 0),
      );
      const rolesByName = new Map<string, {
        id: string;
        role: string;
        tenantId: string;
        tenantName: string;
        competitionId: string | null;
        scope: "TENANT" | "COMPETITION";
      }>();

      for (const tenantRole of visibleTenantRoles) {
        rolesByName.set(tenantRole.role, {
          id: tenantRole.id,
          role: tenantRole.role,
          tenantId: tenantRole.tenantId,
          tenantName: tenantRole.tenant.name,
          competitionId: null,
          scope: "TENANT",
        });
      }

      for (const competitionRole of u.competitionRoles) {
        rolesByName.set(competitionRole.role, {
          id: competitionRole.id,
          role: competitionRole.role,
          tenantId: competitionRole.competition.tenantId,
          tenantName: competitionRole.competition.tenant.name,
          competitionId: competitionRole.competition.id,
          scope: "COMPETITION",
        });
      }
      const visibleRoles = [...rolesByName.values()];

      return {
        id: u.id,
        email: u.email,
        name: u.name,
        authentikSub: u.authentikSub,
        lastSeenAt: u.lastSeenAt,
        createdAt: u.createdAt,
        roles: visibleRoles,
        teamCount: teamScopes.size,
        accountScope: visibleRoles.length > 0 || teamScopes.size > 0 ? "TENANT_SCOPED" : "UNSCOPED_PORTAL",
        teamScopes: Array.from(teamScopes.values()),
      };
    }),
  });
}
