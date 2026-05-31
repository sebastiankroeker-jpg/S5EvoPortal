"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import BottomTabBar from "@/app/components/bottom-tab-bar";
import ClaimLinkDashboard from "@/app/components/claim-link-dashboard";
import NavBar from "@/app/components/nav-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePermissions } from "@/lib/permissions-context";

export default function ClaimLinksPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { can } = usePermissions();
  const hasAccess = !!session && can("team.view.all");

  const navigateFromBottomTab = (tabId: string) => {
    if (tabId === "profile") {
      router.push("/profile");
      return;
    }

    router.push(tabId === "home" ? "/" : `/#${tabId}`);
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background pb-24 lg:pb-0">
        <NavBar />
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="animate-spin inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
        <div className="lg:hidden">
          <BottomTabBar activeTab="orga" onTabChange={navigateFromBottomTab} />
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background pb-24 lg:pb-0">
        <NavBar />
        <div className="flex min-h-[60vh] items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Kein Zugriff</CardTitle>
              <CardDescription>Du hast keine Berechtigung für das Claim-Link Dashboard.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/">
                <Button className="w-full">Zurück ins Portal</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
        <div className="lg:hidden">
          <BottomTabBar activeTab="orga" onTabChange={navigateFromBottomTab} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-0">
      <NavBar />

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
          <Card className="border-border/60">
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Claim-Link Dashboard</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">Übernahmen kontrolliert unterstützen.</h1>
              <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
                Erzeuge Team- und Teilnehmer-Links, prüfe offene Einlösungen und löse falsche Verknüpfungen ohne
                Mail-Pingpong.
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardContent className="p-5 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Wofür gedacht</p>
              <p className="mt-2">Teamchef:innen mit vorhandenen Anmeldungen verknüpfen</p>
              <p>Teilnehmerkonten neu einladen</p>
              <p>Offene, abgelaufene und gesperrte Links prüfen</p>
              <p>Claim-Einlösung global steuern</p>
            </CardContent>
          </Card>
        </section>

        <ClaimLinkDashboard />
      </main>

      <div className="lg:hidden">
        <BottomTabBar activeTab="orga" onTabChange={navigateFromBottomTab} />
      </div>
    </div>
  );
}
