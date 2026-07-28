-- Competition-scoped operational role grants.
-- Existing tenant_roles rows are intentionally left untouched and remain
-- explicit legacy tenant-wide grants until an admin converts them.
CREATE TABLE "competition_roles" (
    "id" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "grantedById" TEXT,

    CONSTRAINT "competition_roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "competition_roles_userId_competitionId_role_key"
ON "competition_roles"("userId", "competitionId", "role");

CREATE INDEX "competition_roles_competitionId_role_idx"
ON "competition_roles"("competitionId", "role");

CREATE INDEX "competition_roles_userId_competitionId_idx"
ON "competition_roles"("userId", "competitionId");

ALTER TABLE "competition_roles"
ADD CONSTRAINT "competition_roles_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "competition_roles"
ADD CONSTRAINT "competition_roles_competitionId_fkey"
FOREIGN KEY ("competitionId") REFERENCES "competitions"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "competition_roles"
ADD CONSTRAINT "competition_roles_grantedById_fkey"
FOREIGN KEY ("grantedById") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "competition_roles"
ADD CONSTRAINT "competition_roles_operational_role_check"
CHECK ("role" IN ('MODERATOR', 'ZEITNAHME'));
