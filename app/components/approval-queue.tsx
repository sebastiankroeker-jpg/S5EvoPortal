"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

interface PendingChange {
  id: string;
  changeData: string;
  beforeData?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  participant: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string | null;
    team: { name: string; contactEmail?: string | null };
  };
  requestedBy: {
    name: string | null;
    email: string;
  };
}

type Snapshot = Record<string, string | number | null>;

const fieldLabels: Record<string, string> = {
  firstName: "Vorname",
  lastName: "Nachname",
  birthYear: "Geburtsjahr",
  gender: "Geschlecht",
  disciplineCode: "Disziplin",
  shirtSize: "T-Shirt",
  moderationNote: "Moderationshinweis",
  email: "E-Mail",
  phone: "Telefon",
};

function parseSnapshot(raw?: string | null): Snapshot {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Snapshot;
  } catch {
    return {};
  }
}

function formatValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  if (value === "MALE") return "Männlich";
  if (value === "FEMALE") return "Weiblich";
  if (value === "TBD") return "Noch offen";
  return String(value);
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("de-DE");
}

export default function ApprovalQueue() {
  const [changes, setChanges] = useState<PendingChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});

  const fetchChanges = async () => {
    try {
      const res = await fetch("/api/admin/pending-changes");
      if (res.ok) {
        const data = await res.json();
        setChanges(data.changes || []);
      }
    } catch (err) {
      console.error("Fehler beim Laden der Änderungsanträge:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchChanges();
  }, []);

  const handleAction = async (id: string, action: "approve" | "reject") => {
    setProcessing(id);
    try {
      const res = await fetch("/api/admin/pending-changes/" + id, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, comment: comments[id] || "" }),
      });

      if (res.ok) {
        setChanges((prev) => prev.filter((change) => change.id !== id));
      }
    } catch (err) {
      console.error("Fehler bei Aktion:", err);
    } finally {
      setProcessing(null);
    }
  };

  const changeDiffs = useMemo(() => {
    return changes.reduce((acc, change) => {
      const before = parseSnapshot(change.beforeData);
      const after = parseSnapshot(change.changeData);
      const fields = Object.keys(after)
        .filter((key) => before[key] !== after[key])
        .map((key) => ({
          key,
          before: before[key],
          after: after[key],
        }));
      acc[change.id] = fields;
      return acc;
    }, {} as Record<string, Array<{ key: string; before: string | number | null | undefined; after: string | number | null | undefined }>>);
  }, [changes]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (changes.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <span className="text-4xl">✅</span>
          <p className="mt-2 text-muted-foreground">Keine offenen Änderungsanträge</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">📋 Offene Änderungsanträge ({changes.length})</h3>
      </div>

      <AnimatePresence>
        {changes.map((change) => {
          const fields = changeDiffs[change.id] || [];
          const wasUpdated = change.updatedAt !== change.createdAt;

          return (
            <motion.div
              key={change.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -100 }}
              layout
            >
              <Card className="border-amber-200 dark:border-amber-800">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-sm">
                        {change.participant.firstName} {change.participant.lastName}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Team: {change.participant.team.name} · Beantragt von {change.requestedBy.name || change.requestedBy.email}
                      </CardDescription>
                      <CardDescription className="mt-1 text-xs">
                        Eingegangen: {formatDateTime(change.createdAt)}
                        {wasUpdated ? " · aktualisiert: " + formatDateTime(change.updatedAt) : ""}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="border-amber-300 text-amber-600">
                      ⏳ In Prüfung
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2 rounded-md bg-muted/30 p-3">
                    {fields.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Keine Feldänderungen erkannt.</p>
                    ) : (
                      fields.map((field) => (
                        <div key={field.key} className="grid grid-cols-[120px_1fr_1fr] gap-2 text-xs">
                          <span className="text-muted-foreground">{fieldLabels[field.key] || field.key}</span>
                          <span className="rounded bg-background px-2 py-1 text-muted-foreground">{formatValue(field.before)}</span>
                          <span className="rounded bg-green-50 px-2 py-1 font-medium text-green-800 dark:bg-green-900/20 dark:text-green-200">
                            {formatValue(field.after)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Kommentar der Orga (optional)</label>
                    <Textarea
                      value={comments[change.id] || ""}
                      onChange={(event) => setComments((current) => ({ ...current, [change.id]: event.target.value }))}
                      placeholder="Optionaler Kommentar für die Entscheidung"
                      className="min-h-[88px]"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => void handleAction(change.id, "approve")}
                      disabled={processing === change.id}
                      className="flex-1"
                    >
                      {processing === change.id ? "..." : "✅ Genehmigen"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void handleAction(change.id, "reject")}
                      disabled={processing === change.id}
                      className="flex-1"
                    >
                      {processing === change.id ? "..." : "❌ Ablehnen"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
