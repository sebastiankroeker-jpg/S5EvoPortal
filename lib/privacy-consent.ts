export const PRIVACY_NOTICE_VERSION = "2026-07-23";

export const CONSENT_STORAGE_KEY = "s5evo-privacy-consent-v1";

export const CONSENT_CATEGORIES = [
  "FUNCTIONAL_STORAGE",
  "EXTERNAL_MAPS",
  "LOCAL_OFFLINE",
  "PORTAL_MESSAGE_EMAIL",
] as const;

export type ConsentCategoryKey = (typeof CONSENT_CATEGORIES)[number];

export type ConsentState = Record<ConsentCategoryKey, boolean>;

export type ConsentSnapshot = {
  version: string;
  decidedAt: string | null;
  categories: ConsentState;
};

export const DEFAULT_CONSENT_STATE: ConsentState = {
  FUNCTIONAL_STORAGE: false,
  EXTERNAL_MAPS: false,
  LOCAL_OFFLINE: false,
  PORTAL_MESSAGE_EMAIL: false,
};

export const ALL_OPTIONAL_CONSENT_STATE: ConsentState = {
  FUNCTIONAL_STORAGE: true,
  EXTERNAL_MAPS: true,
  LOCAL_OFFLINE: true,
  PORTAL_MESSAGE_EMAIL: true,
};

export function normalizeConsentState(input: unknown): ConsentState {
  if (!input || typeof input !== "object") {
    return { ...DEFAULT_CONSENT_STATE };
  }

  const record = input as Partial<Record<ConsentCategoryKey, unknown>>;
  return {
    FUNCTIONAL_STORAGE: record.FUNCTIONAL_STORAGE === true,
    EXTERNAL_MAPS: record.EXTERNAL_MAPS === true,
    LOCAL_OFFLINE: record.LOCAL_OFFLINE === true,
    PORTAL_MESSAGE_EMAIL: record.PORTAL_MESSAGE_EMAIL === true,
  };
}

export function buildConsentSnapshot(categories: ConsentState): ConsentSnapshot {
  return {
    version: PRIVACY_NOTICE_VERSION,
    decidedAt: new Date().toISOString(),
    categories,
  };
}
