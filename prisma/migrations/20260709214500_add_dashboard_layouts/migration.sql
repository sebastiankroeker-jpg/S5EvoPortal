-- CreateEnum
CREATE TYPE "DashboardLayoutScope" AS ENUM ('PERSONAL', 'GLOBAL');

-- CreateEnum
CREATE TYPE "DashboardKey" AS ENUM ('TEAM_DASHBOARD');

-- CreateTable
CREATE TABLE "dashboard_layouts" (
    "id" TEXT NOT NULL,
    "dashboardKey" "DashboardKey" NOT NULL,
    "scope" "DashboardLayoutScope" NOT NULL,
    "name" TEXT NOT NULL,
    "configVersion" INTEGER NOT NULL DEFAULT 1,
    "config" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "tenantId" TEXT NOT NULL,
    "competitionId" TEXT,
    "ownerId" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "dashboard_layouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dashboard_layouts_tenantId_dashboardKey_scope_deletedAt_idx" ON "dashboard_layouts"("tenantId", "dashboardKey", "scope", "deletedAt");

-- CreateIndex
CREATE INDEX "dashboard_layouts_ownerId_dashboardKey_deletedAt_idx" ON "dashboard_layouts"("ownerId", "dashboardKey", "deletedAt");

-- CreateIndex
CREATE INDEX "dashboard_layouts_competitionId_idx" ON "dashboard_layouts"("competitionId");

-- CreateIndex
CREATE INDEX "dashboard_layouts_isDefault_idx" ON "dashboard_layouts"("isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_layouts_personal_name_unique" ON "dashboard_layouts"("tenantId", "dashboardKey", "ownerId", COALESCE("competitionId", ''), lower("name")) WHERE "scope" = 'PERSONAL' AND "deletedAt" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_layouts_global_name_unique" ON "dashboard_layouts"("tenantId", "dashboardKey", COALESCE("competitionId", ''), lower("name")) WHERE "scope" = 'GLOBAL' AND "deletedAt" IS NULL;

-- AddForeignKey
ALTER TABLE "dashboard_layouts" ADD CONSTRAINT "dashboard_layouts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_layouts" ADD CONSTRAINT "dashboard_layouts_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_layouts" ADD CONSTRAINT "dashboard_layouts_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_layouts" ADD CONSTRAINT "dashboard_layouts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_layouts" ADD CONSTRAINT "dashboard_layouts_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
