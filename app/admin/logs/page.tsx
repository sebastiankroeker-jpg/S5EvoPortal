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
import { navigateFromExternalBottomTab } from "@/lib/bottom-tab-navigation";
import { usePermissions } from "@/lib/permissions-context";

type RuntimeLogEntry = {
  id: string;
  timestamp: string | null;
  deploymentId: string;
  level: string;
  message: string;
  source: string;
  domain: string;
  requestMethod: string;
  requestPath: string;
  responseStatusCode: number;
  environment: string;
  branch: string;
  traceId: string;
};

type RuntimeLogsResponse = {
  logs?: RuntimeLogEntry[];
  hasMoreRows?: boolean;
  error?: string;
};

function formatTimestamp(value: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("de-DE");
}

function statusBadgeVariant(statusCode: number): "destructive" | "outline" | "secondary" {
  if (statusCode >= 500) return "destructive";
  if (statusCode >= 400) return "secondary";
  return "outline";
}

export default function AdminLogsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { can, isLoading: permissionsLoading } = usePermissions();
  const hasAdminAccess = !!session && can("config.edit");

  const [since, setSince] = useState("24h");
  const [statusCode, setStatusCode] = useState("500");
  const [limit, setLimit] = useState("100");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<RuntimeLogEntry[]>([]);
  const [hasMoreRows, setHasMoreRows] = useState(false);

  const navigateFromBottomTab = (tabId: string) => {
    navigateFromExternalBottomTab(router, tabId);
  };

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        since,
        statusCode,
        limit,
        environment: "production",
        level: "error",
      });

      if (search.trim()) {
        params.set("search", search.trim());
      }

      const response = await fetch(`/api/admin/runtime-logs?${params.toString()}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as RuntimeLogsResponse;

      if (!response.ok) {
        setLogs([]);
        setHasMoreRows(false);
        setError(data.error || "Logs konnten nicht geladen werden.");
        return;
      }

      setLogs(Array.isArray(data.logs) ? data.logs : []);
      setHasMoreRows(data.hasMoreRows === true);
    } catch (requestError) {
      setLogs([]);
      setHasMoreRows(false);
      setError(requestError instanceof Error ? requestError.message : "Logs konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [limit, search, since, statusCode]);

  useEffect(() => {
    if (!permissionsLoading && hasAdminAccess) {
      void loadLogs();
    }
  }, [hasAdminAccess, loadLogs, permissionsLoading]);

  const summary = useMemo(() => {
    const errors5xx = logs.filter((entry) => entry.responseStatusCode >= 500).length;
    const uniquePaths = new Set(logs.map((entry) => entry.requestPath).filter(Boolean)).size;
    return {
      total: logs.length,
      errors5xx,
      uniquePaths,
    };
  }, [logs]);

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
              <CardDescription>Nur Admins und Moderatoren können Runtime-Logs sehen.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin">
                <Button className="w-full">Zurück zur Administration</Button>
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
          <h1 className="text-3xl font-bold tracking-tight">Runtime-Logs</h1>
          <p className="text-sm text-muted-foreground">Error-Feed aus Vercel Production-Logs für schnelle Incident-Analyse.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filter</CardTitle>
            <CardDescription>Zeitfenster, Statuscode und Suchbegriff für den Error-Feed.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Seit</p>
                <Input value={since} onChange={(event) => setSince(event.target.value)} placeholder="24h / 90m / ISO" />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Statuscode</p>
                <Input value={statusCode} onChange={(event) => setStatusCode(event.target.value)} placeholder="500" />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Limit</p>
                <Input value={limit} onChange={(event) => setLimit(event.target.value)} placeholder="100" />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Suche</p>
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="bundleId / /api/teams" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void loadLogs()} disabled={loading}>
                {loading ? "Lade..." : "Aktualisieren"}
              </Button>
              <Link href="/admin">
                <Button variant="outline">Zurück zu Admin</Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Log-Zeilen</CardDescription>
              <CardTitle className="text-2xl">{summary.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>HTTP 5xx</CardDescription>
              <CardTitle className="text-2xl">{summary.errors5xx}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Betroffene Endpoints</CardDescription>
              <CardTitle className="text-2xl">{summary.uniquePaths}</CardTitle>
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
            <CardTitle>Error-Feed</CardTitle>
            <CardDescription>
              {hasMoreRows ? "Es gibt weitere Treffer außerhalb des aktuellen Limits." : "Alle Treffer im aktuellen Filter geladen."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Treffer mit den aktuellen Filtern.</p>
            ) : (
              <div className="space-y-3">
                {logs.map((entry) => (
                  <div key={entry.id || `${entry.timestamp}-${entry.requestPath}`} className="rounded-md border border-border/60 p-3">
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant={statusBadgeVariant(entry.responseStatusCode)}>{entry.responseStatusCode || "—"}</Badge>
                      <Badge variant="outline">{entry.requestMethod || "?"}</Badge>
                      <span className="text-muted-foreground">{formatTimestamp(entry.timestamp)}</span>
                      {entry.branch ? <Badge variant="secondary">{entry.branch}</Badge> : null}
                    </div>
                    <p className="font-mono text-xs text-foreground">{entry.requestPath || "—"}</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{entry.message || "Keine Nachricht vorhanden."}</p>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>Domain: {entry.domain || "—"}</span>
                      <span>Deployment: {entry.deploymentId || "—"}</span>
                      <span>Trace: {entry.traceId || "—"}</span>
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
