"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type ParticipantClaimState = {
  claim: {
    participantId: string;
    participantName: string;
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

export default function ParticipantClaimPage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const token = Array.isArray(params?.token) ? params.token[0] : params?.token;
  const [data, setData] = useState<ParticipantClaimState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    if (!token) return;

    (async () => {
      try {
        const res = await fetch(`/api/participant-claim/${token}`, { cache: "no-store" });
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
      const res = await fetch(`/api/participant-claim/${token}`, { method: "POST" });
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

  const callbackUrl = `/participant-claim/${token}`;
  const loginUrl = `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;
  const registerUrl = `/register?callbackUrl=${encodeURIComponent(callbackUrl)}`;
  const sessionEmail = data?.session.email || "deinem Konto";
  const claimEmail = data?.claim.maskedSuggestedEmail || "der vorgesehenen E-Mail";

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>🔐 Teilnehmerprofil im Portal verknüpfen</CardTitle>
          <CardDescription>
            Dieser Link ordnet genau einen Teilnehmer deinem Portal-Konto zu. Du brauchst dafür dieselbe E-Mail-Adresse wie in der Einladung.
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
                <p><strong>Teilnehmer:</strong> {data.claim.participantName}</p>
                <p><strong>Team:</strong> {data.claim.teamName}</p>
                <p><strong>Wettkampf:</strong> {data.claim.competitionName} ({data.claim.competitionYear})</p>
                <p><strong>Vorgesehene E-Mail:</strong> {data.claim.maskedSuggestedEmail || "hinterlegt"}</p>
                <p><strong>Link gültig bis:</strong> {new Date(data.claim.expiresAt).toLocaleString("de-DE")}</p>
              </div>

              {!data.session.authenticated && (
                <div className="space-y-3">
                  <div className="rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">
                    Bitte melde dich jetzt mit der vorgesehenen E-Mail im Portal an. Falls du noch kein Konto hast, kannst du es direkt damit anlegen. Hinterlegt ist aktuell <strong>{claimEmail}</strong>.
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
                  <p>Angemeldet bist du als <strong>{sessionEmail}</strong>, der Link ist aber für eine andere hinterlegte E-Mail gedacht.</p>
                  <p className="text-sm">Bitte melde dich mit der richtigen E-Mail neu an oder lege damit ein Konto an.</p>
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
                  <p>Dieser Link wurde bereits eingelöst oder der Teilnehmer ist bereits mit einem anderen Account verknüpft.</p>
                  <p className="text-sm">Wenn das nicht so sein sollte, melde dich bitte direkt bei der Orga.</p>
                </div>
              )}

              {!data.settings.claimLinksEnabled && !data.state.alreadyClaimedBySessionUser && (
                <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 p-3 space-y-2">
                  <p>Die Einlösung von Claim-Links ist aktuell global deaktiviert.</p>
                  <p className="text-sm">Bitte melde dich direkt bei der Orga, wenn die Verknüpfung kurzfristig nötig ist.</p>
                </div>
              )}

              {(data.state.emailMatches || data.state.alreadyClaimedBySessionUser) && !claimed && data.settings.claimLinksEnabled && (
                <div className="space-y-3">
                  <p>
                    Angemeldet als <strong>{sessionEmail}</strong>. Wenn du bestätigst, wird dieser Teilnehmer mit deinem Account verknüpft.
                  </p>
                  <div className="rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">
                    Danach kannst du deine eigenen Teilnehmerdaten im Portal pflegen. Das Team selbst wird dadurch nicht auf dich umgeschrieben.
                  </div>
                  <Button onClick={handleClaim} disabled={claiming} className="w-full">
                    {claiming ? "Verknüpfe Teilnehmer..." : data.state.alreadyClaimedBySessionUser ? "Teilnehmerprofil im Portal öffnen" : "Teilnehmer mit meinem Account verknüpfen"}
                  </Button>
                </div>
              )}

              {(claimed || data.state.alreadyClaimedBySessionUser) && (
                <div className="space-y-3">
                  <div className="rounded-md bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 p-3">
                    Der Teilnehmer ist mit deinem Account verknüpft. Du kannst jetzt im Portal deine eigenen Daten pflegen.
                  </div>
                  <Button className="w-full" onClick={() => router.push("/profile")}>Zum Profil</Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
