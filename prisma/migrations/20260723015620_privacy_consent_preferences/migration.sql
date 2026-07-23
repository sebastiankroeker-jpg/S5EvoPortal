-- CreateEnum
CREATE TYPE "ConsentCategory" AS ENUM ('FUNCTIONAL_STORAGE', 'EXTERNAL_MAPS', 'LOCAL_OFFLINE', 'PORTAL_MESSAGE_EMAIL');

-- CreateEnum
CREATE TYPE "ConsentSource" AS ENUM ('BANNER', 'SETTINGS', 'PROFILE', 'REGISTRATION', 'CLAIM', 'ADMIN');

-- CreateTable
CREATE TABLE "consent_preferences" (
    "id" TEXT NOT NULL,
    "category" "ConsentCategory" NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT false,
    "noticeVersion" TEXT NOT NULL,
    "source" "ConsentSource" NOT NULL DEFAULT 'BANNER',
    "grantedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,
    "participantId" TEXT,
    "tenantId" TEXT,
    "competitionId" TEXT,

    CONSTRAINT "consent_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consent_preferences_tenantId_category_idx" ON "consent_preferences"("tenantId", "category");

-- CreateIndex
CREATE INDEX "consent_preferences_competitionId_category_idx" ON "consent_preferences"("competitionId", "category");

-- CreateIndex
CREATE INDEX "consent_preferences_category_granted_idx" ON "consent_preferences"("category", "granted");

-- CreateIndex
CREATE UNIQUE INDEX "consent_preferences_userId_category_key" ON "consent_preferences"("userId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "consent_preferences_participantId_category_key" ON "consent_preferences"("participantId", "category");

-- AddForeignKey
ALTER TABLE "consent_preferences" ADD CONSTRAINT "consent_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_preferences" ADD CONSTRAINT "consent_preferences_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_preferences" ADD CONSTRAINT "consent_preferences_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_preferences" ADD CONSTRAINT "consent_preferences_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
