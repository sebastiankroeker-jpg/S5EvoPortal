"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { usePermissions } from "@/lib/permissions-context";
import { useTheme, type Theme } from "@/lib/theme-context";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import SearchOverlay from "./search-overlay";
import { isClaimNavigationPath } from "@/lib/navigation-menu";

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

function SidebarItem({ icon, label, onClick, isActive, isCollapsed }: {
  icon: string; label: string; onClick: () => void; isActive?: boolean; isCollapsed: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors hover:bg-accent ${
        isActive
          ? "bg-primary/10 text-primary font-medium shadow-sm ring-1 ring-primary/20 dark:bg-primary/20"
          : "text-muted-foreground"
      } ${isCollapsed ? "justify-center" : ""}`}
      title={isCollapsed ? label : undefined}
      aria-current={isActive ? "page" : undefined}
    >
      {isActive && !isCollapsed && (
        <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary" />
      )}
      <span className="text-sm shrink-0">{icon}</span>
      {!isCollapsed && <span className="truncate">{label}</span>}
    </button>
  );
}

function SectionLabel({ label, isCollapsed }: { label: string; isCollapsed: boolean }) {
  if (isCollapsed) return <div className="h-px bg-border mx-1 my-1" />;
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
  const { can, activeRole } = usePermissions();
  const { theme, setTheme } = useTheme();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;

    const saved = localStorage.getItem("sidebar-collapsed");
    return saved ? JSON.parse(saved) : false;
  });
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<MainTab>(() => {
    if (typeof window === "undefined") return "home";

    const hashTab = getTabFromHash();
    if (hashTab) return hashTab;

    const storedTab = window.sessionStorage.getItem("s5evo-active-tab");
    return isMainTab(storedTab) ? storedTab : "home";
  });
  const isClaimPath = isClaimNavigationPath(pathname);
  const showOrgaSection = !isClaimPath && (can("team.view.all") || can("results.edit"));
  const showTechSection = !isClaimPath;
  const teamLabel = isClaimPath || activeRole === "TEILNEHMER" ? "Mein Team" : "Teams";
  const teamIcon = isClaimPath || activeRole === "TEILNEHMER" ? "🏃" : "📋";

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
    const next = !isCollapsed;
    setIsCollapsed(next);
    localStorage.setItem("sidebar-collapsed", JSON.stringify(next));
    window.dispatchEvent(new Event("sidebar-toggle"));
  };

  const switchToTab = (tabId: string) => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("s5evo-active-tab", tabId);
    }
    setActiveTab(tabId as MainTab);

    if (pathname !== "/") {
      router.push(tabId === "home" ? "/" : `/#${tabId}`);
    } else {
      const nextUrl = tabId === "home" ? "/" : `/#${tabId}`;
      window.history.replaceState(null, "", nextUrl);
    }

    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("switchTab", { detail: { tabId } }));
    }, 50);
  };

  if (!session?.user) return null;

  return (
    <motion.div
      className={`fixed left-0 top-0 h-full bg-card border-r border-border/30 z-40 flex flex-col sidebar-scroll ${
        isCollapsed ? "w-12" : "w-52"
      }`}
      initial={false}
      animate={{ width: isCollapsed ? 48 : 208 }}
      transition={{ duration: 0.2 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-2 border-b border-border/30">
        {!isCollapsed ? (
          <Link href="/" className="flex items-center gap-1.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60">
            <span className="text-base">🏅</span>
            <span className="font-semibold text-sm">S5Evo</span>
          </Link>
        ) : (
          <Link href="/" className="mx-auto rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60">
            <span className="text-base">🏅</span>
          </Link>
        )}
        <Button variant="ghost" size="sm" onClick={toggleCollapsed} className="h-6 w-6 p-0">
          {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </Button>
      </div>

      {/* Search */}
      <div className="px-2 py-2">
        {isCollapsed ? (
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
        <SectionLabel label="Navigation" isCollapsed={isCollapsed} />
        <SidebarItem icon="🏠" label="Home" onClick={() => switchToTab("home")} isActive={pathname === "/" && activeTab === "home"} isCollapsed={isCollapsed} />
        <SidebarItem icon={teamIcon} label={teamLabel} onClick={() => switchToTab(isClaimPath ? "dashboard" : "registration")} isActive={pathname === "/" && (activeTab === "registration" || (isClaimPath && activeTab === "dashboard"))} isCollapsed={isCollapsed} />
        <SidebarItem icon="🏆" label="Live" onClick={() => switchToTab("live")} isActive={pathname === "/" && activeTab === "live"} isCollapsed={isCollapsed} />
        <SidebarItem icon="👤" label="Profil" onClick={() => router.push("/profile")} isActive={pathname === "/profile"} isCollapsed={isCollapsed} />

        {showOrgaSection && (
          <>
            <SectionLabel label="Orga" isCollapsed={isCollapsed} />
            <SidebarItem icon="⚙️" label="Orga" onClick={() => switchToTab("orga")} isActive={pathname === "/" && activeTab === "orga"} isCollapsed={isCollapsed} />
            {can("team.view.all") && (
              <SidebarItem icon="👥" label="Alle Teams" onClick={() => switchToTab("dashboard")} isActive={pathname === "/" && activeTab === "dashboard"} isCollapsed={isCollapsed} />
            )}
            {can("team.view.all") && (
              <SidebarItem icon="📝" label="Aenderungen" onClick={() => router.push("/aenderungen")} isActive={pathname === "/aenderungen"} isCollapsed={isCollapsed} />
            )}
            {can("results.edit") && (
              <SidebarItem icon="✏️" label="Erfassung" onClick={() => {}} isCollapsed={isCollapsed} />
            )}
            {can("config.edit") && (
              <SidebarItem icon="🏢" label="Administration" onClick={() => router.push("/admin")} isActive={pathname === "/admin"} isCollapsed={isCollapsed} />
            )}
          </>
        )}

        {showTechSection && (
          <>
            <SectionLabel label="Tech" isCollapsed={isCollapsed} />
            <SidebarItem icon="🔗" label="Architektur" onClick={() => window.open("/architecture", "_blank")} isCollapsed={isCollapsed} />
            <SidebarItem icon="🖥️" label="Infrastruktur" onClick={() => router.push("/tech")} isActive={pathname === "/tech"} isCollapsed={isCollapsed} />
            <SidebarItem icon="📋" label="Changelog" onClick={() => router.push("/changelog")} isActive={pathname === "/changelog"} isCollapsed={isCollapsed} />
          </>
        )}

        <SectionLabel label="Themes" isCollapsed={isCollapsed} />
        <div className={`${isCollapsed ? "flex flex-col items-center gap-1" : "flex gap-1 justify-center px-2"}`}>
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
      </div>

      {/* Search Overlay */}
      <SearchOverlay isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </motion.div>
  );
}
