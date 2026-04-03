"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useTheme } from "@/lib/theme-context";
import { usePermissions } from "@/lib/permissions-context";
import NavBar from "./components/nav-bar";
import HomeScreen from "./components/home-screen";
import TeamScreen from "./components/team-screen";
import Dashboard from "./components/dashboard";
import LiveScreen from "./components/live-screen";
import BottomTabBar from "./components/bottom-tab-bar";
import ApprovalQueue from "./components/approval-queue";
import UserManagement from "./components/user-management";

export default function Home() {
  const { status } = useSession();
  const { theme } = useTheme();
  const { can } = usePermissions();
  const [activeTab, setActiveTab] = useState("home");

  // Listen for tab switch events (from sidebar, bottom bar, etc.)
  useEffect(() => {
    const handler = (e: CustomEvent) => setActiveTab(e.detail.tabId);
    window.addEventListener("switchTab" as any, handler);
    return () => window.removeEventListener("switchTab" as any, handler);
  }, []);

  // Profile tab → navigate to /profile
  useEffect(() => {
    if (activeTab === "profile") {
      window.location.href = "/profile";
    }
  }, [activeTab]);

  return (
    <div className={`min-h-screen pb-16 lg:pb-0 ${
      theme === "bunt" ? "bunt-bg" :
      theme === "esv" ? "esv-bg" : ""
    }`}>
      <NavBar />
      
      <main className="max-w-5xl mx-auto px-4 py-4">
        {activeTab === "home" && <HomeScreen />}
            {activeTab === "registration" && <TeamScreen />}
            {activeTab === "dashboard" && <Dashboard />}
            {activeTab === "orga" && (can("team.view.all") || can("results.edit")) && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold">⚙️ Orga-Bereich</h2>
                
                {/* Approval Queue */}
                <ApprovalQueue />

                {/* User Management — nur für Admins */}
                {can("config.edit") && <UserManagement />}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {can("team.view.all") && (
                    <button onClick={() => setActiveTab("dashboard")} className="p-4 rounded-md border border-border/40 shadow-sm bg-card hover:bg-accent transition-colors text-left space-y-1">
                      <span className="text-lg">👥</span>
                      <p className="font-medium text-sm">Alle Teams</p>
                      <p className="text-xs text-muted-foreground">Teams verwalten & bearbeiten</p>
                    </button>
                  )}
                  {can("results.edit") && (
                    <button className="p-4 rounded-md border border-border/40 shadow-sm bg-card hover:bg-accent transition-colors text-left space-y-1 opacity-60">
                      <span className="text-lg">✏️</span>
                      <p className="font-medium text-sm">Ergebnis-Erfassung</p>
                      <p className="text-xs text-muted-foreground">Demnächst verfügbar</p>
                    </button>
                  )}
                  {can("config.edit") && (
                    <button onClick={() => window.location.href = "/admin"} className="p-4 rounded-md border border-border/40 shadow-sm bg-card hover:bg-accent transition-colors text-left space-y-1">
                      <span className="text-lg">🏢</span>
                      <p className="font-medium text-sm">Administration</p>
                      <p className="text-xs text-muted-foreground">Tenant & Wettkampf konfigurieren</p>
                    </button>
                  )}
                  <button onClick={() => window.open("/architecture", "_blank")} className="p-4 rounded-md border border-border/40 shadow-sm bg-card hover:bg-accent transition-colors text-left space-y-1">
                    <span className="text-lg">🔗</span>
                    <p className="font-medium text-sm">Referenzarchitektur</p>
                    <p className="text-xs text-muted-foreground">Technische Übersicht</p>
                  </button>
                  <button onClick={() => window.location.href = '/tech'} className="p-4 rounded-md border border-border/40 shadow-sm bg-card hover:bg-accent transition-colors text-left space-y-1">
                    <span className="text-lg">🖥️</span>
                    <p className="font-medium text-sm">Infrastruktur</p>
                    <p className="text-xs text-muted-foreground">System-Übersicht</p>
                  </button>
                </div>
              </div>
            )}
            {activeTab === "live" && <LiveScreen />}
      </main>

      {/* Bottom Tab Bar - only mobile */}
      <div className="lg:hidden">
        <BottomTabBar activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    </div>
  );
}