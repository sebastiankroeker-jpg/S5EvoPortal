"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function RegisterPage() {
  const handleRegisterRedirect = () => {
    // Redirect to Authentik registration flow
    window.location.href = "https://auth.s5evo.de/if/flow/s5-evo-registration/";
  };

  const handleSocialLogin = (provider: string) => {
    // Redirect to Authentik social login with correct client_id
    const clientId = "aG3hurJM1wq7y0XYMe2St1f7bZrSRvXNhDtJDwZO";
    const redirectUri = encodeURIComponent(window.location.origin + '/api/auth/callback/authentik');
    window.location.href = `https://auth.s5evo.de/application/o/authorize/?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=openid%20profile%20email`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">🏅 Account erstellen</h1>
          <p className="text-muted-foreground mt-2">
            Erstelle einen Account für die Fünfkampf-Anmeldung
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Registrierung</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={handleRegisterRedirect}
              className="w-full"
              size="lg"
            >
              🔐 Anmelden / Registrieren
            </Button>
            
            <p className="text-xs text-muted-foreground text-center">
              Neue Benutzer werden automatisch registriert
            </p>
            
            <div className="text-center text-xs text-muted-foreground">
              <p>Social Login wird bald verfügbar sein</p>
            </div>

            <div className="text-center text-sm text-muted-foreground">
              <p>
                Schon einen Account?{" "}
                <Link href="/api/auth/signin" className="text-primary hover:underline">
                  Hier anmelden
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="text-center text-xs text-muted-foreground">
          Nach der Registrierung erhältst du eine E-Mail zur Bestätigung.
        </div>
      </div>
    </div>
  );
}