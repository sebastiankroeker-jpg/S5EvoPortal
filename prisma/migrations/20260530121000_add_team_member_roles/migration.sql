CREATE TYPE "TeamMemberRoleType" AS ENUM ('TEAM_MANAGER');

CREATE TABLE "team_member_roles" (
  "id" TEXT NOT NULL,
  "role" "TeamMemberRoleType" NOT NULL DEFAULT 'TEAM_MANAGER',
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "teamId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "grantedByUserId" TEXT,
  "revokedByUserId" TEXT,

  CONSTRAINT "team_member_roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "team_member_roles_teamId_userId_role_key"
  ON "team_member_roles"("teamId", "userId", "role");

CREATE INDEX "team_member_roles_userId_role_revokedAt_idx"
  ON "team_member_roles"("userId", "role", "revokedAt");

CREATE INDEX "team_member_roles_teamId_role_revokedAt_idx"
  ON "team_member_roles"("teamId", "role", "revokedAt");

ALTER TABLE "team_member_roles"
ADD CONSTRAINT "team_member_roles_teamId_fkey"
FOREIGN KEY ("teamId") REFERENCES "teams"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "team_member_roles"
ADD CONSTRAINT "team_member_roles_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "team_member_roles"
ADD CONSTRAINT "team_member_roles_grantedByUserId_fkey"
FOREIGN KEY ("grantedByUserId") REFERENCES "users"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "team_member_roles"
ADD CONSTRAINT "team_member_roles_revokedByUserId_fkey"
FOREIGN KEY ("revokedByUserId") REFERENCES "users"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
