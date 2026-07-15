import type { $Enums } from "@prisma/client";

type ResultDataBatchStatus = $Enums.ResultDataBatchStatus;
type ResultDataPurpose = $Enums.ResultDataPurpose;
type ResultDataSource = $Enums.ResultDataSource;
type ResultDraftStatus = $Enums.ResultDraftStatus;
type ResultResetScope = $Enums.ResultResetScope;

export const RESULT_SOURCE_LABELS: Record<ResultDataSource, string> = {
  LEGACY_IMPORT: "Altes Backend",
  TIMEKEEPING_SYNC: "Zeitnahme-Sync",
  MANUAL_ADMIN: "Manuelle Ergebnis-Pflege",
  SYSTEM_RECALC: "System-Neuberechnung",
};

export const RESULT_PURPOSE_LABELS: Record<ResultDataPurpose, string> = {
  PRODUCTION: "Produktion",
  PROD_TEST: "Produktionstest",
  DRY_RUN: "Testlauf",
};

export const RESULT_BATCH_STATUS_LABELS: Record<ResultDataBatchStatus, string> = {
  STAGED: "Gestaged",
  VALIDATED: "Validiert",
  REVIEWED: "Geprueft",
  PUBLISHED: "Publiziert",
  DISCARDED: "Verworfen",
  ERROR: "Fehler",
};

export const RESULT_DRAFT_STATUS_LABELS: Record<ResultDraftStatus, string> = {
  DRAFT: "Entwurf",
  VALIDATED: "Validiert",
  CONFLICT: "Konflikt",
  APPROVED: "Freigegeben",
  REJECTED: "Abgelehnt",
  PUBLISHED: "Publiziert",
  DISCARDED: "Verworfen",
};

export const RESULT_RESET_SCOPE_LABELS: Record<ResultResetScope, string> = {
  RAW_BATCH: "Raw-Paket",
  DRAFTS: "Drafts",
  PUBLICATION: "Publikation",
  OFFICIAL_RESULTS: "Offizielle Ergebnisse",
  TEST_DATA: "Testdaten",
};

export function isProductionTestPurpose(purpose: ResultDataPurpose) {
  return purpose === "PROD_TEST" || purpose === "DRY_RUN";
}

export function canDiscardResultBatch(status: ResultDataBatchStatus) {
  return status === "STAGED" || status === "VALIDATED" || status === "REVIEWED" || status === "ERROR";
}

export function requiresResultResetSnapshot(scope: ResultResetScope) {
  return scope === "PUBLICATION" || scope === "OFFICIAL_RESULTS" || scope === "TEST_DATA";
}
