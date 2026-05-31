-- Add indexes for the existing MVP query paths.
-- These do not change application behavior; they only give PostgreSQL better access paths
-- for competition-scoped team lists, participant lists, role checks, and approval queues.

CREATE INDEX "tenant_roles_tenantId_role_idx" ON "tenant_roles"("tenantId", "role");

CREATE INDEX "competitions_tenantId_status_year_createdAt_idx" ON "competitions"("tenantId", "status", "year", "createdAt");
CREATE INDEX "competitions_status_year_createdAt_idx" ON "competitions"("status", "year", "createdAt");

CREATE INDEX "teams_competitionId_deletedAt_idx" ON "teams"("competitionId", "deletedAt");
CREATE INDEX "teams_ownerId_deletedAt_idx" ON "teams"("ownerId", "deletedAt");
CREATE INDEX "teams_teamChiefId_deletedAt_idx" ON "teams"("teamChiefId", "deletedAt");
CREATE INDEX "teams_contactEmail_idx" ON "teams"("contactEmail");
CREATE INDEX "teams_updatedAt_idx" ON "teams"("updatedAt");

CREATE INDEX "participants_userId_deletedAt_idx" ON "participants"("userId", "deletedAt");
CREATE INDEX "participants_teamId_deletedAt_idx" ON "participants"("teamId", "deletedAt");
CREATE INDEX "participants_lastName_firstName_idx" ON "participants"("lastName", "firstName");

CREATE INDEX "discipline_results_participantId_idx" ON "discipline_results"("participantId");

CREATE INDEX "competition_rankings_teamId_idx" ON "competition_rankings"("teamId");

CREATE INDEX "pending_changes_status_updatedAt_idx" ON "pending_changes"("status", "updatedAt");
CREATE INDEX "pending_changes_participantId_status_idx" ON "pending_changes"("participantId", "status");
CREATE INDEX "pending_changes_requestedById_status_idx" ON "pending_changes"("requestedById", "status");
