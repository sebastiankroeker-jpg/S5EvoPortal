"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type ClaimState = {
  claim: {
    teamId: string;
    teamName: string;
    competitionName: string;
    competitionYear: number;
    maskedSuggestedEmail?: string | null;
    claimedAt?: string | null;
    expiresAt: string;
  };
  session: {
    authenticated: boolean;
    email?: string | null;
    name?: string | null;
  };
  state: {
    emailMatches: boolean;
    alreadyClaimedBySessionUser: boolean;
    requiresLogin: boolean;
    alreadyClaimedByOtherUser: boolean;
  };
  settings: {
    claimLinksEnabled: boolean;
  };
};

export default function ClaimPage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const token = Array.isArray(params?.token) ? params.token[0] : params?.token;
  const [data, setData] = useState<ClaimState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    if (!token) return;

    (async () => {
      try {
        const res = await fetch(`/api/claim/${token}`, { cache: "no-store" });
        const payload = await res.json();
        if (!res.ok) {
          throw new Error(payload.error || "Link konnte nicht geladen werden");
        }
        setData(payload);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Link konnte nicht geladen werden");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  useEffect(() => {
    if (!data?.state.alreadyClaimedBySessionUser) return;
    window.history.replaceState(null, "", "/");
  }, [data?.state.alreadyClaimedBySessionUser]);

  const handleClaim = async () => {
    if (!token) return;
    setClaiming(true);
    setError("");

    try {
      const res = await fetch(`/api/claim/${token}`, { method: "POST" });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || "Claim fehlgeschlagen");
      }
      window.history.replaceState(null, "", "/");
      setClaimed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Claim fehlgeschlagen");
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const callbackUrl = `/claim/${token}`;
  const loginUrl = `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;
  const registerUrl = `/register?callbackUrl=${encodeURIComponent(callbackUrl)}`;
  const sessionEmail = data?.session.email || "deinem Konto";
  const claimEmail = data?.claim.maskedSuggestedEmail || "der vorgesehenen E-Mail";

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>🔐 Team übernehmen & im Portal bearbeiten</CardTitle>
          <CardDescription>
            Dieser Link ordnet eine bestehende Mannschaftsanmeldung deinem Portal-Konto zu. Du brauchst dafuer dieselbe E-Mail-Adresse wie bei der Anmeldung.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-3 text-sm">
              {error}
            </div>
          )}

          {data && (
            <div className="space-y-3 text-sm">
              <div className="rounded-md border p-3 space-y-1">
                <p><strong>Team:</strong> {data.claim.teamName}</p>
                <p><strong>Wettkampf:</strong> {data.claim.competitionName} ({data.claim.competitionYear})</p>
                <p><strong>Vorgesehene E-Mail:</strong> {data.claim.maskedSuggestedEmail || "hinterlegt"}</p>
                <p><strong>Link gültig bis:</strong> {new Date(data.claim.expiresAt).toLocaleString("de-DE")}</p>
              </div>

              {!data.session.authenticated && (
                <div className="space-y-3">
                  <div className="rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">
                    Bitte melde dich jetzt mit der bei der Anmeldung verwendeten E-Mail im Portal an. Falls du noch kein Konto hast, kannst du es direkt damit anlegen. Hinterlegt ist aktuell <strong>{claimEmail}</strong>.
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Link href={loginUrl}>
                      <Button className="w-full">Mit bestehendem Konto anmelden</Button>
                    </Link>
                    <Link href={registerUrl}>
                      <Button variant="outline" className="w-full">Neues Konto anlegen</Button>
                    </Link>
                  </div>
                </div>
              )}

              {data.session.authenticated && !data.state.emailMatches && !data.state.alreadyClaimedByOtherUser && (
                <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 p-3 space-y-3">
                  <p>Angemeldet bist du als <strong>{sessionEmail}</strong>, der Link ist aber fuer eine andere hinterlegte E-Mail gedacht.</p>
                  <p className="text-sm">Bitte melde dich mit der richtigen E-Mail neu an oder lege damit ein Konto an. Erst dann laesst sich die Mannschaft uebernehmen.</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Link href={loginUrl}>
                      <Button className="w-full">Mit anderer E-Mail anmelden</Button>
                    </Link>
                    <Link href={registerUrl}>
                      <Button variant="outline" className="w-full">Konto mit richtiger E-Mail anlegen</Button>
                    </Link>
                  </div>
                </div>
              )}

              {data.state.alreadyClaimedByOtherUser && (
                <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 p-3 space-y-2">
                  <p>Dieser Link wurde bereits eingelöst.</p>
                  <p className="text-sm">Wenn das nicht so sein sollte, melde dich bitte direkt bei der Orga.</p>
                </div>
              )}

              {!data.settings.claimLinksEnabled && !data.state.alreadyClaimedBySessionUser && (
                <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 p-3 space-y-2">
                  <p>Die Einlösung von Claim-Links ist aktuell global deaktiviert.</p>
                  <p className="text-sm">Bitte melde dich direkt bei der Orga, wenn das Team kurzfristig übernommen werden soll.</p>
                </div>
              )}

              {(data.state.emailMatches || data.state.alreadyClaimedBySessionUser) && !claimed && data.settings.claimLinksEnabled && (
                <div className="space-y-3">
                  <p>
                    Angemeldet als <strong>{sessionEmail}</strong>. Wenn du bestaetigst, wird diese Mannschaft mit deinem Account verknuepft.
                  </p>
                  <div className="rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">
                    Danach laeuft die weitere Bearbeitung ganz normal im Portal. Diesen Link brauchst du dann nicht mehr.
                  </div>
                  <Button onClick={handleClaim} disabled={claiming} className="w-full">
                    {claiming ? "Verknuepfe Mannschaft..." : data.state.alreadyClaimedBySessionUser ? "Mannschaft im Portal oeffnen" : "Mannschaft mit meinem Account verknuepfen"}
                  </Button>
                </div>
              )}

              {(claimed || data.state.alreadyClaimedBySessionUser) && (
                <div className="space-y-3">
                  <div className="rounded-md bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 p-3">
                    Die Mannschaft ist mit deinem Account verknuepft. Du kannst jetzt wie gewohnt im Portal weiterarbeiten.
                  </div>
                  <div className="rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">
                    Naechster Schritt: im Portal ins Mannschafts-Dashboard wechseln und das Team dort weiter pflegen.
                  </div>
                  <Button className="w-full" onClick={() => router.push("/")}>Ins Portal</Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
