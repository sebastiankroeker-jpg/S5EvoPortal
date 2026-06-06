-- CreateEnum
CREATE TYPE "TeamRegistrationMode" AS ENUM ('TEAM', 'MARKETPLACE');

-- CreateEnum
CREATE TYPE "MarketplaceVisibility" AS ENUM ('PUBLIC', 'MARKETPLACE_USERS', 'PORTAL_USERS', 'ADMIN_MANAGEMENT_ONLY');

-- CreateEnum
CREATE TYPE "MarketplaceStatus" AS ENUM ('NEW', 'REVIEWED', 'MATCHING', 'MATCHED', 'WITHDRAWN');

-- AlterTable
ALTER TABLE "teams"
ADD COLUMN "registrationMode" "TeamRegistrationMode" NOT NULL DEFAULT 'TEAM',
ADD COLUMN "marketplaceVisibility" "MarketplaceVisibility" NOT NULL DEFAULT 'ADMIN_MANAGEMENT_ONLY',
ADD COLUMN "marketplaceStatus" "MarketplaceStatus" NOT NULL DEFAULT 'NEW',
ADD COLUMN "marketplaceMessage" TEXT;

-- CreateIndex
CREATE INDEX "teams_registrationMode_marketplaceStatus_idx" ON "teams"("registrationMode", "marketplaceStatus");

-- CreateIndex
CREATE INDEX "teams_marketplaceVisibility_idx" ON "teams"("marketplaceVisibility");
