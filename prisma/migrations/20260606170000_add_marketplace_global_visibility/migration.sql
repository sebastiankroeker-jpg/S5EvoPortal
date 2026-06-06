-- CreateEnum
CREATE TYPE "MarketplaceGlobalVisibility" AS ENUM ('SELECTIVE', 'OFFLINE');

-- AlterTable
ALTER TABLE "competitions"
ADD COLUMN "marketplaceGlobalVisibility" "MarketplaceGlobalVisibility" NOT NULL DEFAULT 'SELECTIVE';
