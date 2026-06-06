"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import BottomTabBar from "@/app/components/bottom-tab-bar";
import Dashboard from "@/app/components/dashboard";
import NavBar from "@/app/components/nav-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCompetition } from "@/lib/competition-context";
import { usePermissions } from "@/lib/permissions-context";
import { navigateFromExternalBottomTab } from "@/lib/bottom-tab-navigation";

export default function MarketplaceDashboardPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { can, isLoading: permissionsLoading } = usePermissions();
  const { active: activeCompetition } = useCompetition();
  const hasAccess = !!session && can("team.view.all");
  const canEditConfig = can("config.edit");
  const marketplaceVisibilityMode = activeCompetition?.marketplaceGlobalVisibility === "OFFLINE" ? "OFFLINE" : "SELECTIVE";
  const marketplaceVisibilityMeta =
    marketplaceVisibilityMode === "OFFLINE"
      ? {
          label: "Sportler-Börse offline",
          className: "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100",
        }
      : {
          label: "Sportler-Börse selektiv sichtbar",
          className: "border-green-300 bg-green-50 text-green-800 hover:bg-green-100 dark:border-green-700 dark:bg-green-950/40 dark:text-green-100",
        };

  const navigateFromBottomTab = (tabId: string) => {
    navigateFromExternalBottomTab(router, tabId);
  };

  if (status === "loading" || permissionsLoading) {
    return (
      <div className="min-h-screen bg-background pb-24 lg:pb-0">
        <NavBar />
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
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
              <CardDescription>Du hast keine Berechtigung für das Sportler-Börse-Dashboard.</CardDescription>
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

      <main className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5">
        <div className="space-y-1">
          <p className="text-sm font-medium text-primary">Orga</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-2xl font-bold">Sportler-Börse Dashboard</h1>
            {canEditConfig ? (
              <Link href="/admin?tab=competition#sportlerboerse-sichtbarkeit" className="w-fit">
                <Badge variant="outline" className={`h-7 cursor-pointer px-2.5 text-xs ${marketplaceVisibilityMeta.className}`}>
                  {marketplaceVisibilityMeta.label}
                  <span className="ml-1 text-[10px] opacity-75">Customizing</span>
                </Badge>
              </Link>
            ) : (
              <Badge variant="outline" className={`h-7 w-fit px-2.5 text-xs ${marketplaceVisibilityMeta.className}`}>
                {marketplaceVisibilityMeta.label}
              </Badge>
            )}
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Einzelmeldungen prüfen, Status setzen und Kontaktinformationen für die Vermittlung im Blick behalten.
          </p>
        </div>

        <Dashboard marketplaceFocus />
      </main>

      <div className="lg:hidden">
        <BottomTabBar activeTab="orga" onTabChange={navigateFromBottomTab} />
      </div>
    </div>
  );
}
