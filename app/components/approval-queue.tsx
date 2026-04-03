"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";

interface PendingChange {
  id: string;
  changeData: string;
  status: string;
  createdAt: string;
  participant: {
    id: string;
    firstName: string;
    lastName: string;
    team: { name: string };
  };
  requestedBy: {
    name: string | null;
    email: string;
  };
}

export default function ApprovalQueue() {
  const [changes, setChanges] = useState<PendingChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

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
    fetchChanges();
  }, []);

  const handleAction = async (id: string, action: "approve" | "reject") => {
    setProcessing(id);
    try {
      const res = await fetch(`/api/admin/pending-changes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (res.ok) {
        // Entfernen aus der Liste
        setChanges((prev) => prev.filter((c) => c.id !== id));
      }
    } catch (err) {
      console.error("Fehler bei Aktion:", err);
    } finally {
      setProcessing(null);
    }
  };

  const formatChangeData = (raw: string): Record<string, string> => {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  };

  const fieldLabels: Record<string, string> = {
    firstName: "Vorname",
    lastName: "Nachname",
    birthYear: "Geburtsjahr",
    gender: "Geschlecht",
    disciplineCode: "Disziplin",
    email: "E-Mail",
    phone: "Telefon",
  };

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
          <p className="text-muted-foreground mt-2">Keine offenen Änderungsanträge</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">
          📋 Offene Änderungsanträge ({changes.length})
        </h3>
      </div>

      <AnimatePresence>
        {changes.map((change) => {
          const data = formatChangeData(change.changeData);
          const fields = Object.entries(data);

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
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm">
                        {change.participant.firstName} {change.participant.lastName}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Team: {change.participant.team.name} · Beantragt von {change.requestedBy.name || change.requestedBy.email}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="text-amber-600 border-amber-300">
                      ⏳ Offen
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="bg-muted/30 rounded-md p-2 space-y-1">
                    {fields.map(([key, value]) => (
                      <div key={key} className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{fieldLabels[key] || key}</span>
                        <span className="font-medium">{String(value)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleAction(change.id, "approve")}
                      disabled={processing === change.id}
                      className="flex-1"
                    >
                      {processing === change.id ? "..." : "✅ Genehmigen"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAction(change.id, "reject")}
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
