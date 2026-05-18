"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useSession } from "next-auth/react";
import { Role, Permission, can as canCheck, getHighestRole } from "./permissions";

interface PermissionsContextType {
  roles: Role[];
  activeRole: Role;
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
  const { data: session } = useSession();
  const [simulatedRole, setSimulatedRole] = useState<Role | null>(null);
  
  // Rollen aus der DB laden
  const [dbRoles, setDbRoles] = useState<Role[] | null>(null);

  useEffect(() => {
    if (!session?.user) return;

    let cancelled = false;

    fetch("/api/profile/roles")
      .then(res => res.ok ? res.json() : { roles: [] })
      .then(data => {
        if (!cancelled) {
          setDbRoles(data.roles?.length ? data.roles : ["TEILNEHMER"]);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDbRoles(["TEILNEHMER"]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session?.user]);

  const roles: Role[] = session?.user
    ? (dbRoles?.length ? dbRoles : ["TEILNEHMER"])
    : ["ZUSCHAUER"];
  
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
