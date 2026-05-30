ALTER TABLE "participants"
ADD COLUMN "userId" TEXT;

CREATE INDEX "participants_userId_idx" ON "participants"("userId");

ALTER TABLE "participants"
ADD CONSTRAINT "participants_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
