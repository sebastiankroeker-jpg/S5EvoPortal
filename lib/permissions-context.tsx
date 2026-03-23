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
  
  // TODO: Später aus DB laden über API (TenantRole)
  // Für jetzt: Eingeloggte User = ZUSCHAUER (Default)
  // TEAMCHEF wird automatisch wenn man ein Team anmeldet
  // ADMIN nur für Authentik-User in der Admin-Gruppe (später aus DB)
  // Zum Testen: Default ADMIN damit Role-Switcher funktioniert
  const roles: Role[] = session?.user ? ["ADMIN"] : ["ZUSCHAUER"];
  
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