"use client";

import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/lib/theme-context";
import { usePermissions } from "@/lib/permissions-context";
import { useCompetition } from "@/lib/competition-context";
import { FIVE_KAMPF_BRAND } from "@/lib/brand-assets";
import NavBar from "./components/nav-bar";
import HomeScreen from "./components/home-screen";
import TeamScreen from "./components/team-screen";
import Dashboard from "./components/dashboard";
import LiveScreen from "./components/live-screen";
import BottomTabBar from "./components/bottom-tab-bar";

const MAIN_TABS = ["home", "registration", "dashboard", "orga", "live"] as const;
type MainTab = (typeof MAIN_TABS)[number];
type SwitchTabDetail = {
  tabId?: string;
  teamView?: string;
  ownerFilter?: string;
  dashboardScope?: string;
};

type OrgaSummary = {
  teamsTotal: number;
  participantsTotal: number;
  marketplaceRegistrations: number;
  pendingChanges: number;
  openClaimLinks: number;
};

function isMainTab(value: string | null): value is MainTab {
  return value !== null && MAIN_TABS.includes(value as MainTab);
}

function canAccessTab(
  tab: MainTab,
  options: {
    authenticated: boolean;
    canViewOwnTeams: boolean;
    canViewAllTeams: boolean;
    canEditResults: boolean;
  },
) {
  switch (tab) {
    case "home":
    case "live":
      return true;
    case "registration":
      return options.authenticated;
    case "dashboard":
      return options.canViewOwnTeams || options.canViewAllTeams;
    case "orga":
      return options.canViewAllTeams || options.canEditResults;
    default:
      return false;
  }
}

function getTabFromHash() {
  if (typeof window === "undefined") return null;
  const hashValue = window.location.hash.replace(/^#/, "");
  return isMainTab(hashValue) ? hashValue : null;
}

export default function Home() {
  const router = useRouter();
  const { status } = useSession();
  const { theme } = useTheme();
  const { can, isLoading: permissionsLoading } = usePermissions();
  const { active: activeCompetition } = useCompetition();
  const canViewOwnTeams = can("team.view.own");
  const canViewAllTeams = can("team.view.all");
  const canEditResults = can("results.edit");
  const canUseTimekeeping = can("timekeeping.use");
  const [orgaSummary, setOrgaSummary] = useState<OrgaSummary | null>(null);
  const [orgaSummaryLoading, setOrgaSummaryLoading] = useState(false);
  const pendingSwitchTabDetail = useRef<SwitchTabDetail | null>(null);
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
      const detail = (event as CustomEvent<SwitchTabDetail>).detail;
      const tabId = detail?.tabId ?? null;
      if (isMainTab(tabId)) {
        pendingSwitchTabDetail.current = detail;
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
    if (status === "loading" || permissionsLoading) return;

    if (
      canAccessTab(activeTab, {
        authenticated: status === "authenticated",
        canViewOwnTeams,
        canViewAllTeams,
        canEditResults,
      })
    ) {
      return;
    }

    window.sessionStorage.setItem("s5evo-active-tab", "home");
    if (window.location.pathname === "/" && window.location.hash) {
      window.history.replaceState(null, "", "/");
    }
    setActiveTab("home");
  }, [activeTab, canEditResults, canViewAllTeams, canViewOwnTeams, permissionsLoading, status]);

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

    const pendingDetail = pendingSwitchTabDetail.current?.tabId === activeTab
      ? pendingSwitchTabDetail.current
      : null;
    pendingSwitchTabDetail.current = null;

    window.dispatchEvent(new CustomEvent("switchTab", { detail: pendingDetail ?? { tabId: activeTab } }));
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "orga" || !(canViewAllTeams || canEditResults)) return;

    let cancelled = false;
    const loadSummary = async () => {
      setOrgaSummaryLoading(true);
      try {
        const params = new URLSearchParams();
        if (activeCompetition?.id) params.set("competitionId", activeCompetition.id);
        const response = await fetch(`/api/admin/orga-summary?${params}`);
        if (!response.ok) throw new Error("Summary failed");
        const data = await response.json();
        if (!cancelled) {
          setOrgaSummary(data.summary || null);
        }
      } catch {
        if (!cancelled) {
          setOrgaSummary(null);
        }
      } finally {
        if (!cancelled) {
          setOrgaSummaryLoading(false);
        }
      }
    };

    void loadSummary();
    return () => {
      cancelled = true;
    };
  }, [activeCompetition?.id, activeTab, canEditResults, canViewAllTeams]);

  const formatOrgaCount = (value?: number) => {
    if (orgaSummaryLoading) return "...";
    if (typeof value !== "number") return "—";
    return value.toLocaleString("de-DE");
  };

  return (
    <div className={`min-h-screen pb-24 lg:pb-0 ${
      theme === "bunt" ? "bunt-bg" :
      theme === "esv" ? "esv-bg" : ""
    }`}>
      <NavBar />
      
      <main className="mx-auto max-w-6xl px-2 py-3 sm:px-4 sm:py-4">
        {activeTab === "home" && <HomeScreen />}
            {activeTab === "registration" && <TeamScreen />}
            {activeTab === "dashboard" && <Dashboard />}
            {activeTab === "orga" && (canViewAllTeams || canEditResults) && (
              <div className="space-y-5">
                <div className="space-y-1">
                  <h2 className="text-xl font-semibold">⚙️ Orga-Bereich</h2>
                  <p className="text-sm text-muted-foreground">
                    Zentrale Werkzeuge für Wettkampfleitung, Support und Datenpflege.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button onClick={() => router.push('/teilnehmer')} className="p-4 rounded-md border border-border/40 shadow-sm bg-card hover:bg-accent transition-colors text-left space-y-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-lg">📋</span>
                      <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                        {formatOrgaCount(orgaSummary?.participantsTotal)}
                      </span>
                    </div>
                    <p className="font-medium text-sm">Teilnehmerübersicht</p>
                    <p className="text-xs text-muted-foreground">Eigenes Dashboard für Suche, Hinweise und Druckliste</p>
                  </button>
                  {canViewAllTeams && (
                    <button onClick={() => router.push('/sportlerboerse-dashboard')} className="p-4 rounded-md border border-border/40 shadow-sm bg-card hover:bg-accent transition-colors text-left space-y-1">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-lg">🧩</span>
                        <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                          {formatOrgaCount(orgaSummary?.marketplaceRegistrations)}
                        </span>
                      </div>
                      <p className="font-medium text-sm">Sportler-Börse</p>
                      <p className="text-xs text-muted-foreground">Einzelmeldungen prüfen, vermitteln und Status pflegen</p>
                    </button>
                  )}
                  {canViewAllTeams && (
                    <button onClick={() => router.push('/aenderungen')} className="p-4 rounded-md border border-border/40 shadow-sm bg-card hover:bg-accent transition-colors text-left space-y-1">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-lg">📝</span>
                        <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                          {formatOrgaCount(orgaSummary?.pendingChanges)}
                        </span>
                      </div>
                      <p className="font-medium text-sm">Änderungen</p>
                      <p className="text-xs text-muted-foreground">Anträge prüfen, freigeben oder ablehnen</p>
                    </button>
                  )}
                  {canViewAllTeams && (
                    <button onClick={() => router.push('/claim-links')} className="p-4 rounded-md border border-border/40 shadow-sm bg-card hover:bg-accent transition-colors text-left space-y-1">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-lg">🔐</span>
                        <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                          {formatOrgaCount(orgaSummary?.openClaimLinks)}
                        </span>
                      </div>
                      <p className="font-medium text-sm">Claim-Links</p>
                      <p className="text-xs text-muted-foreground">Übernahmelinks erzeugen und Supportfälle klären</p>
                    </button>
                  )}
                  {canUseTimekeeping && (
                    <button onClick={() => router.push('/zeitnahme')} className="p-4 rounded-md border border-border/40 shadow-sm bg-card hover:bg-accent transition-colors text-left space-y-1">
                      <span className="text-lg">⏱️</span>
                      <p className="font-medium text-sm">Zeitnahme</p>
                      <p className="text-xs text-muted-foreground">Offline-Stoppuhr, Rohzeiten und Sync-Status</p>
                    </button>
                  )}
                  {can("config.edit") && (
                    <button onClick={() => router.push('/admin/ergebnisse')} className="overflow-hidden rounded-md border border-border/40 bg-card text-left shadow-sm transition-colors hover:bg-accent">
                      <div className="relative h-24">
                        <Image
                          src={FIVE_KAMPF_BRAND.banner}
                          alt=""
                          fill
                          sizes="(min-width: 640px) 50vw, 100vw"
                          className="object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-black/68 via-black/38 to-transparent" />
                        <div className="absolute inset-x-0 bottom-0 p-3 text-white">
                          <p className="text-sm font-semibold">Ergebnisdaten</p>
                          <p className="mt-0.5 text-xs text-white/80">Pakete prüfen, Uhr-Sync übernehmen und Staging kontrollieren</p>
                        </div>
                      </div>
                    </button>
                  )}
                  {can("config.edit") && (
                    <>
                      <button onClick={() => router.push("/admin?tab=competition")} className="p-4 rounded-md border border-border/40 shadow-sm bg-card hover:bg-accent transition-colors text-left space-y-1">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-lg">🏢</span>
                          <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                            {formatOrgaCount(orgaSummary?.teamsTotal)}
                          </span>
                        </div>
                        <p className="font-medium text-sm">Tenant & Wettkampf</p>
                        <p className="text-xs text-muted-foreground">Mandant, aktiver Wettkampf, Anmeldung und Regeln konfigurieren</p>
                      </button>
                      <button onClick={() => router.push("/admin?tab=users")} className="p-4 rounded-md border border-border/40 shadow-sm bg-card hover:bg-accent transition-colors text-left space-y-1">
                        <span className="text-lg">👥</span>
                        <p className="font-medium text-sm">Benutzer</p>
                        <p className="text-xs text-muted-foreground">Konten, Rollen und Team-Manager-Rechte verwalten</p>
                      </button>
                      <button onClick={() => router.push("/admin?tab=audits")} className="p-4 rounded-md border border-border/40 shadow-sm bg-card hover:bg-accent transition-colors text-left space-y-1">
                        <span className="text-lg">🧾</span>
                        <p className="font-medium text-sm">Audits</p>
                        <p className="text-xs text-muted-foreground">Logs, Mail-Protokoll, Claim-Auffälligkeiten und Betriebsprüfung</p>
                      </button>
                    </>
                  )}
                  <button onClick={() => router.push('/orga-links')} className="p-4 rounded-md border border-border/40 shadow-sm bg-card hover:bg-accent transition-colors text-left space-y-1">
                    <span className="text-lg">🗂️</span>
                    <p className="font-medium text-sm">Orga-Links</p>
                    <p className="text-xs text-muted-foreground">Geparkte Technik- und Referenzseiten gesammelt an einem Ort</p>
                  </button>
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
