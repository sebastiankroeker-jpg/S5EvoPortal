"use client";

import { useSession } from "next-auth/react";
import { usePermissions } from "@/lib/permissions-context";
import { cn } from "@/lib/utils";

interface Tab {
  id: string;
  icon: string;
  label: string;
  permission: string | null;
}

const TABS: Tab[] = [
  { id: "home", icon: "🏠", label: "Home", permission: null },
  { id: "registration", icon: "📋", label: "Team", permission: "team.create" },
  { id: "live", icon: "🏆", label: "Live", permission: "results.view" },
  { id: "profile", icon: "👤", label: "Profil", permission: null },
];

interface BottomTabBarProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export default function BottomTabBar({ activeTab, onTabChange }: BottomTabBarProps) {
  const { status } = useSession();
  const { can } = usePermissions();

  // Filter tabs based on authentication and permissions
  const visibleTabs = TABS.filter(tab => {
    // Always show home and live
    if (tab.id === "home" || tab.id === "live") return true;
    
    // Profile only when authenticated
    if (tab.id === "profile") return status === "authenticated";
    
    // Other tabs need permission
    if (tab.permission && !can(tab.permission)) return false;
    
    return status === "authenticated";
  });

  const handleTabClick = (tabId: string) => {
    onTabChange(tabId);
    
    // Dispatch event for other components
    const event = new CustomEvent('switchTab', { detail: { tabId } });
    window.dispatchEvent(event);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden">
      <div 
        className="bg-card/95 backdrop-blur-md border-t border-border/30"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="grid grid-flow-col auto-cols-fr h-14">
          {visibleTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 transition-all duration-200",
                  "hover:bg-muted/50 active:bg-muted",
                  isActive && "text-primary"
                )}
              >
                <span 
                  className={cn(
                    "text-lg transition-transform duration-200",
                    isActive && "scale-110"
                  )}
                >
                  {tab.icon}
                </span>
                <span 
                  className={cn(
                    "text-[10px] font-medium transition-all duration-200",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}