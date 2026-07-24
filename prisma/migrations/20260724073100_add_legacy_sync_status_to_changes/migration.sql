CREATE TYPE "LegacySyncStatus" AS ENUM ('OPEN', 'LEGACY_OK');

ALTER TABLE "pending_changes"
  ADD COLUMN "legacyStatus" "LegacySyncStatus" NOT NULL DEFAULT 'OPEN';

ALTER TABLE "change_requests"
  ADD COLUMN "legacyStatus" "LegacySyncStatus" NOT NULL DEFAULT 'OPEN';

ALTER TABLE "participant_audit_logs"
  ADD COLUMN "legacyStatus" "LegacySyncStatus" NOT NULL DEFAULT 'OPEN';

CREATE INDEX "pending_changes_legacyStatus_updatedAt_idx"
  ON "pending_changes"("legacyStatus", "updatedAt");

CREATE INDEX "change_requests_legacyStatus_updatedAt_idx"
  ON "change_requests"("legacyStatus", "updatedAt");

CREATE INDEX "participant_audit_logs_legacyStatus_createdAt_idx"
  ON "participant_audit_logs"("legacyStatus", "createdAt");
