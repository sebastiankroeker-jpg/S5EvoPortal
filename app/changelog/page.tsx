"use client";

import { useState, useEffect, useCallback, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import NavBar from "@/app/components/nav-bar";
import BottomTabBar from "@/app/components/bottom-tab-bar";

const ENTRY_TYPES = ["BUG", "REQUEST"] as const;
const ENTRY_STATUSES = ["OPEN", "IN_PROGRESS", "DONE"] as const;
const ENTRY_PRIORITIES = ["LOW", "NORMAL", "HIGH"] as const;

type EntryType = (typeof ENTRY_TYPES)[number];
type EntryStatus = (typeof ENTRY_STATUSES)[number];
type EntryPriority = (typeof ENTRY_PRIORITIES)[number];

const TYPE_LABELS: Record<EntryType, string> = {
  BUG: "Fehler",
  REQUEST: "Request",
};

const STATUS_LABELS: Record<EntryStatus, string> = {
  OPEN: "Offen",
  IN_PROGRESS: "In Arbeit",
  DONE: "Erledigt",
};

const PRIORITY_LABELS: Record<EntryPriority, string> = {
  LOW: "Niedrig",
  NORMAL: "Normal",
  HIGH: "Hoch",
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  MODERATOR: "Moderator:in",
  TEAMCHEF: "Teamchef:in",
  TEILNEHMER: "Teilnehmer:in",
  ZUSCHAUER: "Zuschauer:in",
};

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
  const router = useRouter();
  const { status } = useSession();
  const { activeRole, can } = usePermissions();
  const canManageEntries = can("*") || can("team.edit.all");

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
    type: "REQUEST" as EntryType,
    title: "",
    perspective: "",
    priority: "NORMAL" as EntryPriority,
    description: "",
  });
  const [formLoading, setFormLoading] = useState(false);
  const [adminMessage, setAdminMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [updatingEntryId, setUpdatingEntryId] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<{ id: string; type: EntryType; description: string } | null>(null);
  const [lastSubmittedRequest, setLastSubmittedRequest] = useState<string | null>(null);

  const showAdminMessage = useCallback((type: "success" | "error", text: string) => {
    setAdminMessage({ type, text });
    setTimeout(() => setAdminMessage(null), 3500);
  }, []);

  const fetchEntries = useCallback(async () => {
    if (!canManageEntries) return;
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
  }, [filters, canManageEntries]);

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
      setLastSubmittedRequest(formState.title.trim() || formState.description.trim().slice(0, 120));
      showAdminMessage("success", "Danke, ist in der Request-Inbox. Wir prüfen das.");
      setFormState({ type: "REQUEST", title: "", perspective: ROLE_LABELS[activeRole] || activeRole, priority: "NORMAL", description: "" });
      fetchEntries();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Speichern fehlgeschlagen";
      showAdminMessage("error", message);
    } finally {
      setFormLoading(false);
    }
  };

  useEffect(() => {
    if (!formState.perspective) {
      setFormState((prev) => ({ ...prev, perspective: ROLE_LABELS[activeRole] || activeRole }));
    }
  }, [activeRole, formState.perspective]);

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

  const startEditingEntry = (entry: AdminEntry) => {
    setEditingEntry({
      id: entry.id,
      type: entry.type,
      description: entry.description,
    });
  };

  const handleSaveEntry = async () => {
    if (!editingEntry) return;

    const description = editingEntry.description.trim();
    if (description.length < 3) {
      showAdminMessage("error", "Beschreibung ist zu kurz");
      return;
    }

    setUpdatingEntryId(editingEntry.id);
    try {
      const res = await fetch(`/api/admin/changelog-entries/${editingEntry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: editingEntry.type,
          description,
        }),
      });
      if (!res.ok) {
        throw new Error("Update fehlgeschlagen");
      }
      setEditingEntry(null);
      showAdminMessage("success", "Eintrag aktualisiert");
      fetchEntries();
    } catch (error) {
      showAdminMessage("error", "Eintrag konnte nicht gespeichert werden");
    } finally {
      setUpdatingEntryId(null);
    }
  };

  const handleDeleteEntry = async (entry: AdminEntry) => {
    const confirmed = window.confirm("Diesen Request dauerhaft löschen?");
    if (!confirmed) return;

    setUpdatingEntryId(entry.id);
    try {
      const res = await fetch(`/api/admin/changelog-entries/${entry.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error("Löschen fehlgeschlagen");
      }
      if (editingEntry?.id === entry.id) {
        setEditingEntry(null);
      }
      showAdminMessage("success", "Eintrag gelöscht");
      fetchEntries();
    } catch (error) {
      showAdminMessage("error", "Eintrag konnte nicht gelöscht werden");
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

  const navigateFromBottomTab = (tabId: string) => {
    if (tabId === "profile") {
      router.push("/profile");
      return;
    }

    router.push(tabId === "home" ? "/" : `/#${tabId}`);
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background pb-24 lg:pb-0">
        <NavBar />
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
        <div className="lg:hidden">
          <BottomTabBar activeTab="" onTabChange={navigateFromBottomTab} />
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen bg-background pb-24 lg:pb-0">
        <NavBar />
        <div className="flex min-h-[60vh] items-center justify-center px-4">
          <Card className="max-w-md">
            <CardContent className="p-8 text-center space-y-4">
              <p className="text-muted-foreground">Bitte melde dich an, um Projektstand und Requests zu sehen.</p>
              <Link href="/"><Button>Zur Startseite</Button></Link>
            </CardContent>
          </Card>
        </div>
        <div className="lg:hidden">
          <BottomTabBar activeTab="" onTabChange={navigateFromBottomTab} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-0">
      <NavBar />

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          <h1 className="text-3xl font-bold tracking-tight">Feedback & Projektstand</h1>
          <p className="text-muted-foreground">
            Hohe Flughöhe für Release-Stand, bekannte Themen und neue Anforderungen.
          </p>
        </motion.div>

        <section className="grid gap-3 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Aktueller Stand</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              MVP im Live-Test mit rollenbasierter Teamansicht, Datenschutzgrenzen und Orga-Listen.
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Nächste Kante</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Zieleinlauf, Ergebniserfassung und Moderationsfluss sauber ausmodellieren.
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Requests</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Alle angemeldeten Rollen dürfen Feedback und Anforderungen einstellen.
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Request erfassen</CardTitle>
              <CardDescription>Feedback, Fehler oder Anforderungen mit Rolle/Perspektive festhalten</CardDescription>
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
              {lastSubmittedRequest && (
                <div className="mb-4 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-muted-foreground">
                  Zuletzt gesendet: <span className="font-medium text-foreground">{lastSubmittedRequest}</span>
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
                          <SelectItem key={type} value={type}>{TYPE_LABELS[type]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Perspektive</label>
                    <Input
                      value={formState.perspective}
                      onChange={(e) => setFormState((prev) => ({ ...prev, perspective: e.target.value }))}
                      placeholder="z.B. Moderator:in"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Priorität</label>
                    <Select
                      value={formState.priority}
                      onValueChange={(value) => setFormState((prev) => ({ ...prev, priority: value as EntryPriority }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Priorität wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {ENTRY_PRIORITIES.map((priority) => (
                          <SelectItem key={priority} value={priority}>{PRIORITY_LABELS[priority]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Titel</label>
                  <Input
                    value={formState.title}
                    onChange={(e) => setFormState((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="Kurzer Arbeitstitel"
                    maxLength={140}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Beschreibung</label>
                  <Textarea
                    value={formState.description}
                    onChange={(e) => setFormState((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Was soll angepasst, geprüft oder korrigiert werden?"
                    rows={4}
                    minLength={3}
                    required
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    landet direkt in der Request-Inbox der Orga
                  </p>
                  <Button type="submit" disabled={formLoading || formState.description.trim().length < 3}>
                    {formLoading ? "Speichere..." : "Request speichern"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </section>

        {canManageEntries && (
          <section className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Request-Inbox</CardTitle>
                <CardDescription>Einträge filtern und Status aktualisieren</CardDescription>
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
                            <SelectItem key={type} value={type}>{TYPE_LABELS[type]}</SelectItem>
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
                            <SelectItem key={status} value={status}>{STATUS_LABELS[status]}</SelectItem>
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
                            <div className="space-y-2">
                              <p>Keine Einträge gefunden</p>
                              <Button variant="ghost" size="sm" onClick={resetFilters}>
                                Filter zurücksetzen
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )}
                      {entries.map((entry) => (
                        <tr key={entry.id} className="border-t">
                          <td className="px-3 py-2">
                            {editingEntry?.id === entry.id ? (
                              <Select
                                value={editingEntry.type}
                                onValueChange={(value) =>
                                  setEditingEntry((prev) => prev ? { ...prev, type: value as EntryType } : prev)
                                }
                              >
                                <SelectTrigger className="h-8 min-w-24 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {ENTRY_TYPES.map((type) => (
                                    <SelectItem key={type} value={type}>{TYPE_LABELS[type]}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge variant="outline">{TYPE_LABELS[entry.type]}</Badge>
                            )}
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
                                  <SelectItem key={status} value={status}>{STATUS_LABELS[status]}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {editingEntry?.id === entry.id ? (
                              <Textarea
                                value={editingEntry.description}
                                onChange={(event) =>
                                  setEditingEntry((prev) => prev ? { ...prev, description: event.target.value } : prev)
                                }
                                rows={5}
                                className="min-w-72 text-xs"
                              />
                            ) : (
                              <>
                                <p className="line-clamp-3 whitespace-pre-wrap">{entry.description}</p>
                                <p className="mt-1 text-[11px] text-muted-foreground/70">
                                  von {entry.createdBy?.name || entry.createdBy?.email || "Unbekannt"}
                                </p>
                              </>
                            )}
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
                            {editingEntry?.id === entry.id ? (
                              <div className="flex flex-col gap-1">
                                <Button size="sm" disabled={updatingEntryId === entry.id} onClick={handleSaveEntry}>
                                  Speichern
                                </Button>
                                <Button variant="ghost" size="sm" disabled={updatingEntryId === entry.id} onClick={() => setEditingEntry(null)}>
                                  Abbrechen
                                </Button>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-1">
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
                                <Button variant="outline" size="sm" disabled={updatingEntryId === entry.id} onClick={() => startEditingEntry(entry)}>
                                  Bearbeiten
                                </Button>
                                <Button variant="destructive" size="sm" disabled={updatingEntryId === entry.id} onClick={() => handleDeleteEntry(entry)}>
                                  Löschen
                                </Button>
                              </div>
                            )}
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

      <div className="lg:hidden">
        <BottomTabBar activeTab="" onTabChange={navigateFromBottomTab} />
      </div>
    </div>
  );
}
