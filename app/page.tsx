"use client";

import { useSession, signIn } from "next-auth/react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import NavBar from "./components/nav-bar";
import ThemeSwitcher from "./components/theme-switcher";
import TeamRegistration from "./components/team-registration";
import SysAdminView from "./components/sysadmin-view";

type Theme = "light" | "dark" | "psychedelic" | "sysadmin";

export default function Home() {
  const { data: session, status } = useSession();
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    // Set dark class for shadcn
    if (theme === "dark" || theme === "sysadmin" || theme === "psychedelic") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  return (
    <div className={`min-h-screen transition-all duration-500 ${
      theme === "psychedelic" ? "psychedelic-bg" :
      theme === "sysadmin" ? "sysadmin-bg" : ""
    }`}>
      <NavBar />

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-3"
        >
          <h1 className={`text-4xl font-bold tracking-tight ${
            theme === "psychedelic" ? "psychedelic-text" :
            theme === "sysadmin" ? "font-mono text-[#00ff88]" : ""
          }`}>
            {theme === "sysadmin" ? "S5EVO // MISSION CONTROL" : "🏅 S5Evo Portal"}
          </h1>
          <p className={`text-muted-foreground ${
            theme === "sysadmin" ? "font-mono text-[#64748b]" : ""
          }`}>
            {theme === "sysadmin"
              ? "Infrastructure Status • Fleet Overview • Live Monitoring"
              : "Mannschaftsfünfkampf – Anmeldung & Verwaltung"}
          </p>
        </motion.div>

        {/* Theme Switcher */}
        <ThemeSwitcher theme={theme} setTheme={setTheme} />

        {/* Sys-Admin Mode */}
        {theme === "sysadmin" ? (
          <SysAdminView />
        ) : (
          <>
            {/* Login Card */}
            {status === "unauthenticated" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <Card className={theme === "psychedelic" ? "psychedelic-card" : ""}>
                  <CardHeader>
                    <CardTitle>Willkommen beim Fünfkampf! 🏆</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-muted-foreground">
                      Melde dich an, um deine Mannschaft zu registrieren.
                    </p>
                    <Button
                      size="lg"
                      onClick={() => signIn("authentik")}
                      className={`w-full ${theme === "psychedelic" ? "psychedelic-btn" : ""}`}
                    >
                      🔐 Mit Authentik anmelden
                    </Button>
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

            {/* Authenticated: Tabs */}
            {status === "authenticated" && session?.user && (
              <Tabs defaultValue="registration" className="space-y-6">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="registration">📋 Anmeldung</TabsTrigger>
                  <TabsTrigger value="dashboard">📊 Dashboard</TabsTrigger>
                </TabsList>

                <TabsContent value="registration">
                  <TeamRegistration />
                </TabsContent>

                <TabsContent value="dashboard">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <Card className={theme === "psychedelic" ? "psychedelic-card" : ""}>
                      <CardHeader>
                        <CardTitle>📊 Dashboard</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-muted-foreground">
                          Hier siehst du bald deine angemeldeten Mannschaften, Teilnehmer und den Wettbewerbsstatus.
                        </p>
                        <div className="grid grid-cols-3 gap-4 mt-6">
                          <div className="text-center p-4 bg-muted rounded-lg">
                            <p className="text-3xl font-bold">0</p>
                            <p className="text-xs text-muted-foreground mt-1">Teams</p>
                          </div>
                          <div className="text-center p-4 bg-muted rounded-lg">
                            <p className="text-3xl font-bold">0</p>
                            <p className="text-xs text-muted-foreground mt-1">Teilnehmer</p>
                          </div>
                          <div className="text-center p-4 bg-muted rounded-lg">
                            <p className="text-3xl font-bold">5</p>
                            <p className="text-xs text-muted-foreground mt-1">Disziplinen</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </TabsContent>
              </Tabs>
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
            <span className="font-mono">S5EVO INFRA v0.1 • {new Date().toISOString()}</span>
          ) : (
            <span>S5Evo Portal v0.1 • Mannschaftsfünfkampf • Built with ❤️</span>
          )}
        </motion.footer>
      </main>
    </div>
  );
}
