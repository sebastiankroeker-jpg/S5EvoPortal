"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useCompetition } from "@/lib/competition-context";
import { useNotifications } from "@/lib/notification-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ClaimTokenInfo = {
  id: string;
  status: "none" | "active" | "claimed" | "expired" | "revoked";
  suggestedEmail: string;
  suggestedName?: string | null;
  createdAt: string;
  expiresAt: string;
  claimedAt?: string | null;
  revokedAt?: string | null;
  claimedBy?: { email?: string | null; name?: string | null } | null;
};

type ClaimItem = {
  itemType: "team" | "participant";
  itemId: string;
  teamId: string;
  teamName: string;
  category: string;
  contactEmail: string;
  contactName: string;
  ownerEmail: string;
  participantId: string | null;
  participantName: string | null;
  linkedUser?: { id: string; email?: string | null; name?: string | null } | null;
  token: ClaimTokenInfo | null;
};

type ClaimAuditEvent = {
  id: string;
  scope: "team" | "participant";
  createdAt: string;
  eventType: string;
  outcome?: string | null;
  reason?: string | null;
  suspicious: boolean;
  sessionEmail?: string | null;
  ipAddress?: string | null;
  teamId?: string | null;
  participantId?: string | null;
};

const STATUS_META: Record<ClaimTokenInfo["status"] | "none", { label: string; variant: "default" | "secondary" | "outline" | "destructive"; }> = {
  none: { label: "Kein Link", variant: "outline" },
  active: { label: "Offen", variant: "default" },
  claimed: { label: "Eingelöst", variant: "secondary" },
  expired: { label: "Abgelaufen", variant: "outline" },
  revoked: { label: "Gesperrt", variant: "destructive" },
};

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("de-DE");
}

function maskEmail(email?: string | null) {
  if (!email) return "—";
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  if (local.length <= 2) return `${local[0] ?? "*"}*@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}

export default function ClaimLinkDashboard() {
  const { active: activeCompetition } = useCompetition();
  const notifications = useNotifications();
  const [items, setItems] = useState<ClaimItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ClaimTokenInfo["status"] | "none" | "all">("all");
  const [busyTeamId, setBusyTeamId] = useState<string | null>(null);
  const [busyTokenId, setBusyTokenId] = useState<string | null>(null);
  const [busyResetParticipantId, setBusyResetParticipantId] = useState<string | null>(null);
  const [togglingGlobal, setTogglingGlobal] = useState(false);
  const [claimLinksEnabled, setClaimLinksEnabled] = useState(true);
  const [generatedLinks, setGeneratedLinks] = useState<Record<string, string>>({});
  const [opsEvents, setOpsEvents] = useState<ClaimAuditEvent[]>([]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeCompetition?.id) params.set("competitionId", activeCompetition.id);
      const res = await fetch(`/api/admin/claim-links?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Claim-Links konnten nicht geladen werden");
      setClaimLinksEnabled(data.claimLinksEnabled !== false);
      setItems(data.items || []);

      const opsParams = new URLSearchParams();
      opsParams.set("suspiciousOnly", "true");
      opsParams.set("limit", "12");
      if (activeCompetition?.id) opsParams.set("competitionId", activeCompetition.id);
      const opsRes = await fetch(`/api/admin/claim-audit?${opsParams.toString()}`);
      const opsData = await opsRes.json().catch(() => ({ events: [] }));
      if (opsRes.ok) {
        setOpsEvents(Array.isArray(opsData.events) ? opsData.events : []);
      }
    } catch (err) {
      notifications.error(
        "Claim-Links konnten nicht geladen werden",
        err instanceof Error ? err.message : "Bitte später erneut versuchen.",
      );
    } finally {
      setLoading(false);
    }
  }, [activeCompetition?.id, notifications]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) =>
      item.itemType.toLowerCase().includes(term) ||
      item.teamName.toLowerCase().includes(term) ||
      item.contactEmail.toLowerCase().includes(term) ||
      item.contactName.toLowerCase().includes(term) ||
      item.ownerEmail.toLowerCase().includes(term) ||
      (item.participantName || "").toLowerCase().includes(term),
    );
  }, [items, search]);

  const visibleItems = useMemo(() => {
    return filteredItems.filter((item) => {
      if (statusFilter === "all") return true;
      const currentStatus = item.token?.status || "none";
      return currentStatus === statusFilter;
    });
  }, [filteredItems, statusFilter]);

  const copyToClipboard = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      notifications.success("Claim-Link kopiert");
    } catch {
      notifications.error("Kopieren fehlgeschlagen");
    }
  };

  const generateClaimLink = async (item: ClaimItem) => {
    setBusyTeamId(item.itemId);
    try {
      const res = await fetch("/api/admin/claim-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          item.itemType === "participant"
            ? { participantId: item.participantId }
            : { teamId: item.teamId },
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Claim-Link konnte nicht erzeugt werden");
      setGeneratedLinks((current) => ({ ...current, [`${item.itemType}:${item.itemId}`]: data.claimUrl }));
      notifications.success(
        item.itemType === "participant" ? "Neuer Teilnehmer-Claim-Link erzeugt" : "Neuer Team-Claim-Link erzeugt",
        "Der neue Link kann direkt kopiert werden.",
      );
      await loadItems();
    } catch (err) {
      notifications.error(
        "Claim-Link konnte nicht erzeugt werden",
        err instanceof Error ? err.message : "Bitte später erneut versuchen.",
      );
    } finally {
      setBusyTeamId(null);
    }
  };

  const revokeClaimLink = async (tokenId: string, tokenType: "team" | "participant") => {
    setBusyTokenId(tokenId);
    try {
      const res = await fetch("/api/admin/claim-links", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenId, tokenType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Claim-Link konnte nicht gesperrt werden");
      notifications.success("Claim-Link gesperrt");
      await loadItems();
    } catch (err) {
      notifications.error(
        "Claim-Link konnte nicht gesperrt werden",
        err instanceof Error ? err.message : "Bitte später erneut versuchen.",
      );
    } finally {
      setBusyTokenId(null);
    }
  };

  const resetParticipantLink = async (item: ClaimItem) => {
    if (!item.participantId) return;
    const confirmed = window.confirm(
      `Account-Verknüpfung für ${item.participantName || item.contactName} lösen und eine neue Einladung an ${item.contactEmail || "die hinterlegte E-Mail"} senden?`,
    );
    if (!confirmed) return;

    setBusyResetParticipantId(item.participantId);
    try {
      const res = await fetch("/api/admin/claim-links", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resetParticipantLink", participantId: item.participantId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verknüpfung konnte nicht gelöst werden");
      const mailStatus = data.participantClaimMail?.status;
      notifications.success(
        mailStatus === "sent" || mailStatus === "queued"
          ? "Verknüpfung gelöst und neue Einladung versendet"
          : "Verknüpfung gelöst und neue Einladung erzeugt",
      );
      await loadItems();
    } catch (err) {
      notifications.error(
        "Verknüpfung konnte nicht gelöst werden",
        err instanceof Error ? err.message : "Bitte später erneut versuchen.",
      );
    } finally {
      setBusyResetParticipantId(null);
    }
  };

  const toggleGlobalClaimLinks = async (enabled: boolean) => {
    setTogglingGlobal(true);
    try {
      const res = await fetch("/api/admin/claim-links", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggleGlobal", enabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Globaler Claim-Schalter konnte nicht aktualisiert werden");
      setClaimLinksEnabled(data.claimLinksEnabled !== false);
      notifications.success(
        enabled ? "Claim-Einlösung global aktiviert" : "Claim-Einlösung global deaktiviert",
      );
    } catch (err) {
      notifications.error(
        "Globaler Claim-Schalter konnte nicht aktualisiert werden",
        err instanceof Error ? err.message : "Bitte später erneut versuchen.",
      );
    } finally {
      setTogglingGlobal(false);
    }
  };

  return (
    <Card id="claim-link-dashboard">
      <CardHeader>
        <CardTitle className="text-lg">🔐 Claim-Link Dashboard</CardTitle>
        <CardDescription>
          Interne Übersicht für Team- und Teilnehmer-Claims. Status <strong>Offen</strong> bedeutet: Link existiert, ist noch nicht eingelöst, nicht gesperrt und nicht abgelaufen. Das angezeigte Portal-Konto kann bereits gesetzt worden sein und ist kein Beleg für eine erfolgte Einlösung.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Suche Team, Teilnehmer, Kontakt oder Portal-Konto..."
                className="sm:w-72"
              />
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
              <SelectTrigger className="sm:w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                <SelectItem value="none">Kein Link</SelectItem>
                <SelectItem value="active">Offen / nicht eingelöst</SelectItem>
                <SelectItem value="claimed">Eingelöst</SelectItem>
                <SelectItem value="expired">Abgelaufen</SelectItem>
                <SelectItem value="revoked">Gesperrt</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={claimLinksEnabled ? "outline" : "default"}
              size="sm"
              onClick={() => void toggleGlobalClaimLinks(!claimLinksEnabled)}
              disabled={togglingGlobal}
            >
              {togglingGlobal ? "Speichere..." : claimLinksEnabled ? "Einlösung global deaktivieren" : "Einlösung global aktivieren"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => void loadItems()} disabled={loading}>
              🔄 Aktualisieren
            </Button>
          </div>
        </div>

        <div className={`rounded-md border px-3 py-2 text-sm ${claimLinksEnabled ? "border-green-200 bg-green-50 text-green-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
          Die globale Claim-Einlösung ist aktuell <strong>{claimLinksEnabled ? "freigeschaltet" : "deaktiviert"}</strong>.
        </div>

        <div className="rounded-md border border-border/50 bg-muted/20 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">Ops-Hinweise</p>
              <p className="text-xs text-muted-foreground">
                Auffällige Claim-Aktivität aus Team- und Teilnehmer-Claims.
              </p>
            </div>
            <Badge variant={opsEvents.length > 0 ? "destructive" : "outline"}>
              {opsEvents.length > 0 ? `${opsEvents.length} auffällig` : "unauffällig"}
            </Badge>
          </div>

          {opsEvents.length > 0 ? (
            <div className="mt-3 space-y-2">
              {opsEvents.slice(0, 5).map((event) => (
                <div key={event.id} className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{event.scope === "participant" ? "Teilnehmer-Claim" : "Team-Claim"}</Badge>
                    <span className="font-medium">{event.eventType}</span>
                    <span className="text-xs text-muted-foreground">{formatDateTime(event.createdAt)}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {event.reason || event.outcome || "auffälliges Muster"} · Session: {maskEmail(event.sessionEmail)} · IP: {event.ipAddress || "—"}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Keine auffälligen Claim-Ereignisse in den zuletzt geprüften Einträgen.</p>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="rounded-md border border-border/50 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
            Keine Teams für Claim-Links gefunden.
          </div>
        ) : (
          <div className="space-y-3">
            {visibleItems.map((item) => {
              const tokenStatus = item.token?.status || "none";
              const statusMeta = STATUS_META[tokenStatus];
              const generatedLink = generatedLinks[`${item.itemType}:${item.itemId}`];
              const itemLabel = item.itemType === "participant" ? "Teilnehmer-Claim" : "Team-Claim";

              return (
                <div key={`${item.itemType}:${item.itemId}`} className="rounded-lg border border-border/50 bg-card p-4 space-y-3 shadow-sm">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{item.itemType === "participant" ? item.contactName : item.teamName}</span>
                        <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                        <Badge variant="outline">{itemLabel}</Badge>
                        <Badge variant="outline">{item.category}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        {item.itemType === "participant" ? (
                          <>
                            <p>Teilnehmer: {item.contactName || "—"} · {item.contactEmail || "—"}</p>
                            <p>Team: {item.teamName}</p>
                            <p>Portal-Konto: {item.linkedUser?.email || "—"}</p>
                          </>
                        ) : (
                          <>
                            <p>Kontakt: {item.contactName || "—"} · {item.contactEmail || "—"}</p>
                            <p>Portal-Konto: {item.ownerEmail || "—"}</p>
                          </>
                        )}
                        {item.token ? (
                          <>
                            <p>Erzeugt: {formatDateTime(item.token.createdAt)} · Gültig bis: {formatDateTime(item.token.expiresAt)}</p>
                            {item.token.status === "active" ? <p>Link ist offen und wurde noch nicht eingelöst.</p> : null}
                            {item.token.claimedAt ? (
                              <p>Eingelöst: {formatDateTime(item.token.claimedAt)}{item.token.claimedBy?.email ? ` · von ${item.token.claimedBy.email}` : ""}</p>
                            ) : null}
                            {item.token.revokedAt ? <p>Gesperrt: {formatDateTime(item.token.revokedAt)}</p> : null}
                          </>
                        ) : (
                          <p>Noch kein Claim-Link erzeugt.</p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => void generateClaimLink(item)}
                        disabled={busyTeamId === item.itemId}
                      >
                        {busyTeamId === item.itemId
                          ? "Erzeuge..."
                          : item.token?.status === "active"
                            ? item.itemType === "participant" ? "Neuen Teilnehmer-Link erzeugen" : "Neuen Team-Link erzeugen"
                            : item.itemType === "participant" ? "Teilnehmer-Link erzeugen" : "Team-Link erzeugen"}
                      </Button>
                      {generatedLink ? (
                        <Button size="sm" variant="outline" onClick={() => void copyToClipboard(generatedLink)}>
                          Link kopieren
                        </Button>
                      ) : null}
                      {item.token?.status === "active" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void revokeClaimLink(item.token!.id, item.itemType)}
                          disabled={busyTokenId === item.token.id}
                        >
                          {busyTokenId === item.token.id ? "Sperre..." : "Link sperren"}
                        </Button>
                      ) : null}
                      {item.itemType === "participant" && item.linkedUser ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => void resetParticipantLink(item)}
                          disabled={busyResetParticipantId === item.participantId}
                        >
                          {busyResetParticipantId === item.participantId ? "Löse..." : "Verknüpfung lösen & neu einladen"}
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  {generatedLink ? (
                    <div className="space-y-2 rounded-md border border-primary/20 bg-primary/5 p-3">
                      <p className="text-xs text-muted-foreground">Neu erzeugter {itemLabel} für Supportfälle</p>
                      <Input value={generatedLink} readOnly className="font-mono text-xs" />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
