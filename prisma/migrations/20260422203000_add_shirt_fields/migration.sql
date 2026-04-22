-- CreateEnum
CREATE TYPE "ShirtSize" AS ENUM ('K116', 'K128', 'K140', 'K152', 'K164', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL');

-- AlterTable
ALTER TABLE "competitions" ADD COLUMN     "shirtOrderDeadline" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "participants" ADD COLUMN     "shirtSize" "ShirtSize";
