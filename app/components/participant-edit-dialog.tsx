"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DISCIPLINES } from "@/lib/domain/team";

interface Participant {
  id: string;
  firstName: string;
  lastName: string;
  birthYear: number;
  gender: string;
  disciplineCode: string;
  email?: string | null;
  phone?: string | null;
  pendingChanges?: { id: string; status: string }[];
}

interface ParticipantEditDialogProps {
  participant: Participant | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  directEdit: boolean; // true = Admin/Teamchef, false = Teilnehmer (Approval)
}

export default function ParticipantEditDialog({
  participant,
  open,
  onOpenChange,
  onSaved,
  directEdit,
}: ParticipantEditDialogProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [gender, setGender] = useState("");
  const [disciplineCode, setDisciplineCode] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ applied: boolean; message?: string } | null>(null);
  const [error, setError] = useState("");

  const hasPendingChange = participant?.pendingChanges?.some(c => c.status === "PENDING");

  useEffect(() => {
    if (participant) {
      setFirstName(participant.firstName);
      setLastName(participant.lastName);
      setBirthYear(String(participant.birthYear));
      setGender(participant.gender);
      setDisciplineCode(participant.disciplineCode);
      setEmail(participant.email || "");
      setPhone(participant.phone || "");
      setResult(null);
      setError("");
    }
  }, [participant]);

  const handleSave = async () => {
    if (!participant) return;
    setSaving(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch(`/api/participants/${participant.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          birthYear: Number(birthYear),
          gender,
          disciplineCode,
          email: email || null,
          phone: phone || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Speichern fehlgeschlagen");
      }

      const data = await res.json();
      setResult({ applied: data.applied, message: data.message });

      if (data.applied) {
        // Direkt angewendet — Dialog nach kurzer Anzeige schließen
        setTimeout(() => {
          onOpenChange(false);
          onSaved();
        }, 1200);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            ✏️ Teilnehmer bearbeiten
            {!directEdit && (
              <Badge variant="outline" className="text-xs">
                Änderung wird geprüft
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {directEdit
              ? "Änderungen werden direkt gespeichert."
              : "Deine Änderungen werden zur Genehmigung eingereicht."}
          </DialogDescription>
        </DialogHeader>

        {hasPendingChange && (
          <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 text-sm p-3 rounded-md">
            ⏳ Es gibt bereits einen offenen Änderungsantrag. Bitte warte auf die Genehmigung.
          </div>
        )}

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Vorname</label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Nachname</label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} className="mt-1" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Geburtsjahr</label>
              <Input
                type="number"
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value)}
                min={1940}
                max={2020}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Geschlecht</label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MALE">Männlich</SelectItem>
                  <SelectItem value="FEMALE">Weiblich</SelectItem>
                  <SelectItem value="DIVERSE">Divers</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Disziplin-Zuordnung</label>
            <Select value={disciplineCode} onValueChange={setDisciplineCode}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TBD">Noch offen</SelectItem>
                {DISCIPLINES.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.icon} {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">E-Mail (optional)</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teilnehmer@example.de"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Telefon (optional)</label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+49 ..."
                className="mt-1"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="text-red-500 text-sm bg-red-50 dark:bg-red-900/20 p-2 rounded">{error}</div>
        )}

        {result && !result.applied && (
          <div className="text-green-700 dark:text-green-300 text-sm bg-green-50 dark:bg-green-900/20 p-3 rounded-md">
            ✅ {result.message || "Änderungsantrag eingereicht!"}
          </div>
        )}

        {result?.applied && (
          <div className="text-green-700 dark:text-green-300 text-sm bg-green-50 dark:bg-green-900/20 p-3 rounded-md">
            ✅ Gespeichert!
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || hasPendingChange || !!result}
          >
            {saving
              ? "Speichert..."
              : directEdit
              ? "💾 Speichern"
              : "📨 Zur Genehmigung einreichen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
