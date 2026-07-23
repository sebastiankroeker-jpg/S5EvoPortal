"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSession } from "next-auth/react";

import {
  ALL_OPTIONAL_CONSENT_STATE,
  CONSENT_STORAGE_KEY,
  DEFAULT_CONSENT_STATE,
  PRIVACY_NOTICE_VERSION,
  buildConsentSnapshot,
  normalizeConsentState,
  type ConsentCategoryKey,
  type ConsentSnapshot,
  type ConsentState,
} from "@/lib/privacy-consent";

type PrivacyConsentContextValue = {
  categories: ConsentState;
  decided: boolean;
  loading: boolean;
  saveConsent: (categories: ConsentState, source?: "BANNER" | "PROFILE") => Promise<void>;
  acceptEssential: () => Promise<void>;
  acceptAll: () => Promise<void>;
  hasConsent: (category: ConsentCategoryKey) => boolean;
};

const PrivacyConsentContext = createContext<PrivacyConsentContextValue | null>(null);

const FUNCTIONAL_STORAGE_KEYS = [
  "sidebar-collapsed",
  "s5evo-active-competition",
  "s5evo-dashboard.visibleColumns",
  "s5evo-messages.visibleColumns.v1",
  "s5evo.messages.visibleColumns.v1",
  "s5evo.messages.filters.v1",
  "s5evo-theme",
  "s5evo-theme-effects",
  "theme",
  "app-theme",
  "color-theme",
];
const FUNCTIONAL_STORAGE_PREFIXES = [
  "s5evo.dashboard.preferences.v1",
  "s5evo.dashboard.selectedLayout.v1",
];

function removeFunctionalStorage() {
  if (typeof window === "undefined") return;

  for (const key of FUNCTIONAL_STORAGE_KEYS) {
    window.localStorage.removeItem(key);
  }

  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index);
    if (key && FUNCTIONAL_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      window.localStorage.removeItem(key);
    }
  }
}

function readLocalSnapshot(): ConsentSnapshot | null {
  if (typeof window === "undefined") return null;

  try {
    const rawValue = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!rawValue) return null;
    const parsed = JSON.parse(rawValue) as Partial<ConsentSnapshot>;
    return {
      version: typeof parsed.version === "string" ? parsed.version : PRIVACY_NOTICE_VERSION,
      decidedAt: typeof parsed.decidedAt === "string" ? parsed.decidedAt : null,
      categories: normalizeConsentState(parsed.categories),
    };
  } catch {
    return null;
  }
}

function writeLocalSnapshot(snapshot: ConsentSnapshot) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(snapshot));
  if (!snapshot.categories.FUNCTIONAL_STORAGE) {
    removeFunctionalStorage();
  }
}

async function persistRemote(categories: ConsentState, source: "BANNER" | "PROFILE") {
  const response = await fetch("/api/privacy/preferences", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ categories, source }),
  });

  if (!response.ok && response.status !== 401) {
    throw new Error("privacy_preferences_save_failed");
  }
}

export function PrivacyConsentProvider({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const [snapshot, setSnapshot] = useState<ConsentSnapshot>(() => readLocalSnapshot() ?? {
    version: PRIVACY_NOTICE_VERSION,
    decidedAt: null,
    categories: { ...DEFAULT_CONSENT_STATE },
  });
  const loading = false;

  useEffect(() => {
    if (status !== "authenticated") return;

    let cancelled = false;
    fetch("/api/privacy/preferences", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then(async (remote: ConsentSnapshot | null) => {
        if (cancelled || !remote) return;
        const localSnapshot = readLocalSnapshot();
        if (!remote.decidedAt && localSnapshot?.decidedAt) {
          await persistRemote(localSnapshot.categories, "BANNER").catch(() => undefined);
          return;
        }
        const nextSnapshot = {
          version: remote.version || PRIVACY_NOTICE_VERSION,
          decidedAt: remote.decidedAt,
          categories: normalizeConsentState(remote.categories),
        };
        setSnapshot(nextSnapshot);
        writeLocalSnapshot(nextSnapshot);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [status]);

  const saveConsent = useCallback(
    async (categories: ConsentState, source: "BANNER" | "PROFILE" = "BANNER") => {
      const normalized = normalizeConsentState(categories);
      const nextSnapshot = buildConsentSnapshot(normalized);
      setSnapshot(nextSnapshot);
      writeLocalSnapshot(nextSnapshot);
      if (status === "authenticated") {
        await persistRemote(normalized, source);
      }
    },
    [status],
  );

  const acceptEssential = useCallback(
    () => saveConsent({ ...DEFAULT_CONSENT_STATE }, "BANNER"),
    [saveConsent],
  );

  const acceptAll = useCallback(
    () => saveConsent({ ...ALL_OPTIONAL_CONSENT_STATE }, "BANNER"),
    [saveConsent],
  );

  const value = useMemo<PrivacyConsentContextValue>(
    () => ({
      categories: snapshot.categories,
      decided: Boolean(snapshot.decidedAt),
      loading,
      saveConsent,
      acceptEssential,
      acceptAll,
      hasConsent: (category) => snapshot.categories[category],
    }),
    [acceptAll, acceptEssential, loading, saveConsent, snapshot],
  );

  return <PrivacyConsentContext.Provider value={value}>{children}</PrivacyConsentContext.Provider>;
}

export function usePrivacyConsent() {
  const context = useContext(PrivacyConsentContext);
  if (!context) {
    throw new Error("usePrivacyConsent must be used within PrivacyConsentProvider");
  }
  return context;
}
