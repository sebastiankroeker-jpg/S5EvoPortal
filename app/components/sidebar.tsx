"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { usePermissions } from "@/lib/permissions-context";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";

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
  const [isCollapsed, setIsCollapsed] = useState(false);

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

      {/* Navigation — kompakt, kein Scroll nötig */}
      <div className="flex-1 py-1.5 px-1 space-y-0.5 overflow-y-auto">
        <SectionLabel label="Navigation" isCollapsed={isCollapsed} />
        {can("team.create") && (
          <SidebarItem icon="📋" label="Anmeldung" onClick={() => switchToTab("registration")} isActive={pathname === "/"} isCollapsed={isCollapsed} />
        )}
        {(can("team.view.own") || can("team.view.all")) && (
          <SidebarItem icon="📊" label="Meine Teams" onClick={() => switchToTab("dashboard")} isCollapsed={isCollapsed} />
        )}
        <SidebarItem icon="🏆" label="Ergebnisse" onClick={() => {}} isCollapsed={isCollapsed} />
        <SidebarItem icon="📈" label="Ranglisten" onClick={() => {}} isCollapsed={isCollapsed} />

        {(can("team.view.all") || can("results.edit")) && (
          <>
            <SectionLabel label="Admin" isCollapsed={isCollapsed} />
            {can("team.view.all") && (
              <SidebarItem icon="👥" label="Alle Teams" onClick={() => switchToTab("dashboard")} isCollapsed={isCollapsed} />
            )}
            {can("results.edit") && (
              <SidebarItem icon="✏️" label="Erfassung" onClick={() => {}} isCollapsed={isCollapsed} />
            )}
          </>
        )}

        <SectionLabel label="Einstellungen" isCollapsed={isCollapsed} />
        {can("config.edit") && (
          <SidebarItem icon="⚙️" label="Administration" onClick={() => router.push("/admin")} isActive={pathname === "/admin"} isCollapsed={isCollapsed} />
        )}
        <SidebarItem icon="🔗" label="Architektur" onClick={() => window.open("/architecture", "_blank")} isCollapsed={isCollapsed} />
      </div>

      {/* Footer — Konto */}
      <div className="border-t border-border/30 px-1 py-1.5 space-y-0.5">
        <SidebarItem icon="👤" label="Profil" onClick={() => router.push("/profile")} isActive={pathname === "/profile"} isCollapsed={isCollapsed} />
        <SidebarItem icon="📋" label="Changelog" onClick={() => router.push("/changelog")} isActive={pathname === "/changelog"} isCollapsed={isCollapsed} />
      </div>
    </motion.div>
  );
}
