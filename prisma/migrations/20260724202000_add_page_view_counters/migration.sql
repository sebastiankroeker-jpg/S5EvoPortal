CREATE TABLE "page_view_counters" (
  "id" TEXT NOT NULL,
  "day" TIMESTAMP(3) NOT NULL,
  "surface" TEXT NOT NULL DEFAULT 'portal',
  "routeKey" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "tenantId" TEXT NOT NULL,
  "competitionId" TEXT NOT NULL,

  CONSTRAINT "page_view_counters_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "page_view_counters_tenantId_competitionId_day_surface_routeKey_key"
  ON "page_view_counters"("tenantId", "competitionId", "day", "surface", "routeKey");

CREATE INDEX "page_view_counters_tenantId_day_idx"
  ON "page_view_counters"("tenantId", "day");

CREATE INDEX "page_view_counters_competitionId_day_idx"
  ON "page_view_counters"("competitionId", "day");

ALTER TABLE "page_view_counters"
  ADD CONSTRAINT "page_view_counters_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "page_view_counters"
  ADD CONSTRAINT "page_view_counters_competitionId_fkey"
  FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
