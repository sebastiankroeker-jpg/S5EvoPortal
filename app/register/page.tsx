"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { normalizeCallbackUrl, startPortalRegistration } from "@/lib/auth-flow";

export default function RegisterPage() {
  const { status } = useSession();
  const router = useRouter();
  const [callbackUrl, setCallbackUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const redirectStarted = useRef(false);
  const resolvedCallbackUrl = callbackUrl || "/";
  const loginUrl = `/login?callbackUrl=${encodeURIComponent(resolvedCallbackUrl)}`;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setCallbackUrl(normalizeCallbackUrl(params.get("callbackUrl")));
  }, []);

  useEffect(() => {
    if (status === "authenticated" && callbackUrl) {
      router.replace(callbackUrl);
    }
  }, [status, router, callbackUrl]);

  useEffect(() => {
    if (status !== "unauthenticated" || !callbackUrl || redirectStarted.current) return;
    redirectStarted.current = true;

    void (async () => {
      try {
        await startPortalRegistration(callbackUrl);
      } catch {
        setError("Die Weiterleitung zu Authentik konnte nicht vorbereitet werden.");
        redirectStarted.current = false;
      }
    })();
  }, [status, callbackUrl]);

  const handleRegisterRedirect = async () => {
    if (!callbackUrl) return;
    setError(null);
    try {
      await startPortalRegistration(callbackUrl);
    } catch {
      setError("Die Weiterleitung zu Authentik konnte nicht vorbereitet werden.");
    }
  };

  if (status === "loading" || !callbackUrl) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          <p className="text-muted-foreground text-sm">Registrierung wird vorbereitet...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">🏅 Neues Konto anlegen</h1>
          <p className="text-muted-foreground mt-2">
            Die Kontoerstellung muss im laufenden Portal-Login passieren, damit Authentik den Rückweg ins Portal sauber beibehält.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Konto erstellen</CardTitle>
            <CardDescription>
              Du wirst direkt in den Authentik-Registrierungsflow weitergeleitet. Danach kommt der Rückweg sauber wieder im Portal an.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
            <Button
              onClick={handleRegisterRedirect}
              className="w-full"
              size="lg"
            >
              Erneut zu Authentik weiterleiten
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Falls die automatische Weiterleitung nicht anspringt, löst der Button denselben Flow manuell aus.
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
