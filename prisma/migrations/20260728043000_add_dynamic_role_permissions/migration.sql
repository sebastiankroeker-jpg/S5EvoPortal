-- Dynamic, tenant-scoped permission mapping. Existing TenantRole grants stay
-- intact; these assignments are an additional authorization layer.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'FRIENDS';

CREATE TABLE "permission_objects" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "description" TEXT,
  "riskLevel" TEXT NOT NULL DEFAULT 'MEDIUM',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "permission_objects_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "permission_objects_key_key" ON "permission_objects"("key");

CREATE TABLE "role_permissions" (
  "id" TEXT NOT NULL,
  "role" "Role" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "tenantId" TEXT NOT NULL,
  "permissionId" TEXT NOT NULL,
  CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "role_permissions_tenantId_role_permissionId_key"
  ON "role_permissions"("tenantId", "role", "permissionId");
CREATE INDEX "role_permissions_tenantId_role_idx"
  ON "role_permissions"("tenantId", "role");

ALTER TABLE "role_permissions"
  ADD CONSTRAINT "role_permissions_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_permissions"
  ADD CONSTRAINT "role_permissions_permissionId_fkey"
  FOREIGN KEY ("permissionId") REFERENCES "permission_objects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- V1 exposes only permissions backed by server-side enforcement. More legacy
-- route permissions are intentionally added after the separate audit.
INSERT INTO "permission_objects" ("id", "key", "label", "category", "description", "riskLevel", "updatedAt") VALUES
  ('permission_admin_roles_manage', 'admin.roles.manage', 'Rollen und Berechtigungen verwalten', 'Administration', 'Rollen und deren Berechtigungsobjekte verwalten.', 'HIGH', CURRENT_TIMESTAMP),
  ('permission_portal_map_view', 'portal.map.view', 'Event-Karte anzeigen', 'Portal', 'Interaktive Event-Karte anzeigen.', 'LOW', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "role_permissions" ("id", "role", "tenantId", "permissionId", "updatedAt")
SELECT 'role_permission_admin_roles_' || t."id", 'ADMIN', t."id", p."id", CURRENT_TIMESTAMP
FROM "tenants" t CROSS JOIN "permission_objects" p WHERE p."key" = 'admin.roles.manage'
ON CONFLICT ("tenantId", "role", "permissionId") DO NOTHING;

INSERT INTO "role_permissions" ("id", "role", "tenantId", "permissionId", "updatedAt")
SELECT 'role_permission_admin_map_' || t."id", 'ADMIN', t."id", p."id", CURRENT_TIMESTAMP
FROM "tenants" t CROSS JOIN "permission_objects" p WHERE p."key" = 'portal.map.view'
ON CONFLICT ("tenantId", "role", "permissionId") DO NOTHING;
