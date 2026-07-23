"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
type BatchDetailTab = "overview" | "drafts" | "raw" | "conflicts" | "corrections";

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

type ResultDraftDetail = {
  id: string;
  status: string;
  statusLabel: string;
  conflictStatus: string;
  disciplineCode: string;
  startNumber: string | null;
  rawValueText: string | null;
  effectiveStartNumber: string | null;
  effectiveRawValueText: string | null;
  netElapsedMs: number | null;
  validationMessages: unknown[];
  preview: {
    resultStatus: string | null;
    classPoints: number | null;
    classRank: number | null;
    classLabel: string | null;
    overallGroup: string | null;
    overallGenderPoints: number | null;
    overallGenderRank: number | null;
    effectiveResultStatus?: string | null;
  };
  sourceRawRecord: {
    id: string;
    rowKey: string;
    rowNumber: number | null;
    validationStatus: string;
    validationMessages: unknown[];
  } | null;
  team: {
    id: string;
    name: string;
    startNumber: string | null;
    classificationCode: string | null;
  } | null;
  participant: {
    id: string;
    firstName: string;
    lastName: string;
    disciplineCode: string;
  } | null;
  createdAt: string;
};

type ResultRawRecordDetail = {
  id: string;
  rowKey: string;
  disciplineCode: string | null;
  startNumber: string | null;
  participantId: string | null;
  teamId: string | null;
  rawValue: number | null;
  rawValueText: string | null;
  effectiveStartNumber: string | null;
  effectiveRawValueText: string | null;
  recordedAt: string | null;
  validationStatus: string;
  effectiveValidationStatus: string;
  validationMessages: unknown[];
  rowNumber: number | null;
  fields: Record<string, unknown> | null;
  createdAt: string;
};

type ResultStagingBatchDetails = {
  batch: ResultStagingBatch;
  rawRecords: ResultRawRecordDetail[];
  drafts: ResultDraftDetail[];
  corrections: ResultCorrectionDetail[];
};

type BatchDetailsResponse = Partial<ResultStagingBatchDetails> & {
  error?: string;
};

type ResultCorrectionDetail = {
  id: string;
  targetType: "DRAFT" | "RAW_RECORD" | string;
  targetId: string;
  field: string;
  beforeValue: string;
  afterValue: string;
  reason: string | null;
  active: boolean;
  createdAt: string;
  createdBy: string | null;
  revertedAt: string | null;
};

type CorrectionFormState = {
  targetType: "DRAFT" | "RAW_RECORD";
  targetId: string;
  targetLabel: string;
  field: string;
  beforeValue: string;
  value: string;
  reason: string;
};

type CorrectionResponse = {
  ok?: boolean;
  error?: string;
};

type TimekeepingSessionSummary = {
  id: string;
  deviceId: string;
  deviceName: string | null;
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

type LegacyRunningImportSummary = {
  rows?: number;
  validTimes?: number;
  invalidTimes?: number;
  matchedRecords?: number;
  unmatchedRecords?: number;
  warnings?: number;
  errors?: number;
  dryRun?: boolean;
};

type LegacyRunningImportResponse = {
  batchId?: string;
  label?: string | null;
  status?: string;
  summary?: LegacyRunningImportSummary;
  validation?: {
    status?: string;
    warnings?: number;
    errors?: number;
  };
  error?: string;
};

type LegacyResultImportSummary = {
  rawRows?: number;
  drafts?: number;
  disciplineCode?: string;
  disciplineCounts?: Record<string, number>;
  warnings?: number;
  errors?: number;
  engineWarnings?: number;
};

type LegacyResultImportResponse = {
  batchId?: string;
  label?: string | null;
  status?: string;
  purpose?: string;
  dryRun?: boolean;
  summary?: LegacyResultImportSummary;
  validation?: {
    status?: string;
    warnings?: number;
    errors?: number;
    engineWarnings?: number;
  };
  error?: string;
};

type ResultResetPreviewResponse = {
  expectedConfirmationText?: string;
  executable?: boolean;
  blockers?: string[];
  warnings?: string[];
  counts?: {
    batches?: number;
    rawRecords?: number;
    drafts?: number;
    publications?: number;
    publicationItems?: number;
  };
  error?: string;
};

type ResultResetExecutionResponse = {
  deletedCounts?: {
    batches?: number;
    rawRecords?: number;
    drafts?: number;
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

function concernVariant(count: number): "destructive" | "outline" | "secondary" {
  return count > 0 ? "destructive" : "secondary";
}

function packageTitle(batch: ResultStagingBatch) {
  return batch.label || batch.externalRef || batch.id;
}

function summaryNumber(summary: Record<string, unknown> | null, key: string) {
  const value = summary?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function batchConcernCount(batch: ResultStagingBatch) {
  return (
    summaryNumber(batch.validationSummary, "errors") +
    summaryNumber(batch.validationSummary, "warnings") +
    summaryNumber(batch.validationSummary, "conflicts") +
    summaryNumber(batch.summary, "errors") +
    summaryNumber(batch.summary, "warnings") +
    summaryNumber(batch.summary, "unmatchedRecords") +
    summaryNumber(batch.summary, "invalidTimes")
  );
}

function batchDisciplineLabel(batch: ResultStagingBatch) {
  const candidates = [
    batch.summary?.disciplineCode,
    batch.summary?.discipline,
    batch.validationSummary?.disciplineCode,
    batch.validationSummary?.discipline,
  ];
  const value = candidates.find((candidate): candidate is string => typeof candidate === "string" && candidate.length > 0);
  const option = DISCIPLINE_FILTERS.find((filter) => filter.value === value);
  return option?.label || value || "Gemischt";
}

function participantName(participant: ResultDraftDetail["participant"]) {
  if (!participant) return "—";
  return `${participant.firstName} ${participant.lastName}`.trim() || participant.id;
}

function messageSummary(messages: unknown[]) {
  if (messages.length === 0) return "—";
  return messages
    .map((message) => {
      if (!message || typeof message !== "object") return String(message);
      const record = message as Record<string, unknown>;
      const code = typeof record.code === "string" ? record.code : "Hinweis";
      const severity = typeof record.severity === "string" ? record.severity : null;
      const detail = typeof record.message === "string"
        ? ` (${record.message})`
        : typeof record.actual !== "undefined" || typeof record.expected !== "undefined"
          ? ` (Ist ${String(record.actual ?? "—")}, Soll ${String(record.expected ?? "—")})`
          : "";
      return severity ? `${severity}: ${code}${detail}` : `${code}${detail}`;
    })
    .join(", ");
}

function fieldValue(fields: Record<string, unknown> | null, key: string) {
  const value = fields?.[key];
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function recordValue(record: ResultRawRecordDetail, key: string) {
  if (key === "startNumber") return record.effectiveStartNumber || record.startNumber || "—";
  if (key === "disciplineCode") return record.disciplineCode || fieldValue(record.fields, "Au1Disziplin");
  if (key === "rawValueText") return record.effectiveRawValueText || record.rawValueText || fieldValue(record.fields, "AuZeit");
  return fieldValue(record.fields, key);
}

function timekeepingSessionTitle(timekeepingSession: TimekeepingSessionSummary) {
  const deviceLabel = timekeepingSession.deviceName?.trim() || timekeepingSession.deviceId;
  return `${timekeepingSession.disciplineCode} • ${timekeepingSession.startBlockName} • ${deviceLabel} • ${formatDateTime(timekeepingSession.updatedAt)}`;
}

function correctionFieldLabel(field: string) {
  if (field === "startNumber") return "Startnummer";
  if (field === "rawValueText") return "Zeit/Wert";
  if (field === "resultStatus") return "Ergebnisstatus";
  if (field === "validationStatus") return "Validierungsstatus";
  return field;
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
  const [checkingLegacyResult, setCheckingLegacyResult] = useState(false);
  const [importingLegacyResult, setImportingLegacyResult] = useState(false);
  const [importingLegacyRunning, setImportingLegacyRunning] = useState(false);
  const [resettingTestData, setResettingTestData] = useState(false);
  const legacyResultInputRef = useRef<HTMLInputElement | null>(null);
  const legacyRunningInputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timekeepingFeedback, setTimekeepingFeedback] = useState<string | null>(null);
  const [legacyResultFeedback, setLegacyResultFeedback] = useState<string | null>(null);
  const [legacyRunningFeedback, setLegacyRunningFeedback] = useState<string | null>(null);
  const [batches, setBatches] = useState<ResultStagingBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [batchDetails, setBatchDetails] = useState<ResultStagingBatchDetails | null>(null);
  const [batchDetailTab, setBatchDetailTab] = useState<BatchDetailTab>("drafts");
  const [loadingBatchDetails, setLoadingBatchDetails] = useState(false);
  const [correctionForm, setCorrectionForm] = useState<CorrectionFormState | null>(null);
  const [savingCorrection, setSavingCorrection] = useState(false);
  const [timekeepingSessions, setTimekeepingSessions] = useState<TimekeepingSessionSummary[]>([]);
  const [selectedTimekeepingSessionId, setSelectedTimekeepingSessionId] = useState("");

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

  const loadBatchDetails = useCallback(async (batchId: string) => {
    if (!activeCompetition?.id || !hasAdminAccess || !batchId) {
      setBatchDetails(null);
      return;
    }

    setLoadingBatchDetails(true);
    setError(null);
    try {
      const params = new URLSearchParams({ competitionId: activeCompetition.id });
      const response = await fetch(`/api/admin/result-staging/batches/${encodeURIComponent(batchId)}?${params.toString()}`, {
        cache: "no-store",
      });
      const data = (await response.json().catch(() => ({}))) as BatchDetailsResponse;
      if (!response.ok || !data.batch || !Array.isArray(data.drafts)) {
        throw new Error(data.error || "Paketdetails konnten nicht geladen werden.");
      }
      setBatchDetails({
        batch: data.batch,
        rawRecords: Array.isArray(data.rawRecords) ? data.rawRecords : [],
        drafts: data.drafts,
        corrections: Array.isArray(data.corrections) ? data.corrections : [],
      });
    } catch (requestError) {
      setBatchDetails(null);
      setError(requestError instanceof Error ? requestError.message : "Paketdetails konnten nicht geladen werden.");
    } finally {
      setLoadingBatchDetails(false);
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
          purpose: "PROD_TEST",
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

  const readLegacyRunningCsvFile = async (file: File) => {
    const buffer = await file.arrayBuffer();
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch {
      return new TextDecoder("windows-1252").decode(buffer);
    }
  };

  const formatLegacyResultSummary = (summary?: LegacyResultImportSummary) => {
    if (!summary) return "Keine Zusammenfassung verfügbar.";
    const disciplineCounts = Object.entries(summary.disciplineCounts || {})
      .map(([code, count]) => `${code}: ${count}`)
      .join(", ");
    return [
      `Disziplin: ${summary.disciplineCode || "unbekannt"}`,
      `Raw Records: ${summary.rawRows ?? 0}`,
      `Drafts: ${summary.drafts ?? 0}`,
      `Disziplin-Zeilen: ${disciplineCounts || "—"}`,
      `Engine-Abweichungen: ${summary.engineWarnings ?? 0}`,
      `Warnungen: ${summary.warnings ?? 0}`,
      `Fehler: ${summary.errors ?? 0}`,
    ].join("\n");
  };

  const postLegacyResultImport = async (csv: string, dryRun: boolean) => {
    if (!activeCompetition?.id) {
      throw new Error("Es ist kein aktiver Wettkampf ausgewählt.");
    }

    const response = await fetch("/api/admin/result-staging/legacy-results/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        competitionId: activeCompetition.id,
        csv,
        dryRun,
      }),
    });
    const data = (await response.json().catch(() => ({}))) as LegacyResultImportResponse;
    if (!response.ok) {
      throw new Error(data.error || "Legacy-Ergebnis-CSV konnte nicht verarbeitet werden.");
    }
    return data;
  };

  const handleLegacyResultImport = async (file: File | null) => {
    if (!file || checkingLegacyResult || importingLegacyResult) return;
    if (!activeCompetition?.id) {
      setError("Es ist kein aktiver Wettkampf ausgewählt.");
      return;
    }

    setCheckingLegacyResult(true);
    setImportingLegacyResult(true);
    setError(null);
    setLegacyResultFeedback(null);
    try {
      const csv = await readLegacyRunningCsvFile(file);
      const preview = await postLegacyResultImport(csv, true);
      const summaryText = formatLegacyResultSummary(preview.summary);
      const confirmed = window.confirm(
        `Legacy-Ergebnis Dry-run geprüft.\n\n${summaryText}\n\nJetzt als Produktionstest-Paket stagen?`,
      );
      if (!confirmed) {
        setLegacyResultFeedback(`Dry-run geprüft, kein Paket geschrieben.\n${summaryText}`);
        return;
      }

      const result = await postLegacyResultImport(csv, false);
      setSource("LEGACY_IMPORT");
      if (result.summary?.disciplineCode && result.summary.disciplineCode !== "MIXED" && result.summary.disciplineCode !== "UNKNOWN") {
        setDiscipline(result.summary.disciplineCode);
      }
      setSelectedBatchId(result.batchId || "");
      setBatchDetailTab("drafts");
      setActiveTab("mapping");
      setLegacyResultFeedback(
        `Paket ${result.label || result.batchId} erstellt.\n${formatLegacyResultSummary(result.summary)}`,
      );
      await loadBatches();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Legacy-Ergebnis-CSV konnte nicht verarbeitet werden.");
    } finally {
      setCheckingLegacyResult(false);
      setImportingLegacyResult(false);
      if (legacyResultInputRef.current) {
        legacyResultInputRef.current.value = "";
      }
    }
  };

  const postLegacyRunningImport = async (csv: string, dryRun: boolean) => {
    if (!activeCompetition?.id) {
      throw new Error("Es ist kein aktiver Wettkampf ausgewählt.");
    }

    const response = await fetch("/api/admin/result-staging/legacy-running/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        competitionId: activeCompetition.id,
        csv,
        purpose: "PROD_TEST",
        dryRun,
      }),
    });
    const data = (await response.json().catch(() => ({}))) as LegacyRunningImportResponse;
    if (!response.ok) {
      throw new Error(data.error || "Legacy-Laufen-Import fehlgeschlagen.");
    }
    return data;
  };

  const formatLegacyRunningSummary = (summary?: LegacyRunningImportSummary) => {
    if (!summary) return "Keine Zusammenfassung verfügbar.";
    return [
      `Zeilen: ${summary.rows ?? 0}`,
      `gültige Zeiten: ${summary.validTimes ?? 0}`,
      `Sonderzeiten: ${summary.invalidTimes ?? 0}`,
      `gematcht: ${summary.matchedRecords ?? 0}`,
      `offen: ${summary.unmatchedRecords ?? 0}`,
      `Warnungen: ${summary.warnings ?? 0}`,
      `Fehler: ${summary.errors ?? 0}`,
    ].join("\n");
  };

  const handleLegacyRunningImport = async (file: File | null) => {
    if (!file || importingLegacyRunning) return;
    if (!activeCompetition?.id) {
      setError("Es ist kein aktiver Wettkampf ausgewählt.");
      return;
    }

    setImportingLegacyRunning(true);
    setError(null);
    setLegacyRunningFeedback(null);
    try {
      const csv = await readLegacyRunningCsvFile(file);
      const preview = await postLegacyRunningImport(csv, true);
      const summaryText = formatLegacyRunningSummary(preview.summary);
      const confirmed = window.confirm(
        `Legacy-Laufen Dry-run geprüft.\n\n${summaryText}\n\nJetzt als Ergebnis-Paket stagen?`,
      );
      if (!confirmed) {
        setLegacyRunningFeedback(`Dry-run geprüft, kein Paket geschrieben.\n${summaryText}`);
        return;
      }

      const result = await postLegacyRunningImport(csv, false);
      setSource("LEGACY_IMPORT");
      setDiscipline("RUN");
      setSelectedBatchId(result.batchId || "");
      setBatchDetailTab("drafts");
      setActiveTab("mapping");
      setLegacyRunningFeedback(
        `Paket ${result.label || result.batchId} erstellt.\n${formatLegacyRunningSummary(result.summary)}`,
      );
      await loadBatches();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Legacy-Laufen-Import fehlgeschlagen.");
    } finally {
      setImportingLegacyRunning(false);
      if (legacyRunningInputRef.current) {
        legacyRunningInputRef.current.value = "";
      }
    }
  };

  const resetResultTestData = async () => {
    if (!activeCompetition?.id || resettingTestData) return;

    setResettingTestData(true);
    setError(null);
    setLegacyResultFeedback(null);
    setLegacyRunningFeedback(null);
    setTimekeepingFeedback(null);
    try {
      const previewResponse = await fetch("/api/admin/result-staging/reset/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competitionId: activeCompetition.id,
          scope: "TEST_DATA",
        }),
      });
      const preview = (await previewResponse.json().catch(() => ({}))) as ResultResetPreviewResponse;
      if (!previewResponse.ok) {
        throw new Error(preview.error || "Testdaten-Reset konnte nicht geprüft werden.");
      }
      if (!preview.executable) {
        throw new Error(preview.blockers?.join("\n") || "Testdaten-Reset ist aktuell gesperrt.");
      }

      const counts = preview.counts || {};
      const batches = counts.batches ?? 0;
      const rawRecords = counts.rawRecords ?? 0;
      const drafts = counts.drafts ?? 0;
      if (batches === 0 && rawRecords === 0 && drafts === 0) {
        setLegacyRunningFeedback("Keine Ergebnis-Testdaten gefunden.");
        return;
      }

      const confirmed = window.confirm(
        `Ergebnis-Testdaten löschen?\n\nPakete: ${batches}\nRaw Records: ${rawRecords}\nDrafts: ${drafts}\n\nBestätigung:\n${preview.expectedConfirmationText}\n\nOffizielle Ergebnisse werden nicht gelöscht.`,
      );
      if (!confirmed) {
        setLegacyRunningFeedback("Testdaten-Reset abgebrochen.");
        return;
      }

      const resetResponse = await fetch("/api/admin/result-staging/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competitionId: activeCompetition.id,
          scope: "TEST_DATA",
          reason: "Admin Produktionstest vor Wettkampf bereinigt",
          confirmationText: preview.expectedConfirmationText,
        }),
      });
      const result = (await resetResponse.json().catch(() => ({}))) as ResultResetExecutionResponse;
      if (!resetResponse.ok) {
        throw new Error(result.error || "Ergebnis-Testdaten konnten nicht gelöscht werden.");
      }

      setSource("all");
      setPurpose("all");
      setBatchStatus("all");
      setLegacyRunningFeedback(
        `Ergebnis-Testdaten gelöscht: ${result.deletedCounts?.batches ?? batches} Pakete, ${result.deletedCounts?.rawRecords ?? rawRecords} Raw Records, ${result.deletedCounts?.drafts ?? drafts} Drafts.`,
      );
      await Promise.all([loadBatches(), loadTimekeepingSessions()]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Ergebnis-Testdaten konnten nicht gelöscht werden.");
    } finally {
      setResettingTestData(false);
    }
  };

  const openDraftCorrection = (draft: ResultDraftDetail, field: "startNumber" | "rawValueText" | "resultStatus") => {
    const beforeValue = field === "resultStatus"
      ? draft.preview.effectiveResultStatus || draft.preview.resultStatus || ""
      : field === "startNumber"
        ? draft.effectiveStartNumber || draft.startNumber || ""
        : draft.effectiveRawValueText || draft.rawValueText || "";
    setCorrectionForm({
      targetType: "DRAFT",
      targetId: draft.id,
      targetLabel: `${draft.startNumber ? `#${draft.startNumber}` : "Draft"} · ${participantName(draft.participant)}`,
      field,
      beforeValue,
      value: beforeValue,
      reason: "",
    });
    setBatchDetailTab("corrections");
  };

  const openRawCorrection = (record: ResultRawRecordDetail, field: "startNumber" | "rawValueText" | "validationStatus") => {
    const beforeValue = field === "validationStatus"
      ? record.effectiveValidationStatus || record.validationStatus
      : field === "startNumber"
        ? record.effectiveStartNumber || record.startNumber || ""
        : record.effectiveRawValueText || record.rawValueText || "";
    setCorrectionForm({
      targetType: "RAW_RECORD",
      targetId: record.id,
      targetLabel: `${record.rowNumber ? `Zeile ${record.rowNumber}` : "Raw Record"} · ${recordValue(record, "startNumber")}`,
      field,
      beforeValue,
      value: beforeValue,
      reason: "",
    });
    setBatchDetailTab("corrections");
  };

  const saveCorrection = async () => {
    if (!activeCompetition?.id || !selectedBatchId || !correctionForm || savingCorrection) return;

    setSavingCorrection(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/result-staging/batches/${encodeURIComponent(selectedBatchId)}/corrections?competitionId=${encodeURIComponent(activeCompetition.id)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            operation: "apply",
            targetType: correctionForm.targetType,
            targetId: correctionForm.targetId,
            field: correctionForm.field,
            value: correctionForm.value,
            reason: correctionForm.reason,
          }),
        },
      );
      const data = (await response.json().catch(() => ({}))) as CorrectionResponse;
      if (!response.ok) {
        throw new Error(data.error || "Korrektur konnte nicht gespeichert werden.");
      }
      setCorrectionForm(null);
      await loadBatchDetails(selectedBatchId);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Korrektur konnte nicht gespeichert werden.");
    } finally {
      setSavingCorrection(false);
    }
  };

  const revertCorrection = async (correctionId: string) => {
    if (!activeCompetition?.id || !selectedBatchId || savingCorrection) return;

    const confirmed = window.confirm("Diese Korrektur zurücknehmen?");
    if (!confirmed) return;

    setSavingCorrection(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/result-staging/batches/${encodeURIComponent(selectedBatchId)}/corrections?competitionId=${encodeURIComponent(activeCompetition.id)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            operation: "revert",
            correctionId,
          }),
        },
      );
      const data = (await response.json().catch(() => ({}))) as CorrectionResponse;
      if (!response.ok) {
        throw new Error(data.error || "Korrektur konnte nicht zurückgenommen werden.");
      }
      await loadBatchDetails(selectedBatchId);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Korrektur konnte nicht zurückgenommen werden.");
    } finally {
      setSavingCorrection(false);
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

  useEffect(() => {
    if (filteredBatches.length === 0) {
      setSelectedBatchId("");
      setBatchDetails(null);
      return;
    }
    if (!selectedBatchId || !filteredBatches.some((batch) => batch.id === selectedBatchId)) {
      setSelectedBatchId(filteredBatches[0].id);
    }
  }, [filteredBatches, selectedBatchId]);

  useEffect(() => {
    if (activeTab !== "mapping" || !selectedBatchId) return;
    void loadBatchDetails(selectedBatchId);
  }, [activeTab, loadBatchDetails, selectedBatchId]);

  const selectedBatch = useMemo(
    () => filteredBatches.find((batch) => batch.id === selectedBatchId) || null,
    [filteredBatches, selectedBatchId],
  );

  const selectedBatchConcerns = selectedBatch ? batchConcernCount(selectedBatch) : 0;

  const detailConflictDrafts = useMemo(() => (
    batchDetails?.drafts.filter((draft) => (
      draft.status === "CONFLICT" ||
      draft.conflictStatus !== "NONE" ||
      draft.validationMessages.length > 0 ||
      !draft.team ||
      !draft.participant
    )) ?? []
  ), [batchDetails]);

  const detailConflictRawRecords = useMemo(() => (
    batchDetails?.rawRecords.filter((record) => (
      record.validationStatus !== "VALID" ||
      record.validationMessages.length > 0
    )) ?? []
  ), [batchDetails]);

  const detailConcernCount = detailConflictDrafts.length + detailConflictRawRecords.length;

  const summary = useMemo(() => {
    const rawRecords = filteredBatches.reduce((sum, batch) => sum + batch.counts.rawRecords, 0);
    const drafts = filteredBatches.reduce((sum, batch) => sum + batch.counts.drafts, 0);
    const publications = filteredBatches.reduce((sum, batch) => sum + batch.counts.publications, 0);
    const conflicts = filteredBatches.reduce((sum, batch) => sum + batchConcernCount(batch), 0);
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

        {legacyResultFeedback && (
          <div className="whitespace-pre-line rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {legacyResultFeedback}
          </div>
        )}

        {legacyRunningFeedback && (
          <div className="whitespace-pre-line rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {legacyRunningFeedback}
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
              <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1">
                    <p className="font-medium text-amber-950">Produktionstest bereinigen</p>
                    <p className="text-sm text-amber-900">
                      Entfernt nur Ergebnis-Staging-Pakete mit Zweck Produktionstest oder Dry Run. Offizielle Ergebnisse bleiben unberührt.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => void resetResultTestData()}
                    disabled={resettingTestData || !activeCompetition?.id}
                  >
                    {resettingTestData ? "Prüfe..." : "Testdaten löschen"}
                  </Button>
                </div>
              </div>

              <div className="rounded-md border border-border/60 bg-muted/20 px-4 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div className="space-y-1">
                    <p className="font-medium">Legacy-Ergebnis-CSV prüfen</p>
                    <p className="text-sm text-muted-foreground">
                      V2-Dry-run für Laufen, Rennrad, MTB, Bankdrücken und Stockschießen, danach bewusst als Produktionstest-Paket stagen.
                    </p>
                  </div>
                  <div>
                    <input
                      ref={legacyResultInputRef}
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={(event) => void handleLegacyResultImport(event.target.files?.[0] ?? null)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => legacyResultInputRef.current?.click()}
                      disabled={checkingLegacyResult || importingLegacyResult || !activeCompetition?.id}
                    >
                      {checkingLegacyResult || importingLegacyResult ? "Prüfe..." : "CSV auswählen"}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="rounded-md border border-border/60 bg-muted/20 px-4 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div className="space-y-1">
                    <p className="font-medium">Legacy-Laufen-CSV importieren</p>
                    <p className="text-sm text-muted-foreground">
                      Laufen-Ergebnisse als Preview prüfen und danach bewusst als Produktionstest-Paket ins Ergebnis-Staging übernehmen.
                    </p>
                  </div>
                  <div>
                    <input
                      ref={legacyRunningInputRef}
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={(event) => void handleLegacyRunningImport(event.target.files?.[0] ?? null)}
                    />
                    <Button
                      onClick={() => legacyRunningInputRef.current?.click()}
                      disabled={importingLegacyRunning || !activeCompetition?.id}
                    >
                      {importingLegacyRunning ? "Prüfe..." : "CSV auswählen"}
                    </Button>
                  </div>
                </div>
              </div>

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
                      <p className="truncate text-sm font-medium">
                        {selectedTimekeepingSession.deviceName?.trim() || selectedTimekeepingSession.deviceId}
                      </p>
                      {selectedTimekeepingSession.deviceName?.trim() && (
                        <p className="truncate text-[11px] text-muted-foreground">{selectedTimekeepingSession.deviceId}</p>
                      )}
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
                <div className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="rounded-md border border-border/60 px-3 py-3">
                      <p className="text-xs text-muted-foreground">Pakete im Filter</p>
                      <p className="text-2xl font-semibold">{summary.packages}</p>
                    </div>
                    <div className="rounded-md border border-border/60 px-3 py-3">
                      <p className="text-xs text-muted-foreground">Raw / Drafts</p>
                      <p className="text-2xl font-semibold">{summary.rawRecords} / {summary.drafts}</p>
                    </div>
                    <div className="rounded-md border border-border/60 px-3 py-3">
                      <p className="text-xs text-muted-foreground">Warnsignale</p>
                      <p className="text-2xl font-semibold">{summary.conflicts}</p>
                    </div>
                    <div className="rounded-md border border-border/60 px-3 py-3">
                      <p className="text-xs text-muted-foreground">Offen</p>
                      <p className="text-2xl font-semibold">{summary.openPackages}</p>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[960px] text-left text-sm">
                    <thead className="border-b border-border/60 text-xs text-muted-foreground">
                      <tr>
                        <th className="py-2 pr-3 font-medium">Paket</th>
                        <th className="py-2 pr-3 font-medium">Disziplin</th>
                        <th className="py-2 pr-3 font-medium">Quelle</th>
                        <th className="py-2 pr-3 font-medium">Zweck</th>
                        <th className="py-2 pr-3 font-medium">Status</th>
                        <th className="py-2 pr-3 font-medium text-right">Raw</th>
                        <th className="py-2 pr-3 font-medium text-right">Drafts</th>
                        <th className="py-2 pr-3 font-medium text-right">Warn.</th>
                        <th className="py-2 pr-3 font-medium text-right">Publ.</th>
                        <th className="py-2 pr-3 font-medium">Erstellt</th>
                        <th className="py-2 pr-3 font-medium text-right">Aktion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBatches.map((batch) => (
                        <tr key={batch.id} className="border-b border-border/40">
                          <td className="py-3 pr-3">
                            <p className="font-medium">{packageTitle(batch)}</p>
                            <p className="text-xs text-muted-foreground">{batch.id}</p>
                          </td>
                          <td className="py-3 pr-3">{batchDisciplineLabel(batch)}</td>
                          <td className="py-3 pr-3">{batch.sourceLabel}</td>
                          <td className="py-3 pr-3">{batch.purposeLabel}</td>
                          <td className="py-3 pr-3">
                            <Badge variant={statusVariant(batch.status)}>{batch.statusLabel}</Badge>
                          </td>
                          <td className="py-3 pr-3 text-right tabular-nums">{batch.counts.rawRecords}</td>
                          <td className="py-3 pr-3 text-right tabular-nums">{batch.counts.drafts}</td>
                          <td className="py-3 pr-3 text-right tabular-nums">
                            <Badge variant={concernVariant(batchConcernCount(batch))}>{batchConcernCount(batch)}</Badge>
                          </td>
                          <td className="py-3 pr-3 text-right tabular-nums">{batch.counts.publications}</td>
                          <td className="py-3 pr-3">{formatDateTime(batch.createdAt)}</td>
                          <td className="py-3 pr-3 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedBatchId(batch.id);
                                setBatchDetailTab("raw");
                                setActiveTab("mapping");
                              }}
                            >
                              Records ansehen
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    </table>
                  </div>
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
              {filteredBatches.length === 0 ? (
                <EmptyState
                  title="Keine Pakete im aktuellen Filter."
                  text="Passe die Filter an oder stage ein Ergebnis-Paket, um Einzelzeilen zu prüfen."
                />
              ) : (
                <div className="rounded-md border border-border/60 bg-muted/20 px-4 py-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div className="space-y-1">
                      <p className="font-medium">Paketdetails prüfen</p>
                      <p className="text-sm text-muted-foreground">
                        Einzel-Drafts bleiben hier nur lesbar. Veröffentlichen und Bearbeiten sind weiter gesperrt.
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <select
                        value={selectedBatchId}
                        onChange={(event) => setSelectedBatchId(event.target.value)}
                        className={selectClassName()}
                      >
                        {filteredBatches.map((batch) => (
                          <option key={batch.id} value={batch.id}>
                            {packageTitle(batch)}
                          </option>
                        ))}
                      </select>
                      <Button
                        variant="outline"
                        onClick={() => void loadBatchDetails(selectedBatchId)}
                        disabled={!selectedBatchId || loadingBatchDetails}
                      >
                        {loadingBatchDetails ? "Lade..." : "Details laden"}
                      </Button>
                    </div>
                  </div>
                  {selectedBatch ? (
                    <div className="mt-4 grid gap-3 md:grid-cols-6">
                      <div className="rounded-md border border-border bg-background px-3 py-2">
                        <p className="text-xs text-muted-foreground">Paket</p>
                        <p className="truncate text-sm font-medium">{packageTitle(selectedBatch)}</p>
                      </div>
                      <div className="rounded-md border border-border bg-background px-3 py-2">
                        <p className="text-xs text-muted-foreground">Disziplin</p>
                        <p className="text-sm font-medium">{batchDisciplineLabel(selectedBatch)}</p>
                      </div>
                      <div className="rounded-md border border-border bg-background px-3 py-2">
                        <p className="text-xs text-muted-foreground">Status</p>
                        <p className="text-sm font-medium">{selectedBatch.statusLabel}</p>
                      </div>
                      <div className="rounded-md border border-border bg-background px-3 py-2">
                        <p className="text-xs text-muted-foreground">Raw</p>
                        <p className="text-lg font-semibold">{selectedBatch.counts.rawRecords}</p>
                      </div>
                      <div className="rounded-md border border-border bg-background px-3 py-2">
                        <p className="text-xs text-muted-foreground">Drafts</p>
                        <p className="text-lg font-semibold">{selectedBatch.counts.drafts}</p>
                      </div>
                      <div className="rounded-md border border-border bg-background px-3 py-2">
                        <p className="text-xs text-muted-foreground">Warnsignale</p>
                        <p className="text-lg font-semibold">{selectedBatchConcerns}</p>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              {batchDetails ? (
                <div className="space-y-3">
                  <div className="flex flex-col gap-3 rounded-md border border-border/60 bg-card px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium">{packageTitle(batchDetails.batch)}</p>
                      <p className="text-xs text-muted-foreground">
                        {batchDisciplineLabel(batchDetails.batch)} · {batchDetails.rawRecords.length} Raw Records · {batchDetails.drafts.length} Drafts · {detailConcernCount} Warnsignale · {batchDetails.corrections.filter((correction) => correction.active).length} aktive Korrekturen
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={batchDetailTab === "overview" ? "default" : "outline"}
                        onClick={() => setBatchDetailTab("overview")}
                      >
                        Übersicht
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={batchDetailTab === "drafts" ? "default" : "outline"}
                        onClick={() => setBatchDetailTab("drafts")}
                      >
                        Drafts
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={batchDetailTab === "raw" ? "default" : "outline"}
                        onClick={() => setBatchDetailTab("raw")}
                      >
                        Raw Records
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={batchDetailTab === "conflicts" ? "default" : "outline"}
                        onClick={() => setBatchDetailTab("conflicts")}
                      >
                        Konflikte
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={batchDetailTab === "corrections" ? "default" : "outline"}
                        onClick={() => setBatchDetailTab("corrections")}
                      >
                        Korrekturen
                      </Button>
                    </div>
                  </div>

                  {batchDetailTab === "overview" ? (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-md border border-border/60 px-4 py-3">
                        <p className="text-xs text-muted-foreground">Quelle / Zweck</p>
                        <p className="mt-1 font-medium">{batchDetails.batch.sourceLabel}</p>
                        <p className="text-sm text-muted-foreground">{batchDetails.batch.purposeLabel}</p>
                      </div>
                      <div className="rounded-md border border-border/60 px-4 py-3">
                        <p className="text-xs text-muted-foreground">Status</p>
                        <div className="mt-2">
                          <Badge variant={statusVariant(batchDetails.batch.status)}>{batchDetails.batch.statusLabel}</Badge>
                        </div>
                      </div>
                      <div className="rounded-md border border-border/60 px-4 py-3">
                        <p className="text-xs text-muted-foreground">Records / Drafts</p>
                        <p className="mt-1 text-2xl font-semibold">
                          {batchDetails.rawRecords.length} / {batchDetails.drafts.length}
                        </p>
                      </div>
                      <div className="rounded-md border border-border/60 px-4 py-3">
                        <p className="text-xs text-muted-foreground">Warnsignale</p>
                        <p className="mt-1 text-2xl font-semibold">{detailConcernCount}</p>
                      </div>
                      <div className="rounded-md border border-border/60 px-4 py-3 md:col-span-2">
                        <p className="text-xs text-muted-foreground">Referenz</p>
                        <p className="mt-1 break-all text-sm font-medium">{batchDetails.batch.externalRef || batchDetails.batch.id}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(batchDetails.batch.createdAt)}</p>
                      </div>
                      <div className="rounded-md border border-border/60 px-4 py-3 md:col-span-2">
                        <p className="text-xs text-muted-foreground">Nächster Schritt</p>
                        <p className="mt-1 text-sm">
                          Drafts und Raw Records prüfen. Manuelle Korrekturen werden als Overlay gespeichert; Veröffentlichung bleibt gesperrt.
                        </p>
                      </div>
                    </div>
                  ) : batchDetailTab === "drafts" ? (
                    <div className="overflow-x-auto rounded-md border border-border/60">
                      <table className="w-full min-w-[1160px] text-left text-sm">
                        <thead className="border-b border-border/60 bg-muted/30 text-xs text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 font-medium">Zeile</th>
                            <th className="px-3 py-2 font-medium">#</th>
                            <th className="px-3 py-2 font-medium">Team</th>
                            <th className="px-3 py-2 font-medium">Teilnehmer</th>
                            <th className="px-3 py-2 font-medium">Zeit/Wert</th>
                            <th className="px-3 py-2 font-medium text-right">Punkte</th>
                            <th className="px-3 py-2 font-medium text-right">Kl.-Platz</th>
                            <th className="px-3 py-2 font-medium text-right">Ges.-Punkte</th>
                            <th className="px-3 py-2 font-medium text-right">Ges.-Platz</th>
                            <th className="px-3 py-2 font-medium">Status</th>
                            <th className="px-3 py-2 font-medium">Hinweise</th>
                            <th className="px-3 py-2 font-medium text-right">Aktion</th>
                          </tr>
                        </thead>
                        <tbody>
                          {batchDetails.drafts.length === 0 ? (
                            <tr>
                              <td colSpan={12} className="px-3 py-8 text-center text-muted-foreground">
                                Keine Draft-Zeilen für dieses Paket gefunden.
                              </td>
                            </tr>
                          ) : (
                            batchDetails.drafts.map((draft) => (
                              <tr key={draft.id} className="border-b border-border/40">
                                <td className="px-3 py-2 tabular-nums">{draft.sourceRawRecord?.rowNumber ?? "—"}</td>
                                <td className="px-3 py-2 font-medium tabular-nums">
                                  {draft.effectiveStartNumber ? `#${draft.effectiveStartNumber}` : "—"}
                                  {draft.effectiveStartNumber !== draft.startNumber ? (
                                    <div className="text-[11px] text-amber-700">Overlay</div>
                                  ) : null}
                                </td>
                                <td className="px-3 py-2">
                                  <div className="max-w-[220px] truncate">{draft.team?.name || "—"}</div>
                                  {draft.team?.classificationCode ? (
                                    <div className="text-xs text-muted-foreground">{draft.team.classificationCode}</div>
                                  ) : null}
                                </td>
                                <td className="px-3 py-2">
                                  <div className="max-w-[190px] truncate">{participantName(draft.participant)}</div>
                                  {draft.participant?.disciplineCode ? (
                                    <div className="text-xs text-muted-foreground">{draft.participant.disciplineCode}</div>
                                  ) : null}
                                </td>
                                <td className="px-3 py-2 tabular-nums">
                                  {draft.effectiveRawValueText || "—"}
                                  {draft.effectiveRawValueText !== draft.rawValueText ? (
                                    <div className="text-[11px] text-amber-700">Overlay</div>
                                  ) : null}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums">{draft.preview.classPoints ?? "—"}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{draft.preview.classRank ?? "—"}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{draft.preview.overallGenderPoints ?? "—"}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{draft.preview.overallGenderRank ?? "—"}</td>
                                <td className="px-3 py-2">
                                  <Badge variant={draft.status === "CONFLICT" ? "destructive" : "outline"}>{draft.statusLabel}</Badge>
                                  {draft.preview.effectiveResultStatus || draft.preview.resultStatus ? (
                                    <div className="mt-1 text-xs text-muted-foreground">{draft.preview.effectiveResultStatus || draft.preview.resultStatus}</div>
                                  ) : null}
                                </td>
                                <td className="px-3 py-2">
                                  <div className="max-w-[240px] truncate text-xs text-muted-foreground" title={messageSummary(draft.validationMessages)}>
                                    {messageSummary(draft.validationMessages)}
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button type="button" size="sm" variant="outline" onClick={() => openDraftCorrection(draft, "rawValueText")}>
                                      Zeit
                                    </Button>
                                    <Button type="button" size="sm" variant="outline" onClick={() => openDraftCorrection(draft, "startNumber")}>
                                      #
                                    </Button>
                                    <Button type="button" size="sm" variant="outline" onClick={() => openDraftCorrection(draft, "resultStatus")}>
                                      Status
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  ) : batchDetailTab === "conflicts" ? (
                    <div className="space-y-3">
                      <div className="rounded-md border border-border/60 bg-muted/20 px-4 py-3 text-sm">
                        {detailConcernCount === 0
                          ? "Keine Konflikte oder Warnungen in den geladenen Details gefunden."
                          : `${detailConflictDrafts.length} Draft-Hinweise und ${detailConflictRawRecords.length} Raw-Record-Hinweise gefunden.`}
                      </div>
                      {detailConcernCount === 0 ? null : (
                        <div className="overflow-x-auto rounded-md border border-border/60">
                          <table className="w-full min-w-[980px] text-left text-sm">
                            <thead className="border-b border-border/60 bg-muted/30 text-xs text-muted-foreground">
                              <tr>
                                <th className="px-3 py-2 font-medium">Typ</th>
                                <th className="px-3 py-2 font-medium">Zeile</th>
                                <th className="px-3 py-2 font-medium">#</th>
                                <th className="px-3 py-2 font-medium">Disziplin</th>
                                <th className="px-3 py-2 font-medium">Status</th>
                                <th className="px-3 py-2 font-medium">Hinweise</th>
                              </tr>
                            </thead>
                            <tbody>
                              {detailConflictDrafts.map((draft) => (
                                <tr key={`draft-${draft.id}`} className="border-b border-border/40">
                                  <td className="px-3 py-2">Draft</td>
                                  <td className="px-3 py-2 tabular-nums">{draft.sourceRawRecord?.rowNumber ?? "—"}</td>
                                  <td className="px-3 py-2 font-medium tabular-nums">{draft.startNumber ? `#${draft.startNumber}` : "—"}</td>
                                  <td className="px-3 py-2">{draft.disciplineCode}</td>
                                  <td className="px-3 py-2">
                                    <Badge variant={draft.status === "CONFLICT" ? "destructive" : "outline"}>{draft.statusLabel}</Badge>
                                  </td>
                                  <td className="px-3 py-2">
                                    <div className="max-w-[520px] truncate text-xs text-muted-foreground" title={messageSummary(draft.validationMessages)}>
                                      {messageSummary(draft.validationMessages)}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                              {detailConflictRawRecords.map((record) => (
                                <tr key={`raw-${record.id}`} className="border-b border-border/40">
                                  <td className="px-3 py-2">Raw</td>
                                  <td className="px-3 py-2 tabular-nums">{record.rowNumber ?? "—"}</td>
                                  <td className="px-3 py-2 font-medium tabular-nums">
                                    {record.startNumber ? `#${record.startNumber}` : recordValue(record, "Au1Startnr")}
                                  </td>
                                  <td className="px-3 py-2">{recordValue(record, "disciplineCode")}</td>
                                  <td className="px-3 py-2">
                                    <Badge variant={record.validationStatus === "ERROR" ? "destructive" : "outline"}>
                                      {record.validationStatus}
                                    </Badge>
                                  </td>
                                  <td className="px-3 py-2">
                                    <div className="max-w-[520px] truncate text-xs text-muted-foreground" title={messageSummary(record.validationMessages)}>
                                      {messageSummary(record.validationMessages)}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ) : batchDetailTab === "corrections" ? (
                    <div className="space-y-4">
                      {correctionForm ? (
                        <div className="rounded-md border border-border/60 bg-muted/20 px-4 py-4">
                          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_minmax(0,1fr)_minmax(0,1fr)_auto]">
                            <div>
                              <p className="text-xs text-muted-foreground">Ziel</p>
                              <p className="mt-1 truncate text-sm font-medium">{correctionForm.targetLabel}</p>
                              <p className="text-xs text-muted-foreground">{correctionForm.targetType}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Feld</p>
                              <p className="mt-1 text-sm font-medium">{correctionFieldLabel(correctionForm.field)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Vorher</p>
                              <p className="mt-1 truncate text-sm font-medium">{correctionForm.beforeValue || "—"}</p>
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground" htmlFor="result-correction-value">Neu</label>
                              <Input
                                id="result-correction-value"
                                value={correctionForm.value}
                                onChange={(event) => setCorrectionForm({ ...correctionForm, value: event.target.value })}
                                className="mt-1"
                              />
                            </div>
                            <div className="flex items-end gap-2">
                              <Button type="button" onClick={() => void saveCorrection()} disabled={savingCorrection || correctionForm.value === correctionForm.beforeValue}>
                                {savingCorrection ? "Speichere..." : "Speichern"}
                              </Button>
                              <Button type="button" variant="outline" onClick={() => setCorrectionForm(null)} disabled={savingCorrection}>
                                Abbrechen
                              </Button>
                            </div>
                          </div>
                          <div className="mt-3">
                            <label className="text-xs text-muted-foreground" htmlFor="result-correction-reason">Grund</label>
                            <Input
                              id="result-correction-reason"
                              value={correctionForm.reason}
                              onChange={(event) => setCorrectionForm({ ...correctionForm, reason: event.target.value })}
                              placeholder="Optional, z.B. Zahlendreher aus CSV korrigiert"
                              className="mt-1"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-md border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                          Wähle in `Drafts` oder `Raw Records` eine Zeile und ein Feld aus, um eine Overlay-Korrektur zu erfassen.
                        </div>
                      )}

                      <div className="overflow-x-auto rounded-md border border-border/60">
                        <table className="w-full min-w-[980px] text-left text-sm">
                          <thead className="border-b border-border/60 bg-muted/30 text-xs text-muted-foreground">
                            <tr>
                              <th className="px-3 py-2 font-medium">Status</th>
                              <th className="px-3 py-2 font-medium">Ziel</th>
                              <th className="px-3 py-2 font-medium">Feld</th>
                              <th className="px-3 py-2 font-medium">Vorher</th>
                              <th className="px-3 py-2 font-medium">Neu</th>
                              <th className="px-3 py-2 font-medium">Grund</th>
                              <th className="px-3 py-2 font-medium">Erfasst</th>
                              <th className="px-3 py-2 font-medium text-right">Aktion</th>
                            </tr>
                          </thead>
                          <tbody>
                            {batchDetails.corrections.length === 0 ? (
                              <tr>
                                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                                  Noch keine manuellen Korrekturen für dieses Paket.
                                </td>
                              </tr>
                            ) : (
                              batchDetails.corrections.map((correction) => (
                                <tr key={correction.id} className="border-b border-border/40">
                                  <td className="px-3 py-2">
                                    <Badge variant={correction.active ? "outline" : "secondary"}>
                                      {correction.active ? "Aktiv" : "Zurückgenommen"}
                                    </Badge>
                                  </td>
                                  <td className="px-3 py-2">{correction.targetType}</td>
                                  <td className="px-3 py-2">{correctionFieldLabel(correction.field)}</td>
                                  <td className="px-3 py-2">{correction.beforeValue || "—"}</td>
                                  <td className="px-3 py-2 font-medium">{correction.afterValue || "—"}</td>
                                  <td className="px-3 py-2">
                                    <div className="max-w-[240px] truncate text-xs text-muted-foreground" title={correction.reason || ""}>
                                      {correction.reason || "—"}
                                    </div>
                                  </td>
                                  <td className="px-3 py-2">
                                    <div>{formatDateTime(correction.createdAt)}</div>
                                    {correction.createdBy ? (
                                      <div className="text-xs text-muted-foreground">{correction.createdBy}</div>
                                    ) : null}
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    {correction.active ? (
                                      <Button type="button" size="sm" variant="outline" onClick={() => void revertCorrection(correction.id)} disabled={savingCorrection}>
                                        Zurücknehmen
                                      </Button>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">{formatDateTime(correction.revertedAt)}</span>
                                    )}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-md border border-border/60">
                      <table className="w-full min-w-[1320px] text-left text-sm">
                        <thead className="border-b border-border/60 bg-muted/30 text-xs text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 font-medium">Zeile</th>
                            <th className="px-3 py-2 font-medium">#</th>
                            <th className="px-3 py-2 font-medium">Disz.</th>
                            <th className="px-3 py-2 font-medium">Klasse</th>
                            <th className="px-3 py-2 font-medium">Zeit/Wert</th>
                            <th className="px-3 py-2 font-medium">Versuch/Schub</th>
                            <th className="px-3 py-2 font-medium">Gewicht brutto/netto</th>
                            <th className="px-3 py-2 font-medium">Stock</th>
                            <th className="px-3 py-2 font-medium">Punkte/Rang</th>
                            <th className="px-3 py-2 font-medium">Status</th>
                            <th className="px-3 py-2 font-medium">Hinweise</th>
                            <th className="px-3 py-2 font-medium text-right">Aktion</th>
                          </tr>
                        </thead>
                        <tbody>
                          {batchDetails.rawRecords.length === 0 ? (
                            <tr>
                              <td colSpan={12} className="px-3 py-8 text-center text-muted-foreground">
                                Keine Raw Records für dieses Paket gefunden.
                              </td>
                            </tr>
                          ) : (
                            batchDetails.rawRecords.map((record) => (
                              <tr key={record.id} className="border-b border-border/40">
                                <td className="px-3 py-2 tabular-nums">{record.rowNumber ?? "—"}</td>
                                <td className="px-3 py-2 font-medium tabular-nums">
                                  {record.effectiveStartNumber ? `#${record.effectiveStartNumber}` : recordValue(record, "Au1Startnr")}
                                  {record.effectiveStartNumber !== record.startNumber ? (
                                    <div className="text-[11px] text-amber-700">Overlay</div>
                                  ) : null}
                                </td>
                                <td className="px-3 py-2">{recordValue(record, "disciplineCode")}</td>
                                <td className="px-3 py-2">{recordValue(record, "Au1Klasse")}</td>
                                <td className="px-3 py-2 tabular-nums">
                                  {recordValue(record, "rawValueText")}
                                  {record.effectiveRawValueText !== record.rawValueText ? (
                                    <div className="text-[11px] text-amber-700">Overlay</div>
                                  ) : null}
                                </td>
                                <td className="px-3 py-2 tabular-nums">{recordValue(record, "AuVersuchnr")}</td>
                                <td className="px-3 py-2 tabular-nums">
                                  {recordValue(record, "AuBruttoGewicht")} / {recordValue(record, "AuGewicht")}
                                </td>
                                <td className="px-3 py-2 tabular-nums">
                                  {recordValue(record, "AuRingeStock")}
                                  <span className="text-muted-foreground"> · </span>
                                  {recordValue(record, "AuRingeStockStreicherg")}
                                  <span className="text-muted-foreground"> · </span>
                                  {recordValue(record, "AuSchubBWZ")}
                                  {fieldValue(record.fields, "AuSummenkennzeichen") !== "—" ? (
                                    <Badge variant="outline" className="ml-2">S</Badge>
                                  ) : null}
                                </td>
                                <td className="px-3 py-2 tabular-nums">
                                  {recordValue(record, "AuPunkte")} / {recordValue(record, "AuPlatzKlasse")}
                                </td>
                                <td className="px-3 py-2">
                                  <Badge variant={record.effectiveValidationStatus === "ERROR" ? "destructive" : "outline"}>
                                    {record.effectiveValidationStatus}
                                  </Badge>
                                  {record.effectiveValidationStatus !== record.validationStatus ? (
                                    <div className="mt-1 text-[11px] text-amber-700">Overlay</div>
                                  ) : null}
                                </td>
                                <td className="px-3 py-2">
                                  <div className="max-w-[260px] truncate text-xs text-muted-foreground" title={messageSummary(record.validationMessages)}>
                                    {messageSummary(record.validationMessages)}
                                  </div>
                                  <div className="mt-1 max-w-[260px] truncate text-[11px] text-muted-foreground" title={record.rowKey}>
                                    {record.rowKey}
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button type="button" size="sm" variant="outline" onClick={() => openRawCorrection(record, "rawValueText")}>
                                      Wert
                                    </Button>
                                    <Button type="button" size="sm" variant="outline" onClick={() => openRawCorrection(record, "startNumber")}>
                                      #
                                    </Button>
                                    <Button type="button" size="sm" variant="outline" onClick={() => openRawCorrection(record, "validationStatus")}>
                                      Status
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : loadingBatchDetails ? (
                <div className="rounded-md border border-border/60 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
                  Lade Paketdetails...
                </div>
              ) : null}

              <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Korrekturen werden nur als Overlay gespeichert. Raw Records, Drafts, Veröffentlichung und offizielle Ergebnisse bleiben unverändert.
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
