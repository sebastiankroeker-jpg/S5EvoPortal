"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, RefreshCw, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { openTeamDashboard, openUserDashboard } from "@/lib/admin-routing";
import { usePermissions } from "@/lib/permissions-context";

interface PendingChange {
  id: string;
  changeRequestId?: string;
  targetType?: string;
  changeType?: string;
  source?: string;
  bundleId?: string | null;
  bundleType?: "SWAP" | null;
  bundleStatus?: "PENDING" | "APPROVED" | "REJECTED" | "CONFLICT" | null;
  changeData: string;
  beforeData?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string | null;
  reviewComment?: string | null;
  participant: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string | null;
    team: { id: string; name: string; contactEmail?: string | null };
  };
  requestedBy: {
    name: string | null;
    email: string;
  };
  reviewedBy?: {
    name: string | null;
    email: string;
  } | null;
  recentHistory?: Array<{
    id: string;
    action: string;
    createdAt: string;
    message?: string | null;
    pendingChangeId?: string | null;
    actor?: {
      name: string | null;
      email: string;
    } | null;
  }>;
  impact?: {
    nextClassificationCode: string;
    nextClassificationLabel: string;
    nextTotalAge: number;
    classificationWarnings: string[];
    disciplineWarnings: string[];
    hasLiveDrift: boolean;
    liveDriftSummary: Array<{
      field: string;
      label: string;
      before: string;
      after: string;
    }>;
  };
}

interface ApprovalQueueProps {
  variant?: "embedded" | "page";
}

type Snapshot = Record<string, string | number | null>;

type ChangeField = {
  key: string;
  before: string | number | null | undefined;
  after: string | number | null | undefined;
};

type DecoratedChange = PendingChange & {
  fields: ChangeField[];
  wasUpdated: boolean;
  participantName: string;
  requesterLabel: string;
  priorityScore: number;
  isCritical: boolean;
  bundleMembers?: DecoratedChange[];
  bundleGroupSize?: number;
  bundleFieldCount?: number;
  bundleHasLiveDrift?: boolean;
};

const fieldLabels: Record<string, string> = {
  firstName: "Vorname",
  lastName: "Nachname",
  birthYear: "Geburtsjahr",
  gender: "Geschlecht",
  disciplineCode: "Disziplin",
  shirtSize: "T-Shirt",
  moderationNote: "Moderationshinweis",
  email: "E-Mail",
  participantPublicationPreference: "Namensveröffentlichung",
};

function parseSnapshot(raw?: string | null): Snapshot {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Snapshot;
  } catch {
    return {};
  }
}

function formatValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "leer";
  if (value === "MALE") return "Herr";
  if (value === "FEMALE") return "Dame";
  if (value === "TBD") return "Noch offen";
  if (value === "RUN") return "Laufen";
  if (value === "BENCH") return "Bankdruecken";
  if (value === "STOCK") return "Stockschiessen";
  if (value === "ROAD") return "Rennrad";
  if (value === "MTB") return "Mountainbike";
  if (value === "NAME_VEROEFFENTLICHEN") return "Name veröffentlichen";
  if (value === "NAME_VERBERGEN") return "Name verbergen";
  return String(value);
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("de-DE");
}

function formatAuditAction(action: string) {
  if (action === "REQUEST_SUBMITTED") return "Antrag gestellt";
  if (action === "REQUEST_UPDATED") return "Antrag aktualisiert";
  if (action === "REQUEST_APPROVED") return "Genehmigt";
  if (action === "REQUEST_REJECTED") return "Abgelehnt";
  if (action === "DIRECT_CHANGE") return "Direkt geändert";
  if (action === "SUBMITTED") return "Antrag gestellt";
  if (action === "UPDATED") return "Antrag aktualisiert";
  if (action === "APPROVED") return "Genehmigt";
  if (action === "REJECTED") return "Abgelehnt";
  if (action === "APPLIED") return "Angewendet";
  if (action === "CANCELLED") return "Zurueckgezogen";
  if (action === "FAILED") return "Fehlgeschlagen";
  return action;
}

function getTargetTypeLabel(targetType?: string) {
  if (targetType === "PARTICIPANT") return "Teilnehmer";
  if (targetType === "TEAM") return "Mannschaft";
  if (targetType === "USER") return "Benutzer";
  if (targetType === "CONTRACT") return "Vertrag";
  if (targetType === "METERING_POINT") return "Zaehlpunkt";
  return "Antrag";
}

function getStatusFilterLabel(status: "PENDING" | "APPROVED" | "REJECTED" | "ALL") {
  if (status === "APPROVED") return "genehmigt";
  if (status === "REJECTED") return "abgelehnt";
  if (status === "ALL") return "alle";
  return "offen";
}

function buildDiffs(change: PendingChange): ChangeField[] {
  const before = parseSnapshot(change.beforeData);
  const after = parseSnapshot(change.changeData);

  return Object.keys(after)
    .filter((key) => before[key] !== after[key])
    .map((key) => ({
      key,
      before: before[key],
      after: after[key],
    }));
}

function resolvePriorityScore(change: PendingChange, wasUpdated: boolean) {
  let score = 0;

  if (change.status === "PENDING") score += 100;
  if (change.impact?.hasLiveDrift) score += 50;
  if ((change.impact?.classificationWarnings?.length || 0) > 0) score += 30;
  if ((change.impact?.disciplineWarnings?.length || 0) > 0) score += 20;
  if (wasUpdated) score += 10;

  return score;
}

function resolveDisplayStatus(change: PendingChange) {
  if (change.bundleStatus === "CONFLICT") return "CONFLICT";
  return change.status;
}

export default function ApprovalQueue({ variant = "embedded" }: ApprovalQueueProps) {
  const { activeRole } = usePermissions();
  const [changes, setChanges] = useState<PendingChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [updatedOnly, setUpdatedOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"PENDING" | "APPROVED" | "REJECTED" | "ALL">("PENDING");
  const [participantFilterId, setParticipantFilterId] = useState<string | null>(null);
  const [teamFilterId, setTeamFilterId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dashboardMode = variant === "page";
  const canUseAdminLinks = activeRole === "ADMIN";

  const fetchChanges = async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "refresh") {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);

    try {
      const params = new URLSearchParams();
      if (dashboardMode) {
        params.set("scope", "all");
      }

      const res = await fetch("/api/admin/pending-changes" + (params.size ? `?${params}` : ""));
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Aenderungsantraege konnten nicht geladen werden");
      }

      const data = await res.json();
      setChanges(data.changes || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Aenderungsantraege konnten nicht geladen werden";
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (dashboardMode) {
      const params = new URLSearchParams(window.location.search);
      const status = params.get("status");
      const query = params.get("q");
      const participantId = params.get("participantId");
      const teamId = params.get("teamId");

      if (status === "PENDING" || status === "APPROVED" || status === "REJECTED" || status === "ALL") {
        setStatusFilter(status);
      }
      if (query) setSearchQuery(query);
      if (participantId) setParticipantFilterId(participantId);
      if (teamId) setTeamFilterId(teamId);
    }
    void fetchChanges();
  }, []);

  const decoratedChanges = useMemo<DecoratedChange[]>(() => {
    return changes.map((change) => ({
      ...change,
      fields: buildDiffs(change),
      wasUpdated: change.updatedAt !== change.createdAt,
      participantName: change.participant.firstName + " " + change.participant.lastName,
      requesterLabel: change.requestedBy.name || change.requestedBy.email,
      priorityScore: resolvePriorityScore(change, change.updatedAt !== change.createdAt),
      isCritical:
        change.status === "PENDING" &&
        Boolean(
          change.impact?.hasLiveDrift ||
            change.impact?.classificationWarnings?.length ||
            change.impact?.disciplineWarnings?.length,
        ),
    }));
  }, [changes]);

  const filteredChanges = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const sortedChanges = decoratedChanges
      .filter((change) => {
        if (statusFilter !== "ALL" && change.status !== statusFilter) {
          return false;
        }

        if (updatedOnly && !change.wasUpdated) {
          return false;
        }

        if (participantFilterId && change.participant.id !== participantFilterId) {
          return false;
        }

        if (teamFilterId && change.participant.team.id !== teamFilterId) {
          return false;
        }

        if (!query) {
          return true;
        }

        const haystack = [
          change.participantName,
          change.participant.team.name,
          change.requesterLabel,
          change.requestedBy.email,
          ...change.fields.map((field) => (fieldLabels[field.key] || field.key) + " " + formatValue(field.before) + " " + formatValue(field.after)),
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(query);
      })
      .sort((left, right) => {
        if (right.priorityScore !== left.priorityScore) {
          return right.priorityScore - left.priorityScore;
        }

        return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
      });

    const bundlesById = new Map<string, DecoratedChange[]>();
    for (const change of sortedChanges) {
      if (!change.bundleId) continue;
      const current = bundlesById.get(change.bundleId) || [];
      current.push(change);
      bundlesById.set(change.bundleId, current);
    }

    const collapsed: DecoratedChange[] = [];
    const seenBundleIds = new Set<string>();
    for (const change of sortedChanges) {
      if (!change.bundleId) {
        collapsed.push(change);
        continue;
      }
      if (seenBundleIds.has(change.bundleId)) continue;
      seenBundleIds.add(change.bundleId);

      const bundleMembers = bundlesById.get(change.bundleId) || [change];
      collapsed.push({
        ...change,
        bundleMembers,
        bundleGroupSize: bundleMembers.length,
        bundleFieldCount: bundleMembers.reduce((sum, member) => sum + member.fields.length, 0),
        bundleHasLiveDrift: bundleMembers.some((member) => member.impact?.hasLiveDrift),
        isCritical: bundleMembers.some((member) => member.isCritical),
      });
    }

    return collapsed;
  }, [decoratedChanges, participantFilterId, searchQuery, statusFilter, teamFilterId, updatedOnly]);

  const visibleChanges = useMemo(() => {
    return dashboardMode ? filteredChanges : filteredChanges.slice(0, 3);
  }, [dashboardMode, filteredChanges]);

  const stats = useMemo(() => {
    const teamCount = new Set(decoratedChanges.map((change) => change.participant.team.name)).size;
    const updatedCount = decoratedChanges.filter((change) => change.wasUpdated).length;
    const fieldCount = decoratedChanges.reduce((sum, change) => sum + change.fields.length, 0);
    const lastUpdated = decoratedChanges[0]?.updatedAt || null;
    const approvedCount = decoratedChanges.filter((change) => change.status === "APPROVED").length;
    const rejectedCount = decoratedChanges.filter((change) => change.status === "REJECTED").length;
    const openCount = decoratedChanges.filter((change) => change.status === "PENDING").length;

    return {
      openCount,
      approvedCount,
      rejectedCount,
      teamCount,
      updatedCount,
      fieldCount,
      lastUpdated,
    };
  }, [decoratedChanges]);

  const hasActiveFilters = Boolean(participantFilterId || teamFilterId || searchQuery || statusFilter !== "PENDING" || updatedOnly);
  const activeFilterCount = [
    Boolean(participantFilterId),
    Boolean(teamFilterId),
    searchQuery.trim() !== "",
    statusFilter !== "PENDING",
    updatedOnly,
  ].filter(Boolean).length;
  const activeFilterLabel = useMemo(() => {
    const labels: string[] = [];
    const participantName = participantFilterId
      ? decoratedChanges.find((change) => change.participant.id === participantFilterId)?.participantName
      : null;
    const teamName = teamFilterId
      ? decoratedChanges.find((change) => change.participant.team.id === teamFilterId)?.participant.team.name
      : null;

    if (participantFilterId) labels.push("Teilnehmer: " + (participantName || "Auswahl"));
    if (teamFilterId) labels.push("Team: " + (teamName || "Auswahl"));
    if (statusFilter !== "PENDING") labels.push("Status: " + getStatusFilterLabel(statusFilter));
    if (updatedOnly) labels.push("nur aktualisierte Anträge");
    if (searchQuery.trim()) labels.push("Suche: " + searchQuery.trim());

    return labels.join(" · ");
  }, [decoratedChanges, participantFilterId, searchQuery, statusFilter, teamFilterId, updatedOnly]);

  const resetDashboardFilters = () => {
    setParticipantFilterId(null);
    setTeamFilterId(null);
    setSearchQuery("");
    setStatusFilter("PENDING");
    setUpdatedOnly(false);
    window.history.replaceState(null, "", "/aenderungen");
  };

  const handleAction = async (change: DecoratedChange, action: "approve" | "reject") => {
    const processingKey = change.bundleId ? `bundle:${change.bundleId}` : change.id;
    const commentKey = change.bundleId ? `bundle:${change.bundleId}` : change.id;
    setProcessing(processingKey);
    setError(null);

    try {
      const reviewId = change.changeRequestId || change.id;
      const endpoint = change.bundleId
        ? `/api/admin/participant-change-bundles/${change.bundleId}/decision`
        : "/api/admin/pending-changes/" + reviewId;
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, comment: comments[commentKey] || "" }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Aktion fehlgeschlagen");
      }

      await fetchChanges("refresh");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Aktion fehlgeschlagen";
      setError(message);
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="animate-spin w-7 h-7 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (dashboardMode) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold">
              Änderungsübersicht ({filteredChanges.length}/{decoratedChanges.length})
            </h3>
            <p className="truncate text-xs text-muted-foreground">
              {stats.fieldCount} Feldwechsel
              {stats.lastUpdated ? " · letzte Aktivität " + formatDateTime(stats.lastUpdated) : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button type="button" variant="ghost" size="sm" onClick={() => void fetchChanges("refresh")} disabled={refreshing}>
              <RefreshCw className={"h-4 w-4" + (refreshing ? " animate-spin" : "")} />
              <span className="sr-only">Aktualisieren</span>
            </Button>
          </div>
        </div>

        <div className="rounded-md border border-border/60 bg-card/70 p-2.5 shadow-sm">
          <div className="relative mt-2">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-8 pl-8 text-xs sm:h-9 sm:text-sm"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Suche Teilnehmer, Team, Antragsteller oder Änderung"
            />
          </div>

          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <Badge className="whitespace-nowrap" variant={hasActiveFilters ? "default" : "outline"}>
                {activeFilterCount} aktiv
              </Badge>
              {hasActiveFilters && (
                <Button className="whitespace-nowrap" size="xs" variant="outline" onClick={resetDashboardFilters}>
                  Filter löschen
                </Button>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => setFiltersOpen((open) => !open)}
              aria-label={filtersOpen ? "Filter einklappen" : "Filter ausklappen"}
            >
              {filtersOpen ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
            </Button>
          </div>

          {filtersOpen && (
            <div className="mt-3 space-y-3 border-t border-border/60 pt-3">
              {hasActiveFilters && (
                <div className="rounded-md border border-border/60 bg-muted/25 px-3 py-2 text-xs text-muted-foreground">
                  Aktiver Filter: <span className="text-foreground">{activeFilterLabel}</span>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={statusFilter === "PENDING" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter("PENDING")}
                  className="justify-between gap-2"
                >
                  <span>Offen</span>
                  <span className="rounded bg-background/30 px-1 text-[10px]">{stats.openCount}</span>
                </Button>
                <Button
                  type="button"
                  variant={statusFilter === "APPROVED" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter("APPROVED")}
                  className="justify-between gap-2"
                >
                  <span>Genehmigt</span>
                  <span className="rounded bg-background/30 px-1 text-[10px]">{stats.approvedCount}</span>
                </Button>
                <Button
                  type="button"
                  variant={statusFilter === "REJECTED" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter("REJECTED")}
                  className="justify-between gap-2"
                >
                  <span>Abgelehnt</span>
                  <span className="rounded bg-background/30 px-1 text-[10px]">{stats.rejectedCount}</span>
                </Button>
                <Button
                  type="button"
                  variant={statusFilter === "ALL" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter("ALL")}
                  className="justify-between gap-2"
                >
                  <span>Alle</span>
                  <span className="rounded bg-background/30 px-1 text-[10px]">{decoratedChanges.length}</span>
                </Button>
                <Button
                  type="button"
                  variant={updatedOnly ? "default" : "outline"}
                  size="sm"
                  onClick={() => setUpdatedOnly((current) => !current)}
                  className="whitespace-nowrap"
                >
                  Aktualisierte
                </Button>
              </div>
            </div>
          )}
        </div>

        {error && (
          <Card className="border-red-300 bg-red-50/70 dark:border-red-900 dark:bg-red-950/30">
            <CardContent className="p-4 text-sm text-red-700 dark:text-red-200">{error}</CardContent>
          </Card>
        )}

        {filteredChanges.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <span className="text-4xl">✅</span>
              <p className="mt-3 text-lg font-medium">Keine offenen Treffer</p>
              <p className="text-sm text-muted-foreground">
                {decoratedChanges.length === 0
                  ? "Aktuell gibt es keine Aenderungsantraege."
                  : "Zu den aktiven Filtern wurden keine passenden Antraege gefunden."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <ChangeList
            changes={visibleChanges}
            comments={comments}
            setComments={setComments}
            processing={processing}
            onAction={handleAction}
            canUseAdminLinks={canUseAdminLinks}
            dashboardCompact
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Aenderungsantraege</h3>
          <p className="text-xs text-muted-foreground">
            {stats.openCount} offen, {stats.approvedCount} genehmigt, {stats.rejectedCount} abgelehnt
          </p>
        </div>
        <Link href="/aenderungen">
          <Button size="sm" variant="outline">Dashboard oeffnen</Button>
        </Link>
      </div>

      {error && (
        <Card className="border-red-300 bg-red-50/70 dark:border-red-900 dark:bg-red-950/30">
          <CardContent className="p-4 text-sm text-red-700 dark:text-red-200">{error}</CardContent>
        </Card>
      )}

      {decoratedChanges.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <span className="text-4xl">✅</span>
            <p className="mt-2 text-muted-foreground">Keine offenen Aenderungsantraege</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <ChangeList
            changes={visibleChanges}
            comments={comments}
            setComments={setComments}
            processing={processing}
            onAction={handleAction}
            compact
            canUseAdminLinks={canUseAdminLinks}
          />
          {filteredChanges.length > visibleChanges.length && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">Weitere {filteredChanges.length - visibleChanges.length} Antraege warten noch.</p>
                  <p className="text-sm text-muted-foreground">Im Dashboard kannst du suchen, filtern und gesammelt abarbeiten.</p>
                </div>
                <Link href="/aenderungen">
                  <Button size="sm">Zum Dashboard</Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function ChangeList({
  changes,
  comments,
  setComments,
  processing,
  onAction,
  compact = false,
  canUseAdminLinks = false,
  dashboardCompact = false,
}: {
  changes: DecoratedChange[];
  comments: Record<string, string>;
  setComments: Dispatch<SetStateAction<Record<string, string>>>;
  processing: string | null;
  onAction: (change: DecoratedChange, action: "approve" | "reject") => Promise<void>;
  compact?: boolean;
  canUseAdminLinks?: boolean;
  dashboardCompact?: boolean;
}) {
  const [expandedChangeId, setExpandedChangeId] = useState<string | null>(null);

  const getStatusTone = (status: string) => {
    if (status === "CONFLICT") return "border-red-300 text-red-700 dark:text-red-200";
    if (status === "APPROVED") return "border-green-300 text-green-700 dark:text-green-200";
    if (status === "REJECTED") return "border-red-300 text-red-700 dark:text-red-200";
    return "border-amber-300 text-amber-700 dark:text-amber-200";
  };

  const getStatusLabel = (status: string) => {
    if (status === "CONFLICT") return "Konflikt";
    if (status === "APPROVED") return "Genehmigt";
    if (status === "REJECTED") return "Abgelehnt";
    return "In Pruefung";
  };

  return (
    <AnimatePresence>
      {changes.map((change) => {
        const displayStatus = resolveDisplayStatus(change);
        const commentKey = change.bundleId ? `bundle:${change.bundleId}` : change.id;
        const processingKey = change.bundleId ? `bundle:${change.bundleId}` : change.id;
        return (
        <motion.div
          key={change.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, x: -80 }}
          layout
        >
          {dashboardCompact ? (
            <Card
              className={
                displayStatus === "APPROVED"
                  ? "border-green-200/80 dark:border-green-900/70"
                  : displayStatus === "REJECTED" || displayStatus === "CONFLICT"
                    ? "border-red-200/80 dark:border-red-900/70"
                    : "border-amber-200/80 dark:border-amber-900/70"
              }
            >
              <CardContent className="space-y-2 p-2.5">
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                  <div className="min-w-0 space-y-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <span className="min-w-0 truncate text-sm font-medium">
                        {change.bundleId && (change.bundleGroupSize || 0) > 1
                          ? `Tausch-Bundle (${change.bundleGroupSize})`
                          : change.participantName}
                      </span>
                      <Badge variant="outline" className={`h-6 px-1.5 text-[10px] ${getStatusTone(displayStatus)}`}>
                        {getStatusLabel(displayStatus)}
                      </Badge>
                      <Badge variant="outline" className="h-6 px-1.5 text-[10px]">
                        {getTargetTypeLabel(change.targetType)}
                      </Badge>
                      <Badge variant="secondary" className="h-6 px-1.5 text-[10px]">
                        {change.bundleFieldCount ?? change.fields.length} Felder
                      </Badge>
                      {change.bundleId ? <Badge variant="secondary">Bundle</Badge> : null}
                    </div>
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                      <button
                        type="button"
                        className={canUseAdminLinks ? "truncate hover:text-primary" : "truncate"}
                        onClick={() => {
                          if (canUseAdminLinks) openTeamDashboard({ teamId: change.participant.team.id });
                        }}
                        disabled={!canUseAdminLinks}
                        title={canUseAdminLinks ? "Mannschaft öffnen" : undefined}
                      >
                        {change.participant.team.name}
                      </button>
                      <span>·</span>
                      <span>Antrag von {change.requesterLabel}</span>
                      <span>·</span>
                      <span>{formatDateTime(change.updatedAt)}</span>
                    </div>
                    {change.fields.length > 0 && (
                      <div className="rounded-md border border-border/50 bg-muted/25 px-2 py-1.5 text-[11px] text-muted-foreground">
                        <span className="font-medium text-foreground">Betroffen:</span>{" "}
                        {change.fields.slice(0, 2).map((field, index) => (
                          <span key={field.key} className="mr-2">
                            {index > 0 ? "· " : ""}
                            {fieldLabels[field.key] || field.key}: {formatValue(field.before)} {"->"} {formatValue(field.after)}
                          </span>
                        ))}
                        {change.fields.length > 2 ? `+${change.fields.length - 2} weitere` : ""}
                      </div>
                    )}
                    {(change.wasUpdated || change.impact?.classificationWarnings?.length || change.bundleHasLiveDrift || change.impact?.hasLiveDrift) ? (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {change.wasUpdated && <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">Aktualisiert</Badge>}
                        {change.impact?.classificationWarnings?.length ? (
                          <Badge variant="outline" className="h-5 border-amber-300 px-1.5 text-[10px] text-amber-700 dark:text-amber-200">
                            Klassenwirkung
                          </Badge>
                        ) : null}
                        {(change.bundleHasLiveDrift || change.impact?.hasLiveDrift) ? (
                          <Badge variant="outline" className="h-5 border-red-300 px-1.5 text-[10px] text-red-700 dark:text-red-200">
                            Live-Stand abweichend
                          </Badge>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex items-center justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 shrink-0 px-2 text-[11px]"
                      onClick={() => setExpandedChangeId((current) => current === change.id ? null : change.id)}
                    >
                      {expandedChangeId === change.id ? "Details zu" : "Details"}
                    </Button>
                  </div>
                </div>

                {expandedChangeId === change.id && (
                  <div className="space-y-3 border-t border-border/50 pt-3 sm:space-y-4">
                    <div className="rounded-md border border-border/50 bg-muted/20 p-3">
                      {(change.impact?.classificationWarnings?.length || change.impact?.disciplineWarnings?.length) ? (
                        <div className="mb-3 rounded-md border border-amber-200 bg-amber-50/80 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-100">
                          <div className="text-xs font-medium uppercase tracking-[0.14em] opacity-80">Prüfhinweise</div>
                          <div className="mt-1 font-medium">
                            {change.impact?.nextClassificationLabel || "Unbekannte Klasse"}
                            {typeof change.impact?.nextTotalAge === "number" && change.impact.nextTotalAge > 0
                              ? ` · Gesamtalter ${change.impact.nextTotalAge}`
                              : ""}
                          </div>
                          <ul className="mt-2 space-y-1">
                            {change.impact?.classificationWarnings?.map((warning, index) => (
                              <li key={`class-${index}`}>{warning}</li>
                            ))}
                            {change.impact?.disciplineWarnings?.map((warning, index) => (
                              <li key={`disc-${index}`}>{warning}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {(change.bundleHasLiveDrift || change.impact?.hasLiveDrift) ? (
                        <div className="mb-3 rounded-md border border-red-200 bg-red-50/80 px-3 py-2.5 text-sm text-red-900 dark:border-red-900/60 dark:bg-red-950/25 dark:text-red-100">
                          <div className="font-medium">Live-Stand weicht vom Antrag ab</div>
                          <div className="mt-2 space-y-2">
                            {(change.impact?.liveDriftSummary || []).map((field) => (
                              <div key={`drift-${field.field}`} className="rounded-md bg-background/60 px-3 py-2">
                                <div className="text-xs font-medium uppercase tracking-[0.14em]">{field.label}</div>
                                <div className="mt-1 grid gap-1 text-sm sm:grid-cols-2">
                                  <span>Damals: {field.before}</span>
                                  <span className="font-medium">Jetzt: {field.after}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {change.fields.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Keine Feldaenderungen erkannt.</p>
                      ) : (
                        <div className="space-y-2">
                          {change.fields.map((field) => (
                            <div key={field.key} className="rounded-md border border-border/50 bg-background/70 px-3 py-2.5">
                              <div className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                                {fieldLabels[field.key] || field.key}
                              </div>
                              <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                                <div>
                                  <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Bisher</div>
                                  <div className="mt-1 text-muted-foreground">{formatValue(field.before)}</div>
                                </div>
                                <div>
                                  <div className="text-[11px] uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">Beantragt</div>
                                  <div className="mt-1 font-medium text-emerald-800 dark:text-emerald-200">{formatValue(field.after)}</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {change.recentHistory?.length ? (
                      <div className="rounded-2xl border border-border/50 bg-muted/20 p-3">
                        <div className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                          Letzte Vorgänge
                        </div>
                        <div className="space-y-2">
                          {change.recentHistory.map((entry) => (
                            <div key={entry.id} className="rounded-xl border border-border/50 bg-background/80 px-3 py-2">
                              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                <div className="text-sm font-medium">
                                  {formatAuditAction(entry.action)}
                                  {entry.pendingChangeId === change.id ? " · aktueller Antrag" : ""}
                                </div>
                                <div className="text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</div>
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {entry.actor?.name || entry.actor?.email || "System"}
                              </div>
                              {entry.message ? (
                                <div className="mt-2 text-sm text-muted-foreground">{entry.message}</div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="space-y-2">
                      <label className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                        Kommentar der Orga
                      </label>
                      {displayStatus === "PENDING" ? (
                        <>
                          {(change.bundleHasLiveDrift || change.impact?.hasLiveDrift) ? (
                            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
                              Genehmigen ist fuer diesen Antrag gesperrt, bis der geaenderte Live-Stand geklaert oder ein neuer Antrag gestellt wurde.
                            </div>
                          ) : null}
                          <Textarea
                            value={comments[commentKey] || ""}
                            onChange={(event) => setComments((current) => ({ ...current, [commentKey]: event.target.value }))}
                            placeholder="Kommentar fuer Rueckmeldung an Team/Teilnehmer"
                            className={compact ? "min-h-[84px]" : "min-h-[110px]"}
                          />
                          <p className="text-xs text-muted-foreground">
                            Bei einer Ablehnung ist ein kurzer Kommentar Pflicht. Bei Genehmigung bleibt er optional.
                          </p>
                        </>
                      ) : (
                        <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-3 text-sm text-muted-foreground">
                          {change.reviewComment || "Kein Kommentar hinterlegt"}
                          {change.reviewedBy ? (
                            <div className="mt-2 text-xs">
                              Bearbeitet von {change.reviewedBy.name || change.reviewedBy.email}
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>

                    {displayStatus === "PENDING" ? (
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button
                          size="sm"
                          onClick={() => void onAction(change, "approve")}
                          disabled={processing === processingKey || change.bundleHasLiveDrift || change.impact?.hasLiveDrift}
                          className="sm:flex-1"
                        >
                          {processing === processingKey ? "Bearbeite..." : change.bundleId ? "Bundle genehmigen" : "Genehmigen"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void onAction(change, "reject")}
                          disabled={processing === processingKey || !(comments[commentKey] || "").trim()}
                          className="sm:flex-1"
                        >
                          {processing === processingKey ? "Bearbeite..." : change.bundleId ? "Bundle ablehnen" : "Ablehnen"}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card
              className={
                displayStatus === "APPROVED"
                  ? "border-green-200/80 dark:border-green-900/70"
                  : displayStatus === "REJECTED" || displayStatus === "CONFLICT"
                    ? "border-red-200/80 dark:border-red-900/70"
                    : "border-amber-200/80 dark:border-amber-900/70"
              }
            >
              <CardHeader className={compact ? "pb-2" : "pb-3"}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className={compact ? "text-base" : "text-xl leading-tight"}>
                        {change.bundleId && (change.bundleGroupSize || 0) > 1
                          ? `Tausch-Bundle (${change.bundleGroupSize})`
                          : change.participantName}
                      </CardTitle>
                      <Badge variant="outline" className={getStatusTone(displayStatus)}>
                        {getStatusLabel(displayStatus)}
                      </Badge>
                      <Badge variant="outline">{getTargetTypeLabel(change.targetType)}</Badge>
                      <Badge variant="secondary">{change.bundleFieldCount ?? change.fields.length} Feldwechsel</Badge>
                      {change.bundleId ? <Badge variant="secondary">Bundle</Badge> : null}
                      {change.changeRequestId ? <Badge variant="secondary">ChangeRequest</Badge> : null}
                    </div>
                    {(change.wasUpdated || change.impact?.classificationWarnings?.length || change.bundleHasLiveDrift || change.impact?.hasLiveDrift) ? (
                      <div className="flex flex-wrap gap-2">
                        {change.wasUpdated && <Badge variant="secondary">Aktualisiert</Badge>}
                        {change.impact?.classificationWarnings?.length ? (
                          <Badge variant="outline" className="border-amber-300 text-amber-700 dark:text-amber-200">
                            Klassenwirkung
                          </Badge>
                        ) : null}
                        {(change.bundleHasLiveDrift || change.impact?.hasLiveDrift) ? (
                          <Badge variant="outline" className="border-red-300 text-red-700 dark:text-red-200">
                            Live-Stand abweichend
                          </Badge>
                        ) : null}
                      </div>
                    ) : null}
                    <CardDescription className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-sm">
                      <button
                        type="button"
                        className={canUseAdminLinks ? "font-medium text-foreground hover:text-primary" : "font-medium text-foreground"}
                        onClick={() => {
                          if (canUseAdminLinks) openTeamDashboard({ teamId: change.participant.team.id });
                        }}
                        disabled={!canUseAdminLinks}
                        title={canUseAdminLinks ? "Mannschaft öffnen" : undefined}
                      >
                        {change.participant.team.name}
                      </button>
                      <span>· Antrag von</span>
                      <button
                        type="button"
                        className={canUseAdminLinks ? "font-medium text-foreground hover:text-primary" : "font-medium text-foreground"}
                        onClick={() => {
                          if (canUseAdminLinks) openUserDashboard({ email: change.requestedBy.email, teamId: change.participant.team.id });
                        }}
                        disabled={!canUseAdminLinks}
                        title={canUseAdminLinks ? "Benutzerverwaltung öffnen" : undefined}
                      >
                        {change.requesterLabel}
                      </button>
                    </CardDescription>
                    <CardDescription className="text-xs">
                      {formatDateTime(change.createdAt)}
                      {change.wasUpdated ? " · Update " + formatDateTime(change.updatedAt) : ""}
                      {change.reviewedAt ? " · entschieden " + formatDateTime(change.reviewedAt) : ""}
                    </CardDescription>
                  </div>
                  {!compact && (
                    <div className="hidden gap-1 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground lg:grid lg:min-w-56">
                      <button
                        type="button"
                        className={canUseAdminLinks && change.participant.email ? "truncate text-left hover:text-primary" : "truncate text-left"}
                        onClick={() => {
                          if (canUseAdminLinks && change.participant.email) {
                            openUserDashboard({ email: change.participant.email, teamId: change.participant.team.id });
                          }
                        }}
                        disabled={!canUseAdminLinks || !change.participant.email}
                        title={canUseAdminLinks && change.participant.email ? "Teilnehmerkonto suchen" : undefined}
                      >
                        {change.participant.email || "Keine Teilnehmer-Mail"}
                      </button>
                      <div className="truncate">{change.participant.team.contactEmail || "Keine Team-Mail"}</div>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4">
              <div className="rounded-md border border-border/50 bg-muted/20 p-3">
                {(change.impact?.classificationWarnings?.length || change.impact?.disciplineWarnings?.length) ? (
                  <div className="mb-3 rounded-md border border-amber-200 bg-amber-50/80 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-100">
                    <div className="text-xs font-medium uppercase tracking-[0.14em] opacity-80">Prüfhinweise</div>
                    <div className="mt-1 font-medium">
                      {change.impact?.nextClassificationLabel || "Unbekannte Klasse"}
                      {typeof change.impact?.nextTotalAge === "number" && change.impact.nextTotalAge > 0
                        ? ` · Gesamtalter ${change.impact.nextTotalAge}`
                        : ""}
                    </div>
                    <ul className="mt-2 space-y-1">
                      {change.impact?.classificationWarnings?.map((warning, index) => (
                        <li key={`class-${index}`}>{warning}</li>
                      ))}
                      {change.impact?.disciplineWarnings?.map((warning, index) => (
                        <li key={`disc-${index}`}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {(change.bundleHasLiveDrift || change.impact?.hasLiveDrift) ? (
                  <div className="mb-3 rounded-md border border-red-200 bg-red-50/80 px-3 py-2.5 text-sm text-red-900 dark:border-red-900/60 dark:bg-red-950/25 dark:text-red-100">
                    <div className="font-medium">Live-Stand weicht vom Antrag ab</div>
                    <div className="mt-2 space-y-2">
                      {(change.impact?.liveDriftSummary || []).map((field) => (
                        <div key={`drift-${field.field}`} className="rounded-md bg-background/60 px-3 py-2">
                          <div className="text-xs font-medium uppercase tracking-[0.14em]">{field.label}</div>
                          <div className="mt-1 grid gap-1 text-sm sm:grid-cols-2">
                            <span>Damals: {field.before}</span>
                            <span className="font-medium">Jetzt: {field.after}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {change.fields.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Keine Feldaenderungen erkannt.</p>
                ) : (
                  <div className="space-y-2">
                    {change.fields.map((field) => (
                      <div key={field.key} className="rounded-md border border-border/50 bg-background/70 px-3 py-2.5">
                        <div className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                          {fieldLabels[field.key] || field.key}
                        </div>
                        <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                          <div>
                            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Bisher</div>
                            <div className="mt-1 text-muted-foreground">{formatValue(field.before)}</div>
                          </div>
                          <div>
                            <div className="text-[11px] uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">Beantragt</div>
                            <div className="mt-1 font-medium text-emerald-800 dark:text-emerald-200">{formatValue(field.after)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {change.recentHistory?.length ? (
                <div className="rounded-2xl border border-border/50 bg-muted/20 p-3">
                  <div className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Letzte Vorgänge
                  </div>
                  <div className="space-y-2">
                    {change.recentHistory.map((entry) => (
                      <div key={entry.id} className="rounded-xl border border-border/50 bg-background/80 px-3 py-2">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <div className="text-sm font-medium">
                            {formatAuditAction(entry.action)}
                            {entry.pendingChangeId === change.id ? " · aktueller Antrag" : ""}
                          </div>
                          <div className="text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</div>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {entry.actor?.name || entry.actor?.email || "System"}
                        </div>
                        {entry.message ? (
                          <div className="mt-2 text-sm text-muted-foreground">{entry.message}</div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Kommentar der Orga
                </label>
                {displayStatus === "PENDING" ? (
                  <>
                    {(change.bundleHasLiveDrift || change.impact?.hasLiveDrift) ? (
                      <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
                        Genehmigen ist fuer diesen Antrag gesperrt, bis der geaenderte Live-Stand geklaert oder ein neuer Antrag gestellt wurde.
                      </div>
                    ) : null}
                    <Textarea
                      value={comments[commentKey] || ""}
                      onChange={(event) => setComments((current) => ({ ...current, [commentKey]: event.target.value }))}
                      placeholder="Kommentar fuer Rueckmeldung an Team/Teilnehmer"
                      className={compact ? "min-h-[84px]" : "min-h-[110px]"}
                    />
                    <p className="text-xs text-muted-foreground">
                      Bei einer Ablehnung ist ein kurzer Kommentar Pflicht. Bei Genehmigung bleibt er optional.
                    </p>
                  </>
                ) : (
                  <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-3 text-sm text-muted-foreground">
                    {change.reviewComment || "Kein Kommentar hinterlegt"}
                    {change.reviewedBy ? (
                      <div className="mt-2 text-xs">
                        Bearbeitet von {change.reviewedBy.name || change.reviewedBy.email}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              {displayStatus === "PENDING" ? (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    size="sm"
                    onClick={() => void onAction(change, "approve")}
                    disabled={processing === processingKey || change.bundleHasLiveDrift || change.impact?.hasLiveDrift}
                    className="sm:flex-1"
                  >
                    {processing === processingKey ? "Bearbeite..." : change.bundleId ? "Bundle genehmigen" : "Genehmigen"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void onAction(change, "reject")}
                    disabled={processing === processingKey || !(comments[commentKey] || "").trim()}
                    className="sm:flex-1"
                  >
                    {processing === processingKey ? "Bearbeite..." : change.bundleId ? "Bundle ablehnen" : "Ablehnen"}
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
          )}
        </motion.div>
      )})}
    </AnimatePresence>
  );
}
