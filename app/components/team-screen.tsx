"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/lib/permissions-context";
import Dashboard from "./dashboard";
import TeamRegistration from "./team-registration";

type TeamView = "my-teams" | "register" | "watchlist";

export default function TeamScreen() {
  const { data: session } = useSession();
  const { can, activeRole } = usePermissions();
  const [view, setView] = useState<TeamView>("register");

  if (!session?.user) return null;

  // Zuschauer:in sieht nur Watchlist/Anmelde-CTA
  if (activeRole === "ZUSCHAUER") {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 py-4">
        <div className="text-center space-y-4 py-8">
          <span className="text-5xl">👀</span>
          <h2 className="text-xl font-semibold">Watchlist</h2>
          <p className="text-muted-foreground text-sm max-w-xs mx-auto">
            Hier kannst du bald deine Lieblingsmannschaften verfolgen.
          </p>
          {can("team.create") && (
            <Button onClick={() => setView("register")} className="mt-4">
              📋 Mannschaft anmelden
            </Button>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {/* Sub-Navigation */}
      <div className="flex items-center gap-1 bg-muted/30 rounded-md p-0.5 w-fit">
        {can("team.create") && (
          <button
            onClick={() => setView("register")}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              view === "register" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            📋 Anmelden
          </button>
        )}
        <button
          onClick={() => setView("my-teams")}
          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
            view === "my-teams" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          📊 Meine Teams
        </button>
        <button
          onClick={() => setView("watchlist")}
          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
            view === "watchlist" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          👀 Watchlist
        </button>
      </div>

      {/* Content */}
      {view === "my-teams" && <Dashboard ownerFilter={session.user.email || undefined} />}
      {view === "register" && <TeamRegistration />}
      {view === "watchlist" && (
        <div className="text-center space-y-4 py-8">
          <span className="text-5xl">👀</span>
          <h2 className="text-lg font-semibold">Watchlist</h2>
          <p className="text-muted-foreground text-sm max-w-xs mx-auto">
            Hier kannst du bald Lieblingsmannschaften hinzufügen und deren Ergebnisse verfolgen.
          </p>
        </div>
      )}
    </motion.div>
  );
}
