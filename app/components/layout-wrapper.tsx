"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Sidebar from "./sidebar";
import CommandPill from "./command-pill";
import RoleSwitcher from "./role-switcher";
import { usePrivacyConsent } from "@/lib/privacy-consent-context";

interface LayoutWrapperProps {
  children: React.ReactNode;
}

export default function LayoutWrapper({ children }: LayoutWrapperProps) {
  const { status } = useSession();
  const { hasConsent } = usePrivacyConsent();
  const functionalStorageAllowed = hasConsent("FUNCTIONAL_STORAGE");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const showDesktopSidebar = status === "authenticated";

  // Sidebar State synchronisieren
  useEffect(() => {
    const handleStorageChange = () => {
      if (!functionalStorageAllowed) {
        setIsCollapsed(false);
        return;
      }

      try {
        const saved = localStorage.getItem("sidebar-collapsed");
        setIsCollapsed(saved ? JSON.parse(saved) : false);
      } catch {
        setIsCollapsed(false);
      }
    };

    // Initial load
    handleStorageChange();

    // Listen for changes
    window.addEventListener("storage", handleStorageChange);
    
    // Custom event für interne Updates
    window.addEventListener("sidebar-toggle", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("sidebar-toggle", handleStorageChange);
    };
  }, [functionalStorageAllowed]);

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      
      {/* Main content with responsive margin */}
      <div 
        className={`lg:transition-all lg:duration-300 ${
          showDesktopSidebar ? (isCollapsed ? "lg:ml-12" : "lg:ml-52") : ""
        }`}
      >
        {children}
      </div>
      
      {/* Mobile Command Pill */}
      <div className="lg:hidden">
        <CommandPill />
      </div>
      
      {/* Role Switcher */}
      <RoleSwitcher />
    </>
  );
}
