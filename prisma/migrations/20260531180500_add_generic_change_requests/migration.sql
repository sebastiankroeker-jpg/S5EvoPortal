-- Generic approval workflow foundation.
-- This is additive and keeps the existing participant-scoped pending_changes flow intact.

CREATE TYPE "ChangeRequestStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'APPLIED');

CREATE TYPE "ChangeRequestTargetType" AS ENUM ('PARTICIPANT', 'TEAM', 'USER', 'CONTRACT', 'METERING_POINT');

CREATE TYPE "ChangeRequestChangeType" AS ENUM ('UPDATE', 'DELETE', 'RESTORE', 'ROLE_CHANGE');

CREATE TYPE "ChangeRequestSource" AS ENUM ('SELF_SERVICE', 'ADMIN', 'IMPORT', 'SYSTEM');

CREATE TYPE "ChangeRequestAuditAction" AS ENUM ('CREATED', 'UPDATED', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'APPLIED', 'FAILED');

CREATE TABLE "change_requests" (
  "id" TEXT NOT NULL,
  "targetType" "ChangeRequestTargetType" NOT NULL,
  "targetId" TEXT NOT NULL,
  "changeType" "ChangeRequestChangeType" NOT NULL DEFAULT 'UPDATE',
  "status" "ChangeRequestStatus" NOT NULL DEFAULT 'DRAFT',
  "source" "ChangeRequestSource" NOT NULL DEFAULT 'SELF_SERVICE',
  "beforeSnapshot" JSONB,
  "requestedSnapshot" JSONB NOT NULL,
  "metadata" JSONB,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "reviewComment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "submittedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "appliedAt" TIMESTAMP(3),
  "tenantId" TEXT NOT NULL,
  "competitionId" TEXT,
  "requestedById" TEXT NOT NULL,
  "reviewedById" TEXT,
  "appliedById" TEXT,
  "supersedesRequestId" TEXT,

  CONSTRAINT "change_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "change_request_audit_logs" (
  "id" TEXT NOT NULL,
  "action" "ChangeRequestAuditAction" NOT NULL,
  "beforeData" JSONB,
  "afterData" JSONB,
  "message" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "changeRequestId" TEXT NOT NULL,
  "actorId" TEXT,

  CONSTRAINT "change_request_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "change_requests_tenantId_status_updatedAt_idx" ON "change_requests"("tenantId", "status", "updatedAt");
CREATE INDEX "change_requests_competitionId_status_updatedAt_idx" ON "change_requests"("competitionId", "status", "updatedAt");
CREATE INDEX "change_requests_targetType_targetId_status_idx" ON "change_requests"("targetType", "targetId", "status");
CREATE INDEX "change_requests_requestedById_status_idx" ON "change_requests"("requestedById", "status");
CREATE INDEX "change_requests_reviewedById_status_idx" ON "change_requests"("reviewedById", "status");
CREATE INDEX "change_request_audit_logs_changeRequestId_createdAt_idx" ON "change_request_audit_logs"("changeRequestId", "createdAt");
CREATE INDEX "change_request_audit_logs_actorId_createdAt_idx" ON "change_request_audit_logs"("actorId", "createdAt");

ALTER TABLE "change_requests"
  ADD CONSTRAINT "change_requests_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "change_requests"
  ADD CONSTRAINT "change_requests_competitionId_fkey"
  FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "change_requests"
  ADD CONSTRAINT "change_requests_requestedById_fkey"
  FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "change_requests"
  ADD CONSTRAINT "change_requests_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "change_requests"
  ADD CONSTRAINT "change_requests_appliedById_fkey"
  FOREIGN KEY ("appliedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "change_requests"
  ADD CONSTRAINT "change_requests_supersedesRequestId_fkey"
  FOREIGN KEY ("supersedesRequestId") REFERENCES "change_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "change_request_audit_logs"
  ADD CONSTRAINT "change_request_audit_logs_changeRequestId_fkey"
  FOREIGN KEY ("changeRequestId") REFERENCES "change_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "change_request_audit_logs"
  ADD CONSTRAINT "change_request_audit_logs_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
