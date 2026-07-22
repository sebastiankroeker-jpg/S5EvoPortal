"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, Edit3, Eye, EyeOff, Plus, RefreshCw, Save } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCompetition } from "@/lib/competition-context";
import { useNotifications } from "@/lib/notification-context";

type HomeNewsStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

type HomeNewsEntry = {
  id: string;
  title: string;
  body: string;
  status: HomeNewsStatus;
  publishedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: { name: string | null; email: string };
  updatedBy: { name: string | null; email: string } | null;
};

const EMPTY_FORM = {
  title: "",
  body: "",
  status: "DRAFT" as HomeNewsStatus,
};

const STATUS_META: Record<HomeNewsStatus, { label: string; className: string }> = {
  DRAFT: { label: "Entwurf", className: "border-muted text-muted-foreground" },
  PUBLISHED: { label: "Live", className: "border-green-300 bg-green-50 text-green-800" },
  ARCHIVED: { label: "Archiv", className: "border-amber-300 bg-amber-50 text-amber-800" },
};

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HomeNewsManagement() {
  const notifications = useNotifications();
  const { active: activeCompetition, loading: competitionLoading } = useCompetition();
  const [entries, setEntries] = useState<HomeNewsEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const fetchEntries = useCallback(async () => {
    if (competitionLoading) return;
    setLoading(true);

    try {
      const params = new URLSearchParams();
      if (activeCompetition?.id) params.set("competitionId", activeCompetition.id);
      const response = await fetch(`/api/admin/home-news${params.size ? `?${params}` : ""}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        notifications.error("News konnten nicht geladen werden", data.error || "Bitte später erneut versuchen.");
        return;
      }
      setEntries(Array.isArray(data.entries) ? data.entries : []);
    } catch (error) {
      notifications.error(
        "News konnten nicht geladen werden",
        error instanceof Error ? error.message : "Bitte später erneut versuchen.",
      );
    } finally {
      setLoading(false);
    }
  }, [activeCompetition?.id, competitionLoading, notifications]);

  useEffect(() => {
    void fetchEntries();
  }, [fetchEntries]);

  const activeEntryCount = useMemo(() => entries.filter((entry) => entry.status === "PUBLISHED").length, [entries]);

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const startEdit = (entry: HomeNewsEntry) => {
    setEditingId(entry.id);
    setForm({
      title: entry.title,
      body: entry.body,
      status: entry.status,
    });
  };

  const saveEntry = async () => {
    setSaving(true);

    try {
      const payload = {
        ...form,
        competitionId: activeCompetition?.id,
      };
      const response = await fetch(editingId ? `/api/admin/home-news/${editingId}` : "/api/admin/home-news", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        notifications.error("News konnten nicht gespeichert werden", data.error || "Bitte Eingaben prüfen.");
        return;
      }

      notifications.success(editingId ? "Nachricht aktualisiert" : "Nachricht erstellt");
      resetForm();
      await fetchEntries();
    } catch (error) {
      notifications.error(
        "News konnten nicht gespeichert werden",
        error instanceof Error ? error.message : "Bitte später erneut versuchen.",
      );
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (entry: HomeNewsEntry, status: HomeNewsStatus) => {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/home-news/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, competitionId: activeCompetition?.id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        notifications.error("Status konnte nicht gespeichert werden", data.error || "Bitte später erneut versuchen.");
        return;
      }
      notifications.success(status === "ARCHIVED" ? "Nachricht archiviert" : "Status gespeichert");
      await fetchEntries();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="space-y-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Aktuelles & Neuigkeiten</CardTitle>
              <CardDescription>Nachrichten für die Home-Box pflegen.</CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => void fetchEntries()}>
              <RefreshCw className="mr-2 size-4" />
              Aktualisieren
            </Button>
          </div>
          <div className="rounded-md border border-border/50 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            Öffentlich sichtbar sind nur Live-Nachrichten. Archivierte Nachrichten bleiben für Admins nachvollziehbar.
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
            <Input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Titel"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={form.status === "DRAFT" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setForm((current) => ({ ...current, status: "DRAFT" }))}
              >
                <EyeOff className="mr-1.5 size-3.5" />
                Entwurf
              </Button>
              <Button
                type="button"
                size="sm"
                variant={form.status === "PUBLISHED" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setForm((current) => ({ ...current, status: "PUBLISHED" }))}
              >
                <Eye className="mr-1.5 size-3.5" />
                Live
              </Button>
            </div>
          </div>
          <Textarea
            value={form.body}
            onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
            placeholder="Nachricht"
            rows={5}
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            {editingId && (
              <Button type="button" variant="outline" onClick={resetForm} disabled={saving}>
                Abbrechen
              </Button>
            )}
            <Button type="button" onClick={() => void saveEntry()} disabled={saving || form.title.trim().length < 3 || form.body.trim().length < 3}>
              {editingId ? <Save className="mr-2 size-4" /> : <Plus className="mr-2 size-4" />}
              {saving ? "Speichert..." : editingId ? "Speichern" : "Anlegen"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="px-3 py-2">
            <p className="text-xs text-muted-foreground">Einträge</p>
            <p className="text-xl font-semibold">{entries.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="px-3 py-2">
            <p className="text-xs text-muted-foreground">Live</p>
            <p className="text-xl font-semibold">{activeEntryCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="px-3 py-2">
            <p className="text-xs text-muted-foreground">Wettkampf</p>
            <p className="truncate text-sm font-medium">{activeCompetition?.name || "Tenant-weit"}</p>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </CardContent>
        </Card>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Noch keine Home-Nachrichten angelegt.
          </CardContent>
        </Card>
      ) : (
        entries.map((entry) => {
          const meta = STATUS_META[entry.status];
          return (
            <Card key={entry.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-sm font-semibold">{entry.title}</h3>
                      <Badge variant="outline" className={meta.className}>{meta.label}</Badge>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{entry.body}</p>
                    <p className="text-xs text-muted-foreground">
                      Aktualisiert {formatDateTime(entry.updatedAt)}
                      {entry.updatedBy ? ` von ${entry.updatedBy.name || entry.updatedBy.email}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <Button type="button" size="sm" variant="outline" onClick={() => startEdit(entry)}>
                      <Edit3 className="mr-1.5 size-3.5" />
                      Bearbeiten
                    </Button>
                    {entry.status !== "PUBLISHED" && (
                      <Button type="button" size="sm" variant="outline" onClick={() => void updateStatus(entry, "PUBLISHED")} disabled={saving}>
                        <Eye className="mr-1.5 size-3.5" />
                        Live
                      </Button>
                    )}
                    {entry.status !== "ARCHIVED" && (
                      <Button type="button" size="sm" variant="outline" onClick={() => void updateStatus(entry, "ARCHIVED")} disabled={saving}>
                        <Archive className="mr-1.5 size-3.5" />
                        Archivieren
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
