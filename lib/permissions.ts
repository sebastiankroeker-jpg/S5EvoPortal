// Rollen
export type Role = "ADMIN" | "MODERATOR" | "TEAMCHEF" | "TEILNEHMER" | "ZUSCHAUER";

// Permission strings
export type Permission = string; // z.B. "team.create", "team.delete", "config.edit" etc.

// Rollen → Permissions Mapping
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: ["*"], // Wildcard = alles
  MODERATOR: [
    "team.view.all", 
    "team.edit.all",
    "results.view", 
    "results.edit",
    "participant.view.all",
    "ranking.view",
  ],
  TEAMCHEF: [
    "team.create", 
    "team.view.own", 
    "team.edit.own", 
    "team.delete.own",
    "participant.view.own", 
    "participant.edit.own",
    "results.view",
    "ranking.view",
  ],
  TEILNEHMER: [
    "team.view.own",
    "participant.view.own", 
    "participant.edit.self",
    "results.view",
    "ranking.view",
  ],
  ZUSCHAUER: [
    "results.view",
    "ranking.view",
  ],
};

// Rollen-Hierarchie für höchste Rolle
const ROLE_HIERARCHY: Record<Role, number> = {
  ADMIN: 5,
  MODERATOR: 4,
  TEAMCHEF: 3,
  TEILNEHMER: 2,
  ZUSCHAUER: 1,
};

// Helper: hat die Rolle diese Permission?
export function roleHasPermission(role: Role, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  return permissions.includes("*") || permissions.includes(permission);
}

// Helper: hat irgendeine der Rollen diese Permission?
export function hasPermission(roles: Role[], permission: Permission): boolean {
  return roles.some(role => roleHasPermission(role, permission));
}

// Höchste Rolle bestimmen (für Anzeige)
export function getHighestRole(roles: Role[]): Role {
  if (roles.length === 0) return "ZUSCHAUER";
  
  return roles.reduce((highest, current) => {
    return ROLE_HIERARCHY[current] > ROLE_HIERARCHY[highest] ? current : highest;
  });
}

// Alle effektiven Permissions für Rollen-Set
export function getEffectivePermissions(roles: Role[]): Permission[] {
  const allPermissions = new Set<Permission>();
  
  for (const role of roles) {
    const permissions = ROLE_PERMISSIONS[role];
    permissions.forEach(permission => allPermissions.add(permission));
  }
  
  return Array.from(allPermissions);
}

// Export can() als einfachen Check
export function can(roles: Role[], permission: Permission): boolean {
  return hasPermission(roles, permission);
}

// Rollen die eine Rolle simulieren kann (inkl. eigene Rolle)
export function getSimulatableRoles(role: Role): Role[] {
  switch (role) {
    case "ADMIN":
      return ["ADMIN", "MODERATOR", "TEAMCHEF", "TEILNEHMER", "ZUSCHAUER"];
    case "MODERATOR":
      return ["MODERATOR", "TEAMCHEF", "TEILNEHMER", "ZUSCHAUER"];
    case "TEAMCHEF":
      return ["TEAMCHEF", "TEILNEHMER", "ZUSCHAUER"];
    default:
      return [];
  }
}