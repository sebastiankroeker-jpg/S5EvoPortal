"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePermissions } from "@/lib/permissions-context";
import { getSimulatableRoles, getHighestRole } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, X, Microscope } from "lucide-react";

const ROLE_LABELS = {
  ADMIN: "Admin",
  MODERATOR: "Moderator",
  TEAMCHEF: "Teamchef",
  TEILNEHMER: "Teilnehmer",
  ZUSCHAUER: "Zuschauer",
};

const ROLE_COLORS = {
  ADMIN: "bg-red-500/10 text-red-700 border-red-200 dark:text-red-300 dark:border-red-800",
  MODERATOR: "bg-orange-500/10 text-orange-700 border-orange-200 dark:text-orange-300 dark:border-orange-800",
  TEAMCHEF: "bg-blue-500/10 text-blue-700 border-blue-200 dark:text-blue-300 dark:border-blue-800",
  TEILNEHMER: "bg-green-500/10 text-green-700 border-green-200 dark:text-green-300 dark:border-green-800",
  ZUSCHAUER: "bg-gray-500/10 text-gray-700 border-gray-200 dark:text-gray-300 dark:border-gray-800",
};

export default function RoleSwitcher() {
  const { roles, activeRole, simulatedRole, setSimulatedRole, isSimulating } = usePermissions();
  const [isOpen, setIsOpen] = useState(false);

  // Nur zeigen wenn echte Rolle mindestens TEAMCHEF ist
  const realHighestRole = getHighestRole(roles);
  if (realHighestRole === "TEILNEHMER" || realHighestRole === "ZUSCHAUER") {
    return null;
  }

  const simulatableRoles = getSimulatableRoles(realHighestRole);

  const handleRoleSelect = (role: typeof activeRole) => {
    setSimulatedRole(role);
    setIsOpen(false);
  };

  const resetSimulation = () => {
    setSimulatedRole(null);
  };

  return (
    <>
      {/* Simulation Banner */}
      <AnimatePresence>
        {isSimulating && (
          <motion.div
            className="fixed top-16 left-0 right-0 z-40 bg-amber-500/10 border-b border-amber-200 dark:border-amber-800"
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
          >
            <div className="container mx-auto px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                <Microscope className="h-4 w-4" />
                <span className="text-sm font-medium">
                  Du siehst die App als: {ROLE_LABELS[activeRole]}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetSimulation}
                className="h-6 px-2 text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100"
              >
                <X className="h-3 w-3" />
                <span className="ml-1 text-xs">Reset</span>
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Role Switcher */}
      <div className="fixed top-16 right-4 z-30">
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsOpen(!isOpen)}
            className={`h-8 px-2 text-xs ${ROLE_COLORS[activeRole]} gap-1`}
          >
            <span>{ROLE_LABELS[activeRole]}</span>
            <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </Button>

          <AnimatePresence>
            {isOpen && (
              <motion.div
                className="absolute top-full right-0 mt-1 w-36 bg-popover border border-border rounded-md shadow-lg py-1"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {/* Reset Option (if simulating) */}
                {isSimulating && (
                  <>
                    <button
                      className="w-full px-3 py-2 text-left text-xs hover:bg-accent transition-colors flex items-center gap-2"
                      onClick={resetSimulation}
                    >
                      <X className="h-3 w-3" />
                      <span>Reset</span>
                      <Badge variant="outline" className="ml-auto text-[10px] px-1">
                        Echt
                      </Badge>
                    </button>
                    <div className="h-px bg-border mx-1 my-1" />
                  </>
                )}

                {/* Real Role (if simulating) */}
                {isSimulating && (
                  <button
                    className="w-full px-3 py-2 text-left text-xs hover:bg-accent transition-colors"
                    onClick={() => handleRoleSelect(realHighestRole)}
                  >
                    {ROLE_LABELS[realHighestRole]}
                    <Badge variant="outline" className="ml-2 text-[10px] px-1">
                      Echt
                    </Badge>
                  </button>
                )}

                {/* Simulatable Roles */}
                {simulatableRoles.map((role) => (
                  <button
                    key={role}
                    className="w-full px-3 py-2 text-left text-xs hover:bg-accent transition-colors"
                    onClick={() => handleRoleSelect(role)}
                  >
                    {ROLE_LABELS[role]}
                    {simulatedRole === role && (
                      <Badge variant="outline" className="ml-2 text-[10px] px-1">
                        Aktiv
                      </Badge>
                    )}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}