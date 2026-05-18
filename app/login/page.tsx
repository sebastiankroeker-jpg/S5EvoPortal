"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { normalizeCallbackUrl, readPendingAuthContext, startPortalLogin, startPortalRegistration } from "@/lib/auth-flow";

export default function LoginPage() {
  const { status } = useSession();
  const router = useRouter();
  const [callbackUrl, setCallbackUrl] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authErrorCode, setAuthErrorCode] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const resumeAttempted = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setCallbackUrl(normalizeCallbackUrl(params.get("callbackUrl")));
    const errorCode = params.get("error");
    setAuthErrorCode(errorCode);
    const errorMessages: Record<string, string> = {
      OAuthCallback: "Authentik hat den Login oder die Registrierung nicht sauber abgeschlossen. Der Fehler wurde serverseitig protokolliert.",
      Callback: "Der Rueckweg aus Authentik ins Portal ist fehlgeschlagen. Der Fehler wurde serverseitig protokolliert.",
      OAuthSignin: "Authentik konnte den Anmeldeflow nicht starten. Der Fehler wurde serverseitig protokolliert.",
      SessionRequired: "Deine Sitzung ist abgelaufen. Bitte den Login erneut starten.",
    };
    setAuthError(errorCode ? errorMessages[errorCode] ?? `Authentifizierung fehlgeschlagen (${errorCode}). Der Fehler wurde serverseitig protokolliert.` : null);
  }, []);

  useEffect(() => {
    if (status === "authenticated" && callbackUrl) {
      router.replace(callbackUrl);
    }
  }, [status, router, callbackUrl]);

  useEffect(() => {
    if (status !== "unauthenticated" || !callbackUrl || resumeAttempted.current) {
      return;
    }

    const pendingAuth = readPendingAuthContext();
    if (!pendingAuth || pendingAuth.intent !== "registration") {
      return;
    }

    const cameBackFromAuthentik =
      typeof document !== "undefined" &&
      document.referrer.startsWith("https://auth.s5evo.de/");
    const needsRecovery = authErrorCode === "OAuthCallback" || authErrorCode === "Callback";

    if (!cameBackFromAuthentik && !needsRecovery) {
      return;
    }

    resumeAttempted.current = true;
    setAuthError(
      "Authentik hat die Registrierung abgeschlossen. Das Portal startet jetzt einmalig den Rueckweg neu.",
    );
    setIsSubmitting(true);

    void (async () => {
      try {
        await startPortalLogin(pendingAuth.callbackUrl);
      } finally {
        setIsSubmitting(false);
      }
    })();
  }, [authErrorCode, callbackUrl, status]);

  const handleLogin = async () => {
    if (!callbackUrl) return;
    setIsSubmitting(true);
    try {
      await startPortalLogin(callbackUrl);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async () => {
    if (!callbackUrl) return;
    setIsSubmitting(true);
    try {
      await startPortalRegistration(callbackUrl);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (status === "loading" || !callbackUrl) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          <p className="text-muted-foreground text-sm">Portal wird vorbereitet...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>🔐 Ins Portal</CardTitle>
          <CardDescription>
            Melde dich mit deinem bestehenden Konto an oder lege direkt ein neues an.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {authError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {authError}
            </div>
          )}
          <Button onClick={handleLogin} className="w-full" disabled={isSubmitting}>
            Mit bestehendem Konto weiter
          </Button>
          <Button variant="outline" className="w-full" onClick={handleRegister} disabled={isSubmitting}>
              Neues Konto anlegen
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Wenn du aus einer Anmeldemail kommst, nutze bitte dieselbe E-Mail-Adresse wie dort.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
