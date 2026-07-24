-- CreateEnum
CREATE TYPE "LivePublicationVisibility" AS ENUM ('ADMINS', 'PORTAL_USERS', 'SPECTATORS');

-- AlterTable
ALTER TABLE "competitions"
ADD COLUMN "liveTeamsVisibility" "LivePublicationVisibility" NOT NULL DEFAULT 'ADMINS',
ADD COLUMN "liveStartlistsVisibility" "LivePublicationVisibility" NOT NULL DEFAULT 'ADMINS';
