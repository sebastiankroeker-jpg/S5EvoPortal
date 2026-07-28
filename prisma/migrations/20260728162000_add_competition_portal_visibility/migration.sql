-- Lifecycle, portal visibility and registration availability are intentionally
-- independent. Nullable fields preserve a safe legacy interpretation in the
-- application until each competition is explicitly configured by an admin.
CREATE TYPE "CompetitionPortalVisibility" AS ENUM ('PRIVATE', 'PORTAL_USERS', 'PUBLIC');
CREATE TYPE "CompetitionRegistrationVisibility" AS ENUM ('CLOSED', 'PORTAL_USERS', 'PUBLIC');

ALTER TABLE "competitions"
  ADD COLUMN "portalVisibility" "CompetitionPortalVisibility",
  ADD COLUMN "registrationVisibility" "CompetitionRegistrationVisibility";
