"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { usePermissions } from "@/lib/permissions-context";
import { useTheme } from "@/lib/theme-context";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const { can } = usePermissions();
  const { theme, setTheme } = useTheme();
  
  // Collapsed State aus localStorage laden
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved) {
      setIsCollapsed(JSON.parse(saved));
    }
  }, []);

  const toggleCollapsed = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem("sidebar-collapsed", JSON.stringify(newState));
    
    // Event für Layout-Updates
    window.dispatchEvent(new Event("sidebar-toggle"));
  };

  const switchToTab = (tabId: string) => {
    if (pathname === "/") {
      const event = new CustomEvent("switchTab", { detail: { tabId } });
      window.dispatchEvent(event);
    }
  };

  const navigateTo = (path: string) => {
    router.push(path);
  };

  // Theme options
  const themes = [
    { id: "light", label: "Light", icon: "☀️" },
    { id: "dark", label: "Dark", icon: "🌙" },
    { id: "esv", label: "ESV", icon: "🏔️" },
    { id: "bunt", label: "Bunt", icon: "🎨" },
    { id: "sysadmin", label: "Sys-Admin", icon: "🖥️" },
  ];

  if (!session?.user) return null;

  return (
    <motion.div
      className={`fixed left-0 top-0 h-full bg-card border-r border-border shadow-sm z-40 flex flex-col transition-all duration-300 ${
        isCollapsed ? "w-14" : "w-60"
      }`}
      initial={false}
      animate={{ width: isCollapsed ? 56 : 240 }}
    >
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center gap-2">
              <span className="text-xl">🏅</span>
              <span className="font-bold text-lg tracking-tight">S5Evo Portal</span>
            </div>
          )}
          {isCollapsed && (
            <span className="text-xl mx-auto">🏅</span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleCollapsed}
            className={`h-8 w-8 p-0 hover:bg-accent ${isCollapsed ? "mx-auto" : ""}`}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4 space-y-6">
        
        {/* Main Section */}
        <div className="px-4">
          {!isCollapsed && (
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Navigation
            </div>
          )}
          <div className="space-y-1">
            {can("team.create") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => switchToTab("registration")}
                className={`w-full justify-start h-9 ${pathname === "/" ? "bg-accent" : ""} ${
                  isCollapsed ? "px-2" : "px-3"
                }`}
              >
                <span className="text-base mr-2">📋</span>
                {!isCollapsed && <span className="text-sm">Anmeldung</span>}
              </Button>
            )}
            {(can("team.view.own") || can("team.view.all")) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => switchToTab("dashboard")}
                className={`w-full justify-start h-9 ${pathname === "/" ? "bg-accent" : ""} ${
                  isCollapsed ? "px-2" : "px-3"
                }`}
              >
                <span className="text-base mr-2">📊</span>
                {!isCollapsed && <span className="text-sm">Meine Teams</span>}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => alert("Ergebnisse werden hier angezeigt sobald der Wettkampf läuft")}
              className={`w-full justify-start h-9 ${
                isCollapsed ? "px-2" : "px-3"
              }`}
              disabled={!can("results.view")}
            >
              <span className="text-base mr-2">🏆</span>
              {!isCollapsed && <span className="text-sm">Ergebnisse</span>}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => alert("Ranglisten werden hier angezeigt sobald der Wettkampf läuft")}
              className={`w-full justify-start h-9 ${
                isCollapsed ? "px-2" : "px-3"
              }`}
              disabled={!can("ranking.view")}
            >
              <span className="text-base mr-2">📈</span>
              {!isCollapsed && <span className="text-sm">Ranglisten</span>}
            </Button>
          </div>
        </div>

        {/* Admin Section */}
        {(can("team.view.all") || can("results.edit")) && (
          <div className="px-4">
            {!isCollapsed && <Separator />}
            {!isCollapsed && (
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 mt-3">
                Administration
              </div>
            )}
            <div className="space-y-1">
              {can("team.view.all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => switchToTab("dashboard")}
                  className={`w-full justify-start h-9 ${
                    isCollapsed ? "px-2" : "px-3"
                  }`}
                >
                  <span className="text-base mr-2">👥</span>
                  {!isCollapsed && <span className="text-sm">Alle Teams</span>}
                </Button>
              )}
              {can("results.edit") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => alert("Ergebnis-Erfassung wird hier implementiert")}
                  className={`w-full justify-start h-9 ${
                    isCollapsed ? "px-2" : "px-3"
                  }`}
                >
                  <span className="text-base mr-2">✏️</span>
                  {!isCollapsed && <span className="text-sm">Ergebnis-Erfassung</span>}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Settings Section */}
        <div className="px-4">
          {!isCollapsed && <Separator />}
          {!isCollapsed && (
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 mt-3">
              Einstellungen
            </div>
          )}
          <div className="space-y-1">
            {can("config.edit") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigateTo("/admin")}
                className={`w-full justify-start h-9 ${pathname === "/admin" ? "bg-accent" : ""} ${
                  isCollapsed ? "px-2" : "px-3"
                }`}
              >
                <span className="text-base mr-2">⚙️</span>
                {!isCollapsed && <span className="text-sm">Administration</span>}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open("/architecture", "_blank")}
              className={`w-full justify-start h-9 ${
                isCollapsed ? "px-2" : "px-3"
              }`}
            >
              <span className="text-base mr-2">🔗</span>
              {!isCollapsed && (
                <div className="flex items-center gap-1">
                  <span className="text-sm">Ref-Architektur</span>
                  <ExternalLink className="h-3 w-3" />
                </div>
              )}
            </Button>
          </div>
        </div>

        {/* Theme Section */}
        <div className="px-4">
          {!isCollapsed && <Separator />}
          {!isCollapsed && (
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 mt-3">
              Design
            </div>
          )}
          <div className={`${isCollapsed ? "flex flex-col gap-1" : "flex gap-1 justify-center"}`}>
            {themes.map((t) => (
              <Button
                key={t.id}
                variant={theme === t.id ? "default" : "ghost"}
                size="sm"
                className="h-8 w-8 p-0 text-base"
                onClick={() => setTheme(t.id as any)}
                title={t.label}
              >
                {t.icon}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border p-4 space-y-1">
        {!isCollapsed && (
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Konto
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigateTo("/profile")}
          className={`w-full justify-start h-9 ${pathname === "/profile" ? "bg-accent" : ""} ${
            isCollapsed ? "px-2" : "px-3"
          }`}
        >
          <span className="text-base mr-2">👤</span>
          {!isCollapsed && <span className="text-sm">Profil</span>}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigateTo("/changelog")}
          className={`w-full justify-start h-9 ${pathname === "/changelog" ? "bg-accent" : ""} ${
            isCollapsed ? "px-2" : "px-3"
          }`}
        >
          <span className="text-base mr-2">📋</span>
          {!isCollapsed && <span className="text-sm">Changelog</span>}
        </Button>
      </div>
    </motion.div>
  );
}