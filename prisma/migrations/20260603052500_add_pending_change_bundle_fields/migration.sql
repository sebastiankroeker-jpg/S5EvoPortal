CREATE TYPE "PendingChangeBundleType" AS ENUM ('SWAP');

CREATE TYPE "PendingChangeBundleStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CONFLICT');

ALTER TABLE "pending_changes"
  ADD COLUMN "bundleId" TEXT,
  ADD COLUMN "bundleType" "PendingChangeBundleType",
  ADD COLUMN "bundleStatus" "PendingChangeBundleStatus";

CREATE INDEX "pending_changes_bundleId_idx" ON "pending_changes"("bundleId");
CREATE INDEX "pending_changes_bundleStatus_updatedAt_idx" ON "pending_changes"("bundleStatus", "updatedAt");
