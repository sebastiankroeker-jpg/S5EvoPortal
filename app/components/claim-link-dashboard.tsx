"use client";

import { useEffect, useMemo, useState } from "react";

import { useCompetition } from "@/lib/competition-context";
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
  teamId: string;
  teamName: string;
  category: string;
  contactEmail: string;
  contactName: string;
  ownerEmail: string;
  token: ClaimTokenInfo | null;
};

const STATUS_META: Record<ClaimTokenInfo["status"] | "none", { label: string; variant: "default" | "secondary" | "outline" | "destructive"; }> = {
  none: { label: "Kein Link", variant: "outline" },
  active: { label: "Aktiv", variant: "default" },
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

export default function ClaimLinkDashboard() {
  const { active: activeCompetition } = useCompetition();
  const [items, setItems] = useState<ClaimItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ClaimTokenInfo["status"] | "none" | "all">("all");
  const [busyTeamId, setBusyTeamId] = useState<string | null>(null);
  const [busyTokenId, setBusyTokenId] = useState<string | null>(null);
  const [togglingGlobal, setTogglingGlobal] = useState(false);
  const [claimLinksEnabled, setClaimLinksEnabled] = useState(true);
  const [generatedLinks, setGeneratedLinks] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadItems = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeCompetition?.id) params.set("competitionId", activeCompetition.id);
      const res = await fetch(`/api/admin/claim-links?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Claim-Links konnten nicht geladen werden");
      setClaimLinksEnabled(data.claimLinksEnabled !== false);
      setItems(data.items || []);
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Claim-Links konnten nicht geladen werden" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadItems();
  }, [activeCompetition?.id]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) =>
      item.teamName.toLowerCase().includes(term) ||
      item.contactEmail.toLowerCase().includes(term) ||
      item.contactName.toLowerCase().includes(term) ||
      item.ownerEmail.toLowerCase().includes(term),
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
      setMessage({ type: "success", text: "Claim-Link kopiert" });
    } catch {
      setMessage({ type: "error", text: "Kopieren fehlgeschlagen" });
    }
  };

  const generateClaimLink = async (teamId: string) => {
    setBusyTeamId(teamId);
    try {
      const res = await fetch("/api/admin/claim-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Claim-Link konnte nicht erzeugt werden");
      setGeneratedLinks((current) => ({ ...current, [teamId]: data.claimUrl }));
      setMessage({ type: "success", text: "Neuer Claim-Link erzeugt" });
      await loadItems();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Claim-Link konnte nicht erzeugt werden" });
    } finally {
      setBusyTeamId(null);
    }
  };

  const revokeClaimLink = async (tokenId: string) => {
    setBusyTokenId(tokenId);
    try {
      const res = await fetch("/api/admin/claim-links", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Claim-Link konnte nicht gesperrt werden");
      setMessage({ type: "success", text: "Claim-Link gesperrt" });
      await loadItems();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Claim-Link konnte nicht gesperrt werden" });
    } finally {
      setBusyTokenId(null);
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
      setMessage({ type: "success", text: enabled ? "Claim-Einlösung global aktiviert" : "Claim-Einlösung global deaktiviert" });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Globaler Claim-Schalter konnte nicht aktualisiert werden" });
    } finally {
      setTogglingGlobal(false);
    }
  };

  return (
    <Card id="claim-link-dashboard">
      <CardHeader>
        <CardTitle className="text-lg">🔐 Claim-Link Dashboard</CardTitle>
        <CardDescription>
          Interne Übersicht für Uebernahmelinks. Bestehende Links sind aus Sicherheitsgründen nicht im Klartext lesbar. Für Supportfälle kannst du hier jederzeit einen neuen Link erzeugen.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {message && (
          <div className={`rounded-md border px-3 py-2 text-sm ${message.type === "success" ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"}`}>
            {message.text}
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Suche Team, Kontakt oder Owner..."
              className="sm:w-72"
            />
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
              <SelectTrigger className="sm:w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                <SelectItem value="none">Kein Link</SelectItem>
                <SelectItem value="active">Aktiv</SelectItem>
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
          Claim-Einlösung ist aktuell <strong>{claimLinksEnabled ? "aktiv" : "deaktiviert"}</strong>.
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
              const generatedLink = generatedLinks[item.teamId];

              return (
                <div key={item.teamId} className="rounded-lg border border-border/50 bg-card p-4 space-y-3 shadow-sm">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{item.teamName}</span>
                        <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                        <Badge variant="outline">{item.category}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>Kontakt: {item.contactName || "—"} · {item.contactEmail || "—"}</p>
                        <p>Owner: {item.ownerEmail || "—"}</p>
                        {item.token ? (
                          <>
                            <p>Erzeugt: {formatDateTime(item.token.createdAt)} · Gültig bis: {formatDateTime(item.token.expiresAt)}</p>
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
                        onClick={() => void generateClaimLink(item.teamId)}
                        disabled={busyTeamId === item.teamId}
                      >
                        {busyTeamId === item.teamId ? "Erzeuge..." : item.token?.status === "active" ? "Neuen Link erzeugen" : "Claim-Link erzeugen"}
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
                          onClick={() => void revokeClaimLink(item.token!.id)}
                          disabled={busyTokenId === item.token.id}
                        >
                          {busyTokenId === item.token.id ? "Sperre..." : "Link sperren"}
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  {generatedLink ? (
                    <div className="space-y-2 rounded-md border border-primary/20 bg-primary/5 p-3">
                      <p className="text-xs text-muted-foreground">Neu erzeugter Claim-Link für Supportfälle</p>
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
