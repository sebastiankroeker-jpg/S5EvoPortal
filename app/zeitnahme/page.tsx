"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Plus,
  Play,
  RefreshCcw,
  Save,
  Settings2,
  Search,
  SlidersHorizontal,
  Square,
  Timer,
  Trash2,
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
  classificationCode: string;
  classificationLabel: string;
  startNumber: string | null;
  startNumberValue: number | null;
  firstName: string;
  lastName: string;
  disciplineCode: DisciplineCode;
};

type ClassificationOption = {
  code: string;
  label: string;
};

type StartBlockDefinition = {
  name: string;
  classificationCodes: string[];
};

type DisciplineSnapshot = {
  code: DisciplineCode;
  name: string;
  defaultStartIntervalSeconds: number;
  defaultStartBlocks: StartBlockDefinition[];
  firstStartNumber: number | null;
  classifications: ClassificationOption[];
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
  classificationCodes: string[];
  firstStartNumber: number | null;
  startIntervalSeconds: number;
  manualStartedAt: string | null;
  manualStoppedAt: string | null;
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

function getFirstStartNumber(starters: Starter[], classificationCodes: string[]) {
  const matchingClassifications = new Set(classificationCodes);
  return starters.find((starter) =>
    starter.startNumberValue !== null && matchingClassifications.has(starter.classificationCode)
  )?.startNumberValue ?? null;
}

function hasStoredClassificationConfig(session: TimekeepingSessionState) {
  return Array.isArray(session.classificationCodes);
}

function buildDefaultSessions(snapshot: SnapshotResponse, existing?: PersistedState | null): TimekeepingSessionState[] {
  const existingSessions = existing?.sessions ?? [];
  const nextSessions = snapshot.disciplines.flatMap((discipline) => {
    const existingDisciplineSessions = existingSessions.filter((session) => session.disciplineCode === discipline.code);
    if (existingDisciplineSessions.some(hasStoredClassificationConfig)) {
      return existingDisciplineSessions.map((session) => ({
        ...session,
        classificationCodes: session.classificationCodes ?? [],
        firstStartNumber: session.firstStartNumber ?? getFirstStartNumber(discipline.starters, session.classificationCodes ?? []),
        startIntervalSeconds: session.startIntervalSeconds ?? discipline.defaultStartIntervalSeconds,
        manualStoppedAt: session.manualStoppedAt ?? null,
      }));
    }

    const defaultBlocks = discipline.defaultStartBlocks.length > 0
      ? discipline.defaultStartBlocks
      : [{ name: "Block 1", classificationCodes: discipline.classifications.map((classification) => classification.code) }];
    return defaultBlocks.map((block) => {
      const existingSession = existingSessions.find(
        (session) => session.disciplineCode === discipline.code && session.startBlockName === block.name,
      );
      if (existingSession) {
        return {
          ...existingSession,
          classificationCodes: existingSession.classificationCodes?.length
            ? existingSession.classificationCodes
            : block.classificationCodes,
          firstStartNumber: existingSession.firstStartNumber ?? getFirstStartNumber(discipline.starters, block.classificationCodes),
          manualStoppedAt: existingSession.manualStoppedAt ?? null,
        };
      }
      return {
        id: createId("tks"),
        deviceId: existing?.deviceId ?? createId("device"),
        disciplineCode: discipline.code,
        startBlockName: block.name,
        classificationCodes: block.classificationCodes,
        firstStartNumber: getFirstStartNumber(discipline.starters, block.classificationCodes) ?? discipline.firstStartNumber,
        startIntervalSeconds: discipline.defaultStartIntervalSeconds,
        manualStartedAt: null,
        manualStoppedAt: null,
        events: [],
      };
    });
  });

  const defaultSessionKeys = new Set(
    nextSessions.map((session) => `${session.disciplineCode}:${session.startBlockName}`),
  );
  const preservedLocalSessions = existingSessions.filter((session) =>
    !defaultSessionKeys.has(`${session.disciplineCode}:${session.startBlockName}`)
    && (session.events.length > 0 || session.manualStartedAt)
  ).map((session) => ({
    ...session,
    classificationCodes: session.classificationCodes ?? [],
    manualStoppedAt: session.manualStoppedAt ?? null,
  }));

  return [...nextSessions, ...preservedLocalSessions];
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

function triggerCaptureFeedback() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(35);
  }
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
  const [activeTab, setActiveTab] = useState<"clock" | "config">("clock");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const startNumberInputRef = useRef<HTMLInputElement | null>(null);

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
  const activeBlockStarters = useMemo(() => {
    if (!activeSession || !disciplineSnapshot) return [];
    const classifications = new Set(activeSession.classificationCodes);
    return disciplineSnapshot.starters.filter((starter) => classifications.has(starter.classificationCode));
  }, [activeSession, disciplineSnapshot]);
  const unsyncedCount = activeSession?.events.filter((event) => event.syncStatus !== "synced").length ?? 0;
  const missingStartNumbers = activeSession?.events.filter((event) => event.eventType === "FINISH" && !event.startNumber).length ?? 0;
  const clockIsRunning = Boolean(activeSession?.manualStartedAt && !activeSession.manualStoppedAt);
  const runningElapsedMs = activeSession?.manualStartedAt
    ? new Date(activeSession.manualStoppedAt ?? now).getTime() - new Date(activeSession.manualStartedAt).getTime()
    : null;

  const updateSession = useCallback((updater: (session: TimekeepingSessionState) => TimekeepingSessionState) => {
    setState((current) => {
      if (!current || !activeSessionId) return current;
      return {
        ...current,
        sessions: current.sessions.map((session) => session.id === activeSessionId ? updater(session) : session),
      };
    });
  }, [activeSessionId]);

  const setActiveSessionByDiscipline = (disciplineCode: DisciplineCode) => {
    const nextSession = state?.sessions.find((session) => session.disciplineCode === disciplineCode) ?? null;
    setActiveDiscipline(disciplineCode);
    setActiveSessionId(nextSession?.id ?? null);
  };

  const addStartBlock = () => {
    if (!disciplineSnapshot || !state) return;
    const disciplineSessions = state.sessions.filter((session) => session.disciplineCode === activeDiscipline);
    const allClassificationCodes = disciplineSnapshot.classifications.map((classification) => classification.code);
    const nextSession: TimekeepingSessionState = {
      id: createId("tks"),
      deviceId: state.deviceId,
      disciplineCode: activeDiscipline,
      startBlockName: `Block ${disciplineSessions.length + 1}`,
      classificationCodes: allClassificationCodes,
      firstStartNumber: disciplineSnapshot.firstStartNumber,
      startIntervalSeconds: disciplineSnapshot.defaultStartIntervalSeconds,
      manualStartedAt: null,
      manualStoppedAt: null,
      events: [],
    };
    setState((current) => current ? { ...current, sessions: [...current.sessions, nextSession] } : current);
    setActiveSessionId(nextSession.id);
  };

  const removeActiveStartBlock = () => {
    if (!state || !activeSession) return;
    const disciplineSessions = state.sessions.filter((session) => session.disciplineCode === activeDiscipline);
    if (disciplineSessions.length <= 1 || activeSession.events.length > 0 || activeSession.manualStartedAt) return;
    const remainingSessions = state.sessions.filter((session) => session.id !== activeSession.id);
    const nextSession = remainingSessions.find((session) => session.disciplineCode === activeDiscipline) ?? remainingSessions[0] ?? null;
    setState({ ...state, sessions: remainingSessions });
    setActiveSessionId(nextSession?.id ?? null);
    setActiveDiscipline(nextSession?.disciplineCode ?? activeDiscipline);
  };

  const toggleActiveSessionClassification = (classificationCode: string) => {
    updateSession((session) => {
      const hasClassification = session.classificationCodes.includes(classificationCode);
      const classificationCodes = hasClassification
        ? session.classificationCodes.filter((code) => code !== classificationCode)
        : [...session.classificationCodes, classificationCode];
      const nextFirstStartNumber = disciplineSnapshot
        ? getFirstStartNumber(disciplineSnapshot.starters, classificationCodes)
        : null;
      return {
        ...session,
        classificationCodes,
        firstStartNumber: nextFirstStartNumber ?? session.firstStartNumber,
      };
    });
  };

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
        payload: {
          startBlockName: session.startBlockName,
          classificationCodes: session.classificationCodes,
        },
      };
      return {
        ...session,
        manualStartedAt: recordedAt.toISOString(),
        manualStoppedAt: null,
        events: [startEvent, ...session.events],
      };
    });
    window.requestAnimationFrame(() => {
      startNumberInputRef.current?.focus();
    });
  };

  const stopBlock = () => {
    if (!clockIsRunning) return;
    updateSession((session) => ({ ...session, manualStoppedAt: new Date().toISOString() }));
  };

  const resetClock = () => {
    updateSession((session) => {
      const hasCapturedLocalTimes = session.events.some((event) => event.eventType === "FINISH" && event.syncStatus !== "synced");
      return {
        ...session,
        manualStartedAt: null,
        manualStoppedAt: null,
        events: hasCapturedLocalTimes
          ? session.events
          : session.events.filter((event) => event.eventType !== "BLOCK_START" || event.syncStatus === "synced"),
      };
    });
    setStartNumberInput("");
  };

  const resetLocalData = () => {
    if (!activeSession || unsyncedCount === 0) return;
    const confirmed = window.confirm("Ungesyncte Zeiten dieses Blocks lokal löschen?");
    if (!confirmed) return;
    updateSession((session) => {
      const remainingEvents = session.events.filter((event) => event.syncStatus === "synced");
      return {
        ...session,
        manualStartedAt: remainingEvents.length > 0 ? session.manualStartedAt : null,
        manualStoppedAt: remainingEvents.length > 0 ? session.manualStoppedAt : null,
        events: remainingEvents,
      };
    });
    setAssigningEventId(null);
    setAssignValue("");
    setStartNumberInput("");
  };

  const captureFinish = () => {
    if (!activeSession?.manualStartedAt || activeSession.manualStoppedAt) return;
    const recordedAt = new Date();
    const startNumber = startNumberInput.trim() || null;
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
    setStartNumberInput("");
    triggerCaptureFeedback();
    window.requestAnimationFrame(() => {
      startNumberInputRef.current?.focus();
    });
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
            classificationCodes: activeSession.classificationCodes,
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

        <div className="flex gap-1 rounded-md border border-border/60 bg-card p-1">
          <Button
            variant={activeTab === "clock" ? "default" : "ghost"}
            size="sm"
            className="flex-1 gap-2"
            onClick={() => setActiveTab("clock")}
          >
            <Timer className="size-4" />
            Uhr
          </Button>
          <Button
            variant={activeTab === "config" ? "default" : "ghost"}
            size="sm"
            className="flex-1 gap-2"
            onClick={() => setActiveTab("config")}
          >
            <Settings2 className="size-4" />
            Konfiguration
          </Button>
        </div>

        {activeTab === "config" && (
          <section className="rounded-md border border-border/60 bg-card p-3 shadow-sm">
            <div className="grid gap-3">
              <div className="grid gap-2">
                <p className="text-xs font-semibold text-muted-foreground">Disziplin</p>
                <div className="flex gap-1 overflow-x-auto">
                  {(snapshot?.disciplines ?? []).map((discipline) => (
                    <Button
                      key={discipline.code}
                      variant={activeDiscipline === discipline.code ? "default" : "outline"}
                      size="sm"
                      className="shrink-0"
                      onClick={() => setActiveSessionByDiscipline(discipline.code)}
                    >
                      {DISCIPLINE_LABELS[discipline.code]}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-muted-foreground">Startblöcke</p>
                  <Button size="sm" variant="ghost" className="h-8 gap-1.5 px-2" onClick={addStartBlock}>
                    <Plus className="size-4" />
                    Block
                  </Button>
                </div>
                <div className="flex gap-1 overflow-x-auto pb-1">
                  {state?.sessions.filter((session) => session.disciplineCode === activeDiscipline).map((session) => (
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
              </div>

              <div className="grid gap-2">
                <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                  <label className="grid gap-1 text-xs font-medium">
                    Blockname
                    <Input
                      value={activeSession?.startBlockName ?? ""}
                      onChange={(event) => updateSession((session) => ({
                        ...session,
                        startBlockName: event.target.value,
                      }))}
                      className="h-9"
                    />
                  </label>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-9 gap-1.5 text-muted-foreground"
                    onClick={removeActiveStartBlock}
                    disabled={!activeSession || (state?.sessions.filter((session) => session.disciplineCode === activeDiscipline).length ?? 0) <= 1 || activeSession.events.length > 0 || Boolean(activeSession.manualStartedAt)}
                  >
                    <Trash2 className="size-4" />
                    Entfernen
                  </Button>
                </div>
                <div className="grid gap-1">
                  <p className="text-xs font-medium">Klassen in diesem Block</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(disciplineSnapshot?.classifications ?? []).map((classification) => {
                      const isActive = activeSession?.classificationCodes.includes(classification.code) ?? false;
                      return (
                        <Button
                          key={classification.code}
                          type="button"
                          size="sm"
                          variant={isActive ? "default" : "outline"}
                          className="h-8 px-2 text-xs"
                          onClick={() => toggleActiveSessionClassification(classification.code)}
                          disabled={!activeSession}
                        >
                          {classification.label}
                        </Button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {activeBlockStarters.length} Starter im aktuellen Block
                  </p>
                </div>
              </div>

              {activeDiscipline === "ROAD" && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="grid gap-1 text-xs font-medium">
                    Erste Startnr.
                    <Input
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={toInputNumber(activeSession?.firstStartNumber ?? null)}
                      onChange={(event) => updateSession((session) => ({
                        ...session,
                        firstStartNumber: event.target.value ? Number.parseInt(event.target.value, 10) : null,
                      }))}
                      className="h-9"
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-medium">
                    Start-Abstand Sekunden
                    <Input
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={toInputNumber(activeSession?.startIntervalSeconds ?? 0)}
                      onChange={(event) => updateSession((session) => ({
                        ...session,
                        startIntervalSeconds: event.target.value ? Number.parseInt(event.target.value, 10) : 0,
                      }))}
                      className="h-9"
                    />
                  </label>
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === "clock" && (
          <section className="rounded-md border border-border/60 bg-card p-3 shadow-sm">
            <div className="grid gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {activeSession ? `${DISCIPLINE_LABELS[activeSession.disciplineCode]} · ${activeSession.startBlockName}` : "Kein Block"}
                </span>
                <span>
                  {activeSession?.disciplineCode === "ROAD"
                    ? `${activeBlockStarters.length} Starter · Startnr. ab ${activeSession.firstStartNumber ?? "—"} · Abstand ${activeSession.startIntervalSeconds}s`
                    : `${activeBlockStarters.length} Starter`}
                </span>
              </div>

              <div className="flex items-center justify-center rounded-md border border-border/60 bg-background px-3 py-4 font-mono text-5xl font-semibold tabular-nums">
                {formatDuration(runningElapsedMs)}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <Button onClick={startBlock} className="h-11 gap-2" disabled={!activeSession || Boolean(activeSession.manualStartedAt)}>
                  <Play className="size-4" />
                  Start
                </Button>
                <Button onClick={stopBlock} className="h-11 gap-2" variant="secondary" disabled={!clockIsRunning}>
                  <Square className="size-4" />
                  Stop
                </Button>
                <Button onClick={resetClock} className="h-11 gap-2" variant="outline" disabled={!activeSession?.manualStartedAt}>
                  <RefreshCcw className="size-4" />
                  Reset
                </Button>
              </div>

              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <div className="relative">
                  <Timer className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    ref={startNumberInputRef}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    enterKeyHint="enter"
                    placeholder="Startnummer optional"
                    value={startNumberInput}
                    onChange={(event) => setStartNumberInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        captureFinish();
                      }
                    }}
                    className="h-12 pl-9 text-lg"
                    disabled={!clockIsRunning}
                  />
                </div>
                <Button
                  type="button"
                  className="h-12 gap-2"
                  disabled={!clockIsRunning}
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={captureFinish}
                >
                  <Clock3 className="size-4" />
                  Zieleinlauf
                </Button>
              </div>
            </div>
          </section>
        )}

        <section className="rounded-md border border-border/60 bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 p-2">
            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight">Zeiten</p>
              <p className="text-xs text-muted-foreground">{filteredEvents.length} sichtbar · {unsyncedCount} offen</p>
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" className="h-8 gap-1.5 px-2" onClick={() => setFiltersOpen((open) => !open)}>
                <SlidersHorizontal className="size-4" />
                Filter
              </Button>
              <Button size="sm" variant="ghost" className="h-8 gap-1.5 px-2" onClick={resetLocalData} disabled={syncing || unsyncedCount === 0}>
                <Trash2 className="size-4" />
                Reset
              </Button>
              <Button size="sm" className="h-8 gap-1.5 px-2" onClick={syncEvents} disabled={syncing || unsyncedCount === 0}>
                {syncing ? <RefreshCcw className="size-4 animate-spin" /> : <Save className="size-4" />}
                Sync
              </Button>
            </div>
          </div>

          {filtersOpen && (
            <div className="grid gap-2 border-b border-border/60 p-2 md:grid-cols-[1fr_auto_auto]">
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
            </div>
          )}

          <div className="divide-y divide-border/50">
            {filteredEvents.length === 0 ? (
              <div className="p-5 text-center text-sm text-muted-foreground">Keine Zeiten in der aktuellen Ansicht.</div>
            ) : filteredEvents.map((event) => {
              const starter = activeBlockStarters.find((item) => item.startNumber === event.startNumber)
                ?? disciplineSnapshot?.starters.find((item) => item.startNumber === event.startNumber)
                ?? null;
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
