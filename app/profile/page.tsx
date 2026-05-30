"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { fullSignOut } from "@/lib/auth-helpers";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/lib/theme-context";
import { APP_VERSION } from "@/lib/version";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type LinkedParticipant = {
  id: string;
  firstName: string;
  lastName: string;
  disciplineCode?: string | null;
  team: {
    id: string;
    name: string;
  };
};

type ProfileResponse = {
  user: {
    id: string;
    name: string | null;
    email: string;
    linkedParticipants?: LinkedParticipant[];
  };
};

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const { theme, setTheme } = useTheme();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [linkedParticipants, setLinkedParticipants] = useState<LinkedParticipant[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [error, setError] = useState("");
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    if (session?.user) {
      setName(session.user.name || "");
      setEmail(session.user.email || "");
    }
  }, [session]);

  useEffect(() => {
    if (!session?.user) return;

    let cancelled = false;
    setLoadingProfile(true);

    fetch("/api/profile")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Profil konnte nicht geladen werden"))))
      .then((data: ProfileResponse) => {
        if (cancelled) return;
        setName(data.user.name || "");
        setEmail(data.user.email || "");
        setLinkedParticipants(data.user.linkedParticipants || []);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Profil konnte nicht geladen werden");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingProfile(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session?.user]);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("Speichern fehlgeschlagen");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError("");
    setDeleteError("");
    try {
      const res = await fetch("/api/profile", { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Löschen fehlgeschlagen");
      // Sign out after deletion
      fullSignOut();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Unbekannter Fehler");
      setDeleting(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Bitte melde dich an um dein Profil zu sehen.</p>
            <Link href="/">
              <Button className="mt-4">Zur Startseite</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="flex items-center justify-between px-6 py-2 border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <span className="text-2xl">🏅</span>
            <span className="font-bold text-lg tracking-tight">S5Evo Portal</span>
          </Link>
          <Link href="/changelog">
            <Badge variant="secondary" className="text-xs hover:bg-primary/20 cursor-pointer transition-colors">{APP_VERSION}</Badge>
          </Link>
        </div>
        <Link href="/">
          <Button variant="ghost" size="sm">← Zurück</Button>
        </Link>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          <h1 className="text-3xl font-bold tracking-tight">👤 Mein Profil</h1>
          <p className="text-muted-foreground">Deine persönlichen Daten verwalten</p>
        </motion.div>

        {/* Profile Data */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Profildaten</CardTitle>
              <CardDescription>Name und E-Mail aus deinem Portal-Konto</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Anzeigename</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Vor- und Nachname"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Wird als Team-Manager-Name bei Anmeldungen verwendet
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">E-Mail</label>
                <Input
                  value={email}
                  disabled
                  className="mt-1 opacity-60"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Wird zentral verwaltet — <a href="https://auth.s5evo.de" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Kontoverwaltung öffnen</a>
                </p>
              </div>

              {error && (
                <div className="text-red-500 text-sm bg-red-50 dark:bg-red-900/20 p-2 rounded">{error}</div>
              )}

              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "Speichert..." : saved ? "✓ Gespeichert!" : "💾 Speichern"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Teilnehmer-Zuordnung</CardTitle>
              <CardDescription>Teilnehmerprofile, die bereits mit deinem Portal-Konto verknüpft sind</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loadingProfile ? (
                <div className="text-sm text-muted-foreground">Lade Teilnehmer-Zuordnungen...</div>
              ) : linkedParticipants.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  Aktuell ist noch kein Teilnehmerprofil mit deinem Konto verknüpft.
                </div>
              ) : (
                <div className="space-y-2">
                  {linkedParticipants.map((participant) => (
                    <div key={participant.id} className="rounded-md border p-3 flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="font-medium">{participant.firstName} {participant.lastName}</div>
                        <div className="text-sm text-muted-foreground">
                          Team {participant.team.name}
                          {participant.disciplineCode ? ` · ${participant.disciplineCode}` : ""}
                        </div>
                      </div>
                      <Badge variant="secondary">Verknüpft</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Session Info */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Session</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Angemeldet als</span>
                <span className="font-medium">{session.user.email}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Anmeldedienst</span>
                <span className="font-medium">S5Evo Konto</span>
              </div>
              <div className="pt-2">
                <Button variant="outline" onClick={() => fullSignOut()} className="w-full">
                  Abmelden
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Darstellung / Appearance */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">🎨 Darstellung</CardTitle>
              <CardDescription>Wähle ein Theme für das Portal</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {([
                  { id: "light" as const, label: "Light", icon: "☀️", desc: "Hell & klar" },
                  { id: "dark" as const, label: "Dark", icon: "🌙", desc: "Dunkel & schonend" },
                  { id: "esv" as const, label: "ESV", icon: "🏅", desc: "Vereinsfarben" },
                  { id: "bunt" as const, label: "Bunt", icon: "🌈", desc: "Farbenfroh" },
                ]).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all ${
                      theme === t.id
                        ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                        : "border-border/40 hover:border-border hover:bg-accent/50"
                    }`}
                  >
                    <span className="text-2xl">{t.icon}</span>
                    <span className="text-sm font-medium">{t.label}</span>
                    <span className="text-[10px] text-muted-foreground">{t.desc}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Danger Zone */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <Card className="border-red-200 dark:border-red-900">
            <CardHeader>
              <CardTitle className="text-lg text-red-600 dark:text-red-400">⚠️ Gefahrenzone</CardTitle>
              <CardDescription>Diese Aktionen können nicht rückgängig gemacht werden</CardDescription>
            </CardHeader>
            <CardContent>
              {deleteError && (
                <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                  {deleteError}
                </div>
              )}
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Konto löschen</p>
                  <p className="text-xs text-muted-foreground">Alle deine Daten und Teams werden unwiderruflich gelöscht</p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger
                    render={(
                      <Button
                        type="button"
                        disabled={deleting}
                        className="h-8 bg-red-600 px-3 text-white hover:bg-red-700"
                      />
                    )}
                  >
                    {deleting ? "Lösche..." : "Konto löschen"}
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Konto wirklich löschen?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Dein Profil, alle deine Teams und Teilnehmerdaten werden unwiderruflich gelöscht. 
                        Dein Portal-Konto bleibt separat bestehen und kann bei Bedarf in der Kontoverwaltung gelöscht werden.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700">
                        {deleting ? "Löscht..." : "Ja, Konto löschen"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}
