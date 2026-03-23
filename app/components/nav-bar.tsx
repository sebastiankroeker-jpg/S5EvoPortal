"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { APP_VERSION } from "@/lib/version";

export default function NavBar() {
  const { data: session, status } = useSession();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Sidebar State synchronisieren für Margin
  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem("sidebar-collapsed");
      if (saved) {
        setIsCollapsed(JSON.parse(saved));
      }
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
      className={`flex items-center justify-between px-6 py-1.5 border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-30 lg:transition-all lg:duration-300 ${
        isCollapsed ? "lg:ml-14" : "lg:ml-60"
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="text-xl">🏅</span>
        <span className="font-bold text-lg tracking-tight">S5Evo</span>
        <Link href="/changelog">
          <Badge variant="secondary" className="text-xs hover:bg-primary/20 cursor-pointer transition-colors">
            {APP_VERSION}
          </Badge>
        </Link>
      </div>
      
      {status === "authenticated" && session?.user && (
        <div className="flex items-center gap-2">
          <Link 
            href="/profile" 
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {session.user.name}
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut()}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Abmelden
          </Button>
        </div>
      )}
    </nav>
  );
}