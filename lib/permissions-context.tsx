"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useSession } from "next-auth/react";
import { Role, Permission, can as canCheck, getHighestRole } from "./permissions";

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

interface PermissionsProviderProps {
  children: ReactNode;
}

export function PermissionsProvider({ children }: PermissionsProviderProps) {
  const { data: session, status } = useSession();
  const [simulatedRole, setSimulatedRole] = useState<Role | null>(null);
  const sessionEmail = session?.user?.email ?? null;
  
  // Rollen aus der DB laden
  const [dbRoles, setDbRoles] = useState<{ email: string | null; roles: Role[] } | null>(null);

  useEffect(() => {
    if (!sessionEmail) {
      return;
    }

    let cancelled = false;

    fetch("/api/profile/roles")
      .then(res => res.ok ? res.json() : { roles: [] })
      .then(data => {
        if (!cancelled) {
          setDbRoles({ email: sessionEmail, roles: data.roles?.length ? data.roles : ["TEILNEHMER"] });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDbRoles({ email: sessionEmail, roles: ["TEILNEHMER"] });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sessionEmail]);

  const currentDbRoles = dbRoles?.email === sessionEmail ? dbRoles.roles : null;
  const roles: Role[] = session?.user
    ? (currentDbRoles?.length ? currentDbRoles : ["TEILNEHMER"])
    : ["ZUSCHAUER"];
  const isLoading = status === "loading" || Boolean(session?.user && currentDbRoles === null);
  
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
