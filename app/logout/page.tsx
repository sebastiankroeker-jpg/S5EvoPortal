"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { fullSignOut } from "@/lib/auth-helpers";

export default function LogoutPage() {
  const { status } = useSession();

  if (status === "authenticated") {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
        <Card className="w-full max-w-md border-border/60 shadow-lg">
          <CardHeader>
            <CardTitle>Sitzung noch aktiv</CardTitle>
            <CardDescription>
              Die Portal- oder SSO-Session ist noch nicht komplett beendet. Ich stoße den vollständigen Logout direkt erneut an.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full" onClick={() => fullSignOut("/logout")}>
              Vollständig abmelden
            </Button>
            <Link href="/" className={buttonVariants({ variant: "outline", className: "w-full" })}>
              Zur Startseite
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md border-border/60 shadow-lg">
        <CardHeader>
          <CardTitle>Erfolgreich abgemeldet</CardTitle>
          <CardDescription>
            Deine Portal- und Authentik-Sitzung wurden beendet. Für die nächste Anmeldung musst du dich wieder bewusst einloggen.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Link href="/login" className={buttonVariants({ className: "w-full" })}>
            Zum Portal-Login
          </Link>
          <Link href="/" className={buttonVariants({ variant: "outline", className: "w-full" })}>
            Zur Startseite
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
