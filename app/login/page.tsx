"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const { status } = useSession();
  const router = useRouter();
  const [callbackUrl, setCallbackUrl] = useState("/");
  const registerUrl = `/register?callbackUrl=${encodeURIComponent(callbackUrl)}`;

  useEffect(() => {
    const value = new URL(window.location.href).searchParams.get("callbackUrl") || "/";
    setCallbackUrl(value);
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      router.push(callbackUrl);
    }
  }, [status, router, callbackUrl]);

  const handleLogin = () => {
    signIn("authentik", { callbackUrl });
  };

  if (status === "loading") {
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
          <Button onClick={handleLogin} className="w-full">
            Mit bestehendem Konto weiter
          </Button>
          <Link href={registerUrl}>
            <Button variant="outline" className="w-full">
              Neues Konto anlegen
            </Button>
          </Link>
          <p className="text-xs text-muted-foreground text-center">
            Wenn du aus einer Anmeldemail kommst, nutze bitte dieselbe E-Mail-Adresse wie dort.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
