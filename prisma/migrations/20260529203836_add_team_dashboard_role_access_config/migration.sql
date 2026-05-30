-- AlterTable
ALTER TABLE "competitions" ADD COLUMN     "participantsCanViewAllTeams" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "spectatorsCanViewAllTeams" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "teamOwnerFilterVisibleForTeamchef" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "pending_changes" ALTER COLUMN "updatedAt" DROP DEFAULT;
