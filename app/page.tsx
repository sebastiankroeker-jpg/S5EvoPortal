"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useTheme } from "@/lib/theme-context";
import { usePermissions } from "@/lib/permissions-context";
import NavBar from "./components/nav-bar";
import HomeScreen from "./components/home-screen";
import TeamRegistration from "./components/team-registration";
import Dashboard from "./components/dashboard";
import LivePlaceholder from "./components/live-placeholder";
import SysAdminView from "./components/sysadmin-view";
import BottomTabBar from "./components/bottom-tab-bar";

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
      theme === "sysadmin" ? "sysadmin-bg" :
      theme === "esv" ? "esv-bg" : ""
    }`}>
      <NavBar />
      
      <main className="max-w-5xl mx-auto px-4 py-4">
        {theme === "sysadmin" ? (
          <SysAdminView />
        ) : (
          <>
            {activeTab === "home" && <HomeScreen />}
            {activeTab === "registration" && can("team.create") && <TeamRegistration />}
            {activeTab === "dashboard" && <Dashboard />}
            {activeTab === "live" && <LivePlaceholder />}
          </>
        )}
      </main>

      {/* Bottom Tab Bar - only mobile */}
      <div className="lg:hidden">
        <BottomTabBar activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    </div>
  );
}