"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function RegisterPage() {
  const handleRegisterRedirect = () => {
    // Redirect to Authentik registration flow
    window.location.href = "https://auth.s5evo.de/if/flow/default-registration-flow/";
  };

  const handleSocialLogin = (provider: string) => {
    // Redirect to Authentik social login
    window.location.href = `https://auth.s5evo.de/application/o/authorize/?response_type=code&client_id=s5-evo-portal&redirect_uri=${encodeURIComponent(window.location.origin + '/api/auth/callback/authentik')}&scope=openid%20profile%20email&provider=${provider}`;
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
              📧 Mit E-Mail registrieren
            </Button>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Oder mit Social Login
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Button 
                onClick={() => handleSocialLogin('google')}
                variant="outline"
                className="w-full"
                size="lg"
              >
                🔍 Mit Google
              </Button>
              <Button 
                onClick={() => handleSocialLogin('github')}
                variant="outline"
                className="w-full"
                size="lg"
              >
                🐙 Mit GitHub
              </Button>
            </div>

            <div className="text-center text-sm text-muted-foreground">
              <p>
                Schon einen Account?{" "}
                <a href="/api/auth/signin" className="text-primary hover:underline">
                  Hier anmelden
                </a>
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