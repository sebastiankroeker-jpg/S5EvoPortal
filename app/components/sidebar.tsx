"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { fullSignOut } from "@/lib/auth-helpers";
import { usePermissions } from "@/lib/permissions-context";
import { useTheme, type Theme } from "@/lib/theme-context";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Search, Sparkles } from "lucide-react";
import SearchOverlay from "./search-overlay";
import { getPermittedNavigationMenuItems, groupPermittedNavigationMenuItems, type NavigationMenuItem } from "@/lib/navigation-menu";
import { usePrivacyConsent } from "@/lib/privacy-consent-context";
import { FIVE_KAMPF_BRAND } from "@/lib/brand-assets";

const MAIN_TABS = ["home", "registration", "dashboard", "orga", "live"] as const;
type MainTab = (typeof MAIN_TABS)[number];
const THEME_OPTIONS: Array<{ id: Theme; icon: string; label: string }> = [
  { id: "light", icon: "☀️", label: "Light" },
  { id: "dark", icon: "🌙", label: "Dark" },
  { id: "esv", icon: "🏔️", label: "ESV" },
  { id: "bunt", icon: "🎨", label: "Bunt" },
];

function isMainTab(value: string | null): value is MainTab {
  return value !== null && MAIN_TABS.includes(value as MainTab);
}

function getTabFromHash() {
  if (typeof window === "undefined") return null;
  const hashValue = window.location.hash.replace(/^#/, "");
  return isMainTab(hashValue) ? hashValue : null;
}

function SidebarItem({ icon, label, onClick, isActive, sidebarCollapsed }: {
  icon: string; label: string; onClick: () => void; isActive?: boolean; sidebarCollapsed: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors hover:bg-accent ${
        isActive
          ? "bg-primary/10 text-primary font-medium shadow-sm ring-1 ring-primary/20 dark:bg-primary/20"
          : "text-muted-foreground"
      } ${sidebarCollapsed ? "justify-center" : ""}`}
      title={sidebarCollapsed ? label : undefined}
      aria-current={isActive ? "page" : undefined}
    >
      {isActive && !sidebarCollapsed && (
        <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary" />
      )}
      <span className="text-sm shrink-0">{icon}</span>
      {!sidebarCollapsed && <span className="truncate">{label}</span>}
    </button>
  );
}

function SectionLabel({ label, sidebarCollapsed }: { label: string; sidebarCollapsed: boolean }) {
  if (sidebarCollapsed) return <div className="h-px bg-border mx-1 my-1" />;
  return (
    <div className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider px-2 pt-2 pb-0.5">
      {label}
    </div>
  );
}

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const { can, roles } = usePermissions();
  const { hasConsent } = usePrivacyConsent();
  const { theme, setTheme, sparkleEnabled, toggleSparkle } = useTheme();
  const functionalStorageAllowed = hasConsent("FUNCTIONAL_STORAGE");
  const [storedSidebarCollapsed, setStoredSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    const rawConsent = window.localStorage.getItem("s5evo-privacy-consent-v1");
    const consentAllowsFunctional = rawConsent?.includes("\"FUNCTIONAL_STORAGE\":true") ?? false;
    if (!consentAllowsFunctional) return false;

    try {
      const saved = window.localStorage.getItem("sidebar-collapsed");
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });
  const [searchOpen, setSearchOpen] = useState(false);
  const [adminTab, setAdminTab] = useState(() => {
    if (typeof window === "undefined") return "tenant";
    return new URLSearchParams(window.location.search).get("tab") || "tenant";
  });
  const [activeTab, setActiveTab] = useState<MainTab>(() => {
    if (typeof window === "undefined") return "home";

    const hashTab = getTabFromHash();
    if (hashTab) return hashTab;

    const storedTab = window.sessionStorage.getItem("s5evo-active-tab");
    return isMainTab(storedTab) ? storedTab : "home";
  });
  const sidebarCollapsed = functionalStorageAllowed ? storedSidebarCollapsed : false;
  const navigationGroups = groupPermittedNavigationMenuItems(getPermittedNavigationMenuItems({
    authenticated: Boolean(session?.user),
    can,
    roles,
    pathname,
  }));

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!functionalStorageAllowed) {
      window.localStorage.removeItem("sidebar-collapsed");
      window.dispatchEvent(new Event("sidebar-toggle"));
      return;
    }

    window.dispatchEvent(new Event("sidebar-toggle"));
  }, [functionalStorageAllowed]);

  useEffect(() => {
    if (pathname !== "/") return;

    const handleSwitchTab = (event: Event) => {
      const tabId = (event as CustomEvent<{ tabId?: string }>).detail?.tabId ?? null;
      if (isMainTab(tabId)) {
        setActiveTab(tabId);
      }
    };

    const handleHashChange = () => {
      const hashTab = getTabFromHash();
      setActiveTab(hashTab ?? "home");
    };

    window.addEventListener("switchTab", handleSwitchTab as EventListener);
    window.addEventListener("hashchange", handleHashChange);
    return () => {
      window.removeEventListener("switchTab", handleSwitchTab as EventListener);
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, [pathname]);

  const toggleCollapsed = () => {
    const next = !sidebarCollapsed;
    setStoredSidebarCollapsed(next);
    if (functionalStorageAllowed) {
      localStorage.setItem("sidebar-collapsed", JSON.stringify(next));
    } else {
      localStorage.removeItem("sidebar-collapsed");
    }
    window.dispatchEvent(new Event("sidebar-toggle"));
  };

  const switchToTab = (tabId: string, detail?: Record<string, string>) => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("s5evo-active-tab", tabId);
      if (tabId === "registration") {
        window.sessionStorage.setItem("s5evo-team-view", "mannschaften");
      }
      if (tabId === "dashboard" && detail?.dashboardScope) {
        window.sessionStorage.setItem("s5evo-dashboard-scope", detail.dashboardScope);
      }
    }
    setActiveTab(tabId as MainTab);

    if (pathname !== "/") {
      router.push(tabId === "home" ? "/" : `/#${tabId}`);
    } else {
      const nextUrl = tabId === "home" ? "/" : `/#${tabId}`;
      window.history.replaceState(null, "", nextUrl);
    }

    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("switchTab", { detail: { tabId, ...detail } }));
    }, 50);
  };

  const openAdminTab = (tab: string) => {
    setAdminTab(tab);
    router.push(`/admin?tab=${tab}`);
  };

  const handleMenuSelection = (item: NavigationMenuItem) => {
    switch (item.id) {
      case "home": return switchToTab("home");
      case "registration":
        if (session?.user) {
          window.sessionStorage.setItem("s5evo-team-view", "register");
          return switchToTab("registration", { teamView: "register" });
        }
        return router.push("/anmeldung");
      case "my-teams": return switchToTab("dashboard", { dashboardScope: "mine" });
      case "all-teams": return switchToTab("dashboard", { dashboardScope: "all" });
      case "live": return switchToTab("live");
      case "orga": return switchToTab("orga");
      case "map": return router.push("/karte");
      case "timekeeping": return router.push("/zeitnahme");
      case "profile": return router.push("/profile");
      case "messages": return router.push("/nachrichten");
      case "sportlerboerse-dashboard": return router.push("/sportlerboerse-dashboard");
      case "sportlerboerse-mtc": return router.push("/sportlerboerse/mtc");
      case "participants": return router.push("/teilnehmer");
      case "changes": return router.push("/aenderungen");
      case "claim-links": return router.push("/claim-links");
      case "orga-links": return router.push("/orga-links");
      case "administration": return router.push("/admin");
      case "admin-competition": return openAdminTab("competition");
      case "admin-news": return openAdminTab("news");
      case "admin-results": return router.push("/admin/ergebnisse");
      case "admin-logs": return router.push("/admin/logs");
      case "admin-users": return openAdminTab("users");
      case "admin-audits": return openAdminTab("audits");
      case "admin-archive": return openAdminTab("restore");
      case "changelog": return router.push("/changelog");
      case "sign-out": return fullSignOut();
    }
  };

  const isMenuItemActive = (item: NavigationMenuItem) => {
    if (pathname === "/") {
      if (item.id === "home") return activeTab === "home";
      if (item.id === "registration") return activeTab === "registration";
      if (item.id === "my-teams" || item.id === "all-teams") return activeTab === "dashboard";
      if (item.id === "live") return activeTab === "live";
      if (item.id === "orga") return activeTab === "orga";
    }
    if (item.id === "map") return pathname === "/karte";
    if (item.id === "timekeeping") return pathname === "/zeitnahme";
    if (item.id === "profile") return pathname === "/profile";
    if (item.id === "messages") return pathname === "/nachrichten";
    if (item.id === "changes") return pathname === "/aenderungen";
    if (item.id === "claim-links") return pathname === "/claim-links";
    if (item.id === "orga-links") return pathname === "/orga-links";
    if (item.id === "sportlerboerse-dashboard") return pathname === "/sportlerboerse-dashboard";
    if (item.id === "sportlerboerse-mtc") return pathname === "/sportlerboerse/mtc";
    if (item.id === "participants") return pathname === "/teilnehmer";
    if (item.id === "admin-results") return pathname === "/admin/ergebnisse";
    if (item.id === "admin-logs") return pathname === "/admin/logs";
    if (item.id === "changelog") return pathname === "/changelog";
    if (pathname === "/admin") {
      if (item.id === "administration") return true;
      if (item.id === "admin-competition") return adminTab === "competition" || adminTab === "tenant";
      if (item.id === "admin-news") return adminTab === "news";
      if (item.id === "admin-users") return adminTab === "users";
      if (item.id === "admin-audits") return adminTab === "audits";
      if (item.id === "admin-archive") return adminTab === "restore";
    }
    return false;
  };

  if (!session?.user) return null;

  return (
    <motion.div
      className={`fixed left-0 top-0 h-full bg-card border-r border-border/30 z-40 flex flex-col sidebar-scroll ${
        sidebarCollapsed ? "w-12" : "w-52"
      }`}
      initial={false}
      animate={{ width: sidebarCollapsed ? 48 : 208 }}
      transition={{ duration: 0.2 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-2 border-b border-border/30">
        {!sidebarCollapsed ? (
          <Link href="/" className="relative block size-8 overflow-hidden rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60">
            <Image
              src={FIVE_KAMPF_BRAND.mark}
              alt="5Kampf Bad Bayersoien"
              fill
              sizes="32px"
              className="object-cover"
              priority
            />
          </Link>
        ) : (
          <Link href="/" className="relative mx-auto block size-7 overflow-hidden rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60">
            <Image
              src={FIVE_KAMPF_BRAND.mark}
              alt="5Kampf"
              fill
              sizes="28px"
              className="object-cover"
              priority
            />
          </Link>
        )}
        <Button variant="ghost" size="sm" onClick={toggleCollapsed} className="h-6 w-6 p-0">
          {sidebarCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </Button>
      </div>

      {/* Search */}
      <div className="px-2 py-2">
        {sidebarCollapsed ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSearchOpen(true)}
            className="w-full h-8 p-0"
            title="Suchen"
          >
            <Search className="h-4 w-4" />
          </Button>
        ) : (
          <button
            onClick={() => setSearchOpen(true)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground bg-muted/20 rounded-md hover:bg-muted/40 transition-colors"
          >
            <Search className="h-3 w-3" />
            <span>Suche...</span>
          </button>
        )}
      </div>

      {/* Navigation — kompakt, kein Scroll nötig */}
      <div className="flex-1 py-1.5 px-1 space-y-0.5 overflow-y-auto">
        {navigationGroups.map((group) => (
          <div key={group.section}>
            <SectionLabel label={group.label} sidebarCollapsed={sidebarCollapsed} />
            {group.items.map((item) => (
              <SidebarItem
                key={item.id}
                icon={item.icon}
                label={item.label}
                onClick={() => handleMenuSelection(item)}
                isActive={isMenuItemActive(item)}
                sidebarCollapsed={sidebarCollapsed}
              />
            ))}
          </div>
        ))}

        <SectionLabel label="Themes" sidebarCollapsed={sidebarCollapsed} />
        <div className={`${sidebarCollapsed ? "flex flex-col items-center gap-1" : "flex gap-1 justify-center px-2"}`}>
          {THEME_OPTIONS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={`w-6 h-6 rounded-full text-sm flex items-center justify-center transition-all hover:scale-110 ${
                theme === t.id ? "ring-1 ring-primary ring-offset-1 ring-offset-background scale-110" : "opacity-40 hover:opacity-80"
              }`}
              title={t.label}
            >
              {t.icon}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={toggleSparkle}
          className={`mx-2 mt-1 flex h-7 items-center justify-center gap-1 rounded-md border px-2 text-[11px] font-medium transition-colors ${
            sparkleEnabled
              ? "border-amber-400 bg-amber-400/10 text-amber-700 dark:text-amber-200"
              : "border-border/50 text-muted-foreground hover:text-foreground"
          } ${sidebarCollapsed ? "mx-auto w-7 px-0" : "w-[calc(100%-1rem)]"}`}
          title={sparkleEnabled ? "Sparkle-Effekt für dieses Theme deaktivieren" : "Sparkle-Effekt für dieses Theme aktivieren"}
          aria-label={sparkleEnabled ? "Sparkle-Effekt deaktivieren" : "Sparkle-Effekt aktivieren"}
        >
          <Sparkles className="size-3.5" />
          {!sidebarCollapsed && <span>Sparkle</span>}
        </button>
      </div>

      {/* Search Overlay */}
      <SearchOverlay isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </motion.div>
  );
}
