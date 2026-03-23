"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (session?.user) {
      setName(session.user.name || "");
      setEmail(session.user.email || "");
    }
  }, [session]);

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
    try {
      const res = await fetch("/api/profile", { method: "DELETE" });
      if (!res.ok) throw new Error("Löschen fehlgeschlagen");
      // Sign out after deletion
      signOut({ callbackUrl: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
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
              <CardDescription>Name und E-Mail aus deinem Authentik-Konto</CardDescription>
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
                  Wird als Teamchef:in-Name bei Anmeldungen verwendet
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
                  Wird über Authentik verwaltet — <a href="https://auth.s5evo.de" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">dort ändern</a>
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
                <span className="text-muted-foreground">Identity Provider</span>
                <span className="font-medium">Authentik (auth.s5evo.de)</span>
              </div>
              <div className="pt-2">
                <Button variant="outline" onClick={() => signOut({ callbackUrl: "/" })} className="w-full">
                  Abmelden
                </Button>
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
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Konto löschen</p>
                  <p className="text-xs text-muted-foreground">Alle deine Daten und Teams werden unwiderruflich gelöscht</p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" disabled={deleting}>
                      {deleting ? "Lösche..." : "Konto löschen"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Konto wirklich löschen?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Dein Profil, alle deine Teams und Teilnehmerdaten werden unwiderruflich gelöscht. 
                        Dein Authentik-Konto bleibt bestehen und kann separat unter auth.s5evo.de gelöscht werden.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                        Ja, Konto löschen
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
