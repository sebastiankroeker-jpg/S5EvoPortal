"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { usePermissions } from "@/lib/permissions-context";
import { useTheme } from "@/lib/theme-context";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import SearchOverlay from "./search-overlay";

function SidebarItem({ icon, label, onClick, isActive, isCollapsed }: {
  icon: string; label: string; onClick: () => void; isActive?: boolean; isCollapsed: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors hover:bg-accent ${
        isActive ? "bg-accent font-medium" : "text-muted-foreground"
      } ${isCollapsed ? "justify-center" : ""}`}
      title={isCollapsed ? label : undefined}
    >
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
  const { can } = usePermissions();
  const { theme, setTheme } = useTheme();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved) setIsCollapsed(JSON.parse(saved));
  }, []);

  const toggleCollapsed = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    localStorage.setItem("sidebar-collapsed", JSON.stringify(next));
    window.dispatchEvent(new Event("sidebar-toggle"));
  };

  const switchToTab = (tabId: string) => {
    if (pathname !== "/") router.push("/");
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
          <div className="flex items-center gap-1.5">
            <span className="text-base">🏅</span>
            <span className="font-semibold text-sm">S5Evo</span>
          </div>
        ) : (
          <span className="text-base mx-auto">🏅</span>
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
        <SidebarItem icon="🏠" label="Home" onClick={() => switchToTab("home")} isActive={pathname === "/" && window.location.hash === ""} isCollapsed={isCollapsed} />
        <SidebarItem icon="📋" label="Teams" onClick={() => switchToTab("registration")} isCollapsed={isCollapsed} />
        <SidebarItem icon="🏆" label="Live" onClick={() => switchToTab("live")} isCollapsed={isCollapsed} />
        <SidebarItem icon="👤" label="Profil" onClick={() => router.push("/profile")} isActive={pathname === "/profile"} isCollapsed={isCollapsed} />

        {(can("team.view.all") || can("results.edit")) && (
          <>
            <SectionLabel label="Orga" isCollapsed={isCollapsed} />
            <SidebarItem icon="⚙️" label="Orga" onClick={() => switchToTab("orga")} isCollapsed={isCollapsed} />
            {can("team.view.all") && (
              <SidebarItem icon="👥" label="Alle Teams" onClick={() => switchToTab("dashboard")} isCollapsed={isCollapsed} />
            )}
            {can("results.edit") && (
              <SidebarItem icon="✏️" label="Erfassung" onClick={() => {}} isCollapsed={isCollapsed} />
            )}
            {can("config.edit") && (
              <SidebarItem icon="🏢" label="Administration" onClick={() => router.push("/admin")} isActive={pathname === "/admin"} isCollapsed={isCollapsed} />
            )}
          </>
        )}

        <SectionLabel label="Tech" isCollapsed={isCollapsed} />
        <SidebarItem icon="🔗" label="Architektur" onClick={() => window.open("/architecture", "_blank")} isCollapsed={isCollapsed} />
        <SidebarItem icon="🖥️" label="Infrastruktur" onClick={() => router.push("/tech")} isActive={pathname === "/tech"} isCollapsed={isCollapsed} />
        <SidebarItem icon="📋" label="Changelog" onClick={() => router.push("/changelog")} isActive={pathname === "/changelog"} isCollapsed={isCollapsed} />

        <SectionLabel label="Themes" isCollapsed={isCollapsed} />
        <div className={`${isCollapsed ? "flex flex-col items-center gap-1" : "flex gap-1 justify-center px-2"}`}>
          {[
            { id: "light", icon: "☀️", label: "Light" },
            { id: "dark", icon: "🌙", label: "Dark" },
            { id: "esv", icon: "🏔️", label: "ESV" },
            { id: "bunt", icon: "🎨", label: "Bunt" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id as any)}
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
