"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { APP_VERSION } from "@/lib/version";

export default function NavBar() {
  const { data: session, status } = useSession();

  return (
    <nav className="flex items-center justify-between px-6 py-2 border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <span className="text-2xl">🏅</span>
        <span className="font-bold text-lg tracking-tight">S5Evo Portal</span>
        <Link href="/changelog">
          <Badge variant="secondary" className="text-xs hover:bg-primary/20 cursor-pointer transition-colors">{APP_VERSION}</Badge>
        </Link>
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
      </div>
    </nav>
  );
}
