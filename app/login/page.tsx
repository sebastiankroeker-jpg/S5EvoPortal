"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { normalizeCallbackUrl, startPortalLogin, startPortalRegistration } from "@/lib/auth-flow";

export default function LoginPage() {
  const { status } = useSession();
  const router = useRouter();
  const [callbackUrl, setCallbackUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setCallbackUrl(normalizeCallbackUrl(params.get("callbackUrl")));
  }, []);

  useEffect(() => {
    if (status === "authenticated" && callbackUrl) {
      router.replace(callbackUrl);
    }
  }, [status, router, callbackUrl]);

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
