-- Move start number ownership from participants to teams.
ALTER TABLE "teams"
ADD COLUMN "startNumber" TEXT;

CREATE INDEX "teams_startNumber_idx"
ON "teams"("startNumber");

-- Preserve existing values by promoting a deterministic non-empty value per team.
UPDATE "teams" t
SET "startNumber" = src."startNumber"
FROM (
  SELECT p."teamId", MIN(p."startNumber") AS "startNumber"
  FROM "participants" p
  WHERE p."deletedAt" IS NULL
    AND p."startNumber" IS NOT NULL
    AND p."startNumber" <> ''
  GROUP BY p."teamId"
) src
WHERE t."id" = src."teamId";

DROP INDEX IF EXISTS "participants_startNumber_idx";

ALTER TABLE "participants"
DROP COLUMN IF EXISTS "startNumber";
