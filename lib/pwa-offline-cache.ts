export type OfflineCacheEnvelope<T> = {
  version: 1;
  storedAt: string;
  data: T;
};

function hasLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readOfflineCache<T>(key: string): OfflineCacheEnvelope<T> | null {
  if (!hasLocalStorage()) return null;

  try {
    const rawValue = window.localStorage.getItem(key);
    if (!rawValue) return null;

    const parsed = JSON.parse(rawValue) as Partial<OfflineCacheEnvelope<T>>;
    if (parsed.version !== 1 || typeof parsed.storedAt !== "string" || parsed.data === undefined) {
      return null;
    }

    return parsed as OfflineCacheEnvelope<T>;
  } catch {
    return null;
  }
}

export function writeOfflineCache<T>(key: string, data: T) {
  if (!hasLocalStorage()) return null;

  const envelope: OfflineCacheEnvelope<T> = {
    version: 1,
    storedAt: new Date().toISOString(),
    data,
  };

  try {
    window.localStorage.setItem(key, JSON.stringify(envelope));
    return envelope;
  } catch {
    return null;
  }
}

export function formatOfflineCacheTimestamp(value?: string | null) {
  if (!value) return "kein lokaler Stand";

  try {
    return new Intl.DateTimeFormat("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}
