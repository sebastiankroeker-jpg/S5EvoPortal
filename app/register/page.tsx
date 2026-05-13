"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function RegisterPage() {
  const [callbackUrl, setCallbackUrl] = useState("/");
  const loginUrl = `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;

  useEffect(() => {
    const value = new URL(window.location.href).searchParams.get("callbackUrl") || "/";
    setCallbackUrl(value);
  }, []);

  const handleRegisterRedirect = () => {
    window.location.href = "https://auth.s5evo.de/if/flow/s5-evo-registration/";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">🏅 Neues Konto anlegen</h1>
          <p className="text-muted-foreground mt-2">
            Erstelle dein Portal-Konto, um Mannschaften zu übernehmen und später weiter zu bearbeiten.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Konto erstellen</CardTitle>
            <CardDescription>
              Nutze nach der Erstellung bitte dieselbe E-Mail-Adresse wie in deiner Anmeldung, falls du ein Team übernehmen willst.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={handleRegisterRedirect}
              className="w-full"
              size="lg"
            >
              Neues Konto erstellen
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Nach der Registrierung kannst du zum Portal zurückkehren und mit deinem neuen Konto weitermachen.
            </p>

            <div className="grid gap-2">
              <Link href={loginUrl}>
                <Button variant="outline" className="w-full">Ich habe schon ein Konto</Button>
              </Link>
              {callbackUrl !== "/" && (
                <Link href={callbackUrl}>
                  <Button variant="ghost" className="w-full">Zurück zum Übernahmelink</Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
