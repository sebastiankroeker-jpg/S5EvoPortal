-- Add optional start number per participant.
ALTER TABLE "participants"
ADD COLUMN "startNumber" TEXT;

CREATE INDEX "participants_startNumber_idx"
ON "participants"("startNumber");
