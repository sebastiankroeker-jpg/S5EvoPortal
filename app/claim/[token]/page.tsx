"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type ClaimState = {
  claim: {
    teamId: string;
    teamName: string;
    competitionName: string;
    competitionYear: number;
    suggestedEmail: string;
    suggestedName?: string | null;
    claimedAt?: string | null;
    expiresAt: string;
    claimedBy?: { email?: string | null; name?: string | null } | null;
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
};

export default function ClaimPage() {
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
        const res = await fetch(`/api/claim/${token}`);
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

  const loginUrl = `/login?callbackUrl=${encodeURIComponent(`/claim/${token}`)}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>🔐 Team-Zuordnung & Bearbeitung</CardTitle>
          <CardDescription>
            Bearbeitungslink für eine bestehende Mannschaftsanmeldung
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
                <p><strong>Vorgesehene E-Mail:</strong> {data.claim.suggestedEmail}</p>
                {data.claim.suggestedName ? <p><strong>Vorgeschlagener Name:</strong> {data.claim.suggestedName}</p> : null}
              </div>

              {!data.session.authenticated && (
                <div className="space-y-3">
                  <p>Bitte melde dich zuerst über Authentik an. Danach prüfen wir, ob dein Account zu dieser Anmeldung passt.</p>
                  <Link href={loginUrl}>
                    <Button className="w-full">Mit Authentik anmelden</Button>
                  </Link>
                </div>
              )}

              {data.session.authenticated && !data.state.emailMatches && !data.state.alreadyClaimedByOtherUser && (
                <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 p-3">
                  Angemeldet bist du als <strong>{data.session.email}</strong>, der Link ist aber für <strong>{data.claim.suggestedEmail}</strong> gedacht.
                </div>
              )}

              {data.state.alreadyClaimedByOtherUser && (
                <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 p-3">
                  Dieser Link wurde bereits von <strong>{data.claim.claimedBy?.email}</strong> eingelöst.
                </div>
              )}

              {(data.state.emailMatches || data.state.alreadyClaimedBySessionUser) && !claimed && (
                <div className="space-y-3">
                  <p>
                    Angemeldet als <strong>{data.session.email}</strong>. Wenn du bestätigst, wird diese Mannschaft mit deinem Account verknüpft.
                  </p>
                  <Button onClick={handleClaim} disabled={claiming} className="w-full">
                    {claiming ? "Verknüpfe..." : data.state.alreadyClaimedBySessionUser ? "Mannschaft öffnen" : "Mannschaft mit meinem Account verknüpfen"}
                  </Button>
                </div>
              )}

              {(claimed || data.state.alreadyClaimedBySessionUser) && (
                <div className="space-y-3">
                  <div className="rounded-md bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 p-3">
                    Die Mannschaft ist mit deinem Account verknüpft. Du kannst jetzt wie gewohnt im Portal weiterarbeiten.
                  </div>
                  <Link href="/">
                    <Button className="w-full">Ins Portal</Button>
                  </Link>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
