"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function NavBar() {
  const { data: session, status } = useSession();

  return (
    <nav className="flex items-center justify-between px-6 py-3 border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <span className="text-2xl">🏅</span>
        <span className="font-bold text-lg tracking-tight">S5Evo Portal</span>
        <Badge variant="secondary" className="text-xs">v0.1</Badge>
      </div>
      <div className="flex items-center gap-3">
        {status === "authenticated" && session?.user && (
          <>
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {session.user.name}
            </span>
            <Button variant="ghost" size="sm" onClick={() => signOut()}>
              Abmelden
            </Button>
          </>
        )}
        {status === "unauthenticated" && (
          <Button size="sm" onClick={() => signIn("authentik")}>
            🔐 Anmelden
          </Button>
        )}
      </div>
    </nav>
  );
}
