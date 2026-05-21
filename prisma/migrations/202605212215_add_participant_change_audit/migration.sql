CREATE TYPE "ParticipantAuditAction" AS ENUM (
  'REQUEST_SUBMITTED',
  'REQUEST_UPDATED',
  'REQUEST_APPROVED',
  'REQUEST_REJECTED',
  'DIRECT_CHANGE'
);

ALTER TABLE "pending_changes"
  ADD COLUMN "beforeData" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "reviewComment" TEXT;

CREATE TABLE "participant_audit_logs" (
  "id" TEXT NOT NULL,
  "action" "ParticipantAuditAction" NOT NULL,
  "beforeData" TEXT,
  "afterData" TEXT,
  "message" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "participantId" TEXT NOT NULL,
  "actorId" TEXT,
  "pendingChangeId" TEXT,

  CONSTRAINT "participant_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "participant_audit_logs_participantId_createdAt_idx"
  ON "participant_audit_logs"("participantId", "createdAt");

CREATE INDEX "participant_audit_logs_pendingChangeId_idx"
  ON "participant_audit_logs"("pendingChangeId");

ALTER TABLE "participant_audit_logs"
  ADD CONSTRAINT "participant_audit_logs_participantId_fkey"
  FOREIGN KEY ("participantId") REFERENCES "participants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "participant_audit_logs"
  ADD CONSTRAINT "participant_audit_logs_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "participant_audit_logs"
  ADD CONSTRAINT "participant_audit_logs_pendingChangeId_fkey"
  FOREIGN KEY ("pendingChangeId") REFERENCES "pending_changes"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
