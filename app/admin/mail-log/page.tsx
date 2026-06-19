"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

import BottomTabBar from "@/app/components/bottom-tab-bar";
import NavBar from "@/app/components/nav-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { navigateFromExternalBottomTab } from "@/lib/bottom-tab-navigation";
import { usePermissions } from "@/lib/permissions-context";

type MailEventStatus = "sent" | "skipped" | "failed" | "generated" | "unknown";
type MailEventSource = "team_registration" | "team_lifecycle" | "participant_claim" | "participant_change";

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

type MailEventsResponse = {
  events?: MailEvent[];
  summary?: {
    total: number;
    sent: number;
    generated: number;
    issues: number;
  };
  error?: string;
};

function formatTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("de-DE");
}

function statusLabel(status: MailEventStatus) {
  if (status === "sent") return "Gesendet";
  if (status === "skipped") return "Uebersprungen";
  if (status === "failed") return "Fehler";
  if (status === "generated") return "Erzeugt";
  return "Unbekannt";
}

function statusVariant(status: MailEventStatus): "destructive" | "outline" | "secondary" {
  if (status === "failed") return "destructive";
  if (status === "skipped" || status === "generated") return "secondary";
  return "outline";
}

function sourceLabel(source: MailEventSource) {
  if (source === "team_registration") return "Anmeldungen";
  if (source === "team_lifecycle") return "Archiv/Restore";
  if (source === "participant_change") return "Teilnehmer-Änderungen";
  return "Teilnehmer-Einladung";
}

export default function AdminMailLogPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { can, isLoading: permissionsLoading } = usePermissions();
  const hasAdminAccess = !!session && can("config.edit");

  const [source, setSource] = useState("all");
  const [mailStatus, setMailStatus] = useState("all");
  const [limit, setLimit] = useState("80");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<MailEvent[]>([]);
  const [summary, setSummary] = useState({ total: 0, sent: 0, generated: 0, issues: 0 });

  const navigateFromBottomTab = (tabId: string) => {
    navigateFromExternalBottomTab(router, tabId);
  };

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        source,
        status: mailStatus,
        limit,
      });

      if (search.trim()) {
        params.set("search", search.trim());
      }

      const response = await fetch(`/api/admin/mail-events?${params.toString()}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as MailEventsResponse;

      if (!response.ok) {
        setEvents([]);
        setSummary({ total: 0, sent: 0, generated: 0, issues: 0 });
        setError(data.error || "Mail-Protokoll konnte nicht geladen werden.");
        return;
      }

      setEvents(Array.isArray(data.events) ? data.events : []);
      setSummary(data.summary || { total: 0, sent: 0, generated: 0, issues: 0 });
    } catch (requestError) {
      setEvents([]);
      setSummary({ total: 0, sent: 0, generated: 0, issues: 0 });
      setError(requestError instanceof Error ? requestError.message : "Mail-Protokoll konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [limit, mailStatus, search, source]);

  useEffect(() => {
    if (!permissionsLoading && hasAdminAccess) {
      void loadEvents();
    }
  }, [hasAdminAccess, loadEvents, permissionsLoading]);

  const latestEvent = useMemo(() => events[0], [events]);

  if (status === "loading" || permissionsLoading) {
    return (
      <div className="min-h-screen bg-background pb-24 lg:pb-0">
        <NavBar />
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  if (!hasAdminAccess) {
    return (
      <div className="min-h-screen bg-background pb-24 lg:pb-0">
        <NavBar />
        <div className="mx-auto flex min-h-[60vh] max-w-md items-center justify-center px-4">
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Kein Zugriff</CardTitle>
              <CardDescription>Nur Admins koennen das Mail-Protokoll sehen.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin">
                <Button className="w-full">Zurueck zur Administration</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-0">
      <NavBar />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Mail-Protokoll</h1>
          <p className="text-sm text-muted-foreground">
            Zentraler Blick auf aktuell protokollierte Mail- und Einladungsereignisse.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filter</CardTitle>
            <CardDescription>Quelle, Status, Limit und Suche fuer das Protokoll.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Quelle</p>
                <Select value={source} onValueChange={setSource}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Quellen</SelectItem>
                    <SelectItem value="team_registration">Anmeldungen</SelectItem>
                    <SelectItem value="team_lifecycle">Archiv/Restore</SelectItem>
                    <SelectItem value="participant_change">Teilnehmer-Änderungen</SelectItem>
                    <SelectItem value="participant_claim">Teilnehmer-Einladungen</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Status</p>
                <Select value={mailStatus} onValueChange={setMailStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Status</SelectItem>
                    <SelectItem value="sent">Gesendet</SelectItem>
                    <SelectItem value="generated">Erzeugt</SelectItem>
                    <SelectItem value="skipped">Uebersprungen</SelectItem>
                    <SelectItem value="failed">Fehler</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Limit</p>
                <Input value={limit} onChange={(event) => setLimit(event.target.value)} placeholder="80" />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Suche</p>
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Team, Empfaenger, Betreff" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void loadEvents()} disabled={loading}>
                {loading ? "Lade..." : "Aktualisieren"}
              </Button>
              <Link href="/admin">
                <Button variant="outline">Zurueck zu Admin</Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Treffer</CardDescription>
              <CardTitle className="text-2xl">{summary.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Gesendet</CardDescription>
              <CardTitle className="text-2xl">{summary.sent}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Einladungen erzeugt</CardDescription>
              <CardTitle className="text-2xl">{summary.generated}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Hinweise</CardDescription>
              <CardTitle className="text-2xl">{summary.issues}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {error && (
          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle className="text-destructive">Fehler beim Laden</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Ereignisse</CardTitle>
            <CardDescription>
              {latestEvent ? `Neuester Eintrag: ${formatTimestamp(latestEvent.createdAt)}` : "Keine Eintraege mit den aktuellen Filtern."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Mail-Ereignisse gefunden.</p>
            ) : (
              <div className="space-y-3">
                {events.map((event) => (
                  <div key={event.id} className="rounded-md border border-border/60 p-3">
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant={statusVariant(event.status)}>{statusLabel(event.status)}</Badge>
                      <Badge variant="outline">{sourceLabel(event.source)}</Badge>
                      <span className="text-muted-foreground">{formatTimestamp(event.createdAt)}</span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{event.title}{event.teamName ? `: ${event.teamName}` : ""}</p>
                      {event.subject ? <p className="text-xs text-muted-foreground">Betreff: {event.subject}</p> : null}
                      {event.recipients.length > 0 ? (
                        <p className="break-words text-xs text-muted-foreground">An: {event.recipients.join(", ")}</p>
                      ) : null}
                      {event.actor ? <p className="text-xs text-muted-foreground">Ausgeloest von: {event.actor}</p> : null}
                      {event.detail ? <p className="text-xs text-muted-foreground">{event.detail}</p> : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <div className="lg:hidden">
        <BottomTabBar activeTab="orga" onTabChange={navigateFromBottomTab} />
      </div>
    </div>
  );
}
