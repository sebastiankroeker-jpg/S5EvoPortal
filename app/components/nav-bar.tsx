"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { APP_VERSION } from "@/lib/version";
import { useTheme } from "@/lib/theme-context";
import { usePermissions } from "@/lib/permissions-context";
import { getSimulatableRoles } from "@/lib/permissions";
import type { Role } from "@/lib/permissions";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  MODERATOR: "Moderator:in",
  TEAMCHEF: "Teamchef:in",
  TEILNEHMER: "Teilnehmer:in",
  ZUSCHAUER: "Zuschauer:in",
};

export default function NavBar() {
  const { data: session, status } = useSession();
  const { theme, setTheme } = useTheme();
  const { activeRole, roles, simulatedRole, setSimulatedRole, isSimulating } = usePermissions();
  const [showRoleMenu, setShowRoleMenu] = useState(false);

  const THEMES = [
    { id: "light", icon: "☀️", label: "Light" },
    { id: "dark", icon: "🌙", label: "Dark" },
    { id: "esv", icon: "🏔️", label: "ESV" },
    { id: "bunt", icon: "🎨", label: "Bunt" },
    { id: "sysadmin", icon: "🖥️", label: "Sys-Admin" },
  ];
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem("sidebar-collapsed");
      if (saved) setIsCollapsed(JSON.parse(saved));
    };
    handleStorageChange();
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("sidebar-toggle", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("sidebar-toggle", handleStorageChange);
    };
  }, []);

  return (
    <nav 
      className={`flex items-center justify-between px-4 py-1 border-b border-border/30 bg-card/80 backdrop-blur-sm sticky top-0 z-30 lg:transition-all lg:duration-200 ${
        isCollapsed ? "lg:ml-12" : "lg:ml-52"
      }`}
    >
      {/* Left: Logo + Version */}
      <div className="flex items-center gap-2">
        <span className="text-lg">🏅</span>
        <span className="font-semibold text-sm">S5Evo</span>
        <Link href="/changelog">
          <Badge variant="secondary" className="text-[10px] hover:bg-primary/20 cursor-pointer">{APP_VERSION}</Badge>
        </Link>
      </div>

      {/* Center: Theme-Dots */}
      <div className="flex items-center gap-0.5">
        {THEMES.map((t) => (
          <button
            key={t.id}
            onClick={() => setTheme(t.id as any)}
            className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center transition-all hover:scale-110 ${
              theme === t.id ? "ring-1 ring-primary ring-offset-1 ring-offset-background scale-110" : "opacity-40 hover:opacity-80"
            }`}
            title={t.label}
          >
            {t.icon}
          </button>
        ))}
      </div>

      {/* Right: Role-Switcher + User + Abmelden */}
      {status === "authenticated" && session?.user && (
        <div className="flex items-center gap-2">
          {/* Role-Switcher (nur wenn simulierbar) */}
          {(() => {
            const realRole = roles.length > 0 ? roles[0] : "ZUSCHAUER";
            const simulatable = getSimulatableRoles(realRole as Role);
            if (simulatable.length === 0) return null;
            return (
              <div className="relative">
                <button
                  onClick={() => setShowRoleMenu(!showRoleMenu)}
                  className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                    isSimulating
                      ? "border-amber-400 bg-amber-400/10 text-amber-600 dark:text-amber-300"
                      : "border-border/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  🔬 {ROLE_LABELS[activeRole] || activeRole}
                </button>
                {showRoleMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowRoleMenu(false)} />
                    <div className="absolute right-0 top-full mt-1 w-40 bg-popover border border-border/50 rounded-md shadow-lg py-1 z-50">
                      {isSimulating && (
                        <button
                          className="w-full px-3 py-1.5 text-left text-xs hover:bg-accent text-amber-600 dark:text-amber-300"
                          onClick={() => { setSimulatedRole(null); setShowRoleMenu(false); }}
                        >
                          ✕ Reset ({ROLE_LABELS[realRole] || realRole})
                        </button>
                      )}
                      {simulatable.map((role) => (
                        <button
                          key={role}
                          className={`w-full px-3 py-1.5 text-left text-xs hover:bg-accent transition-colors ${
                            activeRole === role ? "text-primary font-medium" : "text-muted-foreground"
                          }`}
                          onClick={() => { setSimulatedRole(role); setShowRoleMenu(false); }}
                        >
                          {ROLE_LABELS[role] || role}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })()}
          <Link href="/profile" className="text-xs text-muted-foreground hover:text-foreground transition-colors hidden sm:inline">
            👤 {session.user.name}
          </Link>
          <Button variant="ghost" size="sm" onClick={() => fullSignOut()} className="text-xs text-muted-foreground h-6 px-2">
            Abmelden
          </Button>
        </div>
      )}
    </nav>
  );
}
