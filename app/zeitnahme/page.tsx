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
  ExternalLink,
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
import { TIMEKEEPING_LOCAL_BROADCAST_CHANNEL } from "@/lib/timekeeping-local";
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
  isTestStartNumber?: boolean;
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
  startNumberSource?: StartNumberSource;
  testStartNumbers?: {
    enabled: boolean;
    count: number;
  };
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

type ListedTimekeepingEvent = {
  event: TimekeepingEventState;
  session: TimekeepingSessionState;
  starters: Starter[];
};

type PersistedState = {
  deviceId: string;
  competitionId: string;
  snapshotVersion: string;
  cachedSnapshot?: SnapshotResponse;
  sessions: TimekeepingSessionState[];
  lastSyncAt: string | null;
};

const DISCIPLINE_LABELS: Record<DisciplineCode, string> = {
  RUN: "Lauf",
  ROAD: "Rad",
  MTB: "MTB",
};

const ROAD_CLOCK_SLOT_COUNT = 2;
const ROAD_CLOCK_PRIORITY = new Map([
  ["Schüler", 0],
  ["Herren", 1],
]);

const FILTERS = [
  { id: "all", label: "Alle" },
  { id: "missing", label: "Ohne Startnr." },
  { id: "unsynced", label: "Unsync" },
  { id: "conflict", label: "Konflikt" },
] as const;

const SORTS = [
  { id: "finishOrder", label: "Reihenfolge" },
  { id: "recordedDesc", label: "Neueste" },
  { id: "startNumber", label: "Startnr." },
  { id: "netTime", label: "Zeit" },
  { id: "classification", label: "Klasse" },
  { id: "firstName", label: "Vorname" },
  { id: "lastName", label: "Name" },
  { id: "teamName", label: "Team" },
  { id: "status", label: "Status" },
  { id: "assignment", label: "Zuordnung" },
] as const;

type SortId = (typeof SORTS)[number]["id"];
type SortDirection = "asc" | "desc";

type HelperColumn = "recordedAt" | "status" | "assignment";
type StartNumberSource = "official" | "imported-test";

const HELPER_COLUMNS: { id: HelperColumn; label: string }[] = [
  { id: "recordedAt", label: "Uhrzeit" },
  { id: "status", label: "Sync-Status" },
  { id: "assignment", label: "Zuordnung" },
];

const START_NUMBER_SOURCE_OPTIONS: Array<{ value: StartNumberSource; label: string; hint: string }> = [
  {
    value: "official",
    label: "Offizielle Startnummern",
    hint: "Nur freigegebene Teams mit gesetzter Startnummer.",
  },
  {
    value: "imported-test",
    label: "Importierte Test-Startnummern",
    hint: "Nutzt die importierten Team-Startnummern für Tests, ohne Approval zu erzwingen.",
  },
];

function storageKey(competitionId: string) {
  return `s5evo-timekeeping-v1:${competitionId}`;
}

function testStartNumbersStorageKey(competitionId: string) {
  return `s5evo-timekeeping-test-start-numbers-v1:${competitionId}`;
}

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function formatDuration(ms: number | null) {
  if (ms === null || !Number.isFinite(ms)) return "—";
  const sign = ms < 0 ? "-" : "";
  const totalHundredths = Math.abs(Math.round(ms / 10));
  const hundredths = totalHundredths % 100;
  const totalSeconds = Math.floor(totalHundredths / 100);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60);
  return `${sign}${minutes}:${seconds.toString().padStart(2, "0")}.${hundredths.toString().padStart(2, "0")}`;
}

function formatClock(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(iso));
}

function formatDateTimeLocal(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 19);
}

function toInputNumber(value: number | null) {
  return value === null ? "" : String(value);
}

function normalizeStartNumber(startNumber: string | null) {
  const trimmed = startNumber?.trim();
  if (!trimmed) return "";
  if (/^\d+$/.test(trimmed)) return String(Number.parseInt(trimmed, 10));
  return trimmed.toLowerCase();
}

function findStarter(starters: Starter[], startNumber: string | null) {
  const normalized = normalizeStartNumber(startNumber);
  if (!normalized) return null;
  return starters.find((starter) => normalizeStartNumber(starter.startNumber) === normalized) ?? null;
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

function compareText(left: string | null | undefined, right: string | null | undefined) {
  return String(left ?? "").localeCompare(String(right ?? ""), "de", { numeric: true, sensitivity: "base" });
}

function triggerCaptureFeedback() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(35);
  }
}

function sortRoadClockSessions(sessions: TimekeepingSessionState[]) {
  return sessions.slice().sort((left, right) => {
    const leftPriority = ROAD_CLOCK_PRIORITY.get(left.startBlockName) ?? 10;
    const rightPriority = ROAD_CLOCK_PRIORITY.get(right.startBlockName) ?? 10;
    return leftPriority - rightPriority || left.startBlockName.localeCompare(right.startBlockName, "de");
  });
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
  const [sort, setSort] = useState<SortId>("finishOrder");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [assigningEventId, setAssigningEventId] = useState<string | null>(null);
  const [assignValue, setAssignValue] = useState("");
  const [configOpenSessionIds, setConfigOpenSessionIds] = useState<Record<string, boolean>>({});
  const [roadClockSessionIds, setRoadClockSessionIds] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [startNumberSource, setStartNumberSource] = useState<StartNumberSource>("official");
  const [helperColumns, setHelperColumns] = useState<Record<HelperColumn, boolean>>({
    recordedAt: false,
    status: false,
    assignment: false,
  });
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const startNumberInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 50);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!activeCompetition?.id) return;
    const stored = window.localStorage.getItem(testStartNumbersStorageKey(activeCompetition.id));
    setStartNumberSource(stored === "1" ? "imported-test" : "official");
  }, [activeCompetition?.id]);

  useEffect(() => {
    if (!activeCompetition?.id || status !== "authenticated" || !hasAccess) return;

    let cancelled = false;
    const loadSnapshot = async () => {
      setError(null);
      try {
        const params = new URLSearchParams({
          competitionId: activeCompetition.id,
        });
        if (startNumberSource !== "official") params.set("startNumberSource", startNumberSource);
        const response = await fetch(`/api/timekeeping/snapshot?${params.toString()}`);
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
          cachedSnapshot: data,
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
        if (!cancelled) {
          const key = storageKey(activeCompetition.id);
          const persisted = window.localStorage.getItem(key);
          const parsed = persisted ? JSON.parse(persisted) as PersistedState : null;
          if (parsed?.cachedSnapshot) {
            setSnapshot(parsed.cachedSnapshot);
            setState(parsed);
            const firstSession = parsed.sessions.find((session) => session.disciplineCode === activeDiscipline)
              ?? parsed.sessions[0]
              ?? null;
            setActiveDiscipline(firstSession?.disciplineCode ?? "RUN");
            setActiveSessionId(firstSession?.id ?? null);
            setError("Server-Snapshot nicht erreichbar, lokaler Stand geladen.");
            return;
          }
          setError(loadError instanceof Error ? loadError.message : "Zeitnahme konnte nicht geladen werden");
        }
      }
    };

    void loadSnapshot();
    return () => {
      cancelled = true;
    };
  }, [activeCompetition?.id, activeDiscipline, hasAccess, status, startNumberSource]);

  useEffect(() => {
    if (!state?.competitionId) return;
    window.localStorage.setItem(storageKey(state.competitionId), JSON.stringify(state));
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(TIMEKEEPING_LOCAL_BROADCAST_CHANNEL);
      channel.postMessage({ type: "timekeeping-state", competitionId: state.competitionId, state });
      channel.close();
    }
  }, [state]);

  useEffect(() => {
    if (!activeCompetition?.id) return;
    window.localStorage.setItem(testStartNumbersStorageKey(activeCompetition.id), startNumberSource === "imported-test" ? "1" : "0");
  }, [activeCompetition?.id, startNumberSource]);

  const activeSession = useMemo(
    () => state?.sessions.find((session) => session.id === activeSessionId) ?? null,
    [activeSessionId, state?.sessions],
  );
  const disciplineSnapshot = snapshot?.disciplines.find((discipline) => discipline.code === activeDiscipline) ?? null;
  const disciplineSessions = useMemo(
    () => state?.sessions.filter((session) => session.disciplineCode === activeDiscipline) ?? [],
    [activeDiscipline, state?.sessions],
  );
  const visibleClockSessions = useMemo(() => {
    if (activeDiscipline !== "ROAD") return activeSession ? [activeSession] : [];
    const sessionsById = new Map(disciplineSessions.map((session) => [session.id, session]));
    const selectedSessions = roadClockSessionIds
      .map((sessionId) => sessionsById.get(sessionId))
      .filter((session): session is TimekeepingSessionState => Boolean(session));
    const selectedIds = new Set(selectedSessions.map((session) => session.id));
    const fallbackSessions = sortRoadClockSessions(disciplineSessions)
      .filter((session) => !selectedIds.has(session.id));
    return [...selectedSessions, ...fallbackSessions].slice(0, ROAD_CLOCK_SLOT_COUNT);
  }, [activeDiscipline, activeSession, disciplineSessions, roadClockSessionIds]);
  const activeBlockStarters = useMemo(() => {
    if (!activeSession || !disciplineSnapshot) return [];
    const classifications = new Set(activeSession.classificationCodes);
    return disciplineSnapshot.starters.filter((starter) => classifications.has(starter.classificationCode));
  }, [activeSession, disciplineSnapshot]);
  const getSessionStarters = useCallback((session: TimekeepingSessionState) => {
    if (!disciplineSnapshot) return [];
    const classifications = new Set(session.classificationCodes);
    return disciplineSnapshot.starters.filter((starter) => classifications.has(starter.classificationCode));
  }, [disciplineSnapshot]);
  const getSessionClassLabels = useCallback((session: TimekeepingSessionState) => {
    const labels = (disciplineSnapshot?.classifications ?? [])
      .filter((classification) => session.classificationCodes.includes(classification.code))
      .map((classification) => classification.label);
    return labels.length > 0 ? labels.join(", ") : "keine Klassen";
  }, [disciplineSnapshot?.classifications]);
  const resolveFinishSession = useCallback((startNumber: string | null) => {
    if (!activeSession) return null;
    if (activeDiscipline !== "ROAD") return activeSession;

    const starter = findStarter(disciplineSnapshot?.starters ?? [], startNumber);
    if (!starter) return activeSession;

    return visibleClockSessions.find((session) =>
      session.disciplineCode === "ROAD" && session.classificationCodes.includes(starter.classificationCode)
    ) ?? activeSession;
  }, [activeDiscipline, activeSession, disciplineSnapshot?.starters, visibleClockSessions]);
  const startNumberPreviewStarter = useMemo(() => {
    if (!startNumberInput.trim()) return null;
    return findStarter(activeBlockStarters, startNumberInput) ?? findStarter(disciplineSnapshot?.starters ?? [], startNumberInput);
  }, [activeBlockStarters, disciplineSnapshot?.starters, startNumberInput]);
  const finishTargetSession = useMemo(
    () => resolveFinishSession(startNumberInput.trim() || null),
    [resolveFinishSession, startNumberInput],
  );
  const unsyncedCount = activeSession?.events.filter((event) => event.syncStatus !== "synced").length ?? 0;
  const missingStartNumbers = activeSession?.events.filter((event) => event.eventType === "FINISH" && !event.startNumber).length ?? 0;
  const finishTargetIsRunning = Boolean(finishTargetSession?.manualStartedAt && !finishTargetSession.manualStoppedAt);
  const clockSessions = activeDiscipline === "ROAD" ? visibleClockSessions : disciplineSessions;
  const anyClockIsRunning = clockSessions.some((session) => session.manualStartedAt && !session.manualStoppedAt);
  const listedSessions = useMemo(() => (
    activeDiscipline === "ROAD"
      ? visibleClockSessions
      : activeSession ? [activeSession] : []
  ), [activeDiscipline, activeSession, visibleClockSessions]);
  const listedEvents = useMemo<ListedTimekeepingEvent[]>(() => (
    listedSessions.flatMap((session) => {
      const sessionStarters = getSessionStarters(session);
      return session.events
        .filter((event) => event.eventType === "FINISH")
        .map((event) => ({ event, session, starters: sessionStarters }));
    })
  ), [getSessionStarters, listedSessions]);
  const listedUnsyncedCount = listedEvents.filter(({ event }) => event.syncStatus !== "synced").length;
  const finishOrderById = useMemo(() => {
    const order = new Map<string, number>();
    listedEvents
      .slice()
      .sort((a, b) => new Date(a.event.recordedAt).getTime() - new Date(b.event.recordedAt).getTime())
      .forEach(({ event }, index) => order.set(event.clientEventId, index + 1));
    return order;
  }, [listedEvents]);
  const duplicateStartNumbers = useMemo(() => {
    const counts = new Map<string, number>();
    listedEvents.forEach(({ event }) => {
      const normalized = normalizeStartNumber(event.startNumber);
      if (!normalized) return;
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    });
    return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([startNumber]) => startNumber));
  }, [listedEvents]);
  const timekeepingStats = useMemo(() => {
    const finishedStartNumbers = new Set<string>();
    let missingAssignments = 0;
    (activeSession?.events ?? [])
      .filter((event) => event.eventType === "FINISH")
      .forEach((event) => {
        const normalized = normalizeStartNumber(event.startNumber);
        if (normalized) {
          finishedStartNumbers.add(normalized);
        } else {
          missingAssignments += 1;
        }
      });
    const startersInBlock = activeBlockStarters.length;
    const finishedKnownInBlock = activeBlockStarters.filter((starter) => finishedStartNumbers.has(normalizeStartNumber(starter.startNumber))).length;
    return {
      startersInBlock,
      finishedKnownInBlock,
      onCourse: Math.max(0, startersInBlock - finishedKnownInBlock),
      missingAssignments,
      duplicateCount: duplicateStartNumbers.size,
    };
  }, [activeBlockStarters, activeSession?.events, duplicateStartNumbers]);

  const toggleSort = (nextSort: SortId) => {
    setSort((currentSort) => {
      if (currentSort === nextSort) {
        setSortDirection((currentDirection) => currentDirection === "asc" ? "desc" : "asc");
        return currentSort;
      }
      setSortDirection(nextSort === "recordedDesc" ? "desc" : "asc");
      return nextSort;
    });
  };

  const updateSessionById = useCallback((sessionId: string | null, updater: (session: TimekeepingSessionState) => TimekeepingSessionState) => {
    setState((current) => {
      if (!current || !sessionId) return current;
      return {
        ...current,
        sessions: current.sessions.map((session) => session.id === sessionId ? updater(session) : session),
      };
    });
  }, []);

  const updateSession = useCallback((updater: (session: TimekeepingSessionState) => TimekeepingSessionState) => {
    updateSessionById(activeSessionId, updater);
  }, [activeSessionId, updateSessionById]);

  const setActiveSessionByDiscipline = (disciplineCode: DisciplineCode) => {
    const nextSession = state?.sessions.find((session) =>
      session.disciplineCode === disciplineCode && (disciplineCode !== "ROAD" || session.startBlockName === "Schüler")
    ) ?? state?.sessions.find((session) => session.disciplineCode === disciplineCode) ?? null;
    setActiveDiscipline(disciplineCode);
    setActiveSessionId(nextSession?.id ?? null);
  };

  const addStartBlock = () => {
    if (!disciplineSnapshot || !state) return;
    const currentDisciplineSessions = state.sessions.filter((session) => session.disciplineCode === activeDiscipline);
    const allClassificationCodes = disciplineSnapshot.classifications.map((classification) => classification.code);
    const nextSession: TimekeepingSessionState = {
      id: createId("tks"),
      deviceId: state.deviceId,
      disciplineCode: activeDiscipline,
      startBlockName: `Block ${currentDisciplineSessions.length + 1}`,
      classificationCodes: allClassificationCodes,
      firstStartNumber: getFirstStartNumber(disciplineSnapshot.starters, allClassificationCodes) ?? disciplineSnapshot.firstStartNumber,
      startIntervalSeconds: disciplineSnapshot.defaultStartIntervalSeconds,
      manualStartedAt: null,
      manualStoppedAt: null,
      events: [],
    };
    setState((current) => current ? { ...current, sessions: [...current.sessions, nextSession] } : current);
    if (activeDiscipline === "ROAD") {
      const currentSlotId = visibleClockSessions.find((session) => configOpenSessionIds[session.id])?.id ?? activeSessionId;
      setRoadClockSessionIds((current) => {
        const baseIds = current.length > 0 ? current : visibleClockSessions.map((session) => session.id);
        const nextIds = baseIds.length > 0
          ? baseIds.map((sessionId) => sessionId === currentSlotId ? nextSession.id : sessionId)
          : [nextSession.id];
        return Array.from(new Set(nextIds)).slice(0, ROAD_CLOCK_SLOT_COUNT);
      });
    }
    setActiveSessionId(nextSession.id);
    setConfigOpenSessionIds({ [nextSession.id]: true });
  };

  const selectStartBlockForConfig = (sessionId: string, slotSessionId: string) => {
    if (activeDiscipline === "ROAD") {
      setRoadClockSessionIds((current) => {
        const baseIds = current.length > 0 ? current : visibleClockSessions.map((session) => session.id);
        const selectedAlreadyVisible = baseIds.includes(sessionId);
        if (selectedAlreadyVisible && sessionId !== slotSessionId) return baseIds.slice(0, ROAD_CLOCK_SLOT_COUNT);
        const nextIds = baseIds.map((currentSessionId) => currentSessionId === slotSessionId ? sessionId : currentSessionId);
        return Array.from(new Set(nextIds)).slice(0, ROAD_CLOCK_SLOT_COUNT);
      });
    }
    setActiveSessionId(sessionId);
    setConfigOpenSessionIds({ [sessionId]: true });
  };

  const removeStartBlock = (sessionId: string) => {
    if (!state) return;
    const sessionToRemove = state.sessions.find((session) => session.id === sessionId);
    if (!sessionToRemove) return;
    const disciplineSessions = state.sessions.filter((session) => session.disciplineCode === activeDiscipline);
    if (disciplineSessions.length <= 1) return;
    const hasLocalBlockData = sessionToRemove.events.length > 0 || Boolean(sessionToRemove.manualStartedAt);
    if (hasLocalBlockData) {
      const confirmed = window.confirm("Startblock inklusive lokaler Zeiten und Uhr-Status löschen?");
      if (!confirmed) return;
    }
    const remainingSessions = state.sessions.filter((session) => session.id !== sessionToRemove.id);
    const nextSession = remainingSessions.find((session) => session.disciplineCode === activeDiscipline) ?? remainingSessions[0] ?? null;
    setState({ ...state, sessions: remainingSessions });
    setRoadClockSessionIds((current) => current.filter((currentSessionId) => currentSessionId !== sessionToRemove.id));
    setActiveSessionId(nextSession?.id ?? null);
    setActiveDiscipline(nextSession?.disciplineCode ?? activeDiscipline);
    setAssigningEventId(null);
    setAssignValue("");
    setStartNumberInput("");
  };

  const toggleSessionClassification = (sessionId: string, classificationCode: string) => {
    updateSessionById(sessionId, (session) => {
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

  const updateSessionBaseTime = (sessionId: string, value: string) => {
    const manualStartedAt = value ? new Date(value).toISOString() : null;
    updateSessionById(sessionId, (session) => {
      const nextSession = {
        ...session,
        manualStartedAt,
        manualStoppedAt: manualStartedAt ? session.manualStoppedAt : null,
      };
      return {
        ...nextSession,
        events: nextSession.events.map((event) => {
          if (event.syncStatus === "synced" || event.eventType !== "FINISH") return event;
          const { rawElapsedMs, netElapsedMs } = calculateNetMs(nextSession, event.startNumber, new Date(event.recordedAt));
          return { ...event, rawElapsedMs, netElapsedMs };
        }),
      };
    });
  };

  const startBlock = (sessionId = activeSessionId) => {
    updateSessionById(sessionId, (session) => {
      const recordedAt = new Date();
      const previousElapsedMs = session.manualStartedAt && session.manualStoppedAt
        ? new Date(session.manualStoppedAt).getTime() - new Date(session.manualStartedAt).getTime()
        : 0;
      const manualStartedAt = previousElapsedMs > 0
        ? new Date(recordedAt.getTime() - previousElapsedMs).toISOString()
        : recordedAt.toISOString();
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
          resumed: Boolean(session.manualStartedAt && session.manualStoppedAt),
        },
      };
      return {
        ...session,
        manualStartedAt,
        manualStoppedAt: null,
        events: [startEvent, ...session.events],
      };
    });
    window.requestAnimationFrame(() => {
      startNumberInputRef.current?.focus();
    });
  };

  const stopBlock = (sessionId = activeSessionId) => {
    const session = state?.sessions.find((item) => item.id === sessionId);
    if (!session?.manualStartedAt || session.manualStoppedAt) return;
    updateSessionById(sessionId, (currentSession) => ({ ...currentSession, manualStoppedAt: new Date().toISOString() }));
  };

  const resetClock = (sessionId = activeSessionId) => {
    updateSessionById(sessionId, (session) => {
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
    const startNumber = startNumberInput.trim() || null;
    const targetSession = resolveFinishSession(startNumber);
    if (!targetSession?.manualStartedAt || targetSession.manualStoppedAt) return;
    const recordedAt = new Date();
    const { rawElapsedMs, netElapsedMs } = calculateNetMs(targetSession, startNumber, recordedAt);
    const finishEvent: TimekeepingEventState = {
      clientEventId: createId("evt"),
      eventType: "FINISH",
      recordedAt: recordedAt.toISOString(),
      startNumber,
      rawElapsedMs,
      netElapsedMs,
      syncStatus: "local",
    };
    updateSessionById(targetSession.id, (session) => ({ ...session, events: [finishEvent, ...session.events] }));
    setActiveSessionId(targetSession.id);
    setStartNumberInput("");
    triggerCaptureFeedback();
    window.requestAnimationFrame(() => {
      startNumberInputRef.current?.focus();
    });
  };

  const assignStartNumber = (sessionId: string, eventId: string) => {
    const nextStartNumber = assignValue.trim() || null;
    const sourceSession = state?.sessions.find((session) => session.id === sessionId);
    if (!sourceSession) return;
    const target = sourceSession.events.find((event) => event.clientEventId === eventId);
    if (!target) return;
    const { rawElapsedMs, netElapsedMs } = calculateNetMs(sourceSession, nextStartNumber, new Date(target.recordedAt));
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
    updateSessionById(sessionId, (session) => ({
      ...session,
      events: [
        assignmentEvent,
        ...session.events.map((event) => event.clientEventId === eventId
          ? { ...event, startNumber: nextStartNumber, rawElapsedMs, netElapsedMs, syncStatus: "local" as const }
          : event),
      ],
    }));
    setActiveSessionId(sessionId);
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

  const openRoadMonitor = () => {
    if (!activeCompetition?.id) return;
    const params = new URLSearchParams({ competitionId: activeCompetition.id });
    window.open(`/zeitnahme/monitor?${params.toString()}`, "s5evo-road-monitor", "popup,width=1280,height=720");
  };

  const filteredEvents = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return listedEvents
      .filter(({ event }) => {
        if (filter === "missing") return !event.startNumber;
        if (filter === "unsynced") return event.syncStatus !== "synced";
        if (filter === "conflict") return event.syncStatus === "conflict";
        return true;
      })
      .filter(({ event, session, starters }) => {
        if (!needle) return true;
        const starter = findStarter(starters, event.startNumber) ?? findStarter(disciplineSnapshot?.starters ?? [], event.startNumber);
        return [
          event.startNumber,
          event.note,
          formatClock(event.recordedAt),
          formatDuration(event.netElapsedMs),
          session.startBlockName,
          starter?.classificationLabel,
          starter?.firstName,
          starter?.lastName,
          starter?.teamName,
        ].some((value) => String(value ?? "").toLowerCase().includes(needle));
      })
      .sort((a, b) => {
        const aStarter = findStarter(a.starters, a.event.startNumber) ?? findStarter(disciplineSnapshot?.starters ?? [], a.event.startNumber);
        const bStarter = findStarter(b.starters, b.event.startNumber) ?? findStarter(disciplineSnapshot?.starters ?? [], b.event.startNumber);
        let result = 0;
        if (sort === "finishOrder") {
          result = (finishOrderById.get(a.event.clientEventId) ?? Number.MAX_SAFE_INTEGER) - (finishOrderById.get(b.event.clientEventId) ?? Number.MAX_SAFE_INTEGER);
        } else if (sort === "startNumber") {
          const aNumber = Number(normalizeStartNumber(a.event.startNumber) || Number.MAX_SAFE_INTEGER);
          const bNumber = Number(normalizeStartNumber(b.event.startNumber) || Number.MAX_SAFE_INTEGER);
          result = Number.isFinite(aNumber) && Number.isFinite(bNumber)
            ? aNumber - bNumber
            : normalizeStartNumber(a.event.startNumber).localeCompare(normalizeStartNumber(b.event.startNumber));
        } else if (sort === "netTime") {
          result = (a.event.netElapsedMs ?? Number.MAX_SAFE_INTEGER) - (b.event.netElapsedMs ?? Number.MAX_SAFE_INTEGER);
        } else if (sort === "classification") {
          result = compareText(aStarter?.classificationLabel, bStarter?.classificationLabel);
        } else if (sort === "firstName") {
          result = compareText(aStarter?.firstName, bStarter?.firstName);
        } else if (sort === "lastName") {
          result = compareText(aStarter?.lastName, bStarter?.lastName);
        } else if (sort === "teamName") {
          result = compareText(aStarter?.teamName, bStarter?.teamName);
        } else if (sort === "status") {
          result = compareText(visibleEventStatus(a.event), visibleEventStatus(b.event));
        } else if (sort === "assignment") {
          result = Number(Boolean(aStarter)) - Number(Boolean(bStarter));
        } else {
          result = new Date(a.event.recordedAt).getTime() - new Date(b.event.recordedAt).getTime();
        }
        if (result === 0) {
          result = (finishOrderById.get(a.event.clientEventId) ?? Number.MAX_SAFE_INTEGER) - (finishOrderById.get(b.event.clientEventId) ?? Number.MAX_SAFE_INTEGER);
        }
        return sortDirection === "asc" ? result : -result;
      });
  }, [disciplineSnapshot?.starters, filter, finishOrderById, listedEvents, query, sort, sortDirection]);

  const renderSortHeader = (nextSort: SortId, label: string, title = label) => (
    <button
      type="button"
      title={title}
      aria-label={`${title} sortieren`}
      onClick={() => toggleSort(nextSort)}
      className={cn(
        "flex items-center gap-0.5 whitespace-nowrap text-left text-[11px] font-semibold sm:text-xs",
        sort === nextSort ? "text-primary" : "text-muted-foreground",
      )}
    >
      {label}
      <ArrowDownUp className="size-3 shrink-0 sm:size-3.5" />
    </button>
  );

  const renderClockCard = (session: TimekeepingSessionState) => {
    const isActive = session.id === activeSessionId;
    const isRunning = Boolean(session.manualStartedAt && !session.manualStoppedAt);
    const elapsedMs = session.manualStartedAt
      ? new Date(session.manualStoppedAt ?? now).getTime() - new Date(session.manualStartedAt).getTime()
      : null;
    const sessionStarters = getSessionStarters(session);
    const sessionFinishedStartNumbers = new Set(
      session.events
        .filter((event) => event.eventType === "FINISH")
        .map((event) => normalizeStartNumber(event.startNumber))
        .filter(Boolean),
    );
    const finishedKnownInSession = sessionStarters.filter((starter) =>
      sessionFinishedStartNumbers.has(normalizeStartNumber(starter.startNumber))
    ).length;
    const configOpen = Boolean(configOpenSessionIds[session.id]);
    const sessionCount = disciplineSessions.length;

    return (
      <section
        key={session.id}
        className={cn(
          "rounded-md border bg-card p-2 shadow-sm",
          isActive ? "border-primary/60 ring-1 ring-primary/20" : "border-border/60",
        )}
        onClick={() => setActiveSessionId(session.id)}
      >
        <div className="grid gap-2">
          <div className="flex flex-wrap items-start justify-between gap-2 text-xs text-muted-foreground">
            <div className="min-w-0">
              <p className="font-medium text-foreground">
                {DISCIPLINE_LABELS[session.disciplineCode]} · {session.startBlockName}
              </p>
              <p className="truncate">
                {getSessionClassLabels(session)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <span>
                {session.disciplineCode === "ROAD"
                  ? `${finishedKnownInSession}/${sessionStarters.length} im Ziel · ab ${session.firstStartNumber ?? "-"} · ${session.startIntervalSeconds}s`
                  : `${finishedKnownInSession}/${sessionStarters.length} im Ziel`}
              </span>
              <Button
                type="button"
                size="sm"
                variant={configOpen ? "secondary" : "ghost"}
                className="h-8 gap-1.5 px-2"
                onClick={(event) => {
                  event.stopPropagation();
                  setActiveSessionId(session.id);
                  setConfigOpenSessionIds((current) => ({ ...current, [session.id]: !current[session.id] }));
                }}
              >
                <Settings2 className="size-4" />
                Konfiguration
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-center rounded-md border border-border/60 bg-background px-3 py-2 font-mono text-4xl font-semibold tabular-nums sm:text-5xl">
            {formatDuration(elapsedMs)}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Button
              onClick={(event) => {
                event.stopPropagation();
                setActiveSessionId(session.id);
                startBlock(session.id);
              }}
              className="h-10 gap-2"
              disabled={isRunning}
            >
              <Play className="size-4" />
              Start
            </Button>
            <Button
              onClick={(event) => {
                event.stopPropagation();
                setActiveSessionId(session.id);
                stopBlock(session.id);
              }}
              className="h-10 gap-2"
              variant="secondary"
              disabled={!isRunning}
            >
              <Square className="size-4" />
              Stop
            </Button>
            <Button
              onClick={(event) => {
                event.stopPropagation();
                setActiveSessionId(session.id);
                resetClock(session.id);
              }}
              className="h-10 gap-2"
              variant="outline"
              disabled={!session.manualStartedAt}
            >
              <RefreshCcw className="size-4" />
              Reset
            </Button>
          </div>

          {configOpen && (
            <div className="grid gap-3 rounded-md border border-border/60 bg-background p-2" onClick={(event) => event.stopPropagation()}>
              <div className="grid gap-1.5">
                <p className="text-xs font-medium">Startblock</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {disciplineSessions.map((disciplineSession) => (
                    <Button
                      key={disciplineSession.id}
                      type="button"
                      size="sm"
                      variant={disciplineSession.id === session.id ? "default" : "outline"}
                      className="h-8 px-2 text-xs"
                      onClick={() => selectStartBlockForConfig(disciplineSession.id, session.id)}
                    >
                      {disciplineSession.startBlockName}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-8 gap-1.5 px-2 text-xs"
                    onClick={addStartBlock}
                    disabled={!disciplineSnapshot || !state}
                  >
                    <Plus className="size-4" />
                    Block hinzufügen
                  </Button>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                <label className="grid gap-1 text-xs font-medium">
                  Blockname
                  <Input
                    value={session.startBlockName}
                    onChange={(event) => updateSessionById(session.id, (currentSession) => ({
                      ...currentSession,
                      startBlockName: event.target.value,
                    }))}
                    className="h-9"
                  />
                </label>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 gap-1.5 text-muted-foreground"
                  onClick={() => removeStartBlock(session.id)}
                  disabled={sessionCount <= 1}
                >
                  <Trash2 className="size-4" />
                  Entfernen
                </Button>
              </div>

              <div className="grid gap-1">
                <p className="text-xs font-medium">Klassen in diesem Block</p>
                <div className="flex flex-wrap gap-1.5">
                  {(disciplineSnapshot?.classifications ?? []).map((classification) => {
                    const isSelected = session.classificationCodes.includes(classification.code);
                    return (
                      <Button
                        key={classification.code}
                        type="button"
                        size="sm"
                        variant={isSelected ? "default" : "outline"}
                        className="h-8 px-2 text-xs"
                        onClick={() => toggleSessionClassification(session.id, classification.code)}
                      >
                        {classification.label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <label className="grid gap-1 text-xs font-medium">
                  Erste Startnr.
                  <Input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={toInputNumber(session.firstStartNumber)}
                    onChange={(event) => updateSessionById(session.id, (currentSession) => ({
                      ...currentSession,
                      firstStartNumber: event.target.value ? Number.parseInt(event.target.value, 10) : null,
                    }))}
                    className="h-9"
                  />
                </label>
                <label className="grid gap-1 text-xs font-medium">
                  Abstand Sek.
                  <Input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={toInputNumber(session.startIntervalSeconds)}
                    onChange={(event) => updateSessionById(session.id, (currentSession) => ({
                      ...currentSession,
                      startIntervalSeconds: event.target.value ? Number.parseInt(event.target.value, 10) : 0,
                    }))}
                    className="h-9"
                  />
                </label>
                <label className="grid gap-1 text-xs font-medium">
                  Basiszeit
                  <Input
                    type="datetime-local"
                    step="1"
                    value={formatDateTimeLocal(session.manualStartedAt)}
                    onChange={(event) => updateSessionBaseTime(session.id, event.target.value)}
                    className="h-9"
                  />
                </label>
              </div>

              <label className="grid gap-1 text-xs font-medium">
                Startnummernquelle
                <select
                  value={startNumberSource}
                  onChange={(event) => setStartNumberSource(event.target.value as StartNumberSource)}
                  className="h-9 rounded-md border border-border/60 bg-background px-2 text-sm text-foreground"
                >
                  {START_NUMBER_SOURCE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <span className="text-xs text-muted-foreground">
                  {START_NUMBER_SOURCE_OPTIONS.find((option) => option.value === startNumberSource)?.hint}
                </span>
              </label>

              {sessionStarters.length > 0 && (
                <div className="rounded-md border border-border/60 bg-card">
                  <div className="border-b border-border/60 px-2 py-1.5 text-xs font-medium text-muted-foreground">
                    Starter im Block
                  </div>
                  <div className="max-h-40 overflow-auto">
                    {sessionStarters.slice(0, 30).map((starter) => (
                      <div
                        key={`${starter.participantId}-${starter.startNumber}`}
                        className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2 border-b border-border/40 px-2 py-1.5 text-xs last:border-0"
                      >
                        <span className="font-mono font-semibold tabular-nums">
                          {starter.startNumber}
                          {starter.isTestStartNumber && <span className="ml-1 text-[10px] text-amber-700">Test</span>}
                        </span>
                        <span className="min-w-0 truncate">
                          {starter.firstName} {starter.lastName} · {starter.teamName} · {starter.classificationLabel}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    );
  };

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
          <div className="flex flex-wrap items-center justify-end gap-1.5 text-xs">
            <select
              aria-label="Disziplin auswählen"
              value={activeDiscipline}
              onChange={(event) => setActiveSessionByDiscipline(event.target.value as DisciplineCode)}
              className="h-8 rounded-md border border-border/60 bg-background px-2 text-sm text-foreground"
            >
              {(snapshot?.disciplines ?? []).map((discipline) => (
                <option key={discipline.code} value={discipline.code}>
                  {DISCIPLINE_LABELS[discipline.code]}
                </option>
              ))}
            </select>
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

        {snapshot?.testStartNumbers?.enabled && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            Importierte Test-Startnummern aktiv: {snapshot.testStartNumbers.count} Team(s) werden für diesen Snapshot ohne Teamfreigabe testweise geladen.
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          {disciplineSessions.length} Startblock{disciplineSessions.length === 1 ? "" : "s"} konfiguriert
        </div>

        <div className={cn("grid gap-2", activeDiscipline === "ROAD" && visibleClockSessions.length > 1 && "lg:grid-cols-2")}>
          {visibleClockSessions.map((session) => renderClockCard(session))}
        </div>

        <section className="rounded-md border border-border/60 bg-card p-2 shadow-sm">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>Zielblock automatisch per Startnummer</span>
            <span className={cn(
              "rounded-md border px-2 py-1",
              finishTargetIsRunning
                ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"
                : "border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200",
            )}>
              Ziel: {finishTargetSession?.startBlockName ?? "-"} · {finishTargetIsRunning ? "läuft" : "nicht aktiv"}
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <div className="relative">
              <Timer className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
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
                className="h-24 pl-12 text-2xl"
                disabled={!anyClockIsRunning}
              />
            </div>
            <Button
              type="button"
              className="h-24 gap-2 text-lg"
              disabled={!finishTargetIsRunning}
              onPointerDown={(event) => event.preventDefault()}
              onClick={captureFinish}
            >
              <Clock3 className="size-4" />
              Zieleinlauf
            </Button>
          </div>
          {startNumberInput.trim() && (
            <div className={cn(
              "mt-2 rounded-md border px-3 py-2 text-sm",
              startNumberPreviewStarter
                ? "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100"
                : "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100",
            )}>
              {startNumberPreviewStarter ? (
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-medium">
                    {startNumberPreviewStarter.firstName} {startNumberPreviewStarter.lastName}
                  </span>
                  <span className="text-muted-foreground">·</span>
                  <span>{startNumberPreviewStarter.teamName}</span>
                  <span className="text-muted-foreground">·</span>
                  <span>{startNumberPreviewStarter.classificationLabel}</span>
                  {startNumberPreviewStarter.isTestStartNumber && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900 dark:bg-amber-900/60 dark:text-amber-100">
                      Test-Startnr.
                    </span>
                  )}
                </div>
              ) : (
                <span>Keine lokale Zuordnung für Startnummer {startNumberInput.trim()}.</span>
              )}
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-md border border-border/60 bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 p-2">
            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight">Zeiten</p>
              <p className="text-xs text-muted-foreground">
                {filteredEvents.length} sichtbar · {listedUnsyncedCount} offen · {listedSessions.length} Block{listedSessions.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-1">
              <Button size="sm" variant="ghost" className="h-8 gap-1.5 px-2" onClick={() => setFiltersOpen((open) => !open)}>
                <SlidersHorizontal className="size-4" />
                Filter
              </Button>
              <Button size="sm" variant="ghost" className="h-8 gap-1.5 px-2" onClick={() => setLayoutOpen((open) => !open)}>
                <Settings2 className="size-4" />
                Layout
              </Button>
              <Button size="sm" variant="ghost" className="h-8 gap-1.5 px-2" onClick={() => setStatsOpen((open) => !open)}>
                <Timer className="size-4" />
                Stats
              </Button>
              <Button size="sm" variant="ghost" className="h-8 gap-1.5 px-2" onClick={openRoadMonitor} disabled={!activeCompetition?.id}>
                <ExternalLink className="size-4" />
                Monitor
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
                <select
                  value={sort}
                  onChange={(event) => {
                    const nextSort = event.target.value as SortId;
                    setSort(nextSort);
                    setSortDirection(nextSort === "recordedDesc" ? "desc" : "asc");
                  }}
                  className="h-9 rounded-md border border-border/60 bg-background px-2 text-sm text-foreground"
                >
                  {SORTS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
              </label>
            </div>
          )}

          {layoutOpen && (
            <div className="border-b border-border/60 p-2">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Zusatzspalten</p>
              <div className="flex flex-wrap gap-2">
                {HELPER_COLUMNS.map((column) => (
                  <label key={column.id} className="inline-flex h-8 items-center gap-2 rounded-md border border-border/60 bg-background px-2 text-sm">
                    <input
                      type="checkbox"
                      checked={helperColumns[column.id]}
                      onChange={(event) => setHelperColumns((current) => ({ ...current, [column.id]: event.target.checked }))}
                    />
                    {column.label}
                  </label>
                ))}
              </div>
            </div>
          )}

          {statsOpen && (
            <div className="grid grid-cols-2 gap-2 border-b border-border/60 p-2 sm:grid-cols-4">
              <div className="rounded-md bg-muted/40 px-2 py-2">
                <p className="text-[11px] font-medium text-muted-foreground">Im Ziel</p>
                <p className="text-lg font-semibold tabular-nums">{timekeepingStats.finishedKnownInBlock}</p>
              </div>
              <div className="rounded-md bg-muted/40 px-2 py-2">
                <p className="text-[11px] font-medium text-muted-foreground">Auf Strecke</p>
                <p className="text-lg font-semibold tabular-nums">{timekeepingStats.onCourse}</p>
              </div>
              <div className={cn("rounded-md px-2 py-2", timekeepingStats.missingAssignments > 0 ? "bg-orange-50 text-orange-900 dark:bg-orange-950/30 dark:text-orange-200" : "bg-muted/40")}>
                <p className="text-[11px] font-medium text-muted-foreground">Ohne STRNR</p>
                <p className="text-lg font-semibold tabular-nums">{timekeepingStats.missingAssignments}</p>
              </div>
              <div className={cn("rounded-md px-2 py-2", timekeepingStats.duplicateCount > 0 ? "bg-orange-50 text-orange-900 dark:bg-orange-950/30 dark:text-orange-200" : "bg-muted/40")}>
                <p className="text-[11px] font-medium text-muted-foreground">Doppelt</p>
                <p className="text-lg font-semibold tabular-nums">{timekeepingStats.duplicateCount}</p>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            {filteredEvents.length === 0 ? (
              <div className="p-5 text-center text-sm text-muted-foreground">Keine Zeiten in der aktuellen Ansicht.</div>
            ) : (
              <table className="w-full min-w-[610px] table-fixed text-sm">
                <thead className="border-b border-border/60 bg-muted/30">
                  <tr>
                    <th className="w-12 px-1 py-2 text-left">
                      {renderSortHeader("finishOrder", "R.", "Reihenfolge")}
                    </th>
                    <th className="w-24 px-1 py-2 text-left">
                      {renderSortHeader("netTime", "Zeit", "Netto-Zeit")}
                    </th>
                    <th className="w-28 px-1 py-2 text-left">
                      {renderSortHeader("startNumber", "Nr.", "Startnummer")}
                    </th>
                    <th className="w-16 px-1 py-2 text-left">{renderSortHeader("classification", "Kl.", "Klasse")}</th>
                    <th className="w-20 px-1 py-2 text-left">{renderSortHeader("firstName", "Vor.", "Vorname")}</th>
                    <th className="w-20 px-1 py-2 text-left">{renderSortHeader("lastName", "Name", "Nachname")}</th>
                    <th className="w-24 px-1 py-2 text-left">{renderSortHeader("teamName", "Team", "Team")}</th>
                    {helperColumns.recordedAt && (
                      <th className="w-16 px-1 py-2 text-left">
                        {renderSortHeader("recordedDesc", "Uhr", "Uhrzeit")}
                      </th>
                    )}
                    {helperColumns.status && <th className="w-16 px-1 py-2 text-left">{renderSortHeader("status", "Stat.", "Sync-Status")}</th>}
                    {helperColumns.assignment && <th className="w-28 px-1 py-2 text-left">{renderSortHeader("assignment", "Zuord.", "Zuordnung")}</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.map(({ event, session, starters }) => {
                    const starter = findStarter(starters, event.startNumber)
                      ?? findStarter(disciplineSnapshot?.starters ?? [], event.startNumber);
                    const isAssigning = assigningEventId === event.clientEventId;
                    const normalizedStartNumber = normalizeStartNumber(event.startNumber);
                    const isBeforeScheduledStart = event.netElapsedMs !== null && event.netElapsedMs < 0;
                    const hasWarning = event.syncStatus === "conflict" || !normalizedStartNumber || duplicateStartNumbers.has(normalizedStartNumber) || isBeforeScheduledStart;
                    return (
                      <tr
                        key={event.clientEventId}
                        className={cn(
                          "border-b border-border/50 last:border-0",
                          hasWarning && "bg-orange-50/70 dark:bg-orange-950/20",
                        )}
                      >
                        <td className="px-1 py-2 align-top font-mono text-muted-foreground">
                          {finishOrderById.get(event.clientEventId) ?? "—"}
                        </td>
                        <td className="px-1 py-2 align-top font-mono text-base font-semibold tabular-nums">
                          <span title={isBeforeScheduledStart ? "Nettozeit liegt vor der geplanten Startzeit dieser Startnummer." : undefined}>
                            {formatDuration(event.netElapsedMs)}
                          </span>
                        </td>
                        <td className="px-1 py-2 align-top">
                          {isAssigning ? (
                            <div className="grid min-w-0 grid-cols-[minmax(4.25rem,1fr)_44px] gap-1">
                              <Input
                                inputMode="numeric"
                                pattern="[0-9]*"
                                enterKeyHint="done"
                                value={assignValue}
                                onChange={(inputEvent) => setAssignValue(inputEvent.target.value)}
                                onKeyDown={(keyboardEvent) => {
                                  if (keyboardEvent.key === "Enter") assignStartNumber(session.id, event.clientEventId);
                                }}
                                className="h-11 min-w-0 px-2 text-lg font-semibold tabular-nums"
                                autoFocus
                              />
                              <Button size="icon" className="h-11 w-11 shrink-0" onClick={() => assignStartNumber(session.id, event.clientEventId)} aria-label="Startnummer speichern">
                                <Check className="size-4" />
                              </Button>
                            </div>
                          ) : event.startNumber ? (
                            <button
                              type="button"
                              className={cn(
                                "inline-flex min-w-12 items-center justify-center rounded-md bg-primary/10 px-2 py-1 font-semibold text-primary tabular-nums",
                                duplicateStartNumbers.has(normalizedStartNumber) && "bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-100",
                              )}
                              onClick={() => {
                                setAssigningEventId(event.clientEventId);
                                setAssignValue(event.startNumber ?? "");
                              }}
                            >
                              {event.startNumber}
                            </button>
                          ) : (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-9 w-full px-1 text-xs"
                              onClick={() => {
                                setAssigningEventId(event.clientEventId);
                                setAssignValue("");
                              }}
                            >
                              Startnr.
                            </Button>
                          )}
                        </td>
                        <td className="px-1 py-2 align-top">
                          <div className="truncate">{starter?.classificationLabel ?? "—"}</div>
                          {activeDiscipline === "ROAD" && (
                            <div className="truncate text-[11px] text-muted-foreground">{session.startBlockName}</div>
                          )}
                        </td>
                        <td className="truncate px-1 py-2 align-top">{starter?.firstName ?? "—"}</td>
                        <td className="truncate px-1 py-2 align-top">{starter?.lastName ?? "—"}</td>
                        <td className="truncate px-1 py-2 align-top">{starter?.teamName ?? "—"}</td>
                        {helperColumns.recordedAt && <td className="px-1 py-2 align-top font-mono text-muted-foreground">{formatClock(event.recordedAt)}</td>}
                        {helperColumns.status && (
                          <td className="px-1 py-2 align-top">
                            <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">{visibleEventStatus(event)}</span>
                          </td>
                        )}
                        {helperColumns.assignment && (
                          <td className="truncate px-1 py-2 align-top text-muted-foreground">
                            {starter ? "lokal zugeordnet" : "Keine lokale Zuordnung"}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <p className="text-center text-xs text-muted-foreground">
          Snapshot {snapshot?.snapshotVersion ? formatClock(snapshot.snapshotVersion) : "—"} · Sync {state?.lastSyncAt ? formatClock(state.lastSyncAt) : "offen"}
        </p>
      </main>
    </div>
  );
}
