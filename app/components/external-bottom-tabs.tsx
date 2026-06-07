"use client";

import { useRouter } from "next/navigation";

import BottomTabBar from "@/app/components/bottom-tab-bar";
import { navigateFromExternalBottomTab } from "@/lib/bottom-tab-navigation";

interface ExternalBottomTabsProps {
  activeTab?: string;
}

export default function ExternalBottomTabs({ activeTab = "" }: ExternalBottomTabsProps) {
  const router = useRouter();

  const navigateFromBottomTab = (tabId: string) => {
    navigateFromExternalBottomTab(router, tabId);
  };

  return (
    <div className="lg:hidden">
      <BottomTabBar activeTab={activeTab} onTabChange={navigateFromBottomTab} />
    </div>
  );
}
