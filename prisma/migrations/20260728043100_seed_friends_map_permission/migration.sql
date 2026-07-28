-- PostgreSQL requires the new FRIENDS enum value to be committed before it can
-- be used in data rows, so this seed intentionally follows the enum migration.
INSERT INTO "role_permissions" ("id", "role", "tenantId", "permissionId", "updatedAt")
SELECT 'role_permission_friends_map_' || t."id", 'FRIENDS', t."id", p."id", CURRENT_TIMESTAMP
FROM "tenants" t CROSS JOIN "permission_objects" p WHERE p."key" = 'portal.map.view'
ON CONFLICT ("tenantId", "role", "permissionId") DO NOTHING;
