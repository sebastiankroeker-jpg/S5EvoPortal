ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'ZEITNAHME';

CREATE TABLE "timekeeping_sessions" (
  "id" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "disciplineCode" "DisciplineCode" NOT NULL,
  "startBlockName" TEXT NOT NULL,
  "firstStartNumber" INTEGER,
  "startIntervalSeconds" INTEGER NOT NULL DEFAULT 30,
  "manualStartedAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "tenantId" TEXT NOT NULL,
  "competitionId" TEXT NOT NULL,
  "createdById" TEXT,
  CONSTRAINT "timekeeping_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "timekeeping_events" (
  "id" TEXT NOT NULL,
  "clientEventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "recordedAt" TIMESTAMP(3) NOT NULL,
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startNumber" TEXT,
  "rawElapsedMs" INTEGER,
  "netElapsedMs" INTEGER,
  "note" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sessionId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "competitionId" TEXT NOT NULL,
  "actorId" TEXT,
  CONSTRAINT "timekeeping_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "timekeeping_sessions_tenantId_competitionId_disciplineCode_status_idx" ON "timekeeping_sessions"("tenantId", "competitionId", "disciplineCode", "status");
CREATE INDEX "timekeeping_sessions_deviceId_updatedAt_idx" ON "timekeeping_sessions"("deviceId", "updatedAt");
CREATE UNIQUE INDEX "timekeeping_events_sessionId_clientEventId_key" ON "timekeeping_events"("sessionId", "clientEventId");
CREATE INDEX "timekeeping_events_tenantId_competitionId_recordedAt_idx" ON "timekeeping_events"("tenantId", "competitionId", "recordedAt");
CREATE INDEX "timekeeping_events_competitionId_eventType_recordedAt_idx" ON "timekeeping_events"("competitionId", "eventType", "recordedAt");
CREATE INDEX "timekeeping_events_startNumber_idx" ON "timekeeping_events"("startNumber");

ALTER TABLE "timekeeping_sessions" ADD CONSTRAINT "timekeeping_sessions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "timekeeping_sessions" ADD CONSTRAINT "timekeeping_sessions_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "timekeeping_sessions" ADD CONSTRAINT "timekeeping_sessions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "timekeeping_events" ADD CONSTRAINT "timekeeping_events_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "timekeeping_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "timekeeping_events" ADD CONSTRAINT "timekeeping_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "timekeeping_events" ADD CONSTRAINT "timekeeping_events_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "timekeeping_events" ADD CONSTRAINT "timekeeping_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
