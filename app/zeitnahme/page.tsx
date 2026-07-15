"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  AlertTriangle,
  ArrowDownUp,
  Check,
  Clock3,
  Cloud,
  CloudOff,
  Filter,
  Play,
  RefreshCcw,
  Save,
  Search,
  Timer,
} from "lucide-react";

import NavBar from "@/app/components/nav-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCompetition } from "@/lib/competition-context";
import { usePermissions } from "@/lib/permissions-context";
import { cn } from "@/lib/utils";

type DisciplineCode = "RUN" | "ROAD" | "MTB";
type TimekeepingEventType = "BLOCK_START" | "FINISH" | "ASSIGN_START_NUMBER" | "NOTE";
type SyncStatus = "local" | "synced" | "conflict";

type Starter = {
  participantId: string;
  teamId: string;
  teamName: string;
  startNumber: string | null;
  startNumberValue: number | null;
  firstName: string;
  lastName: string;
  disciplineCode: DisciplineCode;
};

type DisciplineSnapshot = {
  code: DisciplineCode;
  name: string;
  defaultStartIntervalSeconds: number;
  defaultBlockCount: number;
  firstStartNumber: number | null;
  starters: Starter[];
};

type SnapshotResponse = {
  snapshotVersion: string;
  competition: { id: string; name: string; year: number; status: string };
  disciplines: DisciplineSnapshot[];
};

type TimekeepingSessionState = {
  id: string;
  deviceId: string;
  disciplineCode: DisciplineCode;
  startBlockName: string;
  firstStartNumber: number | null;
  startIntervalSeconds: number;
  manualStartedAt: string | null;
  events: TimekeepingEventState[];
};

type TimekeepingEventState = {
  clientEventId: string;
  eventType: TimekeepingEventType;
  recordedAt: string;
  startNumber: string | null;
  rawElapsedMs: number | null;
  netElapsedMs: number | null;
  note?: string | null;
  payload?: Record<string, unknown>;
  syncStatus: SyncStatus;
};

type PersistedState = {
  deviceId: string;
  competitionId: string;
  snapshotVersion: string;
  sessions: TimekeepingSessionState[];
  lastSyncAt: string | null;
};

const DISCIPLINE_LABELS: Record<DisciplineCode, string> = {
  RUN: "Lauf",
  ROAD: "Rad",
  MTB: "MTB",
};

const FILTERS = [
  { id: "all", label: "Alle" },
  { id: "missing", label: "Ohne Startnr." },
  { id: "unsynced", label: "Unsync" },
  { id: "conflict", label: "Konflikt" },
] as const;

const SORTS = [
  { id: "recordedDesc", label: "Neueste" },
  { id: "startNumber", label: "Startnr." },
  { id: "netTime", label: "Zeit" },
] as const;

function storageKey(competitionId: string) {
  return `s5evo-timekeeping-v1:${competitionId}`;
}

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function formatDuration(ms: number | null) {
  if (ms === null || !Number.isFinite(ms)) return "—";
  const totalTenths = Math.max(0, Math.round(ms / 100));
  const tenths = totalTenths % 10;
  const totalSeconds = Math.floor(totalTenths / 10);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}.${tenths}`;
}

function formatClock(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(iso));
}

function toInputNumber(value: number | null) {
  return value === null ? "" : String(value);
}

function buildDefaultSessions(snapshot: SnapshotResponse, existing?: PersistedState | null): TimekeepingSessionState[] {
  const existingSessions = existing?.sessions ?? [];
  return snapshot.disciplines.flatMap((discipline) => {
    const blockCount = Math.max(1, discipline.defaultBlockCount);
    return Array.from({ length: blockCount }, (_, index) => {
      const startBlockName = blockCount > 1 ? `Block ${index + 1}` : "Block 1";
      const existingSession = existingSessions.find(
        (session) => session.disciplineCode === discipline.code && session.startBlockName === startBlockName,
      );
      if (existingSession) return existingSession;
      return {
        id: createId("tks"),
        deviceId: existing?.deviceId ?? createId("device"),
        disciplineCode: discipline.code,
        startBlockName,
        firstStartNumber: discipline.firstStartNumber,
        startIntervalSeconds: discipline.defaultStartIntervalSeconds,
        manualStartedAt: null,
        events: [],
      };
    });
  });
}

function calculateNetMs(session: TimekeepingSessionState, startNumber: string | null, recordedAt: Date) {
  if (!session.manualStartedAt) return { rawElapsedMs: null, netElapsedMs: null };
  const blockStart = new Date(session.manualStartedAt);
  const rawElapsedMs = recordedAt.getTime() - blockStart.getTime();

  if (session.disciplineCode !== "ROAD" || !startNumber || session.firstStartNumber === null) {
    return { rawElapsedMs, netElapsedMs: rawElapsedMs };
  }

  const numericStartNumber = Number.parseInt(startNumber, 10);
  if (!Number.isFinite(numericStartNumber)) {
    return { rawElapsedMs, netElapsedMs: rawElapsedMs };
  }

  const offsetMs = Math.max(0, numericStartNumber - session.firstStartNumber) * session.startIntervalSeconds * 1000;
  return { rawElapsedMs, netElapsedMs: rawElapsedMs - offsetMs };
}

function visibleEventStatus(event: TimekeepingEventState) {
  if (event.syncStatus === "conflict") return "Konflikt";
  if (event.syncStatus === "local") return "Unsync";
  if (!event.startNumber && event.eventType === "FINISH") return "Offen";
  return "Ok";
}

export default function TimekeepingPage() {
  const router = useRouter();
  const { status } = useSession();
  const { active: activeCompetition, loading: competitionLoading } = useCompetition();
  const { can, isLoading: permissionsLoading } = usePermissions();
  const hasAccess = can("timekeeping.use");
  const [snapshot, setSnapshot] = useState<SnapshotResponse | null>(null);
  const [state, setState] = useState<PersistedState | null>(null);
  const [activeDiscipline, setActiveDiscipline] = useState<DisciplineCode>("RUN");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [startNumberInput, setStartNumberInput] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [sort, setSort] = useState<(typeof SORTS)[number]["id"]>("recordedDesc");
  const [assigningEventId, setAssigningEventId] = useState<string | null>(null);
  const [assignValue, setAssignValue] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!activeCompetition?.id || status !== "authenticated" || !hasAccess) return;

    let cancelled = false;
    const loadSnapshot = async () => {
      setError(null);
      try {
        const response = await fetch(`/api/timekeeping/snapshot?competitionId=${encodeURIComponent(activeCompetition.id)}`);
        if (!response.ok) throw new Error("Snapshot konnte nicht geladen werden");
        const data = await response.json() as SnapshotResponse;
        if (cancelled) return;

        const key = storageKey(activeCompetition.id);
        const persisted = window.localStorage.getItem(key);
        const parsed = persisted ? JSON.parse(persisted) as PersistedState : null;
        const deviceId = parsed?.deviceId ?? createId("device");
        const nextState: PersistedState = {
          deviceId,
          competitionId: activeCompetition.id,
          snapshotVersion: data.snapshotVersion,
          sessions: buildDefaultSessions(data, parsed ? { ...parsed, deviceId } : null),
          lastSyncAt: parsed?.lastSyncAt ?? null,
        };

        setSnapshot(data);
        setState(nextState);
        const firstSession = nextState.sessions.find((session) => session.disciplineCode === activeDiscipline)
          ?? nextState.sessions[0]
          ?? null;
        setActiveDiscipline(firstSession?.disciplineCode ?? "RUN");
        setActiveSessionId(firstSession?.id ?? null);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Zeitnahme konnte nicht geladen werden");
      }
    };

    void loadSnapshot();
    return () => {
      cancelled = true;
    };
  }, [activeCompetition?.id, activeDiscipline, hasAccess, status]);

  useEffect(() => {
    if (!state?.competitionId) return;
    window.localStorage.setItem(storageKey(state.competitionId), JSON.stringify(state));
  }, [state]);

  const activeSession = useMemo(
    () => state?.sessions.find((session) => session.id === activeSessionId) ?? null,
    [activeSessionId, state?.sessions],
  );
  const disciplineSnapshot = snapshot?.disciplines.find((discipline) => discipline.code === activeDiscipline) ?? null;
  const unsyncedCount = activeSession?.events.filter((event) => event.syncStatus !== "synced").length ?? 0;
  const missingStartNumbers = activeSession?.events.filter((event) => event.eventType === "FINISH" && !event.startNumber).length ?? 0;
  const runningElapsedMs = activeSession?.manualStartedAt ? now - new Date(activeSession.manualStartedAt).getTime() : null;

  const updateSession = useCallback((updater: (session: TimekeepingSessionState) => TimekeepingSessionState) => {
    setState((current) => {
      if (!current || !activeSessionId) return current;
      return {
        ...current,
        sessions: current.sessions.map((session) => session.id === activeSessionId ? updater(session) : session),
      };
    });
  }, [activeSessionId]);

  const startBlock = () => {
    updateSession((session) => {
      const recordedAt = new Date();
      const startEvent: TimekeepingEventState = {
        clientEventId: createId("evt"),
        eventType: "BLOCK_START",
        recordedAt: recordedAt.toISOString(),
        startNumber: null,
        rawElapsedMs: 0,
        netElapsedMs: 0,
        syncStatus: "local",
        payload: { startBlockName: session.startBlockName },
      };
      return {
        ...session,
        manualStartedAt: recordedAt.toISOString(),
        events: [startEvent, ...session.events],
      };
    });
  };

  const captureFinish = (withoutStartNumber = false) => {
    if (!activeSession?.manualStartedAt) return;
    const recordedAt = new Date();
    const startNumber = withoutStartNumber ? null : startNumberInput.trim() || null;
    const { rawElapsedMs, netElapsedMs } = calculateNetMs(activeSession, startNumber, recordedAt);
    const finishEvent: TimekeepingEventState = {
      clientEventId: createId("evt"),
      eventType: "FINISH",
      recordedAt: recordedAt.toISOString(),
      startNumber,
      rawElapsedMs,
      netElapsedMs,
      syncStatus: "local",
    };
    updateSession((session) => ({ ...session, events: [finishEvent, ...session.events] }));
    if (!withoutStartNumber) setStartNumberInput("");
  };

  const assignStartNumber = (eventId: string) => {
    const nextStartNumber = assignValue.trim();
    if (!activeSession || !nextStartNumber) return;
    const target = activeSession.events.find((event) => event.clientEventId === eventId);
    if (!target) return;
    const { rawElapsedMs, netElapsedMs } = calculateNetMs(activeSession, nextStartNumber, new Date(target.recordedAt));
    const assignmentEvent: TimekeepingEventState = {
      clientEventId: createId("evt"),
      eventType: "ASSIGN_START_NUMBER",
      recordedAt: new Date().toISOString(),
      startNumber: nextStartNumber,
      rawElapsedMs,
      netElapsedMs,
      syncStatus: "local",
      payload: { assignedToClientEventId: eventId },
    };
    updateSession((session) => ({
      ...session,
      events: [
        assignmentEvent,
        ...session.events.map((event) => event.clientEventId === eventId
          ? { ...event, startNumber: nextStartNumber, rawElapsedMs, netElapsedMs, syncStatus: "local" as const }
          : event),
      ],
    }));
    setAssigningEventId(null);
    setAssignValue("");
  };

  const syncEvents = async () => {
    if (!state || !activeSession || !activeCompetition?.id) return;
    const eventsToSync = activeSession.events.filter((event) => event.syncStatus !== "synced");
    if (eventsToSync.length === 0) return;
    setSyncing(true);
    setError(null);
    try {
      const response = await fetch("/api/timekeeping/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competitionId: activeCompetition.id,
          session: {
            id: activeSession.id,
            deviceId: state.deviceId,
            disciplineCode: activeSession.disciplineCode,
            startBlockName: activeSession.startBlockName,
            firstStartNumber: activeSession.firstStartNumber,
            startIntervalSeconds: activeSession.startIntervalSeconds,
            manualStartedAt: activeSession.manualStartedAt,
          },
          events: eventsToSync,
        }),
      });
      if (!response.ok) throw new Error("Sync fehlgeschlagen");
      const result = await response.json() as { syncedAt: string };
      setState((current) => {
        if (!current) return current;
        return {
          ...current,
          lastSyncAt: result.syncedAt,
          sessions: current.sessions.map((session) => session.id === activeSession.id
            ? {
                ...session,
                events: session.events.map((event) => event.syncStatus === "synced"
                  ? event
                  : { ...event, syncStatus: "synced" as const }),
              }
            : session),
        };
      });
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Sync fehlgeschlagen");
    } finally {
      setSyncing(false);
    }
  };

  const filteredEvents = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (activeSession?.events ?? [])
      .filter((event) => event.eventType !== "BLOCK_START")
      .filter((event) => {
        if (filter === "missing") return event.eventType === "FINISH" && !event.startNumber;
        if (filter === "unsynced") return event.syncStatus !== "synced";
        if (filter === "conflict") return event.syncStatus === "conflict";
        return true;
      })
      .filter((event) => {
        if (!needle) return true;
        return [
          event.startNumber,
          event.note,
          formatClock(event.recordedAt),
          formatDuration(event.netElapsedMs),
        ].some((value) => String(value ?? "").toLowerCase().includes(needle));
      })
      .sort((a, b) => {
        if (sort === "startNumber") {
          return Number(a.startNumber ?? Number.MAX_SAFE_INTEGER) - Number(b.startNumber ?? Number.MAX_SAFE_INTEGER);
        }
        if (sort === "netTime") {
          return (a.netElapsedMs ?? Number.MAX_SAFE_INTEGER) - (b.netElapsedMs ?? Number.MAX_SAFE_INTEGER);
        }
        return new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime();
      });
  }, [activeSession?.events, filter, query, sort]);

  if (status === "loading" || permissionsLoading || competitionLoading) {
    return (
      <div className="min-h-screen bg-background">
        <NavBar />
        <main className="mx-auto max-w-5xl px-4 py-6 text-sm text-muted-foreground">Zeitnahme wird geladen...</main>
      </div>
    );
  }

  if (status !== "authenticated" || !hasAccess) {
    return (
      <div className="min-h-screen bg-background">
        <NavBar />
        <main className="mx-auto max-w-5xl px-4 py-6">
          <div className="rounded-md border border-border/60 bg-card p-4">
            <p className="text-sm font-medium">Keine Berechtigung für Zeitnahme.</p>
            <Button className="mt-3" size="sm" variant="secondary" onClick={() => router.push("/")}>Zurück</Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 lg:pb-0">
      <NavBar />
      <main className="mx-auto flex max-w-5xl flex-col gap-3 px-3 py-3 sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold leading-tight">Zeitnahme</h1>
            <p className="truncate text-xs text-muted-foreground">
              {snapshot?.competition.name ?? activeCompetition?.name ?? "Wettkampf"} · {activeSession?.startBlockName ?? "Block"}
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-1",
              unsyncedCount > 0 ? "border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200" : "border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200",
            )}>
              {unsyncedCount > 0 ? <CloudOff className="size-3.5" /> : <Cloud className="size-3.5" />}
              {unsyncedCount > 0 ? `${unsyncedCount} offen` : "sync"}
            </span>
            {missingStartNumbers > 0 && (
              <span className="inline-flex items-center gap-1 rounded-md border border-red-300 bg-red-50 px-2 py-1 text-red-800 dark:bg-red-950/30 dark:text-red-200">
                <AlertTriangle className="size-3.5" />
                {missingStartNumbers}
              </span>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-200">
            {error}
          </div>
        )}

        <div className="flex gap-1 overflow-x-auto rounded-md border border-border/60 bg-card p-1">
          {(snapshot?.disciplines ?? []).map((discipline) => (
            <Button
              key={discipline.code}
              variant={activeDiscipline === discipline.code ? "default" : "ghost"}
              size="sm"
              className="shrink-0"
              onClick={() => {
                setActiveDiscipline(discipline.code);
                setActiveSessionId(state?.sessions.find((session) => session.disciplineCode === discipline.code)?.id ?? null);
              }}
            >
              {DISCIPLINE_LABELS[discipline.code]}
            </Button>
          ))}
        </div>

        {activeDiscipline === "ROAD" && (
          <div className="flex gap-1 overflow-x-auto">
            {state?.sessions.filter((session) => session.disciplineCode === "ROAD").map((session) => (
              <Button
                key={session.id}
                variant={activeSessionId === session.id ? "secondary" : "outline"}
                size="sm"
                className="shrink-0"
                onClick={() => setActiveSessionId(session.id)}
              >
                {session.startBlockName}
              </Button>
            ))}
          </div>
        )}

        <section className="rounded-md border border-border/60 bg-card p-3 shadow-sm">
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="grid gap-1 text-xs font-medium">
                Erste Startnr.
                <Input
                  inputMode="numeric"
                  value={toInputNumber(activeSession?.firstStartNumber ?? null)}
                  onChange={(event) => updateSession((session) => ({
                    ...session,
                    firstStartNumber: event.target.value ? Number.parseInt(event.target.value, 10) : null,
                  }))}
                  className="h-9"
                />
              </label>
              <label className="grid gap-1 text-xs font-medium">
                Abstand s
                <Input
                  inputMode="numeric"
                  value={toInputNumber(activeSession?.startIntervalSeconds ?? 0)}
                  onChange={(event) => updateSession((session) => ({
                    ...session,
                    startIntervalSeconds: event.target.value ? Number.parseInt(event.target.value, 10) : 0,
                  }))}
                  className="h-9"
                  disabled={activeSession?.disciplineCode !== "ROAD"}
                />
              </label>
              <div className="grid gap-1 text-xs font-medium">
                Blockzeit
                <div className="flex h-9 items-center rounded-md border border-border/60 bg-background px-3 font-mono text-lg">
                  {formatDuration(runningElapsedMs)}
                </div>
              </div>
            </div>
            <Button onClick={startBlock} className="h-10 gap-2">
              <Play className="size-4" />
              Start
            </Button>
          </div>
        </section>

        <section className="rounded-md border border-border/60 bg-card p-3 shadow-sm">
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <div className="relative">
              <Timer className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                inputMode="numeric"
                placeholder="Startnummer"
                value={startNumberInput}
                onChange={(event) => setStartNumberInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") captureFinish(false);
                }}
                className="h-12 pl-9 text-lg"
                disabled={!activeSession?.manualStartedAt}
              />
            </div>
            <Button className="h-12 gap-2" disabled={!activeSession?.manualStartedAt} onClick={() => captureFinish(false)}>
              <Clock3 className="size-4" />
              Zeit
            </Button>
            <Button className="h-12" variant="secondary" disabled={!activeSession?.manualStartedAt} onClick={() => captureFinish(true)}>
              Ohne Nr.
            </Button>
          </div>
        </section>

        <section className="rounded-md border border-border/60 bg-card shadow-sm">
          <div className="grid gap-2 border-b border-border/60 p-3 md:grid-cols-[1fr_auto_auto_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Suche" className="h-9 pl-9" />
            </div>
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              <Filter className="size-4" />
              <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)} className="h-9 rounded-md border border-border/60 bg-background px-2 text-sm text-foreground">
                {FILTERS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              <ArrowDownUp className="size-4" />
              <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} className="h-9 rounded-md border border-border/60 bg-background px-2 text-sm text-foreground">
                {SORTS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>
            <Button size="sm" className="h-9 gap-2" onClick={syncEvents} disabled={syncing || unsyncedCount === 0}>
              {syncing ? <RefreshCcw className="size-4 animate-spin" /> : <Save className="size-4" />}
              Sync
            </Button>
          </div>

          <div className="divide-y divide-border/50">
            {filteredEvents.length === 0 ? (
              <div className="p-5 text-center text-sm text-muted-foreground">Keine Zeiten in der aktuellen Ansicht.</div>
            ) : filteredEvents.map((event) => {
              const starter = disciplineSnapshot?.starters.find((item) => item.startNumber === event.startNumber) ?? null;
              const isAssigning = assigningEventId === event.clientEventId;
              return (
                <div key={event.clientEventId} className="grid gap-2 p-3 sm:grid-cols-[72px_1fr_auto] sm:items-center">
                  <div className="font-mono text-sm">{formatClock(event.recordedAt)}</div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn(
                        "inline-flex min-w-14 items-center justify-center rounded-md px-2 py-0.5 text-sm font-semibold",
                        event.startNumber ? "bg-primary/10 text-primary" : "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200",
                      )}>
                        {event.startNumber ?? "ohne"}
                      </span>
                      <span className="font-mono text-base font-semibold">{formatDuration(event.netElapsedMs)}</span>
                      <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">{visibleEventStatus(event)}</span>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {starter ? `${starter.firstName} ${starter.lastName} · ${starter.teamName}` : "Keine lokale Zuordnung"}
                    </p>
                    {isAssigning && (
                      <div className="mt-2 flex max-w-sm gap-2">
                        <Input
                          inputMode="numeric"
                          value={assignValue}
                          onChange={(inputEvent) => setAssignValue(inputEvent.target.value)}
                          onKeyDown={(keyboardEvent) => {
                            if (keyboardEvent.key === "Enter") assignStartNumber(event.clientEventId);
                          }}
                          className="h-8"
                          autoFocus
                        />
                        <Button size="sm" className="h-8" onClick={() => assignStartNumber(event.clientEventId)}>
                          <Check className="size-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  {!event.startNumber && event.eventType === "FINISH" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-8"
                      onClick={() => {
                        setAssigningEventId(event.clientEventId);
                        setAssignValue("");
                      }}
                    >
                      Startnr.
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <p className="text-center text-xs text-muted-foreground">
          Snapshot {snapshot?.snapshotVersion ? formatClock(snapshot.snapshotVersion) : "—"} · Sync {state?.lastSyncAt ? formatClock(state.lastSyncAt) : "offen"}
        </p>
      </main>
    </div>
  );
}
