"use client";

import { motion, AnimatePresence } from "framer-motion";
import { usePermissions } from "@/lib/permissions-context";
import { Button } from "@/components/ui/button";
import { Microscope, X } from "lucide-react";

const ROLE_LABELS = {
  ADMIN: "Admin",
  MODERATOR: "Moderator:in",
  TEAMCHEF: "Teamchef:in",
  TEILNEHMER: "Teilnehmer:in",
  ZUSCHAUER: "Zuschauer:in",
};

export default function RoleSimulationBanner() {
  const { activeRole, isSimulating, setSimulatedRole } = usePermissions();

  if (!isSimulating) return null;

  const resetSimulation = () => {
    setSimulatedRole(null);
  };

  return (
    <AnimatePresence>
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
    </AnimatePresence>
  );
}