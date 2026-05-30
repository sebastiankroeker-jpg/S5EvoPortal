"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface PendingChange {
  id: string;
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
    team: { name: string; contactEmail?: string | null };
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
  return action;
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

export default function ApprovalQueue({ variant = "embedded" }: ApprovalQueueProps) {
  const [changes, setChanges] = useState<PendingChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [updatedOnly, setUpdatedOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"PENDING" | "APPROVED" | "REJECTED" | "ALL">("PENDING");
  const [error, setError] = useState<string | null>(null);

  const dashboardMode = variant === "page";

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

    return decoratedChanges
      .filter((change) => {
        if (statusFilter !== "ALL" && change.status !== statusFilter) {
          return false;
        }

        if (updatedOnly && !change.wasUpdated) {
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
  }, [decoratedChanges, searchQuery, statusFilter, updatedOnly]);

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

  const handleAction = async (id: string, action: "approve" | "reject") => {
    setProcessing(id);
    setError(null);

    try {
      const res = await fetch("/api/admin/pending-changes/" + id, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, comment: comments[id] || "" }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Aktion fehlgeschlagen");
      }

      setChanges((prev) => prev.filter((change) => change.id !== id));
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
      <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Offen</p>
              <p className="mt-2 text-3xl font-semibold">{stats.openCount}</p>
              <p className="text-xs text-muted-foreground">Aenderungsantraege in Pruefung</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Genehmigt</p>
              <p className="mt-2 text-3xl font-semibold">{stats.approvedCount}</p>
              <p className="text-xs text-muted-foreground">Bereits erledigte Freigaben</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Abgelehnt</p>
              <p className="mt-2 text-3xl font-semibold">{stats.rejectedCount}</p>
              <p className="text-xs text-muted-foreground">Bereits entschiedene Ablehnungen</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Feldwechsel</p>
              <p className="mt-2 text-3xl font-semibold">{stats.fieldCount}</p>
              <p className="text-xs text-muted-foreground">
                {stats.lastUpdated ? "Letzte Aktivitaet: " + formatDateTime(stats.lastUpdated) : "Noch keine Aktivitaet"}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Suche nach Teilnehmer, Team, Antragsteller oder Aenderung"
                  className="pl-9"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant={statusFilter === "PENDING" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter("PENDING")}
                >
                  Offen
                </Button>
                <Button
                  type="button"
                  variant={statusFilter === "APPROVED" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter("APPROVED")}
                >
                  Genehmigt
                </Button>
                <Button
                  type="button"
                  variant={statusFilter === "REJECTED" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter("REJECTED")}
                >
                  Abgelehnt
                </Button>
                <Button
                  type="button"
                  variant={statusFilter === "ALL" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter("ALL")}
                >
                  Alle
                </Button>
                <Button
                  type="button"
                  variant={updatedOnly ? "default" : "outline"}
                  size="sm"
                  onClick={() => setUpdatedOnly((current) => !current)}
                >
                  {updatedOnly ? "Nur aktualisierte an" : "Nur aktualisierte"}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => void fetchChanges("refresh")} disabled={refreshing}>
                  <RefreshCw className={"mr-2 h-4 w-4" + (refreshing ? " animate-spin" : "")} />
                  Aktualisieren
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

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
}: {
  changes: DecoratedChange[];
  comments: Record<string, string>;
  setComments: Dispatch<SetStateAction<Record<string, string>>>;
  processing: string | null;
  onAction: (id: string, action: "approve" | "reject") => Promise<void>;
  compact?: boolean;
}) {
  const getStatusTone = (status: string) => {
    if (status === "APPROVED") return "border-green-300 text-green-700 dark:text-green-200";
    if (status === "REJECTED") return "border-red-300 text-red-700 dark:text-red-200";
    return "border-amber-300 text-amber-700 dark:text-amber-200";
  };

  const getStatusLabel = (status: string) => {
    if (status === "APPROVED") return "Genehmigt";
    if (status === "REJECTED") return "Abgelehnt";
    return "In Pruefung";
  };

  return (
    <AnimatePresence>
      {changes.map((change) => (
        <motion.div
          key={change.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, x: -80 }}
          layout
        >
          <Card
            className={
              change.status === "APPROVED"
                ? "border-green-200/80 dark:border-green-900/70"
                : change.status === "REJECTED"
                  ? "border-red-200/80 dark:border-red-900/70"
                  : "border-amber-200/80 dark:border-amber-900/70"
            }
          >
            <CardHeader className={compact ? "pb-2" : "pb-3"}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className={compact ? "text-base" : "text-lg"}>{change.participantName}</CardTitle>
                    <Badge variant="outline" className={getStatusTone(change.status)}>
                      {getStatusLabel(change.status)}
                    </Badge>
                    <Badge variant="secondary">{change.fields.length} Feldwechsel</Badge>
                    {change.isCritical ? (
                      <Badge variant="outline" className="border-red-300 text-red-700 dark:text-red-200">
                        Kritisch
                      </Badge>
                    ) : null}
                    {change.wasUpdated && <Badge variant="secondary">Aktualisiert</Badge>}
                    {change.impact?.classificationWarnings?.length ? (
                      <Badge variant="outline" className="border-amber-300 text-amber-700 dark:text-amber-200">
                        Klassenwirkung
                      </Badge>
                    ) : null}
                    {change.impact?.hasLiveDrift ? (
                      <Badge variant="outline" className="border-red-300 text-red-700 dark:text-red-200">
                        Seit Antrag geändert
                      </Badge>
                    ) : null}
                  </div>
                  <CardDescription>
                    Team {change.participant.team.name} · Beantragt von {change.requesterLabel}
                  </CardDescription>
                  <CardDescription>
                    Eingang {formatDateTime(change.createdAt)}
                    {change.wasUpdated ? " · Letztes Update " + formatDateTime(change.updatedAt) : ""}
                    {change.reviewedAt ? " · Entscheiden am " + formatDateTime(change.reviewedAt) : ""}
                  </CardDescription>
                </div>
                {!compact && (
                  <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    <div>{change.participant.email || "Keine Teilnehmer-Mail"}</div>
                    <div>{change.participant.team.contactEmail || "Keine Team-Mail"}</div>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-border/50 bg-muted/30 p-3">
                {(change.impact?.classificationWarnings?.length || change.impact?.disciplineWarnings?.length) ? (
                  <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                    <div className="font-medium">
                      Auswirkung auf Team/Klasse: {change.impact?.nextClassificationLabel || "Unbekannt"}
                      {typeof change.impact?.nextTotalAge === "number" && change.impact.nextTotalAge > 0
                        ? ` · Gesamtalter ${change.impact.nextTotalAge}`
                        : ""}
                    </div>
                    {change.impact?.classificationWarnings?.map((warning, index) => (
                      <div key={`class-${index}`} className="mt-1">
                        {warning}
                      </div>
                    ))}
                    {change.impact?.disciplineWarnings?.map((warning, index) => (
                      <div key={`disc-${index}`} className="mt-1">
                        {warning}
                      </div>
                    ))}
                  </div>
                ) : null}

                {change.impact?.hasLiveDrift ? (
                  <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-900 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100">
                    <div className="font-medium">Achtung: Der Live-Stand wurde seit Antragstellung verändert.</div>
                    <div className="mt-1 text-xs opacity-90">
                      Bitte vor der Entscheidung prüfen, ob der Antrag noch zum aktuellen Datenstand passt.
                    </div>
                    <div className="mt-3 space-y-2">
                      {change.impact.liveDriftSummary.map((field) => (
                        <div key={`drift-${field.field}`} className="grid gap-2 md:grid-cols-[150px_1fr_1fr]">
                          <span className="text-xs font-medium uppercase tracking-[0.14em]">
                            {field.label}
                          </span>
                          <span className="rounded-xl bg-background/70 px-3 py-2 text-sm">
                            Damals: {field.before}
                          </span>
                          <span className="rounded-xl bg-white/70 px-3 py-2 text-sm font-medium dark:bg-black/10">
                            Jetzt: {field.after}
                          </span>
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
                      <div key={field.key} className="grid gap-2 md:grid-cols-[150px_1fr_1fr]">
                        <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                          {fieldLabels[field.key] || field.key}
                        </span>
                        <span className="rounded-xl bg-background px-3 py-2 text-sm text-muted-foreground">
                          {formatValue(field.before)}
                        </span>
                        <span className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                          {formatValue(field.after)}
                        </span>
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
                {change.status === "PENDING" ? (
                  <>
                    {change.impact?.hasLiveDrift ? (
                      <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
                        Genehmigen ist fuer diesen Antrag gesperrt, bis der geaenderte Live-Stand geklaert oder ein neuer Antrag gestellt wurde.
                      </div>
                    ) : null}
                    <Textarea
                      value={comments[change.id] || ""}
                      onChange={(event) => setComments((current) => ({ ...current, [change.id]: event.target.value }))}
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

              {change.status === "PENDING" ? (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    size="sm"
                    onClick={() => void onAction(change.id, "approve")}
                    disabled={processing === change.id || change.impact?.hasLiveDrift}
                    className="sm:flex-1"
                  >
                    {processing === change.id ? "Bearbeite..." : "Genehmigen"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void onAction(change.id, "reject")}
                    disabled={processing === change.id || !(comments[change.id] || "").trim()}
                    className="sm:flex-1"
                  >
                    {processing === change.id ? "Bearbeite..." : "Ablehnen"}
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </AnimatePresence>
  );
}
