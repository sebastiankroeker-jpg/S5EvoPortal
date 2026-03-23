"use client";

import { useState, useEffect } from "react";
import Sidebar from "./sidebar";
import CommandPill from "./command-pill";
import RoleSwitcher from "./role-switcher";

interface LayoutWrapperProps {
  children: React.ReactNode;
}

export default function LayoutWrapper({ children }: LayoutWrapperProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Sidebar State synchronisieren
  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem("sidebar-collapsed");
      if (saved) {
        setIsCollapsed(JSON.parse(saved));
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
  }, []);

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      
      {/* Main content with responsive margin */}
      <div 
        className={`lg:transition-all lg:duration-300 ${
          isCollapsed ? "lg:ml-14" : "lg:ml-60"
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