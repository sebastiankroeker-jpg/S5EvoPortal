"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/lib/theme-context";
import { usePermissions } from "@/lib/permissions-context";
import NavBar from "./components/nav-bar";
import HomeScreen from "./components/home-screen";
import TeamScreen from "./components/team-screen";
import Dashboard from "./components/dashboard";
import LiveScreen from "./components/live-screen";
import BottomTabBar from "./components/bottom-tab-bar";
import ApprovalQueue from "./components/approval-queue";
import ParticipantList from "./components/participant-list";

const MAIN_TABS = ["home", "registration", "dashboard", "orga", "live"] as const;
type MainTab = (typeof MAIN_TABS)[number];

function isMainTab(value: string | null): value is MainTab {
  return value !== null && MAIN_TABS.includes(value as MainTab);
}

function getTabFromHash() {
  if (typeof window === "undefined") return null;
  const hashValue = window.location.hash.replace(/^#/, "");
  return isMainTab(hashValue) ? hashValue : null;
}

export default function Home() {
  const router = useRouter();
  const { theme } = useTheme();
  const { can } = usePermissions();
  const [activeTab, setActiveTab] = useState<MainTab>(() => {
    if (typeof window === "undefined") return "home";

    const initialTab = getTabFromHash();
    if (initialTab) return initialTab;

    const storedTab = window.sessionStorage.getItem("s5evo-active-tab");
    return isMainTab(storedTab) ? storedTab : "home";
  });

  // Listen for tab switch events (from sidebar, bottom bar, etc.)
  useEffect(() => {
    const handler = (event: Event) => {
      const tabId = (event as CustomEvent<{ tabId?: string }>).detail?.tabId ?? null;
      if (isMainTab(tabId)) {
        setActiveTab(tabId);
      }
    };
    const handleHashChange = () => {
      const nextTab = getTabFromHash();
      setActiveTab(nextTab ?? "home");
    };

    window.addEventListener("switchTab", handler as EventListener);
    window.addEventListener("hashchange", handleHashChange);
    return () => {
      window.removeEventListener("switchTab", handler as EventListener);
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem("s5evo-active-tab", activeTab);
    if (window.location.pathname !== "/") return;

    const nextHash = activeTab === "home" ? "" : `#${activeTab}`;
    const nextUrl = nextHash ? `/${nextHash}` : "/";
    const currentUrl = `${window.location.pathname}${window.location.hash}`;
    if (currentUrl !== nextUrl) {
      window.history.replaceState(null, "", nextUrl);
    }

    window.dispatchEvent(new CustomEvent("switchTab", { detail: { tabId: activeTab } }));
  }, [activeTab]);

  return (
    <div className={`min-h-screen pb-24 lg:pb-0 ${
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

                {/* Quick-Actions — oben, immer sichtbar */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {can("team.view.all") && (
                    <button onClick={() => setActiveTab("dashboard")} className="p-4 rounded-md border border-border/40 shadow-sm bg-card hover:bg-accent transition-colors text-left space-y-1">
                      <span className="text-lg">👥</span>
                      <p className="font-medium text-sm">Alle Teams</p>
                      <p className="text-xs text-muted-foreground">Teams verwalten & bearbeiten</p>
                    </button>
                  )}
                  <button onClick={() => { const el = document.getElementById('participant-list'); el?.scrollIntoView({ behavior: 'smooth' }); }} className="p-4 rounded-md border border-border/40 shadow-sm bg-card hover:bg-accent transition-colors text-left space-y-1">
                    <span className="text-lg">📋</span>
                    <p className="font-medium text-sm">Teilnehmerübersicht</p>
                    <p className="text-xs text-muted-foreground">Alle Teilnehmer suchen & bearbeiten</p>
                  </button>
                  {can("team.view.all") && (
                    <button onClick={() => router.push('/aenderungen')} className="p-4 rounded-md border border-border/40 shadow-sm bg-card hover:bg-accent transition-colors text-left space-y-1">
                      <span className="text-lg">📝</span>
                      <p className="font-medium text-sm">Aenderungen</p>
                      <p className="text-xs text-muted-foreground">Offene Antraege pruefen & freigeben</p>
                    </button>
                  )}
                  {can("team.view.all") && (
                    <button onClick={() => router.push('/claim-links')} className="p-4 rounded-md border border-border/40 shadow-sm bg-card hover:bg-accent transition-colors text-left space-y-1">
                      <span className="text-lg">🔐</span>
                      <p className="font-medium text-sm">Claim-Links</p>
                      <p className="text-xs text-muted-foreground">Uebernahmelinks erzeugen & verwalten</p>
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
                    <button onClick={() => router.push("/admin")} className="p-4 rounded-md border border-border/40 shadow-sm bg-card hover:bg-accent transition-colors text-left space-y-1">
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
                  <button onClick={() => router.push('/tech')} className="p-4 rounded-md border border-border/40 shadow-sm bg-card hover:bg-accent transition-colors text-left space-y-1">
                    <span className="text-lg">🖥️</span>
                    <p className="font-medium text-sm">Infrastruktur</p>
                    <p className="text-xs text-muted-foreground">System-Übersicht</p>
                  </button>
                </div>

                {/* Approval Queue */}
                <ApprovalQueue variant="embedded" />
                {/* Teilnehmerübersicht */}
                <div id="participant-list">
                  <ParticipantList />
                </div>
              </div>
            )}
            {activeTab === "live" && <LiveScreen />}
      </main>

      {/* Bottom Tab Bar - only mobile */}
      <div className="lg:hidden">
        <BottomTabBar
          activeTab={activeTab}
          onTabChange={(tabId) => {
            if (isMainTab(tabId)) {
              setActiveTab(tabId);
            }
          }}
        />
      </div>
    </div>
  );
}
