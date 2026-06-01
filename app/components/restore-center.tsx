"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useCompetition } from "@/lib/competition-context";
import { useNotifications } from "@/lib/notification-context";

type DeletedTeam = {
  id: string;
  name: string;
  contactName?: string | null;
  contactEmail?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  owner: {
    id: string;
    name?: string | null;
    email: string;
    deletedAt?: string | null;
  };
  competition: {
    id: string;
    name: string;
    year: number;
  };
  participantCount: number;
  deletedParticipantCount: number;
  linkedParticipantCount: number;
  participants: Array<{
    id: string;
    name: string;
    deletedAt: string | null;
    linkedToUser: boolean;
  }>;
};

type DeletedTeamsResponse = {
  teams: DeletedTeam[];
};

type AuditRecord = Record<string, unknown>;

type AuditEvent = {
  id: string;
  action: string;
  reason?: string | null;
  beforeData?: AuditRecord | null;
  afterData?: AuditRecord | null;
  meta?: AuditRecord | null;
  createdAt: string;
  actor?: {
    id: string;
    name?: string | null;
    email: string;
  } | null;
  competition?: {
    id: string;
    name: string;
    year: number;
  } | null;
};

type AuditEventsResponse = {
  events: AuditEvent[];
};

type TeamAccessAuditResponse = {
  summary: {
    teamchefRoleCount: number;
    staleTeamchefRoleCount: number;
    archivedTeamCount: number;
    archivedTeamsWithLinkedParticipantsCount: number;
  };
  staleTeamchefRoles: Array<{
    roleId: string;
    userId: string;
    email: string;
    name?: string | null;
  }>;
  archivedTeamsWithLinkedParticipants: Array<{
    id: string;
    name: string;
    deletedAt: string | null;
    linkedParticipantCount: number;
  }>;
};

function formatDateTime(value?: string | null) {
  if (!value) return "unbekannt";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unbekannt";
  return date.toLocaleString("de-DE");
}

function getStringValue(record: AuditRecord | null | undefined, key: string) {
  const value = record?.[key];
  return typeof value === "string" ? value : null;
}

function getNumberValue(record: AuditRecord | null | undefined, key: string) {
  const value = record?.[key];
  return typeof value === "number" ? value : null;
}

function getStringArrayValue(record: AuditRecord | null | undefined, key: string) {
  const value = record?.[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function getAuditLabel(action: string) {
  if (action === "TEAM_SOFT_DELETED") return "Archiviert";
  if (action === "TEAM_RESTORED") return "Wiederhergestellt";
  if (action === "TEAM_LIFECYCLE_MAIL") return "Mail";
  return action;
}

function getAuditTone(event: AuditEvent) {
  if (event.action === "TEAM_LIFECYCLE_MAIL") {
    const mailStatus = getStringValue(event.afterData, "mailStatus");
    if (mailStatus === "failed") return "destructive" as const;
    if (mailStatus === "skipped") return "secondary" as const;
    return "outline" as const;
  }
  if (event.action === "TEAM_SOFT_DELETED") return "destructive" as const;
  if (event.action === "TEAM_RESTORED") return "default" as const;
  return "outline" as const;
}

function getAuditTeamName(event: AuditEvent) {
  return getStringValue(event.meta, "teamName") || getStringValue(event.beforeData, "teamName") || "Mannschaft";
}

function getLifecycleMailIssueLabel(event: AuditEvent) {
  const lifecycleAction = getStringValue(event.meta, "lifecycleAction");
  if (lifecycleAction === "restored") return "Wiederherstellungs-Mail";
  return "Archivierungs-Mail";
}

export default function RestoreCenter() {
  const { active: activeCompetition } = useCompetition();
  const notifications = useNotifications();
  const [teams, setTeams] = useState<DeletedTeam[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [accessAudit, setAccessAudit] = useState<TeamAccessAuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(true);
  const [accessAuditLoading, setAccessAuditLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const fetchDeletedTeams = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeCompetition?.id) params.set("competitionId", activeCompetition.id);
      const response = await fetch(`/api/admin/deleted-teams?${params}`);
      const data = (await response.json().catch(() => ({}))) as Partial<DeletedTeamsResponse> & { error?: string };
      if (!response.ok) {
        notifications.error("Archiv konnte nicht geladen werden", data.error || "Bitte später erneut versuchen.");
        return;
      }
      setTeams(data.teams || []);
    } catch (error) {
      console.error("Failed to load deleted teams:", error);
      notifications.error(
        "Archiv konnte nicht geladen werden",
        error instanceof Error ? error.message : "Bitte später erneut versuchen.",
      );
    } finally {
      setLoading(false);
    }
  }, [activeCompetition?.id, notifications]);

  const fetchAuditEvents = useCallback(async () => {
    setAuditLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeCompetition?.id) params.set("competitionId", activeCompetition.id);
      params.append("action", "TEAM_SOFT_DELETED");
      params.append("action", "TEAM_RESTORED");
      params.append("action", "TEAM_LIFECYCLE_MAIL");
      params.set("scopeType", "TEAM");
      params.set("limit", "18");
      const response = await fetch(`/api/admin/audit-events?${params}`);
      const data = (await response.json().catch(() => ({}))) as Partial<AuditEventsResponse> & { error?: string };
      if (!response.ok) {
        notifications.error("Audit-Verlauf konnte nicht geladen werden", data.error || "Bitte später erneut versuchen.");
        return;
      }
      setAuditEvents(data.events || []);
    } catch (error) {
      console.error("Failed to load audit events:", error);
      notifications.error(
        "Audit-Verlauf konnte nicht geladen werden",
        error instanceof Error ? error.message : "Bitte später erneut versuchen.",
      );
    } finally {
      setAuditLoading(false);
    }
  }, [activeCompetition?.id, notifications]);

  const fetchAccessAudit = useCallback(async () => {
    setAccessAuditLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeCompetition?.id) params.set("competitionId", activeCompetition.id);
      const response = await fetch(`/api/admin/team-access-audit?${params}`);
      const data = (await response.json().catch(() => ({}))) as Partial<TeamAccessAuditResponse> & { error?: string };
      if (!response.ok) {
        notifications.error("Rechte-Audit konnte nicht geladen werden", data.error || "Bitte später erneut versuchen.");
        return;
      }
      setAccessAudit((data as TeamAccessAuditResponse) || null);
    } catch (error) {
      console.error("Failed to load team access audit:", error);
      notifications.error(
        "Rechte-Audit konnte nicht geladen werden",
        error instanceof Error ? error.message : "Bitte später erneut versuchen.",
      );
    } finally {
      setAccessAuditLoading(false);
    }
  }, [activeCompetition?.id, notifications]);

  useEffect(() => {
    void fetchDeletedTeams();
    void fetchAuditEvents();
    void fetchAccessAudit();
  }, [fetchAccessAudit, fetchAuditEvents, fetchDeletedTeams]);

  const filteredTeams = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return teams;

    return teams.filter((team) => {
      const haystacks = [
        team.name,
        team.contactName || "",
        team.contactEmail || "",
        team.owner.name || "",
        team.owner.email,
        team.competition.name,
        ...team.participants.map((participant) => participant.name),
      ];
      return haystacks.some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  }, [query, teams]);

  const failingLifecycleMailEvents = useMemo(
    () =>
      auditEvents.filter((event) => {
        if (event.action !== "TEAM_LIFECYCLE_MAIL") return false;
        const mailStatus = getStringValue(event.afterData, "mailStatus");
        return mailStatus === "failed";
      }),
    [auditEvents],
  );

  const restoreTeam = async (team: DeletedTeam) => {
    setRestoringId(team.id);

    try {
      const response = await fetch(`/api/admin/deleted-teams/${team.id}/restore`, {
        method: "POST",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        notifications.error(
          "Mannschaft konnte nicht wiederhergestellt werden",
          data.error || "Bitte später erneut versuchen.",
        );
        return;
      }

      notifications.success(
        data.message || "Mannschaft wurde wiederhergestellt",
        `${team.deletedParticipantCount} Teilnehmer:innen wurden mit berücksichtigt.`,
      );
      await fetchDeletedTeams();
      await fetchAuditEvents();
      await fetchAccessAudit();
    } catch (error) {
      console.error("Failed to restore team:", error);
      notifications.error(
        "Mannschaft konnte nicht wiederhergestellt werden",
        error instanceof Error ? error.message : "Bitte später erneut versuchen.",
      );
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Archiv</CardTitle>
          <CardDescription>
            Archivierte Mannschaften des aktiven Wettkampfs wiederherstellen. Teilnehmer:innen werden dabei mit zurückgeholt.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Suche Mannschaft, Kontakt, Besitzer:in oder Teilnehmer:in..."
              className="flex-1"
            />
            <Button variant="outline" onClick={() => void fetchDeletedTeams()} disabled={loading}>
              Aktualisieren
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-md border border-border/60 bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Archivierte Teams</p>
              <p className="text-lg font-semibold">{teams.length}</p>
            </div>
            <div className="rounded-md border border-border/60 bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Teilnehmer:innen</p>
              <p className="text-lg font-semibold">
                {teams.reduce((sum, team) => sum + team.deletedParticipantCount, 0)}
              </p>
            </div>
            <div className="rounded-md border border-border/60 bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Verknüpfte Accounts</p>
              <p className="text-lg font-semibold">
                {teams.reduce((sum, team) => sum + team.linkedParticipantCount, 0)}
              </p>
            </div>
            <div className="rounded-md border border-border/60 bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Treffer</p>
              <p className="text-lg font-semibold">{filteredTeams.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Rechte-Audit</CardTitle>
          <CardDescription>
            Prüft abgeleitete Teamchef-Rechte und archivierte Teams mit noch verknüpften Teilnehmerkonten.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {accessAuditLoading ? (
            <p className="text-sm text-muted-foreground">Audit wird geladen...</p>
          ) : accessAudit ? (
            <>
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-md border border-border/50 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Abgeleitete Teamchef-Rollen</p>
                  <p className="text-lg font-semibold">{accessAudit.summary.teamchefRoleCount}</p>
                </div>
                <div className="rounded-md border border-border/50 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Verwaiste Teamchef-Rollen</p>
                  <p className="text-lg font-semibold">{accessAudit.summary.staleTeamchefRoleCount}</p>
                </div>
                <div className="rounded-md border border-border/50 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Archivierte Teams</p>
                  <p className="text-lg font-semibold">{accessAudit.summary.archivedTeamCount}</p>
                </div>
                <div className="rounded-md border border-border/50 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Archivierte Teams mit Kontolinks</p>
                  <p className="text-lg font-semibold">{accessAudit.summary.archivedTeamsWithLinkedParticipantsCount}</p>
                </div>
              </div>

              {accessAudit.summary.staleTeamchefRoleCount === 0 ? (
                <p className="text-sm text-green-700">Keine verwaisten Teamchef-Rollen gefunden.</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Verwaiste Teamchef-Rollen</p>
                  <div className="space-y-2">
                    {accessAudit.staleTeamchefRoles.map((entry) => (
                      <div key={entry.roleId} className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
                        {(entry.name || entry.email).trim()} · {entry.email}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {accessAudit.summary.archivedTeamsWithLinkedParticipantsCount > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Archivierte Teams mit noch verknüpften Teilnehmerkonten</p>
                  <div className="space-y-2">
                    {accessAudit.archivedTeamsWithLinkedParticipants.map((team) => (
                      <div key={team.id} className="rounded-md border border-border/50 px-3 py-2 text-sm">
                        {team.name} · {team.linkedParticipantCount} verknüpfte Teilnehmerkonten · archiviert am {formatDateTime(team.deletedAt)}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Keine archivierten Teams mit aktiven Teilnehmerkontolinks gefunden.</p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Audit-Daten konnten nicht geladen werden.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ops-Hinweise</CardTitle>
          <CardDescription>
            Sichtbare Problemfälle rund um Archivierung und Wiederherstellung, damit fehlgeschlagene Seiteneffekte nicht nur im Audit landen.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-md border border-border/50 px-3 py-2">
              <p className="text-xs text-muted-foreground">Fehlgeschlagene Lifecycle-Mails</p>
              <p className="text-lg font-semibold">{failingLifecycleMailEvents.length}</p>
            </div>
            <div className="rounded-md border border-border/50 px-3 py-2">
              <p className="text-xs text-muted-foreground">Letztes Mailproblem</p>
              <p className="text-sm font-medium">
                {failingLifecycleMailEvents[0] ? formatDateTime(failingLifecycleMailEvents[0].createdAt) : "—"}
              </p>
            </div>
            <div className="rounded-md border border-border/50 px-3 py-2">
              <p className="text-xs text-muted-foreground">Empfehlung</p>
              <p className="text-sm font-medium">
                {failingLifecycleMailEvents.length > 0 ? "Audit prüfen" : "Keine offenen Hinweise"}
              </p>
            </div>
          </div>

          {failingLifecycleMailEvents.length > 0 ? (
            <div className="space-y-2">
              {failingLifecycleMailEvents.slice(0, 5).map((event) => {
                const teamName = getAuditTeamName(event);
                const reason = getStringValue(event.afterData, "error") || getStringValue(event.afterData, "reason") || "Unbekannter Fehler";
                return (
                  <div key={event.id} className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="destructive">{getLifecycleMailIssueLabel(event)}</Badge>
                      <span className="font-medium">{teamName}</span>
                      <span className="text-xs text-red-800/80">{formatDateTime(event.createdAt)}</span>
                    </div>
                    <p className="mt-1 text-xs text-red-800/90">{reason}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Keine fehlgeschlagenen Archivierungs- oder Wiederherstellungs-Mails in den letzten Audit-Einträgen.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Audit-Verlauf</CardTitle>
          <CardDescription>
            Letzte Lösch- und Wiederherstellungsaktionen für Mannschaften.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {auditLoading ? (
            <div className="py-4 text-sm text-muted-foreground">Lade Audit-Verlauf...</div>
          ) : auditEvents.length === 0 ? (
            <div className="rounded-md border border-border/50 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
              Noch keine Lösch- oder Restore-Aktionen protokolliert.
            </div>
          ) : (
            <div className="space-y-2">
              {auditEvents.map((event) => {
                const teamName = getAuditTeamName(event);
                const actor = event.actor?.name || event.actor?.email || "Unbekannt";
                const participantCount =
                  getNumberValue(event.afterData, "deletedParticipants") ||
                  getNumberValue(event.afterData, "restoredParticipants");
                const linkedParticipants = getNumberValue(event.meta, "linkedParticipants");
                const mailStatus = getStringValue(event.afterData, "mailStatus");
                const mailReason = getStringValue(event.afterData, "reason") || getStringValue(event.afterData, "error");
                const mailRecipients = getStringArrayValue(event.afterData, "recipients");
                const lifecycleAction = getStringValue(event.meta, "lifecycleAction");

                return (
                  <div key={event.id} className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={getAuditTone(event)}>{getAuditLabel(event.action)}</Badge>
                      <span className="text-sm font-medium">{teamName}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(event.createdAt)} · {actor}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {typeof participantCount === "number" && <span>{participantCount} Teilnehmer:innen</span>}
                      {typeof linkedParticipants === "number" && <span>{linkedParticipants} verknüpfte Accounts</span>}
                      {event.action === "TEAM_LIFECYCLE_MAIL" && (
                        <span>
                          {mailStatus === "sent"
                            ? `Mail gesendet an ${mailRecipients.length} Empfänger`
                            : mailStatus === "skipped"
                              ? `Mail übersprungen${mailReason ? `: ${mailReason}` : ""}`
                              : `Mail fehlgeschlagen${mailReason ? `: ${mailReason}` : ""}`}
                        </span>
                      )}
                      {event.action === "TEAM_LIFECYCLE_MAIL" && lifecycleAction && (
                        <span>{lifecycleAction === "restored" ? "nach Wiederherstellung" : "nach Archivierung"}</span>
                      )}
                      {event.competition && <span>{event.competition.name}</span>}
                    </div>
                    {event.action === "TEAM_LIFECYCLE_MAIL" && mailRecipients.length > 0 && (
                      <div className="mt-1 truncate text-xs text-muted-foreground">
                        An: {mailRecipients.join(", ")}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Lade Archiv...
          </CardContent>
        </Card>
      ) : filteredTeams.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Keine archivierten Mannschaften gefunden.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredTeams.map((team) => {
            const ownerDeleted = Boolean(team.owner.deletedAt);
            return (
              <Card key={team.id} className="border-border/70">
                <CardContent className="space-y-4 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="break-words text-base font-semibold">{team.name}</h3>
                        <Badge variant="outline">{team.competition.year}</Badge>
                        {ownerDeleted && <Badge variant="destructive">Besitzer gelöscht</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Archiviert: {formatDateTime(team.deletedAt)} • Angelegt: {formatDateTime(team.createdAt)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Besitzer: {team.owner.name || team.owner.email}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" disabled>
                        Nach Restore sichtbar
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger render={<Button size="sm" disabled={ownerDeleted || restoringId === team.id} />}>
                          Wiederherstellen
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Mannschaft wiederherstellen?</AlertDialogTitle>
                            <AlertDialogDescription>
                              „{team.name}“ wird wieder sichtbar. {team.deletedParticipantCount} gelöschte Teilnehmer:innen werden ebenfalls wiederhergestellt.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                            <AlertDialogAction onClick={() => void restoreTeam(team)}>
                              Wiederherstellen
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="rounded-md border border-border/60 bg-muted/20 p-3">
                      <p className="text-xs text-muted-foreground">Teilnehmer:innen</p>
                      <p className="font-medium">{team.deletedParticipantCount}/{team.participantCount}</p>
                    </div>
                    <div className="rounded-md border border-border/60 bg-muted/20 p-3">
                      <p className="text-xs text-muted-foreground">Accounts</p>
                      <p className="font-medium">{team.linkedParticipantCount} verknüpft</p>
                    </div>
                    <div className="rounded-md border border-border/60 bg-muted/20 p-3">
                      <p className="text-xs text-muted-foreground">Kontakt</p>
                      <p className="truncate font-medium">{team.contactEmail || team.contactName || "Nicht hinterlegt"}</p>
                    </div>
                  </div>

                  {team.participants.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {team.participants.slice(0, 8).map((participant) => (
                        <Badge key={participant.id} variant="secondary" className="font-normal">
                          {participant.name || "Teilnehmer:in"}
                          {participant.linkedToUser ? " · Konto" : ""}
                        </Badge>
                      ))}
                      {team.participants.length > 8 && (
                        <Badge variant="outline">+{team.participants.length - 8}</Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
