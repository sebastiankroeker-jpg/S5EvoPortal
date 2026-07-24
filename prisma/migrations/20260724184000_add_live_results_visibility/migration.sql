ALTER TABLE "competitions"
ADD COLUMN "liveResultsVisibility" "LivePublicationVisibility" NOT NULL DEFAULT 'ADMINS';

UPDATE "competitions"
SET "liveResultsVisibility" = 'SPECTATORS'
WHERE "publicResults" = true;
