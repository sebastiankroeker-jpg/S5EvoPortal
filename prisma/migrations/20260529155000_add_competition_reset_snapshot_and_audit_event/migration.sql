CREATE TABLE "competition_reset_snapshots" (
    "id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "summary" JSONB NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "competition_reset_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "reason" TEXT,
    "beforeData" JSONB,
    "afterData" JSONB,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,
    "competitionId" TEXT,
    "actorId" TEXT,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "competition_reset_snapshots_tenantId_createdAt_idx"
    ON "competition_reset_snapshots"("tenantId", "createdAt");

CREATE INDEX "competition_reset_snapshots_competitionId_createdAt_idx"
    ON "competition_reset_snapshots"("competitionId", "createdAt");

CREATE INDEX "audit_events_tenantId_createdAt_idx"
    ON "audit_events"("tenantId", "createdAt");

CREATE INDEX "audit_events_competitionId_createdAt_idx"
    ON "audit_events"("competitionId", "createdAt");

CREATE INDEX "audit_events_scopeType_scopeId_createdAt_idx"
    ON "audit_events"("scopeType", "scopeId", "createdAt");

CREATE INDEX "audit_events_action_createdAt_idx"
    ON "audit_events"("action", "createdAt");

ALTER TABLE "competition_reset_snapshots"
    ADD CONSTRAINT "competition_reset_snapshots_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "competition_reset_snapshots"
    ADD CONSTRAINT "competition_reset_snapshots_competitionId_fkey"
    FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "competition_reset_snapshots"
    ADD CONSTRAINT "competition_reset_snapshots_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "audit_events"
    ADD CONSTRAINT "audit_events_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "audit_events"
    ADD CONSTRAINT "audit_events_competitionId_fkey"
    FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "audit_events"
    ADD CONSTRAINT "audit_events_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
