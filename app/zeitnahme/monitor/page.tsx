"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Monitor, RefreshCcw } from "lucide-react";

import { useCompetition } from "@/lib/competition-context";
import { usePermissions } from "@/lib/permissions-context";
import {
  findTimekeepingStarter,
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

type MonitorPage = {
  classProgress: ClassProgress;
  pageInClass: number;
  pagesInClass: number;
  rowStart: number;
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

  const competitionId = competitionIdFromUrl ?? activeCompetition?.id ?? null;

  const refreshLocalState = useCallback(() => {
    const nextState = readLocalState(competitionId);
    setState(nextState);
    setMonitorConfig(readLocalMonitorConfig(competitionId));
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
      };
    }

    return () => {
      window.removeEventListener("storage", onStorage);
      channel?.close();
    };
  }, [competitionId, refreshLocalState]);

  useEffect(() => {
    const updatePageSize = () => {
      const availableRows = Math.floor((window.innerHeight - 150) / 74);
      setPageSize(Math.max(6, Math.min(14, availableRows)));
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

  const monitorPages = useMemo<MonitorPage[]>(() => {
    return classProgress.flatMap((classification) => {
      if (classification.rows.length === 0) return [];
      const pagesInClass = Math.ceil(classification.rows.length / pageSize);
      return Array.from({ length: pagesInClass }, (_, pageInClass) => ({
        classProgress: classification,
        pageInClass,
        pagesInClass,
        rowStart: pageInClass * pageSize,
      }));
    });
  }, [classProgress, pageSize]);
  const totalPages = monitorPages.length;
  const effectivePageIndex = totalPages > 0 ? pageIndex % totalPages : 0;
  const activePage = totalPages > 0 ? monitorPages[effectivePageIndex] ?? monitorPages[0] : null;
  const activeClass = activePage?.classProgress ?? null;
  const visibleRows = activePage?.classProgress.rows.slice(activePage.rowStart, activePage.rowStart + pageSize) ?? [];
  const rankByRowId = useMemo(() => {
    const rankMap = new Map<string, number>();
    classProgress.forEach((classification) => {
      classification.rows.forEach((row, index) => rankMap.set(row.id, index + 1));
    });
    return rankMap;
  }, [classProgress]);

  useEffect(() => {
    if (totalPages <= 1) return;
    const interval = window.setInterval(() => {
      setPageIndex((current) => (current + 1) % totalPages);
    }, monitorConfig.rotationSeconds * 1000);
    return () => window.clearInterval(interval);
  }, [monitorConfig.rotationSeconds, totalPages]);

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
    <main className="flex h-dvh min-h-0 flex-col overflow-hidden bg-zinc-950 text-zinc-50">
      <header className="flex items-center border-b border-white/15 px-5 py-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <Monitor className="size-7 text-cyan-300" />
            <h1 className="text-2xl font-semibold tracking-normal">Rad Einzelzeitfahren</h1>
          </div>
        </div>
      </header>

      <section className="min-h-0 flex-1 overflow-hidden px-5 py-2.5">
        {!state || !roadSnapshot ? (
          <div className="flex h-full min-h-[22rem] items-center justify-center rounded-md border border-dashed border-white/25 text-center text-xl text-zinc-300">
            Noch keine lokalen ROAD-Zeitnahme-Daten auf diesem Gerät.
          </div>
        ) : classProgress.length === 0 ? (
          <div className="flex h-full min-h-[22rem] items-center justify-center rounded-md border border-dashed border-white/25 text-center text-xl text-zinc-300">
            Keine Klassen für die Monitor-Auswahl.
          </div>
        ) : !activeClass ? (
          <div className="flex h-full min-h-[22rem] items-center justify-center rounded-md border border-dashed border-white/25 text-center text-xl text-zinc-300">
            Noch keine Zeiten in den ausgewählten Klassen.
          </div>
        ) : (
          <div className="h-full overflow-hidden rounded-md border border-white/15 bg-zinc-950">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-5 border-b border-white/10 bg-zinc-900 px-5 py-2.5">
              <div className="flex min-w-0 items-baseline gap-5">
                <p className="text-4xl font-semibold tracking-normal">{activeClass.label}</p>
                <p className="text-3xl font-semibold tabular-nums text-emerald-200">
                  {activeClass.finished}/{activeClass.total} im Ziel
                </p>
              </div>
              <div className="text-right text-2xl font-semibold tabular-nums text-zinc-200">
                <p>
                  Seite {(activePage?.pageInClass ?? 0) + 1}/{activePage?.pagesInClass ?? 1} · Wechsel {monitorConfig.rotationSeconds}s
                </p>
              </div>
            </div>
            <table className="w-full table-fixed">
              <thead className="bg-zinc-900/80 text-left text-sm uppercase text-zinc-300">
                <tr>
                  <th className="w-20 px-5 py-2">Rang</th>
                  <th className="w-32 px-5 py-2">Startnr.</th>
                  <th className="px-5 py-2">Teilnehmer</th>
                  <th className="px-4 py-2">Mannschaft</th>
                  <th className="w-48 px-5 py-2 text-right">Nettozeit</th>
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
                    <tr key={row.id} className="h-[4.25rem] border-t border-white/10 bg-zinc-950 odd:bg-zinc-900/55">
                      <td className="px-5 py-2 text-4xl font-semibold tabular-nums text-cyan-200">{rank}</td>
                      <td className="px-5 py-2 font-mono text-4xl font-semibold tabular-nums">{row.event.startNumber ?? "-"}</td>
                      <td className="truncate px-5 py-2 text-3xl font-medium">
                        {row.starter ? `${row.starter.firstName} ${row.starter.lastName}` : "Ohne Zuordnung"}
                      </td>
                      <td className="truncate px-4 py-2 text-2xl text-zinc-200">{row.starter?.teamName ?? "-"}</td>
                      <td className="px-5 py-2 text-right font-mono text-4xl font-semibold tabular-nums text-emerald-200">
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

    </main>
  );
}
