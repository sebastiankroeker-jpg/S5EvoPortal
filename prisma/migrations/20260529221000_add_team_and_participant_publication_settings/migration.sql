-- CreateEnum
CREATE TYPE "TeamPublicationLevel" AS ENUM ('TEAM_ANONYM', 'TEAMNAME_OEFFENTLICH', 'ALLES_OEFFENTLICH');

-- CreateEnum
CREATE TYPE "ParticipantPublicationPreference" AS ENUM ('NAME_VERBERGEN', 'NAME_VEROEFFENTLICHEN');

-- AlterTable
ALTER TABLE "teams"
ADD COLUMN "teamPublicationLevel" "TeamPublicationLevel" NOT NULL DEFAULT 'TEAM_ANONYM';

-- AlterTable
ALTER TABLE "participants"
ADD COLUMN "participantPublicationPreference" "ParticipantPublicationPreference" NOT NULL DEFAULT 'NAME_VERBERGEN';
