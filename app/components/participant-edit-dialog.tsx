"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DISCIPLINES,
  birthYearToBirthDateInput,
  extractBirthYearFromInput,
  formatBirthDateInput,
  resolveBirthDateInputKey,
} from "@/lib/domain/team";
import { SHIRT_SIZES, isShirtOrderClosed } from "@/lib/domain/shirts";

interface Participant {
  id: string;
  firstName: string;
  lastName: string;
  birthYear?: number;
  birthDate?: string;
  gender: string;
  disciplineCode?: string;
  discipline?: string;
  shirtSize?: string | null;
  moderationNote?: string | null;
  email?: string | null;
  phone?: string | null;
  pendingChanges?: { id: string; status: string; updatedAt?: string | null; reviewedAt?: string | null; reviewComment?: string | null }[];
}

type ParticipantChangeStatus = {
  id: string;
  status: string;
  updatedAt?: string | null;
  reviewedAt?: string | null;
  reviewComment?: string | null;
};

interface ParticipantEditDialogProps {
  participant: Participant | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  directEdit: boolean; // true = Admin/Teamchef, false = Teilnehmer (Approval)
  isAdminEdit?: boolean;
  showModerationNote?: boolean;
}

function normalizeGenderValue(value?: string | null) {
  if (value === "W" || value === "FEMALE") return "FEMALE";
  return "MALE";
}

function normalizeDisciplineValue(value?: string | null) {
  return value || "TBD";
}

function getStatusMeta(status?: string | null) {
  if (status === "PENDING") {
    return {
      title: "Änderung in Prüfung",
      text: "Dein letzter Änderungsantrag ist aktuell bei der Orga in Prüfung.",
      className: "bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200",
    };
  }

  if (status === "APPROVED") {
    return {
      title: "Letzte Änderung genehmigt",
      text: "Deine letzte Änderungsanfrage wurde genehmigt.",
      className: "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200",
    };
  }

  if (status === "REJECTED") {
    return {
      title: "Letzte Änderung abgelehnt",
      text: "Deine letzte Änderungsanfrage wurde abgelehnt.",
      className: "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200",
    };
  }

  return null;
}

export default function ParticipantEditDialog({
  participant,
  open,
  onOpenChange,
  onSaved,
  directEdit,
  isAdminEdit = false,
  showModerationNote = false,
}: ParticipantEditDialogProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("");
  const [disciplineCode, setDisciplineCode] = useState("");
  const [shirtSize, setShirtSize] = useState("");
  const [moderationNote, setModerationNote] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [shirtOrderDeadline, setShirtOrderDeadline] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ applied: boolean; message?: string } | null>(null);
  const [error, setError] = useState("");
  const [latestChange, setLatestChange] = useState<ParticipantChangeStatus | null>(null);

  const hasPendingChange = latestChange?.status === "PENDING" || participant?.pendingChanges?.some(c => c.status === "PENDING");
  const statusMeta = getStatusMeta(latestChange?.status);

  const handleBirthDateKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const nextState = resolveBirthDateInputKey(
      birthDate,
      event.key,
      event.currentTarget.selectionStart,
      event.currentTarget.selectionEnd,
    );

    if (!nextState) return;

    event.preventDefault();
    setBirthDate(nextState.value);
    requestAnimationFrame(() => {
      event.currentTarget.setSelectionRange(nextState.caret, nextState.caret);
    });
  };

  useEffect(() => {
    if (participant) {
      setFirstName(participant.firstName);
      setLastName(participant.lastName);
      setBirthDate(participant.birthDate || birthYearToBirthDateInput(participant.birthYear));
      setGender(normalizeGenderValue(participant.gender));
      setDisciplineCode(normalizeDisciplineValue(participant.disciplineCode || participant.discipline));
      setShirtSize(participant.shirtSize || "");
      setModerationNote(participant.moderationNote || "");
      setEmail(participant.email || "");
      setPhone(participant.phone || "");
      setShirtOrderDeadline(null);
      setLatestChange(participant.pendingChanges?.[0] || null);
      setResult(null);
      setError("");
    }
  }, [participant]);

  useEffect(() => {
    if (!open || !participant?.id) return;

    (async () => {
      try {
        const res = await fetch(`/api/participants/${participant.id}`);
        if (!res.ok) return;

        const data = await res.json();
        setFirstName(data.firstName || "");
        setLastName(data.lastName || "");
        setBirthDate(data.birthDate || birthYearToBirthDateInput(data.birthYear));
        setGender(normalizeGenderValue(data.gender));
        setDisciplineCode(normalizeDisciplineValue(data.disciplineCode));
        setShirtSize(data.shirtSize || "");
        setModerationNote(data.moderationNote || "");
        setEmail(data.email || "");
        setPhone(data.phone || "");
        setShirtOrderDeadline(data.team?.competition?.shirtOrderDeadline || null);
        setLatestChange(data.pendingChanges?.[0] || null);
      } catch (err) {
        console.error("Failed to load participant details:", err);
      }
    })();
  }, [open, participant?.id]);

  const shirtLocked = !isAdminEdit && isShirtOrderClosed(shirtOrderDeadline);

  const handleSave = async () => {
    if (!participant) return;
    setSaving(true);
    setError("");
    setResult(null);

    try {
      const extractedBirthYear = extractBirthYearFromInput(birthDate);
      if (extractedBirthYear === null) {
        throw new Error("Geburtsdatum unplausibel");
      }

      const res = await fetch(`/api/participants/${participant.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          birthYear: extractedBirthYear,
          gender,
          disciplineCode,
          shirtSize: shirtSize || null,
          moderationNote: moderationNote || null,
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
        if (!data.applied) {
          setLatestChange({
            id: data.pendingChange?.id || "latest",
            status: "PENDING",
            updatedAt: new Date().toISOString(),
            reviewedAt: null,
            reviewComment: null,
          });
        }

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
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="px-6 pt-6">
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

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {!directEdit && statusMeta && (
            <div className={"text-sm p-3 rounded-md " + statusMeta.className}>
              <div className="font-medium">{statusMeta.title}</div>
              <div>{statusMeta.text}</div>
              {latestChange?.reviewComment ? (
                <div className="mt-1 text-xs opacity-90">Kommentar der Orga: {latestChange.reviewComment}</div>
              ) : null}
              {hasPendingChange ? (
                <div className="mt-1 text-xs opacity-90">Wenn du erneut speicherst, wird der offene Antrag mit deinem neuesten Stand aktualisiert.</div>
              ) : null}
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
                <label className="text-xs font-medium text-muted-foreground">Geburtsdatum</label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="TT.MM.JJJJ"
                  autoComplete="bday"
                  value={birthDate}
                  onChange={(e) => setBirthDate(formatBirthDateInput(e.target.value))}
                  onKeyDown={handleBirthDateKeyDown}
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

            <div>
              <label className="text-xs font-medium text-muted-foreground">T-Shirt-Größe</label>
              <Select value={shirtSize || "none"} onValueChange={(value) => setShirtSize(value === "none" ? "" : value)} disabled={shirtLocked}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Keine Angabe</SelectItem>
                  {SHIRT_SIZES.map((size) => (
                    <SelectItem key={size.id} value={size.id}>
                      {size.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {shirtLocked && (
                <p className="mt-1 text-xs text-muted-foreground">Bestellfrist abgeschlossen, nur Admin kann noch ändern.</p>
              )}
            </div>

            <div>
              {showModerationNote && (
                <>
                  <label className="text-xs font-medium text-muted-foreground">Hinweis für Moderation (intern)</label>
                  <Textarea
                    value={moderationNote}
                    onChange={(e) => setModerationNote(e.target.value)}
                    placeholder="Optionaler interner Hinweis für Startliste / Moderation"
                    maxLength={280}
                    className="mt-1 min-h-[96px]"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">{moderationNote.length}/280 Zeichen</p>
                </>
              )}
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
        </div>

        <DialogFooter className="border-t bg-background/95 px-6 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] backdrop-blur supports-[backdrop-filter]:bg-background/85">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !!result}
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
