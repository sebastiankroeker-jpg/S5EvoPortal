"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import BottomTabBar from "@/app/components/bottom-tab-bar";
import NavBar from "@/app/components/nav-bar";
import ParticipantList from "@/app/components/participant-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePermissions } from "@/lib/permissions-context";

export default function ParticipantsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { can } = usePermissions();
  const hasAccess = !!session && (can("team.view.all") || can("results.edit"));

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
          <div className="animate-spin inline-block h-8 w-8 rounded-full border-4 border-primary border-t-transparent" />
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
              <CardDescription>Du hast keine Berechtigung für das Teilnehmer-Dashboard.</CardDescription>
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

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">
        <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
          <Card className="border-border/60">
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Teilnehmer-Dashboard</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">Alle Teilnehmer schnell finden und pflegen.</h1>
              <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
                Suche nach Name oder Mannschaft, filtere nach Klasse und Disziplin, pflege Moderationshinweise und
                drucke die aktuelle Liste für die Wettkampfleitung.
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardContent className="p-5 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Wofür gedacht</p>
              <p className="mt-2">Startnummern- und Moderationsvorbereitung</p>
              <p>Teilnehmerdaten schnell querprüfen</p>
              <p>Offene Änderungsanträge im Blick behalten</p>
              <p>Druckliste für den Veranstaltungstag</p>
            </CardContent>
          </Card>
        </section>

        <ParticipantList />
      </main>

      <div className="lg:hidden">
        <BottomTabBar activeTab="orga" onTabChange={navigateFromBottomTab} />
      </div>
    </div>
  );
}
