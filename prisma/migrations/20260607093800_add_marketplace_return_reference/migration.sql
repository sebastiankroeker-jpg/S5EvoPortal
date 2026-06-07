ALTER TABLE "participants" ADD COLUMN "marketplaceReturnTeamId" TEXT;
ALTER TABLE "participants" ADD COLUMN "marketplaceReturnDisciplineCode" "DisciplineAssignment";
CREATE INDEX "participants_marketplaceReturnTeamId_idx" ON "participants"("marketplaceReturnTeamId");
