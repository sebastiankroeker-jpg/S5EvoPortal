"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useSession } from "next-auth/react";
import { Role, Permission, can as canCheck, getHighestRole } from "./permissions";
import { readOfflineCache, writeOfflineCache } from "./pwa-offline-cache";

interface PermissionsContextType {
  roles: Role[];
  activeRole: Role;
  isLoading: boolean;
  can: (permission: Permission) => boolean;
  simulatedRole: Role | null;
  setSimulatedRole: (role: Role | null) => void;
  isSimulating: boolean;
}

const PermissionsContext = createContext<PermissionsContextType | null>(null);
const ROLES_CACHE_KEY = "s5evo.offline.profileRoles.v1";
const VALID_ROLES = new Set<Role>(["ADMIN", "MODERATOR", "ZEITNAHME", "TEAMCHEF", "TEILNEHMER", "ZUSCHAUER"]);

interface PermissionsProviderProps {
  children: ReactNode;
}

export function PermissionsProvider({ children }: PermissionsProviderProps) {
  const { data: session, status } = useSession();
  const [simulatedRole, setSimulatedRole] = useState<Role | null>(null);
  const sessionEmail = session?.user?.email ?? null;
  
  // Rollen aus der DB laden
  const [dbRoles, setDbRoles] = useState<{ email: string | null; roles: Role[]; fallback?: boolean } | null>(() => {
    if (typeof navigator !== "undefined" && navigator.onLine) return null;
    const cached = readOfflineCache<{ email: string | null; roles: Role[] }>(ROLES_CACHE_KEY);
    const cachedRoles = cached?.data.roles?.filter((role): role is Role => VALID_ROLES.has(role as Role)) ?? [];
    return cachedRoles.length > 0
      ? { email: cached?.data.email ?? null, roles: cachedRoles, fallback: true }
      : null;
  });

  useEffect(() => {
    if (!sessionEmail) {
      return;
    }

    let cancelled = false;

    fetch("/api/profile/roles", { cache: "no-store" })
      .then(res => res.ok ? res.json() : { roles: [] })
      .then(data => {
        if (!cancelled) {
          const nextRoles = (data.roles?.length ? data.roles : ["TEILNEHMER"])
            .filter((role: string): role is Role => VALID_ROLES.has(role as Role));
          const roles = nextRoles.length ? nextRoles : ["TEILNEHMER"];
          setDbRoles({ email: sessionEmail, roles });
          writeOfflineCache(ROLES_CACHE_KEY, { email: sessionEmail, roles });
        }
      })
      .catch(() => {
        if (!cancelled) {
          const cached = readOfflineCache<{ email: string | null; roles: Role[] }>(ROLES_CACHE_KEY);
          const cachedRoles = cached?.data.email === sessionEmail
            ? cached.data.roles?.filter((role): role is Role => VALID_ROLES.has(role as Role)) ?? []
            : [];
          setDbRoles({ email: sessionEmail, roles: cachedRoles.length ? cachedRoles : ["TEILNEHMER"], fallback: cachedRoles.length > 0 });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sessionEmail]);

  const currentDbRoles = dbRoles?.email === sessionEmail || (!sessionEmail && dbRoles?.fallback) ? dbRoles.roles : null;
  const roles: Role[] = dbRoles?.fallback && currentDbRoles?.length
    ? currentDbRoles
    : session?.user
    ? (currentDbRoles?.length ? currentDbRoles : ["TEILNEHMER"])
    : ["ZUSCHAUER"];
  const isLoading = !dbRoles?.fallback && (status === "loading" || Boolean(session?.user && currentDbRoles === null));
  
  const activeRole = simulatedRole || getHighestRole(roles);
  const isSimulating = simulatedRole !== null;
  
  const can = (permission: Permission): boolean => {
    // Bei Simulation: nur gegen simulierte Rolle prüfen
    if (isSimulating && simulatedRole) {
      return canCheck([simulatedRole], permission);
    }
    // Sonst gegen echte Rollen
    return canCheck(roles, permission);
  };

  const contextValue: PermissionsContextType = {
    roles,
    activeRole,
    isLoading,
    can,
    simulatedRole,
    setSimulatedRole,
    isSimulating,
  };

  return (
    <PermissionsContext.Provider value={contextValue}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions(): PermissionsContextType {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error("usePermissions must be used within a PermissionsProvider");
  }
  return context;
}
