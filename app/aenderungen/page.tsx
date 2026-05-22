"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

import ApprovalQueue from "@/app/components/approval-queue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePermissions } from "@/lib/permissions-context";
import { APP_VERSION } from "@/lib/version";

export default function ChangesPage() {
  const { data: session, status } = useSession();
  const { can } = usePermissions();
  const hasAccess = !!session && (can("team.view.all") || can("results.edit"));

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin inline-block h-8 w-8 rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Kein Zugriff</CardTitle>
            <CardDescription>Du hast keine Berechtigung fuer das Aenderungs-Dashboard.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/">
              <Button className="w-full">Zurueck ins Portal</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight hover:opacity-80">
                <span className="text-xl">🏅</span>
                <span>S5Evo</span>
              </Link>
              <Badge variant="secondary" className="text-xs">{APP_VERSION}</Badge>
              <Badge variant="outline" className="text-xs">Aenderungen</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Offene Aenderungsantraege pruefen, kommentieren und direkt freigeben.
            </p>
          </div>
          <Link href="/#orga">
            <Button variant="outline" size="sm">Zurueck zum Orga-Bereich</Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">
        <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
          <Card className="border-border/60">
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Aenderungs-Dashboard</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">Sauber pruefen statt Mails zusammensuchen.</h1>
              <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
                Hier laufen alle offenen Teilnehmeraenderungen zusammen. Du siehst Antragsteller, Mannschaft,
                Feldwechsel, Nachbesserungen und kannst direkt mit Kommentar entscheiden.
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardContent className="p-5 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Was drin ist</p>
              <p className="mt-2">Live-Liste aller offenen Antraege</p>
              <p>Suche nach Team, Person und Aenderungsinhalt</p>
              <p>Filter fuer aktualisierte Antraege</p>
              <p>Genehmigen oder ablehnen direkt aus dem Dashboard</p>
            </CardContent>
          </Card>
        </section>

        <ApprovalQueue variant="page" />
      </main>
    </div>
  );
}
