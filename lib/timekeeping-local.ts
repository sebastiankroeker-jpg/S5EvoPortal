export type DisciplineCode = "RUN" | "ROAD" | "MTB";
export type TimekeepingEventType = "BLOCK_START" | "FINISH" | "ASSIGN_START_NUMBER" | "NOTE";
export type SyncStatus = "local" | "synced" | "conflict";

export type Starter = {
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

export type ClassificationOption = {
  code: string;
  label: string;
};

export type StartBlockDefinition = {
  name: string;
  classificationCodes: string[];
};

export type DisciplineSnapshot = {
  code: DisciplineCode;
  name: string;
  defaultStartIntervalSeconds: number;
  defaultStartBlocks: StartBlockDefinition[];
  firstStartNumber: number | null;
  classifications: ClassificationOption[];
  starters: Starter[];
};

export type SnapshotResponse = {
  snapshotVersion: string;
  competition: { id: string; name: string; year: number; status: string };
  disciplines: DisciplineSnapshot[];
  startNumberSource?: "official" | "imported-test";
  testStartNumbers?: {
    enabled: boolean;
    count: number;
  };
};

export type TimekeepingSessionState = {
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

export type TimekeepingEventState = {
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

export type PersistedTimekeepingState = {
  deviceId: string;
  deviceName?: string | null;
  competitionId: string;
  snapshotVersion: string;
  cachedSnapshot?: SnapshotResponse;
  sessions: TimekeepingSessionState[];
  lastSyncAt: string | null;
};

export const TIMEKEEPING_LOCAL_BROADCAST_CHANNEL = "s5evo-timekeeping-local-v1";

export function timekeepingStorageKey(competitionId: string) {
  return `s5evo-timekeeping-v1:${competitionId}`;
}

export function timekeepingTestStartNumbersStorageKey(competitionId: string) {
  return `s5evo-timekeeping-test-start-numbers-v1:${competitionId}`;
}

export function formatTimekeepingDuration(ms: number | null) {
  if (ms === null || !Number.isFinite(ms)) return "-";
  const totalHundredths = Math.max(0, Math.round(ms / 10));
  const hundredths = totalHundredths % 100;
  const totalSeconds = Math.floor(totalHundredths / 100);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}.${hundredths.toString().padStart(2, "0")}`;
}

export function formatTimekeepingClock(iso: string | null) {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(iso));
}

export function normalizeTimekeepingStartNumber(startNumber: string | null) {
  const trimmed = startNumber?.trim();
  if (!trimmed) return "";
  if (/^\d+$/.test(trimmed)) return String(Number.parseInt(trimmed, 10));
  return trimmed.toLowerCase();
}

export function findTimekeepingStarter(starters: Starter[], startNumber: string | null) {
  const normalized = normalizeTimekeepingStartNumber(startNumber);
  if (!normalized) return null;
  return starters.find((starter) => normalizeTimekeepingStartNumber(starter.startNumber) === normalized) ?? null;
}
