"use client";

import { useSession, signIn } from "next-auth/react";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import NavBar from "./components/nav-bar";
import TeamRegistration from "./components/team-registration";
import SysAdminView from "./components/sysadmin-view";
import ESVHero from "./components/esv-hero";
import Dashboard from "./components/dashboard";
import { usePermissions } from "@/lib/permissions-context";
import { useTheme } from "@/lib/theme-context";
import { APP_VERSION } from "@/lib/version";

export default function Home() {
  const { data: session, status } = useSession();
  const { can, activeRole } = usePermissions();
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState("registration");

  // Listen for command pill tab switches
  useEffect(() => {
    const handleTabSwitch = (event: CustomEvent) => {
      setActiveTab(event.detail.tabId);
    };

    window.addEventListener("switchTab" as any, handleTabSwitch);
    return () => window.removeEventListener("switchTab" as any, handleTabSwitch);
  }, []);

  // Determine available tabs based on permissions
  const canCreateTeam = can("team.create");
  const canViewDashboard = can("team.view.own") || can("team.view.all");

  // Default tab logic
  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      if (!canCreateTeam && canViewDashboard) {
        setActiveTab("dashboard");
      } else if (canCreateTeam && !canViewDashboard) {
        setActiveTab("registration");
      }
    }
  }, [status, canCreateTeam, canViewDashboard, session]);

  return (
    <div className={`min-h-screen transition-all duration-500 ${
      theme === "bunt" ? "bunt-bg" :
      theme === "sysadmin" ? "sysadmin-bg" :
      theme === "esv" ? "esv-bg" : ""
    }`}>
      <NavBar />

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Sys-Admin Mode */}
        {theme === "sysadmin" ? (
          <SysAdminView />
        ) : theme === "esv" && status === "unauthenticated" ? (
          <ESVHero />
        ) : (
          <>
            {/* Login Card */}
            {status === "unauthenticated" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <Card className={theme === "bunt" ? "bunt-card" : ""}>
                  <CardHeader>
                    <CardTitle>Willkommen beim Fünfkampf! 🏆</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-muted-foreground">
                      Melde dich an oder erstelle einen neuen Account für die Mannschaftsanmeldung.
                    </p>
                    <div className="space-y-3">
                      <Button
                        size="lg"
                        onClick={() => signIn("authentik")}
                        className={`w-full ${theme === "bunt" ? "bunt-btn" : ""}`}
                      >
                        🔐 Anmelden (vorhandener Account)
                      </Button>
                      <Button
                        size="lg"
                        variant="outline"
                        onClick={() => window.location.href = 'https://auth.s5evo.de/if/flow/s5-evo-registration/'}
                        className="w-full"
                      >
                        📝 Neuen Account erstellen
                      </Button>
                      <div className="text-xs text-center text-muted-foreground">
                        <p>Direkt zu <a href="https://auth.s5evo.de" className="text-primary hover:underline">auth.s5evo.de</a> für Login</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Loading */}
            {status === "loading" && (
              <Card>
                <CardContent className="p-8 text-center">
                  <div className="animate-spin inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
                  <p className="mt-4 text-muted-foreground">Lade...</p>
                </CardContent>
              </Card>
            )}

            {/* Authenticated: Role-based content */}
            {status === "authenticated" && session?.user && (
              <>
                {/* Zuschauer-Modus */}
                {activeRole === "ZUSCHAUER" && (
                  <Card>
                    <CardHeader>
                      <CardTitle>🏆 Zuschauer-Bereich</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground">
                        Ergebnisse werden hier angezeigt sobald der Wettkampf läuft.
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Tabs für berechtigte User */}
                {(canCreateTeam || canViewDashboard) && (
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                    <TabsList className={`grid w-full ${
                      canCreateTeam && canViewDashboard ? "grid-cols-2" :
                      "grid-cols-1"
                    }`}>
                      {canCreateTeam && (
                        <TabsTrigger value="registration">📋 Anmeldung</TabsTrigger>
                      )}
                      {canViewDashboard && (
                        <TabsTrigger value="dashboard">📊 Dashboard</TabsTrigger>
                      )}
                    </TabsList>

                    {canCreateTeam && (
                      <TabsContent value="registration">
                        <TeamRegistration />
                      </TabsContent>
                    )}

                    {canViewDashboard && (
                      <TabsContent value="dashboard">
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                        >
                          <Dashboard />
                        </motion.div>
                      </TabsContent>
                    )}
                  </Tabs>
                )}
              </>
            )}
          </>
        )}

        {/* Footer */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="text-center py-8 text-xs text-muted-foreground"
        >
          {theme === "sysadmin" ? (
            <span className="font-mono">S5EVO INFRA {APP_VERSION} • {new Date().toISOString()}</span>
          ) : (
            <span>S5Evo Portal <a href="/changelog" className="hover:underline text-primary">{APP_VERSION}</a> • Mannschaftsfünfkampf • Built with ❤️</span>
          )}
        </motion.footer>
      </main>
    </div>
  );
}