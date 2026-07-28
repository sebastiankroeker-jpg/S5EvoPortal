-- Add display and deterministic ordering metadata to the existing,
-- competition-scoped classification rules. No rule rows are created here;
-- the 2026 backfill remains an explicitly approved production-data action.
ALTER TABLE "classifications"
  ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "displayEmoji" TEXT;
