"use client";

import { useEffect, useMemo, useState } from "react";
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
  if (action === "TEAM_SOFT_DELETED") return "Gelöscht";
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

export default function RestoreCenter() {
  const { active: activeCompetition } = useCompetition();
  const [teams, setTeams] = useState<DeletedTeam[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchDeletedTeams = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeCompetition?.id) params.set("competitionId", activeCompetition.id);
      const response = await fetch(`/api/admin/deleted-teams?${params}`);
      const data = (await response.json().catch(() => ({}))) as Partial<DeletedTeamsResponse> & { error?: string };
      if (!response.ok) {
        setErrorMessage(data.error || "Papierkorb konnte nicht geladen werden");
        return;
      }
      setTeams(data.teams || []);
      setErrorMessage(null);
    } catch (error) {
      console.error("Failed to load deleted teams:", error);
      setErrorMessage("Papierkorb konnte nicht geladen werden");
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditEvents = async () => {
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
        setErrorMessage(data.error || "Audit-Verlauf konnte nicht geladen werden");
        return;
      }
      setAuditEvents(data.events || []);
    } catch (error) {
      console.error("Failed to load audit events:", error);
      setErrorMessage("Audit-Verlauf konnte nicht geladen werden");
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    void fetchDeletedTeams();
    void fetchAuditEvents();
    // fetchDeletedTeams intentionally stays local to keep dependencies compact.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCompetition?.id]);

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

  const restoreTeam = async (team: DeletedTeam) => {
    setRestoringId(team.id);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/admin/deleted-teams/${team.id}/restore`, {
        method: "POST",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setErrorMessage(data.error || "Mannschaft konnte nicht wiederhergestellt werden");
        return;
      }

      setStatusMessage(data.message || "Mannschaft wurde wiederhergestellt");
      await fetchDeletedTeams();
      await fetchAuditEvents();
    } catch (error) {
      console.error("Failed to restore team:", error);
      setErrorMessage("Mannschaft konnte nicht wiederhergestellt werden");
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Papierkorb</CardTitle>
          <CardDescription>
            Gelöschte Mannschaften des aktiven Wettkampfs wiederherstellen. Teilnehmer:innen werden dabei mit zurückgeholt.
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

          {statusMessage && (
            <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
              {statusMessage}
            </div>
          )}
          {errorMessage && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {errorMessage}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-md border border-border/60 bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Gelöschte Teams</p>
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
                        <span>{lifecycleAction === "restored" ? "nach Restore" : "nach Löschen"}</span>
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
            Lade Papierkorb...
          </CardContent>
        </Card>
      ) : filteredTeams.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Keine gelöschten Mannschaften gefunden.
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
                        Gelöscht: {formatDateTime(team.deletedAt)} • Angelegt: {formatDateTime(team.createdAt)}
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
