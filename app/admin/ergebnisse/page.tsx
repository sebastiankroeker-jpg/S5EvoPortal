"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import BottomTabBar from "@/app/components/bottom-tab-bar";
import NavBar from "@/app/components/nav-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { navigateFromExternalBottomTab } from "@/lib/bottom-tab-navigation";
import { useCompetition } from "@/lib/competition-context";
import { usePermissions } from "@/lib/permissions-context";

type WorkbenchTab = "overview" | "packages" | "mapping";

type ResultStagingBatch = {
  id: string;
  source: string;
  sourceLabel: string;
  purpose: string;
  purposeLabel: string;
  status: string;
  statusLabel: string;
  label: string | null;
  externalRef: string | null;
  sourceVersion: string | null;
  summary: Record<string, unknown> | null;
  validationSummary: Record<string, unknown> | null;
  stagedAt: string;
  reviewedAt: string | null;
  publishedAt: string | null;
  discardedAt: string | null;
  createdAt: string;
  updatedAt: string;
  counts: {
    rawRecords: number;
    drafts: number;
    publications: number;
    resetSnapshots: number;
  };
};

type BatchesResponse = {
  competition?: {
    id: string;
    name: string;
    year: number;
    status: string;
  };
  batches?: ResultStagingBatch[];
  error?: string;
};

const WORKBENCH_TABS: Array<{ id: WorkbenchTab; label: string; description: string }> = [
  { id: "overview", label: "Überblick", description: "Ampeln, offene Pakete und Konflikte pro Ergebnisfluss." },
  { id: "packages", label: "Pakete", description: "Raw Packages aus Uhr, Legacy-Import und manueller Pflege." },
  { id: "mapping", label: "Zuordnung & Validierung", description: "STRNR-, Teilnehmer- und Disziplin-Klärung vor Drafts." },
];

const DISCIPLINE_FILTERS = [
  { value: "all", label: "Alle Disziplinen" },
  { value: "RUN", label: "Laufen" },
  { value: "BENCH", label: "Bankdrücken" },
  { value: "STOCK", label: "Stockschießen" },
  { value: "ROAD", label: "Rennrad" },
  { value: "MTB", label: "Mountainbike" },
];

const SOURCE_FILTERS = [
  { value: "all", label: "Alle Quellen" },
  { value: "LEGACY_IMPORT", label: "Legacy" },
  { value: "TIMEKEEPING_SYNC", label: "Uhr" },
  { value: "MANUAL_ADMIN", label: "Manuell" },
  { value: "SYSTEM_RECALC", label: "System" },
];

const PURPOSE_FILTERS = [
  { value: "all", label: "Alle Zwecke" },
  { value: "PRODUCTION", label: "Produktion" },
  { value: "PROD_TEST", label: "Produktionstest" },
  { value: "DRY_RUN", label: "Dry Run" },
];

const STATUS_FILTERS = [
  { value: "all", label: "Alle Status" },
  { value: "STAGED", label: "Gestaged" },
  { value: "VALIDATED", label: "Validiert" },
  { value: "REVIEWED", label: "Geprüft" },
  { value: "PUBLISHED", label: "Publiziert" },
  { value: "DISCARDED", label: "Verworfen" },
  { value: "ERROR", label: "Fehler" },
];

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("de-DE");
}

function statusVariant(status: string): "destructive" | "outline" | "secondary" {
  if (status === "ERROR") return "destructive";
  if (status === "PUBLISHED" || status === "DISCARDED") return "secondary";
  return "outline";
}

function packageTitle(batch: ResultStagingBatch) {
  return batch.label || batch.externalRef || batch.id;
}

function selectClassName() {
  return "h-10 rounded-md border border-border bg-background px-3 text-sm";
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/20 px-4 py-8 text-sm">
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-1 text-muted-foreground">{text}</p>
    </div>
  );
}

export default function ResultDataWorkbenchPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { can, isLoading: permissionsLoading } = usePermissions();
  const { active: activeCompetition } = useCompetition();

  const [activeTab, setActiveTab] = useState<WorkbenchTab>("overview");
  const [discipline, setDiscipline] = useState("all");
  const [source, setSource] = useState("all");
  const [purpose, setPurpose] = useState("all");
  const [batchStatus, setBatchStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batches, setBatches] = useState<ResultStagingBatch[]>([]);

  const hasAdminAccess = !!session && can("config.edit");

  const navigateFromBottomTab = (tabId: string) => {
    navigateFromExternalBottomTab(router, tabId);
  };

  const loadBatches = useCallback(async () => {
    if (!activeCompetition?.id || !hasAdminAccess) return;

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        competitionId: activeCompetition.id,
        limit: "100",
      });
      const response = await fetch(`/api/admin/result-staging/batches?${params.toString()}`, {
        cache: "no-store",
      });
      const data = (await response.json().catch(() => ({}))) as BatchesResponse;
      if (!response.ok) {
        throw new Error(data.error || "Ergebnis-Pakete konnten nicht geladen werden.");
      }
      setBatches(Array.isArray(data.batches) ? data.batches : []);
    } catch (requestError) {
      setBatches([]);
      setError(requestError instanceof Error ? requestError.message : "Ergebnis-Pakete konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [activeCompetition?.id, hasAdminAccess]);

  useEffect(() => {
    if (!permissionsLoading && hasAdminAccess) {
      void loadBatches();
    }
  }, [hasAdminAccess, loadBatches, permissionsLoading]);

  const filteredBatches = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return batches.filter((batch) => {
      if (source !== "all" && batch.source !== source) return false;
      if (purpose !== "all" && batch.purpose !== purpose) return false;
      if (batchStatus !== "all" && batch.status !== batchStatus) return false;
      if (discipline !== "all") {
        const summaryText = JSON.stringify(batch.summary || {}).toLowerCase();
        const validationText = JSON.stringify(batch.validationSummary || {}).toLowerCase();
        if (!summaryText.includes(discipline.toLowerCase()) && !validationText.includes(discipline.toLowerCase())) {
          return false;
        }
      }
      if (normalizedSearch) {
        const haystack = [
          batch.id,
          batch.label,
          batch.externalRef,
          batch.sourceLabel,
          batch.purposeLabel,
          batch.statusLabel,
          batch.sourceVersion,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(normalizedSearch)) return false;
      }
      return true;
    });
  }, [batchStatus, batches, discipline, purpose, search, source]);

  const summary = useMemo(() => {
    const rawRecords = filteredBatches.reduce((sum, batch) => sum + batch.counts.rawRecords, 0);
    const drafts = filteredBatches.reduce((sum, batch) => sum + batch.counts.drafts, 0);
    const publications = filteredBatches.reduce((sum, batch) => sum + batch.counts.publications, 0);
    const conflicts = filteredBatches.reduce((sum, batch) => {
      const validationSummary = batch.validationSummary || {};
      const conflictCount = validationSummary.conflicts;
      const warningCount = validationSummary.warnings;
      return sum + (typeof conflictCount === "number" ? conflictCount : 0) + (typeof warningCount === "number" ? warningCount : 0);
    }, 0);
    return {
      packages: filteredBatches.length,
      rawRecords,
      drafts,
      publications,
      conflicts,
      openPackages: filteredBatches.filter((batch) => ["STAGED", "VALIDATED", "REVIEWED", "ERROR"].includes(batch.status)).length,
    };
  }, [filteredBatches]);

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
              <CardDescription>Nur Admins können Ergebnisdaten verwalten.</CardDescription>
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
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Ergebnisdaten</h1>
            <p className="text-sm text-muted-foreground">
              Raw Packages annehmen, Zuordnungen klären und Ergebnisdaten kontrolliert Richtung Veröffentlichung führen.
            </p>
            <p className="text-xs text-muted-foreground">
              Aktiver Wettkampf: {activeCompetition?.name || "Kein Wettkampf ausgewählt"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void loadBatches()} disabled={loading || !activeCompetition?.id}>
              {loading ? "Lade..." : "Aktualisieren"}
            </Button>
            <Link href="/admin?tab=competition">
              <Button variant="outline">Wettkampf-Admin</Button>
            </Link>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Arbeitskontext</CardTitle>
            <CardDescription>Filter gelten über alle Tabs hinweg und bleiben bewusst nah am Wettkampfablauf.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-5">
              <select value={discipline} onChange={(event) => setDiscipline(event.target.value)} className={selectClassName()}>
                {DISCIPLINE_FILTERS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <select value={source} onChange={(event) => setSource(event.target.value)} className={selectClassName()}>
                {SOURCE_FILTERS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <select value={purpose} onChange={(event) => setPurpose(event.target.value)} className={selectClassName()}>
                {PURPOSE_FILTERS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <select value={batchStatus} onChange={(event) => setBatchStatus(event.target.value)} className={selectClassName()}>
                {STATUS_FILTERS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Paket, Quelle, Ref suchen" />
            </div>
            <div className="flex flex-wrap gap-2">
              {WORKBENCH_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`h-9 rounded-md border px-3 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid gap-3 md:grid-cols-6">
              <div className="rounded-md border border-border/60 bg-card px-3 py-3">
                <p className="text-xs text-muted-foreground">Pakete</p>
                <p className="text-2xl font-semibold">{summary.packages}</p>
              </div>
              <div className="rounded-md border border-border/60 bg-card px-3 py-3">
                <p className="text-xs text-muted-foreground">Offen</p>
                <p className="text-2xl font-semibold">{summary.openPackages}</p>
              </div>
              <div className="rounded-md border border-border/60 bg-card px-3 py-3">
                <p className="text-xs text-muted-foreground">Raw Records</p>
                <p className="text-2xl font-semibold">{summary.rawRecords}</p>
              </div>
              <div className="rounded-md border border-border/60 bg-card px-3 py-3">
                <p className="text-xs text-muted-foreground">Drafts</p>
                <p className="text-2xl font-semibold">{summary.drafts}</p>
              </div>
              <div className="rounded-md border border-border/60 bg-card px-3 py-3">
                <p className="text-xs text-muted-foreground">Publikationen</p>
                <p className="text-2xl font-semibold">{summary.publications}</p>
              </div>
              <div className="rounded-md border border-border/60 bg-card px-3 py-3">
                <p className="text-xs text-muted-foreground">Warnungen</p>
                <p className="text-2xl font-semibold">{summary.conflicts}</p>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Arbeitsfluss</CardTitle>
                <CardDescription>{WORKBENCH_TABS.find((tab) => tab.id === activeTab)?.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {filteredBatches.length === 0 ? (
                  <EmptyState
                    title="Noch keine Ergebnis-Pakete im aktuellen Filter."
                    text="Sobald Legacy-Importe, Uhr-Syncs oder manuelle Ergebnis-Pakete gestaged werden, erscheinen sie hier mit Validierungs- und Draft-Fortschritt."
                  />
                ) : (
                  <div className="space-y-3">
                    {filteredBatches.slice(0, 8).map((batch) => (
                      <div key={batch.id} className="rounded-md border border-border/60 bg-muted/20 px-4 py-3">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="font-medium">{packageTitle(batch)}</p>
                            <p className="text-xs text-muted-foreground">
                              {batch.sourceLabel} • {batch.purposeLabel} • {formatDateTime(batch.createdAt)}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant={statusVariant(batch.status)}>{batch.statusLabel}</Badge>
                            <Badge variant="outline">{batch.counts.rawRecords} Raw</Badge>
                            <Badge variant="outline">{batch.counts.drafts} Drafts</Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "packages" && (
          <Card>
            <CardHeader>
              <CardTitle>Pakete</CardTitle>
              <CardDescription>{WORKBENCH_TABS.find((tab) => tab.id === activeTab)?.description}</CardDescription>
            </CardHeader>
            <CardContent>
              {filteredBatches.length === 0 ? (
                <EmptyState
                  title="Keine Pakete gefunden."
                  text="Der nächste Bauabschnitt ist der Legacy-Import in diese Paketliste. Danach können Pakete geöffnet, validiert und verworfen werden."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[880px] text-left text-sm">
                    <thead className="border-b border-border/60 text-xs text-muted-foreground">
                      <tr>
                        <th className="py-2 pr-3 font-medium">Paket</th>
                        <th className="py-2 pr-3 font-medium">Quelle</th>
                        <th className="py-2 pr-3 font-medium">Zweck</th>
                        <th className="py-2 pr-3 font-medium">Status</th>
                        <th className="py-2 pr-3 font-medium text-right">Raw</th>
                        <th className="py-2 pr-3 font-medium text-right">Drafts</th>
                        <th className="py-2 pr-3 font-medium text-right">Publ.</th>
                        <th className="py-2 pr-3 font-medium">Erstellt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBatches.map((batch) => (
                        <tr key={batch.id} className="border-b border-border/40">
                          <td className="py-3 pr-3">
                            <p className="font-medium">{packageTitle(batch)}</p>
                            <p className="text-xs text-muted-foreground">{batch.id}</p>
                          </td>
                          <td className="py-3 pr-3">{batch.sourceLabel}</td>
                          <td className="py-3 pr-3">{batch.purposeLabel}</td>
                          <td className="py-3 pr-3">
                            <Badge variant={statusVariant(batch.status)}>{batch.statusLabel}</Badge>
                          </td>
                          <td className="py-3 pr-3 text-right tabular-nums">{batch.counts.rawRecords}</td>
                          <td className="py-3 pr-3 text-right tabular-nums">{batch.counts.drafts}</td>
                          <td className="py-3 pr-3 text-right tabular-nums">{batch.counts.publications}</td>
                          <td className="py-3 pr-3">{formatDateTime(batch.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "mapping" && (
          <Card>
            <CardHeader>
              <CardTitle>Zuordnung & Validierung</CardTitle>
              <CardDescription>{WORKBENCH_TABS.find((tab) => tab.id === activeTab)?.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-md border border-border/60 px-3 py-3">
                  <p className="text-xs text-muted-foreground">Zu klärende Pakete</p>
                  <p className="text-2xl font-semibold">{summary.openPackages}</p>
                </div>
                <div className="rounded-md border border-border/60 px-3 py-3">
                  <p className="text-xs text-muted-foreground">Raw Records im Filter</p>
                  <p className="text-2xl font-semibold">{summary.rawRecords}</p>
                </div>
                <div className="rounded-md border border-border/60 px-3 py-3">
                  <p className="text-xs text-muted-foreground">Drafts im Filter</p>
                  <p className="text-2xl font-semibold">{summary.drafts}</p>
                </div>
              </div>
              <EmptyState
                title="Zeilen-Mapping ist der nächste Datenanschluss."
                text="Für echte STRNR-/Teilnehmer-Klärung brauchen wir als nächsten API-Schritt Paketdetails mit Raw Records, Teilnehmer-Matching und Validierungsaktionen. Dieser Tab setzt dafür bereits den Platz im Workflow."
              />
              <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Bearbeiten, Anpassen und Freigeben bleibt hier bewusst gesperrt, bis Raw-Record-Details und Draft-Derivation implementiert sind.
              </div>
            </CardContent>
          </Card>
        )}
      </main>
      <div className="lg:hidden">
        <BottomTabBar activeTab="orga" onTabChange={navigateFromBottomTab} />
      </div>
    </div>
  );
}
