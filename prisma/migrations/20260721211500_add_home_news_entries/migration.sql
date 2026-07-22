-- CreateEnum
CREATE TYPE "HomeNewsStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "home_news_entries" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "HomeNewsStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,
    "competitionId" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "home_news_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "home_news_entries_tenantId_status_archivedAt_publishedAt_idx" ON "home_news_entries"("tenantId", "status", "archivedAt", "publishedAt");

-- CreateIndex
CREATE INDEX "home_news_entries_competitionId_status_archivedAt_publishedAt_idx" ON "home_news_entries"("competitionId", "status", "archivedAt", "publishedAt");

-- AddForeignKey
ALTER TABLE "home_news_entries" ADD CONSTRAINT "home_news_entries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_news_entries" ADD CONSTRAINT "home_news_entries_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_news_entries" ADD CONSTRAINT "home_news_entries_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_news_entries" ADD CONSTRAINT "home_news_entries_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
