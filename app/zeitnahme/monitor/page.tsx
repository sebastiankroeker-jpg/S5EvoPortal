"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Clock3, Monitor, RefreshCcw, Wifi, WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCompetition } from "@/lib/competition-context";
import { usePermissions } from "@/lib/permissions-context";
import {
  findTimekeepingStarter,
  formatTimekeepingClock,
  formatTimekeepingDuration,
  normalizeTimekeepingStartNumber,
  type PersistedTimekeepingState,
  type Starter,
  type TimekeepingEventState,
  type TimekeepingSessionState,
  TIMEKEEPING_LOCAL_BROADCAST_CHANNEL,
  timekeepingStorageKey,
} from "@/lib/timekeeping-local";
import { cn } from "@/lib/utils";

type ResultRow = {
  id: string;
  event: TimekeepingEventState;
  session: TimekeepingSessionState;
  starter: Starter | null;
};

function statusLabel(event: TimekeepingEventState) {
  if (event.syncStatus === "conflict") return "Konflikt";
  if (!event.startNumber) return "Offen";
  if (event.syncStatus === "local") return "lokal";
  return "sync";
}

function readLocalState(competitionId: string | null) {
  if (!competitionId || typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(timekeepingStorageKey(competitionId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PersistedTimekeepingState;
  } catch {
    return null;
  }
}

function compareRows(left: ResultRow, right: ResultRow) {
  const leftTime = left.event.netElapsedMs ?? Number.MAX_SAFE_INTEGER;
  const rightTime = right.event.netElapsedMs ?? Number.MAX_SAFE_INTEGER;
  if (leftTime !== rightTime) return leftTime - rightTime;

  const leftNumber = Number(normalizeTimekeepingStartNumber(left.event.startNumber));
  const rightNumber = Number(normalizeTimekeepingStartNumber(right.event.startNumber));
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber !== rightNumber) {
    return leftNumber - rightNumber;
  }

  return new Date(left.event.recordedAt).getTime() - new Date(right.event.recordedAt).getTime();
}

function isOverallClassification(code: string, label: string) {
  const normalizedCode = code.toLowerCase();
  const normalizedLabel = label.toLowerCase();
  return normalizedCode.includes("combined")
    || normalizedLabel === "herren gesamt"
    || normalizedLabel === "damen gesamt";
}

export default function RoadTimekeepingMonitorPage() {
  const { status } = useSession();
  const { active: activeCompetition, loading: competitionLoading } = useCompetition();
  const { can, isLoading: permissionsLoading } = usePermissions();
  const hasAccess = can("timekeeping.use");
  const [competitionIdFromUrl] = useState(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("competitionId");
  });
  const [state, setState] = useState<PersistedTimekeepingState | null>(() => {
    if (typeof window === "undefined") return null;
    const initialCompetitionId = new URLSearchParams(window.location.search).get("competitionId");
    return readLocalState(initialCompetitionId);
  });
  const [selectedClassificationCodes, setSelectedClassificationCodes] = useState<string[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(8);
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);

  const competitionId = competitionIdFromUrl ?? activeCompetition?.id ?? null;

  const refreshLocalState = useCallback(() => {
    const nextState = readLocalState(competitionId);
    setState(nextState);
    setLastSeenAt(nextState ? new Date().toISOString() : null);
  }, [competitionId]);

  useEffect(() => {
    const timeout = window.setTimeout(refreshLocalState, 0);
    return () => window.clearTimeout(timeout);
  }, [refreshLocalState]);

  useEffect(() => {
    if (!competitionId) return;

    const onStorage = (event: StorageEvent) => {
      if (event.key === timekeepingStorageKey(competitionId)) refreshLocalState();
    };

    window.addEventListener("storage", onStorage);

    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel(TIMEKEEPING_LOCAL_BROADCAST_CHANNEL);
      channel.onmessage = (event: MessageEvent) => {
        const payload = event.data as { type?: string; competitionId?: string; state?: PersistedTimekeepingState };
        if (payload.type !== "timekeeping-state" || payload.competitionId !== competitionId || !payload.state) return;
        setState(payload.state);
        setLastSeenAt(new Date().toISOString());
      };
    }

    return () => {
      window.removeEventListener("storage", onStorage);
      channel?.close();
    };
  }, [competitionId, refreshLocalState]);

  useEffect(() => {
    const updatePageSize = () => {
      const availableRows = Math.floor((window.innerHeight - 245) / 76);
      setPageSize(Math.max(4, Math.min(14, availableRows)));
    };

    updatePageSize();
    window.addEventListener("resize", updatePageSize);
    return () => window.removeEventListener("resize", updatePageSize);
  }, []);

  const roadSnapshot = state?.cachedSnapshot?.disciplines.find((discipline) => discipline.code === "ROAD") ?? null;
  const roadSessions = useMemo(() => state?.sessions.filter((session) => session.disciplineCode === "ROAD") ?? [], [state?.sessions]);
  const monitorClassifications = useMemo(
    () => (roadSnapshot?.classifications ?? []).filter((classification) => !isOverallClassification(classification.code, classification.label)),
    [roadSnapshot?.classifications],
  );
  const classificationOrder = useMemo(
    () => new Map(monitorClassifications.map((classification, index) => [classification.code, index])),
    [monitorClassifications],
  );
  const rows = useMemo<ResultRow[]>(() => {
    const starters = roadSnapshot?.starters ?? [];
    const selectedClassifications = new Set(selectedClassificationCodes);
    return roadSessions
      .flatMap((session) =>
        session.events
          .filter((event) => event.eventType === "FINISH")
          .map((event) => ({
            id: `${session.id}:${event.clientEventId}`,
            event,
            session,
            starter: findTimekeepingStarter(starters, event.startNumber),
          })),
      )
      .filter((row) => {
        if (!row.starter) return selectedClassifications.size === 0;
        const classification = monitorClassifications.find((item) => item.code === row.starter?.classificationCode);
        if (!classification || isOverallClassification(classification.code, classification.label)) return false;
        return selectedClassifications.size === 0 || selectedClassifications.has(row.starter.classificationCode);
      })
      .sort((left, right) => {
        const leftClassification = left.starter?.classificationCode ?? "";
        const rightClassification = right.starter?.classificationCode ?? "";
        const leftOrder = classificationOrder.get(leftClassification) ?? Number.MAX_SAFE_INTEGER;
        const rightOrder = classificationOrder.get(rightClassification) ?? Number.MAX_SAFE_INTEGER;
        if (leftOrder !== rightOrder) return leftOrder - rightOrder;
        return compareRows(left, right);
      });
  }, [classificationOrder, monitorClassifications, roadSessions, roadSnapshot?.starters, selectedClassificationCodes]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const effectivePageIndex = pageIndex % totalPages;
  const visibleRows = rows.slice(effectivePageIndex * pageSize, effectivePageIndex * pageSize + pageSize);
  const rankByRowId = useMemo(() => {
    const rankMap = new Map<string, number>();
    const rowsByClassification = new Map<string, ResultRow[]>();
    rows.forEach((row) => {
      const classification = row.starter?.classificationCode ?? "unassigned";
      rowsByClassification.set(classification, [...(rowsByClassification.get(classification) ?? []), row]);
    });
    rowsByClassification.forEach((classificationRows) => {
      classificationRows.slice().sort(compareRows).forEach((row, index) => rankMap.set(row.id, index + 1));
    });
    return rankMap;
  }, [rows]);

  useEffect(() => {
    if (totalPages <= 1) return;
    const interval = window.setInterval(() => {
      setPageIndex((current) => (current + 1) % totalPages);
    }, 8000);
    return () => window.clearInterval(interval);
  }, [totalPages]);

  const activeSessionCount = roadSessions.filter((session) => session.manualStartedAt && !session.manualStoppedAt).length;
  const hasLocalOpenItems = rows.some((row) => row.event.syncStatus !== "synced");

  if (status === "loading" || permissionsLoading || competitionLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-100">
        <div className="flex items-center gap-3 text-xl">
          <RefreshCcw className="size-6 animate-spin" />
          Monitor wird geladen...
        </div>
      </main>
    );
  }

  if (status !== "authenticated" || !hasAccess) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-6 text-zinc-100">
        <div className="max-w-lg rounded-md border border-red-400/40 bg-red-950/40 p-5 text-center">
          <p className="text-lg font-semibold">Keine Berechtigung für die Zeitnahme-Anzeige.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-zinc-950 text-zinc-50">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/15 px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <Monitor className="size-8 text-cyan-300" />
            <h1 className="text-3xl font-semibold tracking-normal">Rad Einzelzeitfahren</h1>
          </div>
          <p className="mt-1 truncate text-base text-zinc-300">
            {state?.cachedSnapshot?.competition.name ?? activeCompetition?.name ?? "Wettkampf"} · provisorische Live-Zeiten
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 text-sm">
          <span className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 py-2">
            <Clock3 className="size-4" />
            {activeSessionCount > 0 ? `${activeSessionCount} Uhr(en) laufen` : "keine aktive Uhr"}
          </span>
          <span className={cn(
            "inline-flex items-center gap-2 rounded-md border px-3 py-2",
            hasLocalOpenItems ? "border-amber-300/60 bg-amber-400/15 text-amber-100" : "border-emerald-300/60 bg-emerald-400/15 text-emerald-100",
          )}>
            {hasLocalOpenItems ? <WifiOff className="size-4" /> : <Wifi className="size-4" />}
            {hasLocalOpenItems ? "lokale Zeiten" : "sync"}
          </span>
          <Button variant="secondary" size="sm" className="gap-2" onClick={refreshLocalState}>
            <RefreshCcw className="size-4" />
            Aktualisieren
          </Button>
        </div>
      </header>

      <section className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={selectedClassificationCodes.length === 0 ? "secondary" : "ghost"}
            className={cn("h-9 border border-white/10 text-zinc-50", selectedClassificationCodes.length === 0 ? "text-zinc-950" : "hover:bg-white/10")}
            onClick={() => {
              setSelectedClassificationCodes([]);
              setPageIndex(0);
            }}
          >
            Alle Wertungsklassen
          </Button>
          {monitorClassifications.map((classification) => {
            const isSelected = selectedClassificationCodes.includes(classification.code);
            return (
              <Button
                key={classification.code}
                size="sm"
                variant={isSelected ? "secondary" : "ghost"}
                className={cn("h-9 border border-white/10 text-zinc-50", isSelected ? "text-zinc-950" : "hover:bg-white/10")}
                onClick={() => {
                  setSelectedClassificationCodes((current) =>
                    current.includes(classification.code)
                      ? current.filter((code) => code !== classification.code)
                      : [...current, classification.code],
                  );
                  setPageIndex(0);
                }}
              >
                {classification.label}
              </Button>
            );
          })}
        </div>
        <div className="flex items-center gap-3 text-sm text-zinc-300">
          <span>{rows.length} Ergebnis(se)</span>
          {selectedClassificationCodes.length > 0 && <span>{selectedClassificationCodes.length} Klasse(n)</span>}
          {totalPages > 1 && <span>Seite {effectivePageIndex + 1}/{totalPages}</span>}
          <span>Update {lastSeenAt ? formatTimekeepingClock(lastSeenAt) : "-"}</span>
        </div>
      </section>

      <section className="min-h-0 flex-1 px-5 py-4">
        {!state || !roadSnapshot ? (
          <div className="flex h-full min-h-[22rem] items-center justify-center rounded-md border border-dashed border-white/25 text-center text-xl text-zinc-300">
            Noch keine lokalen ROAD-Zeitnahme-Daten auf diesem Gerät.
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="flex h-full min-h-[22rem] items-center justify-center rounded-md border border-dashed border-white/25 text-center text-xl text-zinc-300">
            Keine Zeiten für die aktuelle Klassenauswahl.
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-white/15">
            <table className="w-full table-fixed">
              <thead className="bg-zinc-900 text-left text-sm uppercase text-zinc-300">
                <tr>
                  <th className="w-20 px-4 py-3">Rang</th>
                  <th className="w-36 px-4 py-3">Startnr.</th>
                  <th className="px-4 py-3">Teilnehmer</th>
                  <th className="px-4 py-3">Mannschaft</th>
                  <th className="w-36 px-4 py-3">Klasse</th>
                  <th className="w-44 px-4 py-3 text-right">Nettozeit</th>
                  <th className="w-32 px-4 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const rank = rankByRowId.get(row.id) ?? "-";
                  return (
                    <tr key={row.id} className="border-t border-white/10 bg-zinc-950 odd:bg-zinc-900/55">
                      <td className="px-4 py-3 text-3xl font-semibold tabular-nums text-cyan-200">{rank}</td>
                      <td className="px-4 py-3 font-mono text-3xl font-semibold tabular-nums">{row.event.startNumber ?? "-"}</td>
                      <td className="truncate px-4 py-3 text-2xl font-medium">
                        {row.starter ? `${row.starter.firstName} ${row.starter.lastName}` : "Ohne Zuordnung"}
                      </td>
                      <td className="truncate px-4 py-3 text-xl text-zinc-200">{row.starter?.teamName ?? "-"}</td>
                      <td className="truncate px-4 py-3 text-xl text-zinc-200">{row.starter?.classificationLabel ?? "-"}</td>
                      <td className="px-4 py-3 text-right font-mono text-4xl font-semibold tabular-nums text-emerald-200">
                        {formatTimekeepingDuration(row.event.netElapsedMs)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={cn(
                          "inline-flex rounded-md px-2 py-1 text-sm font-medium",
                          row.event.syncStatus === "synced"
                            ? "bg-emerald-400/15 text-emerald-100"
                            : "bg-amber-400/15 text-amber-100",
                        )}>
                          {statusLabel(row.event)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-3 text-sm text-zinc-400">
        <span>
          Blöcke: {roadSessions.map((session) => session.startBlockName).join(", ") || "-"}
        </span>
        <span>
          Snapshot {state?.snapshotVersion ? formatTimekeepingClock(state.snapshotVersion) : "-"}
        </span>
      </footer>
    </main>
  );
}
