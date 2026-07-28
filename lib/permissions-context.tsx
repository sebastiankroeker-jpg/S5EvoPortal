"use client";

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { useSession } from "next-auth/react";
import { Role, Permission, can as canCheck, getHighestRole } from "./permissions";
import { readOfflineCache, removeOfflineCachesByPrefix, writeOfflineCache } from "./pwa-offline-cache";
import { useCompetition } from "./competition-context";

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
const ROLES_CACHE_PREFIX = "s5evo.offline.profileRoles.v2";
const VALID_ROLES = new Set<Role>(["ADMIN", "MODERATOR", "ZEITNAHME", "TEAMCHEF", "TEILNEHMER", "FRIENDS", "ZUSCHAUER"]);
const DYNAMIC_PERMISSIONS = new Set<Permission>(["admin.roles.manage", "portal.map.view"]);

interface PermissionsProviderProps {
  children: ReactNode;
}

export function PermissionsProvider({ children }: PermissionsProviderProps) {
  const { data: session, status } = useSession();
  const { active: activeCompetition, loading: competitionLoading } = useCompetition();
  const [simulatedRole, setSimulatedRole] = useState<Role | null>(null);
  const sessionEmail = session?.user?.email ?? null;
  const sessionSubject = (session?.user as { id?: string } | undefined)?.id ?? sessionEmail;
  const previousSubjectRef = useRef<string | null>(null);
  
  // Rollen aus der DB laden
  const [dbRoles, setDbRoles] = useState<{
    subject: string;
    tenantId: string;
    competitionId: string;
    roles: Role[];
    permissions?: Permission[];
    fallback?: boolean;
  } | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      removeOfflineCachesByPrefix("s5evo.offline.profileRoles.v1");
      if (previousSubjectRef.current) {
        removeOfflineCachesByPrefix(
          `${ROLES_CACHE_PREFIX}.${encodeURIComponent(previousSubjectRef.current)}.`,
        );
      }
      previousSubjectRef.current = null;
      return;
    }

    if (!sessionEmail || !sessionSubject || competitionLoading || !activeCompetition?.id) return;
    removeOfflineCachesByPrefix("s5evo.offline.profileRoles.v1");
    previousSubjectRef.current = sessionSubject;

    let cancelled = false;
    const competitionId = activeCompetition.id;
    const userCachePrefix = `${ROLES_CACHE_PREFIX}.${encodeURIComponent(sessionSubject)}.`;
    const scopeIndexKey = `${userCachePrefix}scope.${encodeURIComponent(competitionId)}`;

    fetch(`/api/profile/roles?competitionId=${encodeURIComponent(competitionId)}`, { cache: "no-store" })
      .then(res => res.ok ? res.json() : { roles: [] })
      .then(data => {
        if (!cancelled) {
          const nextRoles = (data.roles?.length ? data.roles : ["TEILNEHMER"])
            .filter((role: string): role is Role => VALID_ROLES.has(role as Role));
          const roles = nextRoles.length ? nextRoles : ["TEILNEHMER"];
          const permissions = Array.isArray(data.permissions)
            ? data.permissions.filter((permission: unknown): permission is Permission => typeof permission === "string")
            : [];
          const tenantId = typeof data.tenantId === "string" ? data.tenantId : null;
          if (!tenantId || data.competitionId !== competitionId) {
            setDbRoles({
              subject: sessionSubject,
              tenantId: "",
              competitionId,
              roles: ["TEILNEHMER"],
              permissions: [],
            });
            return;
          }

          const cacheKey = `${userCachePrefix}data.${encodeURIComponent(tenantId)}.${encodeURIComponent(competitionId)}`;
          const nextState = {
            subject: sessionSubject,
            tenantId,
            competitionId,
            roles,
            permissions,
          };
          setDbRoles(nextState);
          writeOfflineCache(scopeIndexKey, { tenantId });
          writeOfflineCache(cacheKey, nextState);
        }
      })
      .catch(() => {
        if (!cancelled) {
          const scopeIndex = readOfflineCache<{ tenantId: string }>(scopeIndexKey);
          const tenantId = scopeIndex?.data.tenantId;
          const cacheKey = tenantId
            ? `${userCachePrefix}data.${encodeURIComponent(tenantId)}.${encodeURIComponent(competitionId)}`
            : null;
          const cached = cacheKey
            ? readOfflineCache<{
                subject: string;
                tenantId: string;
                competitionId: string;
                roles: Role[];
                permissions?: Permission[];
              }>(cacheKey)
            : null;
          const validCache = cached?.data.subject === sessionSubject
            && cached.data.competitionId === competitionId
            && cached.data.tenantId === tenantId;
          const cachedRoles = validCache
            ? cached.data.roles?.filter((role): role is Role => VALID_ROLES.has(role as Role)) ?? []
            : [];
          setDbRoles({
            subject: sessionSubject,
            tenantId: tenantId ?? "",
            competitionId,
            roles: cachedRoles.length ? cachedRoles : ["TEILNEHMER"],
            permissions: [],
            fallback: cachedRoles.length > 0,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeCompetition?.id, competitionLoading, sessionEmail, sessionSubject, status]);

  const currentDbState =
    dbRoles?.subject === sessionSubject
    && dbRoles.competitionId === activeCompetition?.id
      ? dbRoles
      : null;
  const currentDbRoles = currentDbState?.roles ?? null;
  const roles: Role[] = currentDbState?.fallback && currentDbRoles?.length
    ? currentDbRoles
    : session?.user
    ? (currentDbRoles?.length ? currentDbRoles : ["TEILNEHMER"])
    : ["ZUSCHAUER"];
  const isLoading = !currentDbState?.fallback && (
    status === "loading"
    || competitionLoading
    || Boolean(session?.user && currentDbRoles === null)
  );
  
  const activeRole = simulatedRole || getHighestRole(roles);
  const isSimulating = simulatedRole !== null;
  
  const can = (permission: Permission): boolean => {
    // Bei Simulation: nur gegen simulierte Rolle prüfen
    if (isSimulating && simulatedRole) {
      return canCheck([simulatedRole], permission);
    }
    if (DYNAMIC_PERMISSIONS.has(permission) && !currentDbState?.fallback) {
      return currentDbState?.permissions?.includes(permission) ?? false;
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
