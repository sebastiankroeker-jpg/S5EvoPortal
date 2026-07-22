"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/lib/permissions-context";
import NavBar from "@/app/components/nav-bar";
import EventMap from "@/app/components/event-map";

export default function AdminEventMapPage() {
  const { data: session, status } = useSession();
  const { can, isLoading: permissionsLoading } = usePermissions();
  const hasAdminAccess = !!session && can("config.edit");

  if (status === "loading" || permissionsLoading) {
    return (
      <div className="min-h-screen bg-background">
        <NavBar />
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  if (!hasAdminAccess) {
    return (
      <div className="min-h-screen bg-background">
        <NavBar />
        <div className="mx-auto flex min-h-[60vh] max-w-md items-center justify-center px-4">
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Kein Zugriff</CardTitle>
              <CardDescription>Die Event-Karte ist vorerst nur fuer Admins sichtbar.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/">
                <Button className="w-full">Zurueck zur Startseite</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <EventMap />
    </div>
  );
}
