-- Operational roles are explicit competition grants only. Existing production
-- inventory was verified empty before this constraint was prepared.
ALTER TABLE "tenant_roles"
ADD CONSTRAINT "tenant_roles_no_competition_scoped_roles"
CHECK ("role" NOT IN ('MODERATOR', 'ZEITNAHME'));
