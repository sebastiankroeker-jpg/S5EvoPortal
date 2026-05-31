"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import ApprovalQueue from "@/app/components/approval-queue";
import BottomTabBar from "@/app/components/bottom-tab-bar";
import NavBar from "@/app/components/nav-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePermissions } from "@/lib/permissions-context";

export default function ChangesPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { can, isLoading: permissionsLoading } = usePermissions();
  const hasAccess = !!session && (can("team.view.all") || can("results.edit"));

  const navigateFromBottomTab = (tabId: string) => {
    if (tabId === "profile") {
      router.push("/profile");
      return;
    }

    router.push(tabId === "home" ? "/" : `/#${tabId}`);
  };

  if (status === "loading" || permissionsLoading) {
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
              <CardDescription>Du hast keine Berechtigung für das Änderungs-Dashboard.</CardDescription>
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
        <ApprovalQueue variant="page" />
      </main>

      <div className="lg:hidden">
        <BottomTabBar activeTab="orga" onTabChange={navigateFromBottomTab} />
      </div>
    </div>
  );
}
