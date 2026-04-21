"use client";

import { useState, useEffect, useCallback, FormEvent } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/lib/permissions-context";
import { CHANGELOG } from "@/lib/data/changelog";
import { APP_VERSION } from "@/lib/version";

const ENTRY_TYPES = ["BUG", "REQUEST"] as const;
const ENTRY_STATUSES = ["OPEN", "IN_PROGRESS", "DONE"] as const;

type EntryType = (typeof ENTRY_TYPES)[number];
type EntryStatus = (typeof ENTRY_STATUSES)[number];

type AdminEntry = {
  id: string;
  type: EntryType;
  status: EntryStatus;
  description: string;
  createdAt: string;
  resolvedAt?: string | null;
  createdBy: { id: string; name: string | null; email: string | null };
  resolvedBy?: { id: string; name: string | null; email: string | null } | null;
};

export default function ChangelogPage() {
  const { status } = useSession();
  const { can } = usePermissions();
  const isAdmin = can("*") || can("team.edit.all");

  const [entries, setEntries] = useState<AdminEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [entriesError, setEntriesError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    type: "ALL" as "ALL" | EntryType,
    status: "ALL" as "ALL" | EntryStatus,
    createdBy: "",
    resolvedBy: "",
    createdFrom: "",
    createdTo: "",
    resolvedFrom: "",
    resolvedTo: "",
  });
  const [formState, setFormState] = useState({
    type: "BUG" as EntryType,
    status: "OPEN" as EntryStatus,
    description: "",
  });
  const [formLoading, setFormLoading] = useState(false);
  const [adminMessage, setAdminMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [updatingEntryId, setUpdatingEntryId] = useState<string | null>(null);

  const showAdminMessage = useCallback((type: "success" | "error", text: string) => {
    setAdminMessage({ type, text });
    setTimeout(() => setAdminMessage(null), 3500);
  }, []);

  const fetchEntries = useCallback(async () => {
    if (!isAdmin) return;
    setEntriesLoading(true);
    setEntriesError(null);

    try {
      const params = new URLSearchParams();
      if (filters.type !== "ALL") params.set("type", filters.type);
      if (filters.status !== "ALL") params.set("status", filters.status);
      if (filters.createdBy) params.set("createdBy", filters.createdBy);
      if (filters.resolvedBy) params.set("resolvedBy", filters.resolvedBy);
      if (filters.createdFrom) params.set("createdFrom", filters.createdFrom);
      if (filters.createdTo) params.set("createdTo", filters.createdTo);
      if (filters.resolvedFrom) params.set("resolvedFrom", filters.resolvedFrom);
      if (filters.resolvedTo) params.set("resolvedTo", filters.resolvedTo);

      const query = params.toString();
      const res = await fetch(`/api/admin/changelog-entries${query ? `?${query}` : ""}`);
      if (!res.ok) {
        throw new Error("API Fehler");
      }
      const data = await res.json();
      setEntries(data.entries || []);
    } catch (error) {
      setEntriesError("Einträge konnten nicht geladen werden");
    } finally {
      setEntriesLoading(false);
    }
  }, [filters, isAdmin]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleCreateEntry = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormLoading(true);
    try {
      const res = await fetch("/api/admin/changelog-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formState),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => null);
        const fieldErrors = error?.error?.fieldErrors;
        const descriptionError = Array.isArray(fieldErrors?.description) ? fieldErrors.description[0] : null;
        throw new Error(descriptionError || (error?.error ? "Validierungsfehler" : "API Fehler"));
      }
      showAdminMessage("success", "Eintrag gespeichert");
      setFormState({ type: "BUG", status: "OPEN", description: "" });
      fetchEntries();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Speichern fehlgeschlagen";
      showAdminMessage("error", message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleStatusUpdate = async (entryId: string, status: EntryStatus) => {
    setUpdatingEntryId(entryId);
    try {
      const res = await fetch(`/api/admin/changelog-entries/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        throw new Error("Update fehlgeschlagen");
      }
      fetchEntries();
    } catch (error) {
      showAdminMessage("error", "Status konnte nicht aktualisiert werden");
    } finally {
      setUpdatingEntryId(null);
    }
  };

  const resetFilters = () => {
    setFilters({
      type: "ALL",
      status: "ALL",
      createdBy: "",
      resolvedBy: "",
      createdFrom: "",
      createdTo: "",
      resolvedFrom: "",
      resolvedTo: "",
    });
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center space-y-4">
            <p className="text-muted-foreground">Bitte melde dich an um den Changelog zu sehen.</p>
            <Link href="/"><Button>Zur Startseite</Button></Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Simple Header */}
      <nav className="flex items-center justify-between px-6 py-3 border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <span className="text-2xl">🏅</span>
            <span className="font-bold text-lg tracking-tight">S5Evo Portal</span>
          </Link>
          <Badge variant="secondary" className="text-xs">{APP_VERSION}</Badge>
        </div>
        <Link href="/">
          <Button variant="ghost" size="sm">← Zurück</Button>
        </Link>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          <h1 className="text-3xl font-bold tracking-tight">📋 Changelog</h1>
          <p className="text-muted-foreground">
            Versionshistorie und Änderungen am S5Evo Portal
          </p>
        </motion.div>

        {isAdmin && (
          <section className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Neuer Eintrag</CardTitle>
                <CardDescription>Fehler oder Anforderungen erfassen</CardDescription>
              </CardHeader>
              <CardContent>
                {adminMessage && (
                  <div
                    className={`mb-4 rounded-md border px-3 py-2 text-sm ${
                      adminMessage.type === "success"
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : "border-destructive/40 bg-destructive/10 text-destructive"
                    }`}
                  >
                    {adminMessage.text}
                  </div>
                )}
                <form onSubmit={handleCreateEntry} className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Typ</label>
                      <Select
                        value={formState.type}
                        onValueChange={(value) => setFormState((prev) => ({ ...prev, type: value as EntryType }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Typ wählen" />
                        </SelectTrigger>
                        <SelectContent>
                          {ENTRY_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Status</label>
                      <Select
                        value={formState.status}
                        onValueChange={(value) => setFormState((prev) => ({ ...prev, status: value as EntryStatus }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Status wählen" />
                        </SelectTrigger>
                        <SelectContent>
                          {ENTRY_STATUSES.map((status) => (
                            <SelectItem key={status} value={status}>{status}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Beschreibung</label>
                    <Textarea
                      value={formState.description}
                      onChange={(e) => setFormState((prev) => ({ ...prev, description: e.target.value }))}
                      placeholder="Was soll angepasst oder korrigiert werden?"
                      rows={4}
                      minLength={3}
                      required
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="submit" disabled={formLoading || formState.description.trim().length < 3}>
                      {formLoading ? "Speichere..." : "Eintrag hinzufügen"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Admin-Liste</CardTitle>
                <CardDescription>Filtere und aktualisiere Einträge</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Typ</label>
                      <Select
                        value={filters.type}
                        onValueChange={(value) => setFilters((prev) => ({ ...prev, type: value as "ALL" | EntryType }))}
                      >
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">Alle</SelectItem>
                          {ENTRY_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Status</label>
                      <Select
                        value={filters.status}
                        onValueChange={(value) => setFilters((prev) => ({ ...prev, status: value as "ALL" | EntryStatus }))}
                      >
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">Alle</SelectItem>
                          {ENTRY_STATUSES.map((status) => (
                            <SelectItem key={status} value={status}>{status}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Ersteller (E-Mail oder ID)</label>
                      <Input
                        value={filters.createdBy}
                        onChange={(e) => setFilters((prev) => ({ ...prev, createdBy: e.target.value }))}
                        placeholder="max@example.com"
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Erlediger (E-Mail oder ID)</label>
                      <Input
                        value={filters.resolvedBy}
                        onChange={(e) => setFilters((prev) => ({ ...prev, resolvedBy: e.target.value }))}
                        placeholder="admin@example.com"
                        className="h-9"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Erstellt ab</label>
                      <Input
                        type="date"
                        value={filters.createdFrom}
                        onChange={(e) => setFilters((prev) => ({ ...prev, createdFrom: e.target.value }))}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Erstellt bis</label>
                      <Input
                        type="date"
                        value={filters.createdTo}
                        onChange={(e) => setFilters((prev) => ({ ...prev, createdTo: e.target.value }))}
                        className="h-9"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Erledigt ab</label>
                      <Input
                        type="date"
                        value={filters.resolvedFrom}
                        onChange={(e) => setFilters((prev) => ({ ...prev, resolvedFrom: e.target.value }))}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Erledigt bis</label>
                      <Input
                        type="date"
                        value={filters.resolvedTo}
                        onChange={(e) => setFilters((prev) => ({ ...prev, resolvedTo: e.target.value }))}
                        className="h-9"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-muted-foreground">
                    {entriesLoading ? "Lade Einträge..." : `${entries.length} Einträge`}
                    {entriesError && <span className="text-destructive ml-2">{entriesError}</span>}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={resetFilters} disabled={entriesLoading}>
                      Filter zurücksetzen
                    </Button>
                    <Button variant="outline" size="sm" onClick={fetchEntries} disabled={entriesLoading}>
                      Aktualisieren
                    </Button>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left">Typ</th>
                        <th className="px-3 py-2 text-left">Status</th>
                        <th className="px-3 py-2 text-left">Beschreibung</th>
                        <th className="px-3 py-2 text-left">Erstellt</th>
                        <th className="px-3 py-2 text-left">Erledigt</th>
                        <th className="px-3 py-2 text-left">Aktion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.length === 0 && !entriesLoading && (
                        <tr>
                          <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                            Keine Einträge gefunden
                          </td>
                        </tr>
                      )}
                      {entries.map((entry) => (
                        <tr key={entry.id} className="border-t">
                          <td className="px-3 py-2">
                            <Badge variant="outline">{entry.type}</Badge>
                          </td>
                          <td className="px-3 py-2">
                            <Select
                              value={entry.status}
                              onValueChange={(value) => handleStatusUpdate(entry.id, value as EntryStatus)}
                              disabled={updatingEntryId === entry.id}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ENTRY_STATUSES.map((status) => (
                                  <SelectItem key={status} value={status}>{status}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            <p className="line-clamp-3 whitespace-pre-wrap">{entry.description}</p>
                            <p className="mt-1 text-[11px] text-muted-foreground/70">
                              von {entry.createdBy?.name || entry.createdBy?.email || "Unbekannt"}
                            </p>
                          </td>
                          <td className="px-3 py-2 text-xs">
                            <p>{new Date(entry.createdAt).toLocaleString("de-DE")}</p>
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {entry.resolvedAt ? (
                              <div>
                                <p>{new Date(entry.resolvedAt).toLocaleString("de-DE")}</p>
                                <p className="text-[11px] text-muted-foreground/70">
                                  {entry.resolvedBy?.name || entry.resolvedBy?.email || "–"}
                                </p>
                              </div>
                            ) : (
                              <span className="text-muted-foreground/70">–</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            <Button
                              variant={entry.status === "DONE" ? "ghost" : "secondary"}
                              size="sm"
                              disabled={updatingEntryId === entry.id}
                              onClick={() =>
                                handleStatusUpdate(
                                  entry.id,
                                  entry.status === "DONE" ? "OPEN" : "DONE"
                                )
                              }
                            >
                              {entry.status === "DONE" ? "Reopen" : "Erledigt"}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        <div className="space-y-4">
          {CHANGELOG.map((entry, index) => (
            <motion.div
              key={entry.version}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className={index === 0 ? "border-primary/50" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-lg">{entry.version}</CardTitle>
                      {index === 0 && (
                        <Badge variant="default" className="text-xs">Aktuell</Badge>
                      )}
                    </div>
                    <CardDescription>{entry.date}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-2">
                    {entry.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center py-8 text-xs text-muted-foreground"
        >
          S5Evo Portal {APP_VERSION} • Mannschaftsfünfkampf • Built with ❤️
        </motion.footer>
      </main>
    </div>
  );
}
