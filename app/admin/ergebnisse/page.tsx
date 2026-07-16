"use client";

import Image from "next/image";
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
import { FIVE_KAMPF_BRAND, type BrandDisciplineCode } from "@/lib/brand-assets";
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

type TimekeepingSessionSummary = {
  id: string;
  deviceId: string;
  disciplineCode: string;
  startBlockName: string;
  status: string;
  firstStartNumber: number | null;
  startIntervalSeconds: number;
  manualStartedAt: string | null;
  createdAt: string;
  updatedAt: string;
  counts: {
    finishEvents: number;
    finishWithStartNumber: number;
    finishWithoutStartNumber: number;
    withElapsed: number;
    importedFinishEvents: number;
    newFinishEvents: number;
  };
};

type TimekeepingSessionsResponse = {
  sessions?: TimekeepingSessionSummary[];
  error?: string;
};

type TimekeepingImportResponse = {
  batchId?: string;
  label?: string | null;
  counts?: {
    finishEvents: number;
    importedRecords: number;
    skippedDuplicates: number;
    missingStartNumber: number;
    missingElapsed: number;
    warnings: number;
  };
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

const BRAND_DISCIPLINES = Object.entries(FIVE_KAMPF_BRAND.disciplines) as Array<[
  BrandDisciplineCode,
  (typeof FIVE_KAMPF_BRAND.disciplines)[BrandDisciplineCode],
]>;

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

function timekeepingSessionTitle(timekeepingSession: TimekeepingSessionSummary) {
  return `${timekeepingSession.disciplineCode} • ${timekeepingSession.startBlockName} • ${formatDateTime(timekeepingSession.updatedAt)}`;
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
  const [loadingTimekeeping, setLoadingTimekeeping] = useState(false);
  const [importingTimekeeping, setImportingTimekeeping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timekeepingFeedback, setTimekeepingFeedback] = useState<string | null>(null);
  const [batches, setBatches] = useState<ResultStagingBatch[]>([]);
  const [timekeepingSessions, setTimekeepingSessions] = useState<TimekeepingSessionSummary[]>([]);
  const [selectedTimekeepingSessionId, setSelectedTimekeepingSessionId] = useState("");
  const [timekeepingPurpose, setTimekeepingPurpose] = useState("PROD_TEST");

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

  const loadTimekeepingSessions = useCallback(async () => {
    if (!activeCompetition?.id || !hasAdminAccess) return;

    setLoadingTimekeeping(true);
    try {
      const params = new URLSearchParams({
        competitionId: activeCompetition.id,
      });
      if (discipline !== "all" && ["RUN", "ROAD", "MTB"].includes(discipline)) {
        params.set("disciplineCode", discipline);
      }
      const response = await fetch(`/api/admin/result-staging/timekeeping/sessions?${params.toString()}`, {
        cache: "no-store",
      });
      const data = (await response.json().catch(() => ({}))) as TimekeepingSessionsResponse;
      if (!response.ok) {
        throw new Error(data.error || "Zeitnahme-Sessions konnten nicht geladen werden.");
      }
      const sessions = Array.isArray(data.sessions) ? data.sessions : [];
      setTimekeepingSessions(sessions);
      setSelectedTimekeepingSessionId((current) => (
        current && sessions.some((timekeepingSession) => timekeepingSession.id === current)
          ? current
          : sessions[0]?.id || ""
      ));
    } catch (requestError) {
      setTimekeepingSessions([]);
      setSelectedTimekeepingSessionId("");
      setError(requestError instanceof Error ? requestError.message : "Zeitnahme-Sessions konnten nicht geladen werden.");
    } finally {
      setLoadingTimekeeping(false);
    }
  }, [activeCompetition?.id, discipline, hasAdminAccess]);

  useEffect(() => {
    if (!permissionsLoading && hasAdminAccess) {
      void loadBatches();
      void loadTimekeepingSessions();
    }
  }, [hasAdminAccess, loadBatches, loadTimekeepingSessions, permissionsLoading]);

  const selectedTimekeepingSession = useMemo(
    () => timekeepingSessions.find((timekeepingSession) => timekeepingSession.id === selectedTimekeepingSessionId) || null,
    [selectedTimekeepingSessionId, timekeepingSessions],
  );

  const importTimekeepingSession = async () => {
    if (!activeCompetition?.id || !selectedTimekeepingSession || importingTimekeeping) return;

    setImportingTimekeeping(true);
    setError(null);
    setTimekeepingFeedback(null);
    try {
      const response = await fetch("/api/admin/result-staging/timekeeping/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competitionId: activeCompetition.id,
          sessionId: selectedTimekeepingSession.id,
          purpose: timekeepingPurpose,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as TimekeepingImportResponse;
      if (!response.ok) {
        throw new Error(data.error || "Zeitnahme-Session konnte nicht uebernommen werden.");
      }

      setSource("TIMEKEEPING_SYNC");
      setActiveTab("packages");
      setTimekeepingFeedback(
        `Paket ${data.label || data.batchId} erstellt: ${data.counts?.importedRecords ?? 0} Raw Records, ${data.counts?.warnings ?? 0} Warnungen.`,
      );
      await Promise.all([loadBatches(), loadTimekeepingSessions()]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Zeitnahme-Session konnte nicht uebernommen werden.");
    } finally {
      setImportingTimekeeping(false);
    }
  };

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
        <div className="overflow-hidden rounded-md border border-border/60 bg-card">
          <div className="relative min-h-[170px]">
            <Image
              src={FIVE_KAMPF_BRAND.banner}
              alt=""
              fill
              sizes="(min-width: 1280px) 1184px, 100vw"
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/72 via-black/42 to-black/10" />
            <div className="relative flex min-h-[170px] flex-col justify-end gap-3 p-5 text-white md:flex-row md:items-end md:justify-between md:p-6">
              <div className="max-w-2xl space-y-1">
                <h1 className="text-3xl font-bold tracking-tight">Ergebnisdaten</h1>
                <p className="text-sm text-white/85">
                  Raw Packages annehmen, Zuordnungen klären und Ergebnisdaten kontrolliert Richtung Veröffentlichung führen.
                </p>
                <p className="text-xs text-white/75">
                  Aktiver Wettkampf: {activeCompetition?.name || "Kein Wettkampf ausgewählt"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    void loadBatches();
                    void loadTimekeepingSessions();
                  }}
                  disabled={loading || loadingTimekeeping || !activeCompetition?.id}
                >
                  {loading ? "Lade..." : "Aktualisieren"}
                </Button>
                <Link href="/admin?tab=competition">
                  <Button variant="secondary">Wettkampf-Admin</Button>
                </Link>
              </div>
            </div>
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
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <button
                type="button"
                onClick={() => setDiscipline("all")}
                className={`flex h-20 items-center gap-3 rounded-md border px-3 text-left transition-colors ${
                  discipline === "all"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:bg-muted"
                }`}
              >
                <span className="relative size-12 shrink-0 overflow-hidden rounded-md bg-muted">
                  <Image src={FIVE_KAMPF_BRAND.mark} alt="" fill sizes="48px" className="object-cover" />
                </span>
                <span className="text-sm font-medium">Alle Disziplinen</span>
              </button>
              {BRAND_DISCIPLINES.map(([code, brandDiscipline]) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setDiscipline(code)}
                  className={`flex h-20 items-center gap-3 rounded-md border px-3 text-left transition-colors ${
                    discipline === code
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:bg-muted"
                  }`}
                >
                  <span className="relative size-12 shrink-0 overflow-hidden rounded-md bg-muted">
                    <Image src={brandDiscipline.image} alt="" fill sizes="48px" className="object-cover" />
                  </span>
                  <span className="min-w-0 text-sm font-medium leading-tight">{brandDiscipline.label}</span>
                </button>
              ))}
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

        {timekeepingFeedback && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {timekeepingFeedback}
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
            <CardContent className="space-y-5">
              <div className="rounded-md border border-border/60 bg-muted/20 px-4 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div className="space-y-1">
                    <p className="font-medium">Zeitnahme-Sync übernehmen</p>
                    <p className="text-sm text-muted-foreground">
                      Zieleinlauf-Events aus einer Uhr-Session bewusst als Raw Package ins Ergebnis-Staging übernehmen.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => void loadTimekeepingSessions()}
                    disabled={loadingTimekeeping || !activeCompetition?.id}
                  >
                    {loadingTimekeeping ? "Lade..." : "Sessions aktualisieren"}
                  </Button>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(180px,220px)_auto]">
                  <select
                    value={selectedTimekeepingSessionId}
                    onChange={(event) => setSelectedTimekeepingSessionId(event.target.value)}
                    className={selectClassName()}
                    disabled={loadingTimekeeping || timekeepingSessions.length === 0}
                  >
                    {timekeepingSessions.length === 0 ? (
                      <option value="">Keine Zeitnahme-Session gefunden</option>
                    ) : (
                      timekeepingSessions.map((timekeepingSession) => (
                        <option key={timekeepingSession.id} value={timekeepingSession.id}>
                          {timekeepingSessionTitle(timekeepingSession)}
                        </option>
                      ))
                    )}
                  </select>
                  <select
                    value={timekeepingPurpose}
                    onChange={(event) => setTimekeepingPurpose(event.target.value)}
                    className={selectClassName()}
                  >
                    <option value="PROD_TEST">Produktionstest</option>
                    <option value="PRODUCTION">Produktion</option>
                    <option value="DRY_RUN">Dry Run</option>
                  </select>
                  <Button
                    onClick={() => void importTimekeepingSession()}
                    disabled={!selectedTimekeepingSession || selectedTimekeepingSession.counts.newFinishEvents === 0 || importingTimekeeping}
                  >
                    {importingTimekeeping ? "Übernehme..." : "Als Paket übernehmen"}
                  </Button>
                </div>

                {selectedTimekeepingSession ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-6">
                    <div className="rounded-md border border-border bg-background px-3 py-2">
                      <p className="text-xs text-muted-foreground">Finish</p>
                      <p className="text-lg font-semibold">{selectedTimekeepingSession.counts.finishEvents}</p>
                    </div>
                    <div className="rounded-md border border-border bg-background px-3 py-2">
                      <p className="text-xs text-muted-foreground">Neu</p>
                      <p className="text-lg font-semibold">{selectedTimekeepingSession.counts.newFinishEvents}</p>
                    </div>
                    <div className="rounded-md border border-border bg-background px-3 py-2">
                      <p className="text-xs text-muted-foreground">Bereits Paket</p>
                      <p className="text-lg font-semibold">{selectedTimekeepingSession.counts.importedFinishEvents}</p>
                    </div>
                    <div className="rounded-md border border-border bg-background px-3 py-2">
                      <p className="text-xs text-muted-foreground">Mit STRNR</p>
                      <p className="text-lg font-semibold">{selectedTimekeepingSession.counts.finishWithStartNumber}</p>
                    </div>
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                      <p className="text-xs text-amber-900">Ohne STRNR</p>
                      <p className="text-lg font-semibold text-amber-950">{selectedTimekeepingSession.counts.finishWithoutStartNumber}</p>
                    </div>
                    <div className="rounded-md border border-border bg-background px-3 py-2">
                      <p className="text-xs text-muted-foreground">Gerät</p>
                      <p className="truncate text-sm font-medium">{selectedTimekeepingSession.deviceId}</p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Noch keine Uhr-Session im aktuellen Wettkampf/Disziplin-Filter gefunden.
                  </p>
                )}
              </div>

              {filteredBatches.length === 0 ? (
                <EmptyState
                  title="Keine Pakete gefunden."
                  text="Übernimm eine Zeitnahme-Session oder später einen Legacy-Import, damit hier Raw Packages zur Kontrolle erscheinen."
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
