import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { requireTenantRoles } from "@/lib/server-permissions";

type MailEventStatus = "sent" | "skipped" | "failed" | "generated" | "unknown";
type MailEventSource = "team_lifecycle" | "participant_claim" | "participant_change";

type MailEvent = {
  id: string;
  createdAt: string;
  source: MailEventSource;
  title: string;
  status: MailEventStatus;
  recipients: string[];
  subject: string | null;
  teamName: string | null;
  actor: string | null;
  detail: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function stringArrayValue(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function normalizeStatus(value: string | null): MailEventStatus {
  if (value === "sent" || value === "skipped" || value === "failed" || value === "generated") return value;
  return "unknown";
}

function matchesSearch(event: MailEvent, search: string) {
  if (!search) return true;
  const haystack = [
    event.title,
    event.status,
    event.subject,
    event.teamName,
    event.actor,
    event.detail,
    ...event.recipients,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(search);
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const auth = await requireTenantRoles(session, ["ADMIN"]);
  if ("error" in auth) return auth.error;

  const params = request.nextUrl.searchParams;
  const competitionId = params.get("competitionId") || undefined;
  const statusFilter = params.get("status") || "all";
  const sourceFilter = params.get("source") || "all";
  const search = (params.get("search") || "").trim().toLowerCase();
  const limitParam = Number(params.get("limit") || 80);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 10), 200) : 80;

  const teams = await prisma.team.findMany({
    where: {
      competition: {
        tenantId: auth.tenantId,
        ...(competitionId ? { id: competitionId } : {}),
      },
    },
    select: {
      id: true,
      name: true,
    },
  });
  const teamIds = teams.map((team) => team.id);
  const teamNameById = new Map(teams.map((team) => [team.id, team.name]));

  if (teamIds.length === 0) {
    return NextResponse.json({ events: [], summary: { total: 0, sent: 0, generated: 0, issues: 0 } });
  }

  const [lifecycleEvents, participantChangeEvents, participantClaimEvents] = await Promise.all([
    sourceFilter !== "all" && sourceFilter !== "team_lifecycle"
      ? Promise.resolve([])
      : prisma.auditEvent.findMany({
          where: {
            tenantId: auth.tenantId,
            ...(competitionId ? { competitionId } : {}),
            action: "TEAM_LIFECYCLE_MAIL",
            scopeType: "TEAM",
            scopeId: { in: teamIds },
          },
          orderBy: { createdAt: "desc" },
          take: limit,
          select: {
            id: true,
            createdAt: true,
            scopeId: true,
            reason: true,
            afterData: true,
            meta: true,
            actor: { select: { name: true, email: true } },
          },
        }),
    sourceFilter !== "all" && sourceFilter !== "participant_change"
      ? Promise.resolve([])
      : prisma.auditEvent.findMany({
          where: {
            tenantId: auth.tenantId,
            ...(competitionId ? { competitionId } : {}),
            action: "PARTICIPANT_CHANGE_MAIL",
            scopeType: "TEAM",
            scopeId: { in: teamIds },
          },
          orderBy: { createdAt: "desc" },
          take: limit,
          select: {
            id: true,
            createdAt: true,
            scopeId: true,
            reason: true,
            afterData: true,
            meta: true,
            actor: { select: { name: true, email: true } },
          },
        }),
    sourceFilter !== "all" && sourceFilter !== "participant_claim"
      ? Promise.resolve([])
      : prisma.participantClaimAuditEvent.findMany({
          where: {
            teamId: { in: teamIds },
            eventType: "CLAIM_CREATE",
            outcome: "SUCCESS",
          },
          orderBy: { createdAt: "desc" },
          take: limit,
        }),
  ]);

  const tokenIds = participantClaimEvents.map((event) => event.tokenId).filter((id): id is string => Boolean(id));
  const participantTokens = tokenIds.length
    ? await prisma.participantClaimToken.findMany({
        where: { id: { in: tokenIds } },
        select: {
          id: true,
          suggestedEmail: true,
          suggestedName: true,
          participant: {
            select: {
              firstName: true,
              lastName: true,
              team: { select: { name: true } },
            },
          },
        },
      })
    : [];
  const participantTokenById = new Map(participantTokens.map((token) => [token.id, token]));

  const events: MailEvent[] = [
    ...lifecycleEvents.map((event) => {
      const afterData = asRecord(event.afterData);
      const meta = asRecord(event.meta);
      const status = normalizeStatus(stringValue(afterData, "mailStatus"));
      const lifecycleAction = stringValue(meta, "lifecycleAction");
      const actor = event.actor?.name || event.actor?.email || null;

      return {
        id: `lifecycle:${event.id}`,
        createdAt: event.createdAt.toISOString(),
        source: "team_lifecycle" as const,
        title: lifecycleAction === "restored" ? "Restore-Mail" : "Archiv-Mail",
        status,
        recipients: stringArrayValue(afterData, "recipients"),
        subject: stringValue(afterData, "subject"),
        teamName: stringValue(meta, "teamName") || teamNameById.get(event.scopeId) || null,
        actor,
        detail: stringValue(afterData, "error") || stringValue(afterData, "reason") || event.reason,
      };
    }),
    ...participantChangeEvents.map((event) => {
      const afterData = asRecord(event.afterData);
      const meta = asRecord(event.meta);
      const status = normalizeStatus(stringValue(afterData, "mailStatus"));
      const template = stringValue(afterData, "template");
      const actor = event.actor?.name || event.actor?.email || null;
      const context = stringValue(meta, "context");
      const participantName = stringValue(meta, "participantName");
      const titlePrefix =
        template === "participant-direct-change"
          ? "Teilnehmer-Direktänderung"
          : template === "participant-change-decision"
            ? "Review-Entscheidung"
            : template === "participant-claim-invitation"
              ? "Teilnehmer-Einladung"
              : "Teilnehmer-Änderung";

      return {
        id: `participant-change:${event.id}`,
        createdAt: event.createdAt.toISOString(),
        source: "participant_change" as const,
        title: context === "MARKETPLACE" ? `${titlePrefix} Sportler-Börse` : titlePrefix,
        status,
        recipients: stringArrayValue(afterData, "recipients"),
        subject: null,
        teamName: stringValue(meta, "teamName") || teamNameById.get(event.scopeId) || null,
        actor,
        detail: [
          participantName ? `Teilnehmer: ${participantName}` : null,
          stringValue(afterData, "reason") || event.reason,
        ].filter(Boolean).join(" · ") || null,
      };
    }),
    ...participantClaimEvents.map((event) => {
      const token = event.tokenId ? participantTokenById.get(event.tokenId) : null;
      const participantName = token?.suggestedName ||
        [token?.participant.firstName, token?.participant.lastName].filter(Boolean).join(" ") ||
        null;

      return {
        id: `participant-claim:${event.id}`,
        createdAt: event.createdAt.toISOString(),
        source: "participant_claim" as const,
        title: "Teilnehmer-Einladung",
        status: "generated" as const,
        recipients: token?.suggestedEmail ? [token.suggestedEmail] : [],
        subject: null,
        teamName: token?.participant.team.name || (event.teamId ? teamNameById.get(event.teamId) : null) || null,
        actor: event.sessionEmail || null,
        detail: participantName
          ? `Einladungslink erzeugt fuer ${participantName}. Versandstatus wurde historisch nicht separat gespeichert.`
          : "Einladungslink erzeugt. Versandstatus wurde historisch nicht separat gespeichert.",
      };
    }),
  ]
    .filter((event) => statusFilter === "all" || event.status === statusFilter)
    .filter((event) => matchesSearch(event, search))
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, limit);

  const summary = {
    total: events.length,
    sent: events.filter((event) => event.status === "sent").length,
    generated: events.filter((event) => event.status === "generated").length,
    issues: events.filter((event) => event.status === "failed" || event.status === "skipped").length,
  };

  return NextResponse.json({ events, summary });
}
