"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Badge } from "@/components/ui/badge";
import { APP_VERSION } from "@/lib/version";

export default function NavBar() {
  const { data: session, status } = useSession();

  return (
    <nav className="flex items-center justify-between px-6 py-1.5 border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
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
        <Link 
          href="/profile" 
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {session.user.name}
        </Link>
      )}
    </nav>
  );
}