"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import BottomTabBar from "@/app/components/bottom-tab-bar";
import MessageCenter from "@/app/components/message-center";
import NavBar from "@/app/components/nav-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { navigateFromExternalBottomTab } from "@/lib/bottom-tab-navigation";

export default function MessagesPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const navigateFromBottomTab = (tabId: string) => {
    navigateFromExternalBottomTab(router, tabId);
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background pb-24 lg:pb-0">
        <NavBar />
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
        <div className="lg:hidden">
          <BottomTabBar activeTab="profile" onTabChange={navigateFromBottomTab} />
        </div>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="min-h-screen bg-background pb-24 lg:pb-0">
        <NavBar />
        <div className="flex min-h-[60vh] items-center justify-center px-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Bitte anmelden</CardTitle>
              <CardDescription>Nachrichten sind nur mit Portal-Konto verfügbar.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/">
                <Button className="w-full">Zurück ins Portal</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
        <div className="lg:hidden">
          <BottomTabBar activeTab="profile" onTabChange={navigateFromBottomTab} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-0">
      <NavBar />
      <main className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5">
        <MessageCenter />
      </main>
      <div className="lg:hidden">
        <BottomTabBar activeTab="profile" onTabChange={navigateFromBottomTab} />
      </div>
    </div>
  );
}
