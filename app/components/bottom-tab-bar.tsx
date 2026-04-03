"use client";

import { useSession } from "next-auth/react";
import { usePermissions } from "@/lib/permissions-context";
import { cn } from "@/lib/utils";

interface Tab {
  id: string;
  icon: string;
  label: string;
  show: (ctx: { authenticated: boolean; can: (p: string) => boolean; activeRole: string }) => boolean;
}

const TABS: Tab[] = [
  { 
    id: "home", icon: "🏠", label: "Home",
    show: () => true,
  },
  { 
    id: "registration", icon: "📋", label: "Team",
    show: ({ authenticated }) => authenticated,
  },
  { 
    id: "live", icon: "🏆", label: "Live",
    show: () => true,
  },
  { 
    id: "profile", icon: "👤", label: "Profil",
    show: ({ authenticated }) => authenticated,
  },
  { 
    id: "orga", icon: "⚙️", label: "Orga",
    show: ({ can }) => can("team.view.all") || can("results.edit"),
  },
];

// Dynamic label for Team tab based on role
function getTeamLabel(activeRole: string): string {
  switch (activeRole) {
    case "ZUSCHAUER": return "Watch";
    case "TEILNEHMER": return "Mein Team";
    default: return "Teams"; // TEAMCHEF, MODERATOR, ADMIN
  }
}

function getTeamIcon(activeRole: string): string {
  switch (activeRole) {
    case "ZUSCHAUER": return "👀";
    case "TEILNEHMER": return "🏃";
    default: return "📋";
  }
}

interface BottomTabBarProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export default function BottomTabBar({ activeTab, onTabChange }: BottomTabBarProps) {
  const { status } = useSession();
  const { can, activeRole } = usePermissions();
  const authenticated = status === "authenticated";

  const ctx = { authenticated, can, activeRole };

  const visibleTabs = TABS.filter(tab => tab.show(ctx)).map(tab => {
    // Dynamic Team tab
    if (tab.id === "registration") {
      return { ...tab, label: getTeamLabel(activeRole), icon: getTeamIcon(activeRole) };
    }
    return tab;
  });

  const handleTabClick = (tabId: string) => {
    onTabChange(tabId);
    const event = new CustomEvent('switchTab', { detail: { tabId } });
    window.dispatchEvent(event);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden">
      <div 
        className="bg-background/95 backdrop-blur-md border-t border-border/50"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="grid grid-flow-col auto-cols-fr h-14">
          {visibleTabs.map((tab) => {
            const isActive = tab.id === activeTab || 
              (tab.id === "registration" && activeTab === "dashboard");
            
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
                <span className={cn(
                  "text-lg transition-transform duration-200",
                  isActive && "scale-110"
                )}>
                  {tab.icon}
                </span>
                <span className={cn(
                  "text-[10px] font-medium",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}>
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
