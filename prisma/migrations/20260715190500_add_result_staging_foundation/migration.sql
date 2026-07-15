CREATE TYPE "ResultDataSource" AS ENUM ('LEGACY_IMPORT', 'TIMEKEEPING_SYNC', 'MANUAL_ADMIN', 'SYSTEM_RECALC');
CREATE TYPE "ResultDataPurpose" AS ENUM ('PRODUCTION', 'PROD_TEST', 'DRY_RUN');
CREATE TYPE "ResultDataBatchStatus" AS ENUM ('STAGED', 'VALIDATED', 'REVIEWED', 'PUBLISHED', 'DISCARDED', 'ERROR');
CREATE TYPE "ResultValidationStatus" AS ENUM ('PENDING', 'VALID', 'WARNING', 'ERROR');
CREATE TYPE "ResultDraftStatus" AS ENUM ('DRAFT', 'VALIDATED', 'CONFLICT', 'APPROVED', 'REJECTED', 'PUBLISHED', 'DISCARDED');
CREATE TYPE "ResultConflictStatus" AS ENUM ('UNCHECKED', 'NONE', 'CONFLICT');
CREATE TYPE "ResultPublicationStatus" AS ENUM ('PUBLISHED', 'REVERTED');
CREATE TYPE "ResultPublicationAction" AS ENUM ('UPSERT', 'DELETE');
CREATE TYPE "ResultResetScope" AS ENUM ('RAW_BATCH', 'DRAFTS', 'PUBLICATION', 'OFFICIAL_RESULTS', 'TEST_DATA');
CREATE TYPE "ResultResetMode" AS ENUM ('PREVIEW', 'EXECUTED');

CREATE TABLE "result_data_batches" (
  "id" TEXT NOT NULL,
  "source" "ResultDataSource" NOT NULL,
  "purpose" "ResultDataPurpose" NOT NULL DEFAULT 'PRODUCTION',
  "status" "ResultDataBatchStatus" NOT NULL DEFAULT 'STAGED',
  "label" TEXT,
  "externalRef" TEXT,
  "sourceVersion" TEXT,
  "payload" JSONB,
  "summary" JSONB,
  "validationSummary" JSONB,
  "stagedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "discardedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "tenantId" TEXT NOT NULL,
  "competitionId" TEXT NOT NULL,
  "createdById" TEXT,
  "reviewedById" TEXT,
  CONSTRAINT "result_data_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "result_raw_records" (
  "id" TEXT NOT NULL,
  "rowKey" TEXT NOT NULL,
  "disciplineCode" "DisciplineCode",
  "startNumber" TEXT,
  "participantId" TEXT,
  "teamId" TEXT,
  "rawValue" DOUBLE PRECISION,
  "rawValueText" TEXT,
  "recordedAt" TIMESTAMP(3),
  "payload" JSONB NOT NULL,
  "validationStatus" "ResultValidationStatus" NOT NULL DEFAULT 'PENDING',
  "validationMessages" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "batchId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "competitionId" TEXT NOT NULL,
  CONSTRAINT "result_raw_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "result_drafts" (
  "id" TEXT NOT NULL,
  "status" "ResultDraftStatus" NOT NULL DEFAULT 'DRAFT',
  "conflictStatus" "ResultConflictStatus" NOT NULL DEFAULT 'UNCHECKED',
  "disciplineCode" "DisciplineCode" NOT NULL,
  "participantId" TEXT,
  "teamId" TEXT,
  "startNumber" TEXT,
  "rawValue" DOUBLE PRECISION,
  "rawValueText" TEXT,
  "normalizedValue" DOUBLE PRECISION,
  "netElapsedMs" INTEGER,
  "timekeepingEventId" TEXT,
  "currentResultSnapshot" JSONB,
  "proposedResultSnapshot" JSONB,
  "validationMessages" JSONB,
  "reviewedAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "discardedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "batchId" TEXT NOT NULL,
  "sourceRawRecordId" TEXT,
  "tenantId" TEXT NOT NULL,
  "competitionId" TEXT NOT NULL,
  CONSTRAINT "result_drafts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "result_publications" (
  "id" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "ResultPublicationStatus" NOT NULL DEFAULT 'PUBLISHED',
  "label" TEXT,
  "summary" JSONB,
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revertedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tenantId" TEXT NOT NULL,
  "competitionId" TEXT NOT NULL,
  "sourceBatchId" TEXT,
  "createdById" TEXT,
  CONSTRAINT "result_publications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "result_publication_items" (
  "id" TEXT NOT NULL,
  "action" "ResultPublicationAction" NOT NULL,
  "disciplineCode" "DisciplineCode" NOT NULL,
  "participantId" TEXT,
  "teamId" TEXT,
  "startNumber" TEXT,
  "resultId" TEXT,
  "beforeData" JSONB,
  "afterData" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publicationId" TEXT NOT NULL,
  "draftId" TEXT,
  CONSTRAINT "result_publication_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "result_reset_snapshots" (
  "id" TEXT NOT NULL,
  "scope" "ResultResetScope" NOT NULL,
  "mode" "ResultResetMode" NOT NULL DEFAULT 'PREVIEW',
  "reason" TEXT NOT NULL,
  "scopeFilter" JSONB,
  "summary" JSONB NOT NULL,
  "snapshot" JSONB NOT NULL,
  "executedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tenantId" TEXT NOT NULL,
  "competitionId" TEXT NOT NULL,
  "batchId" TEXT,
  "publicationId" TEXT,
  "createdById" TEXT,
  CONSTRAINT "result_reset_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "result_data_batches_tenantId_competitionId_source_status_idx" ON "result_data_batches"("tenantId", "competitionId", "source", "status");
CREATE INDEX "result_data_batches_competitionId_purpose_status_createdAt_idx" ON "result_data_batches"("competitionId", "purpose", "status", "createdAt");
CREATE INDEX "result_data_batches_externalRef_idx" ON "result_data_batches"("externalRef");

CREATE UNIQUE INDEX "result_raw_records_batchId_rowKey_key" ON "result_raw_records"("batchId", "rowKey");
CREATE INDEX "result_raw_records_tenantId_competitionId_disciplineCode_idx" ON "result_raw_records"("tenantId", "competitionId", "disciplineCode");
CREATE INDEX "result_raw_records_competitionId_startNumber_idx" ON "result_raw_records"("competitionId", "startNumber");
CREATE INDEX "result_raw_records_participantId_idx" ON "result_raw_records"("participantId");

CREATE INDEX "result_drafts_tenantId_competitionId_status_conflictStatus_idx" ON "result_drafts"("tenantId", "competitionId", "status", "conflictStatus");
CREATE INDEX "result_drafts_competitionId_disciplineCode_participantId_idx" ON "result_drafts"("competitionId", "disciplineCode", "participantId");
CREATE INDEX "result_drafts_competitionId_startNumber_idx" ON "result_drafts"("competitionId", "startNumber");
CREATE INDEX "result_drafts_timekeepingEventId_idx" ON "result_drafts"("timekeepingEventId");

CREATE UNIQUE INDEX "result_publications_competitionId_version_key" ON "result_publications"("competitionId", "version");
CREATE INDEX "result_publications_tenantId_competitionId_status_publishedAt_idx" ON "result_publications"("tenantId", "competitionId", "status", "publishedAt");

CREATE INDEX "result_publication_items_publicationId_disciplineCode_idx" ON "result_publication_items"("publicationId", "disciplineCode");
CREATE INDEX "result_publication_items_participantId_idx" ON "result_publication_items"("participantId");
CREATE INDEX "result_publication_items_resultId_idx" ON "result_publication_items"("resultId");

CREATE INDEX "result_reset_snapshots_tenantId_competitionId_scope_createdAt_idx" ON "result_reset_snapshots"("tenantId", "competitionId", "scope", "createdAt");
CREATE INDEX "result_reset_snapshots_batchId_idx" ON "result_reset_snapshots"("batchId");
CREATE INDEX "result_reset_snapshots_publicationId_idx" ON "result_reset_snapshots"("publicationId");

ALTER TABLE "result_data_batches" ADD CONSTRAINT "result_data_batches_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "result_data_batches" ADD CONSTRAINT "result_data_batches_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "result_data_batches" ADD CONSTRAINT "result_data_batches_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "result_data_batches" ADD CONSTRAINT "result_data_batches_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "result_raw_records" ADD CONSTRAINT "result_raw_records_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "result_data_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "result_raw_records" ADD CONSTRAINT "result_raw_records_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "result_raw_records" ADD CONSTRAINT "result_raw_records_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "result_drafts" ADD CONSTRAINT "result_drafts_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "result_data_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "result_drafts" ADD CONSTRAINT "result_drafts_sourceRawRecordId_fkey" FOREIGN KEY ("sourceRawRecordId") REFERENCES "result_raw_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "result_drafts" ADD CONSTRAINT "result_drafts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "result_drafts" ADD CONSTRAINT "result_drafts_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "result_publications" ADD CONSTRAINT "result_publications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "result_publications" ADD CONSTRAINT "result_publications_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "result_publications" ADD CONSTRAINT "result_publications_sourceBatchId_fkey" FOREIGN KEY ("sourceBatchId") REFERENCES "result_data_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "result_publications" ADD CONSTRAINT "result_publications_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "result_publication_items" ADD CONSTRAINT "result_publication_items_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "result_publications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "result_publication_items" ADD CONSTRAINT "result_publication_items_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "result_drafts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "result_reset_snapshots" ADD CONSTRAINT "result_reset_snapshots_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "result_reset_snapshots" ADD CONSTRAINT "result_reset_snapshots_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "result_reset_snapshots" ADD CONSTRAINT "result_reset_snapshots_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "result_data_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "result_reset_snapshots" ADD CONSTRAINT "result_reset_snapshots_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "result_publications"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "result_reset_snapshots" ADD CONSTRAINT "result_reset_snapshots_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
