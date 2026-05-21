"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

import ClaimLinkDashboard from "@/app/components/claim-link-dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePermissions } from "@/lib/permissions-context";
import { APP_VERSION } from "@/lib/version";

export default function ClaimLinksPage() {
  const { data: session, status } = useSession();
  const { can } = usePermissions();
  const hasAccess = !!session && can("team.view.all");

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>🚫 Kein Zugriff</CardTitle>
            <CardDescription>Du hast keine Berechtigung für das Claim-Link Dashboard.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/">
              <Button className="w-full">← Zurück ins Portal</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="flex items-center justify-between px-6 py-3 border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <span className="text-2xl">🏅</span>
            <span className="font-bold text-lg tracking-tight">S5Evo Portal</span>
          </Link>
          <Badge variant="secondary" className="text-xs">{APP_VERSION}</Badge>
          <Badge variant="outline" className="text-xs">Claim-Links</Badge>
        </div>
        <Link href="/#orga">
          <Button variant="ghost" size="sm">← Zurück</Button>
        </Link>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">🔐 Claim-Link Dashboard</h1>
          <p className="text-muted-foreground">
            Interne Übersicht für Uebernahmelinks, Supportfälle und globale Claim-Steuerung.
          </p>
        </div>

        <ClaimLinkDashboard />
      </main>
    </div>
  );
}
