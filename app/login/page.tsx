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
      OAuthCallback: "Authentik hat den Vorgang abgeschlossen, aber der Rueckweg ins Portal war nicht sauber. Bitte den Login noch einmal starten.",
      Callback: "Der Rueckweg aus Authentik ins Portal ist fehlgeschlagen. Bitte den Login erneut starten.",
      OAuthSignin: "Authentik konnte den Anmeldeflow gerade nicht starten. Bitte versuche es erneut.",
      SessionRequired: "Deine Sitzung ist abgelaufen. Bitte starte den Login erneut.",
    };
    setAuthError(errorCode ? errorMessages[errorCode] ?? `Authentifizierung fehlgeschlagen (${errorCode}). Bitte erneut versuchen.` : null);
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
      "Die Registrierung in Authentik scheint fertig zu sein. Das Portal startet jetzt einmalig den Rueckweg neu.",
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
            Melde dich mit deinem bestehenden Konto an oder lege direkt ein neues an. Danach geht es automatisch im Portal weiter.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {authError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {authError}
            </div>
          )}
          {callbackUrl !== "/" && (
            <div className="rounded-md border border-border/50 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              Nach dem Login landest du wieder automatisch beim laufenden Portal-Schritt.
            </div>
          )}
          <Button onClick={handleLogin} className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Leite zu Authentik weiter..." : "Mit bestehendem Konto anmelden"}
          </Button>
          <Button variant="outline" className="w-full" onClick={handleRegister} disabled={isSubmitting}>
            {isSubmitting ? "Bitte kurz warten..." : "Neues Konto anlegen"}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Wenn du aus einer Anmeldemail oder von einem Uebernahmelink kommst, nutze bitte dieselbe E-Mail-Adresse wie dort.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
