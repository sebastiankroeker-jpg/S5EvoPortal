/*
  Warnings:

  - You are about to drop the `Participant` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Team` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_TeamMembers` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Participant" DROP CONSTRAINT "Participant_teamId_fkey";

-- DropForeignKey
ALTER TABLE "_TeamMembers" DROP CONSTRAINT "_TeamMembers_A_fkey";

-- DropForeignKey
ALTER TABLE "_TeamMembers" DROP CONSTRAINT "_TeamMembers_B_fkey";

-- DropTable
DROP TABLE "Participant";

-- DropTable
DROP TABLE "Team";

-- DropTable
DROP TABLE "User";

-- DropTable
DROP TABLE "_TeamMembers";
