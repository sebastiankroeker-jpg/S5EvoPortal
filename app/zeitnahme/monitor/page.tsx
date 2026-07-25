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
  timekeepingMonitorConfigStorageKey,
  timekeepingStorageKey,
} from "@/lib/timekeeping-local";
import { cn } from "@/lib/utils";

type ResultRow = {
  id: string;
  event: TimekeepingEventState;
  session: TimekeepingSessionState;
  starter: Starter | null;
};

type MonitorConfig = {
  classificationCodes: string[];
  rotationSeconds: number;
};

type ClassProgress = {
  code: string;
  label: string;
  total: number;
  finished: number;
  rows: ResultRow[];
};

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

function readLocalMonitorConfig(competitionId: string | null): MonitorConfig {
  if (!competitionId || typeof window === "undefined") return { classificationCodes: [], rotationSeconds: 12 };
  const raw = window.localStorage.getItem(timekeepingMonitorConfigStorageKey(competitionId));
  if (!raw) return { classificationCodes: [], rotationSeconds: 12 };
  try {
    const parsed = JSON.parse(raw) as Partial<MonitorConfig>;
    return {
      classificationCodes: Array.isArray(parsed.classificationCodes)
        ? parsed.classificationCodes.filter((code): code is string => typeof code === "string")
        : [],
      rotationSeconds: typeof parsed.rotationSeconds === "number" && Number.isFinite(parsed.rotationSeconds)
        ? Math.max(5, Math.min(60, Math.round(parsed.rotationSeconds)))
        : 12,
    };
  } catch {
    return { classificationCodes: [], rotationSeconds: 12 };
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
  const [monitorConfig, setMonitorConfig] = useState<MonitorConfig>(() => {
    if (typeof window === "undefined") return { classificationCodes: [], rotationSeconds: 12 };
    const initialCompetitionId = new URLSearchParams(window.location.search).get("competitionId");
    return readLocalMonitorConfig(initialCompetitionId);
  });
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(8);
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);

  const competitionId = competitionIdFromUrl ?? activeCompetition?.id ?? null;

  const refreshLocalState = useCallback(() => {
    const nextState = readLocalState(competitionId);
    setState(nextState);
    setMonitorConfig(readLocalMonitorConfig(competitionId));
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
      if (event.key === timekeepingMonitorConfigStorageKey(competitionId)) {
        setMonitorConfig(readLocalMonitorConfig(competitionId));
        setPageIndex(0);
      }
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
      const availableRows = Math.floor((window.innerHeight - 390) / 86);
      setPageSize(Math.max(4, Math.min(10, availableRows)));
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
  const configuredClassificationCodes = useMemo(() => {
    const configured = monitorConfig.classificationCodes.filter((code) =>
      monitorClassifications.some((classification) => classification.code === code)
    );
    return configured.length > 0 ? configured : monitorClassifications.map((classification) => classification.code);
  }, [monitorClassifications, monitorConfig.classificationCodes]);
  const rows = useMemo<ResultRow[]>(() => {
    const starters = roadSnapshot?.starters ?? [];
    const selectedClassifications = new Set(configuredClassificationCodes);
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
        if (!row.starter) return false;
        const classification = monitorClassifications.find((item) => item.code === row.starter?.classificationCode);
        if (!classification || isOverallClassification(classification.code, classification.label)) return false;
        return selectedClassifications.has(row.starter.classificationCode);
      })
      .sort((left, right) => {
        const leftClassification = left.starter?.classificationCode ?? "";
        const rightClassification = right.starter?.classificationCode ?? "";
        const leftOrder = classificationOrder.get(leftClassification) ?? Number.MAX_SAFE_INTEGER;
        const rightOrder = classificationOrder.get(rightClassification) ?? Number.MAX_SAFE_INTEGER;
        if (leftOrder !== rightOrder) return leftOrder - rightOrder;
        return compareRows(left, right);
      });
  }, [classificationOrder, configuredClassificationCodes, monitorClassifications, roadSessions, roadSnapshot?.starters]);

  const classProgress = useMemo<ClassProgress[]>(() => {
    const rowsByClassification = new Map<string, ResultRow[]>();
    rows.forEach((row) => {
      const classification = row.starter?.classificationCode;
      if (!classification) return;
      rowsByClassification.set(classification, [...(rowsByClassification.get(classification) ?? []), row]);
    });

    return configuredClassificationCodes.map((code) => {
      const classification = monitorClassifications.find((item) => item.code === code);
      const starters = (roadSnapshot?.starters ?? []).filter((starter) => starter.classificationCode === code);
      const classRows = (rowsByClassification.get(code) ?? []).slice().sort(compareRows);
      const finishedStartNumbers = new Set(classRows.map((row) => normalizeTimekeepingStartNumber(row.event.startNumber)).filter(Boolean));
      const finished = starters.filter((starter) => finishedStartNumbers.has(normalizeTimekeepingStartNumber(starter.startNumber))).length;
      return {
        code,
        label: classification?.label ?? code,
        total: starters.length,
        finished,
        rows: classRows,
      };
    });
  }, [configuredClassificationCodes, monitorClassifications, roadSnapshot?.starters, rows]);

  const totalPages = Math.max(1, classProgress.length);
  const effectivePageIndex = pageIndex % totalPages;
  const activeClass = classProgress[effectivePageIndex] ?? classProgress[0] ?? null;
  const visibleRows = activeClass?.rows.slice(0, pageSize) ?? [];
  const rankByRowId = useMemo(() => {
    const rankMap = new Map<string, number>();
    classProgress.forEach((classification) => {
      classification.rows.forEach((row, index) => rankMap.set(row.id, index + 1));
    });
    return rankMap;
  }, [classProgress]);

  const latestRows = useMemo(
    () => rows.slice().sort((left, right) => new Date(right.event.recordedAt).getTime() - new Date(left.event.recordedAt).getTime()).slice(0, 5),
    [rows],
  );
  const activeBlockSummaries = useMemo(() => {
    return roadSessions.map((session) => {
      const starters = (roadSnapshot?.starters ?? []).filter((starter) => session.classificationCodes.includes(starter.classificationCode));
      const finishedStartNumbers = new Set(
        session.events
          .filter((event) => event.eventType === "FINISH")
          .map((event) => normalizeTimekeepingStartNumber(event.startNumber))
          .filter(Boolean),
      );
      const finished = starters.filter((starter) => finishedStartNumbers.has(normalizeTimekeepingStartNumber(starter.startNumber))).length;
      return {
        id: session.id,
        name: session.startBlockName,
        running: Boolean(session.manualStartedAt && !session.manualStoppedAt),
        finished,
        total: starters.length,
        onCourse: Math.max(0, starters.length - finished),
      };
    });
  }, [roadSessions, roadSnapshot?.starters]);

  useEffect(() => {
    if (totalPages <= 1) return;
    const interval = window.setInterval(() => {
      setPageIndex((current) => (current + 1) % totalPages);
    }, monitorConfig.rotationSeconds * 1000);
    return () => window.clearInterval(interval);
  }, [monitorConfig.rotationSeconds, totalPages]);

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

      <section className="grid gap-3 border-b border-white/10 px-5 py-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="grid gap-3 sm:grid-cols-3">
          {activeBlockSummaries.map((block) => (
            <div key={block.id} className={cn(
              "rounded-md border px-4 py-3",
              block.running ? "border-cyan-300/70 bg-cyan-400/15" : "border-white/15 bg-white/10",
            )}>
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-2xl font-semibold">{block.name}</p>
                <span className={cn(
                  "rounded-md px-2 py-1 text-sm font-semibold",
                  block.running ? "bg-cyan-200 text-zinc-950" : "bg-white/10 text-zinc-200",
                )}>
                  {block.running ? "läuft" : "bereit"}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-4xl font-semibold tabular-nums text-emerald-200">{block.finished}</p>
                  <p className="text-xs uppercase text-zinc-400">Ziel</p>
                </div>
                <div>
                  <p className="text-4xl font-semibold tabular-nums text-amber-200">{block.onCourse}</p>
                  <p className="text-xs uppercase text-zinc-400">Strecke</p>
                </div>
                <div>
                  <p className="text-4xl font-semibold tabular-nums text-zinc-100">{block.total}</p>
                  <p className="text-xs uppercase text-zinc-400">Starter</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-md border border-white/15 bg-white/10 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xl font-semibold">Letzte Zieleinläufer</p>
            <p className="text-sm text-zinc-400">Update {lastSeenAt ? formatTimekeepingClock(lastSeenAt) : "-"}</p>
          </div>
          <div className="mt-2 grid gap-1.5">
            {latestRows.length === 0 ? (
              <p className="text-lg text-zinc-400">Noch keine Zieleinläufer.</p>
            ) : latestRows.map((row) => (
              <div key={row.id} className="grid grid-cols-[5rem_minmax(0,1fr)_8rem] items-center gap-3 rounded-md bg-zinc-900/75 px-3 py-2">
                <span className="font-mono text-2xl font-semibold tabular-nums">{row.event.startNumber ?? "-"}</span>
                <span className="truncate text-xl">{row.starter ? `${row.starter.firstName} ${row.starter.lastName}` : "Ohne Zuordnung"}</span>
                <span className="text-right font-mono text-2xl font-semibold tabular-nums text-emerald-200">{formatTimekeepingDuration(row.event.netElapsedMs)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="min-h-0 flex-1 px-5 py-4">
        {!state || !roadSnapshot ? (
          <div className="flex h-full min-h-[22rem] items-center justify-center rounded-md border border-dashed border-white/25 text-center text-xl text-zinc-300">
            Noch keine lokalen ROAD-Zeitnahme-Daten auf diesem Gerät.
          </div>
        ) : !activeClass ? (
          <div className="flex h-full min-h-[22rem] items-center justify-center rounded-md border border-dashed border-white/25 text-center text-xl text-zinc-300">
            Keine Klassen für die Monitor-Auswahl.
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-white/15 bg-zinc-950">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 bg-zinc-900 px-5 py-4">
              <div>
                <p className="text-5xl font-semibold tracking-normal">{activeClass.label}</p>
                <p className="mt-1 text-lg text-zinc-300">
                  {activeClass.finished}/{activeClass.total} im Ziel · {Math.max(0, activeClass.total - activeClass.finished)} offen
                </p>
              </div>
              <div className="text-right text-zinc-300">
                <p className="text-lg">Klasse {effectivePageIndex + 1}/{totalPages}</p>
                <p className="text-sm">Wechsel {monitorConfig.rotationSeconds}s · {rows.length} Ergebnis(se)</p>
              </div>
            </div>
            <table className="w-full table-fixed">
              <thead className="bg-zinc-900/80 text-left text-base uppercase text-zinc-300">
                <tr>
                  <th className="w-24 px-5 py-3">Rang</th>
                  <th className="w-40 px-5 py-3">Startnr.</th>
                  <th className="px-5 py-3">Teilnehmer</th>
                  <th className="px-4 py-3">Mannschaft</th>
                  <th className="w-52 px-5 py-3 text-right">Nettozeit</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-14 text-center text-3xl text-zinc-400">
                      Noch keine Zeiten in dieser Klasse.
                    </td>
                  </tr>
                ) : visibleRows.map((row) => {
                  const rank = rankByRowId.get(row.id) ?? "-";
                  return (
                    <tr key={row.id} className="border-t border-white/10 bg-zinc-950 odd:bg-zinc-900/55">
                      <td className="px-5 py-4 text-5xl font-semibold tabular-nums text-cyan-200">{rank}</td>
                      <td className="px-5 py-4 font-mono text-5xl font-semibold tabular-nums">{row.event.startNumber ?? "-"}</td>
                      <td className="truncate px-5 py-4 text-4xl font-medium">
                        {row.starter ? `${row.starter.firstName} ${row.starter.lastName}` : "Ohne Zuordnung"}
                      </td>
                      <td className="truncate px-4 py-4 text-3xl text-zinc-200">{row.starter?.teamName ?? "-"}</td>
                      <td className="px-5 py-4 text-right font-mono text-5xl font-semibold tabular-nums text-emerald-200">
                        {formatTimekeepingDuration(row.event.netElapsedMs)}
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
