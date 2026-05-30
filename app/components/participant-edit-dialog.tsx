"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, Send } from "lucide-react";
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
  PARTICIPANT_PUBLICATION_OPTIONS,
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
  emailInvitation?: EmailInvitationStatus | null;
  participantPublicationPreference?: "NAME_VERBERGEN" | "NAME_VEROEFFENTLICHEN" | null;
  pendingChanges?: { id: string; status: string; updatedAt?: string | null; reviewedAt?: string | null; reviewComment?: string | null }[];
}

type EmailInvitationStatus = {
  status: "missing_email" | "none" | "active" | "claimed" | "expired" | "revoked" | "linked";
  tokenStatus?: "none" | "active" | "claimed" | "expired" | "revoked";
  sentAt?: string | null;
  expiresAt?: string | null;
  claimedAt?: string | null;
  revokedAt?: string | null;
};

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

function getEmailInvitationMeta(status?: EmailInvitationStatus["status"] | null) {
  if (status === "linked") return { label: "Portal-Konto verknüpft", className: "border-green-300 text-green-700" };
  if (status === "claimed") return { label: "Einladung eingelöst", className: "border-green-300 text-green-700" };
  if (status === "active") return { label: "Einladung versendet", className: "border-blue-300 text-blue-700" };
  if (status === "expired") return { label: "Einladung abgelaufen", className: "border-amber-300 text-amber-700" };
  if (status === "revoked") return { label: "Einladung gesperrt", className: "border-red-300 text-red-700" };
  if (status === "missing_email") return { label: "Keine E-Mail", className: "border-muted text-muted-foreground" };
  return { label: "Keine Einladung", className: "border-muted text-muted-foreground" };
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function formatDateTime(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("de-DE");
}

function InfoHint({ text }: { text: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          type="button"
          className="inline-flex size-5 items-center justify-center rounded-full border border-border/70 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Info"
          onClick={(event) => event.preventDefault()}
        >
          <Info className="size-3" />
        </TooltipTrigger>
        <TooltipContent side="top">{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
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
  const [savedEmail, setSavedEmail] = useState("");
  const [emailInvitation, setEmailInvitation] = useState<EmailInvitationStatus | null>(null);
  const [sendingInvitation, setSendingInvitation] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [participantPublicationPreference, setParticipantPublicationPreference] = useState<"NAME_VERBERGEN" | "NAME_VEROEFFENTLICHEN">("NAME_VERBERGEN");
  const [shirtOrderDeadline, setShirtOrderDeadline] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ applied: boolean; message?: string; classificationWarnings?: string[] } | null>(null);
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
      setSavedEmail(participant.email || "");
      setEmailInvitation(participant.emailInvitation || null);
      setInviteMessage(null);
      setParticipantPublicationPreference(participant.participantPublicationPreference || "NAME_VERBERGEN");
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
        setSavedEmail(data.email || "");
        setEmailInvitation(data.emailInvitation || null);
        setParticipantPublicationPreference(data.participantPublicationPreference || "NAME_VERBERGEN");
        setShirtOrderDeadline(data.team?.competition?.shirtOrderDeadline || null);
        setLatestChange(data.pendingChanges?.[0] || null);
      } catch (err) {
        console.error("Failed to load participant details:", err);
      }
    })();
  }, [open, participant?.id]);

  const shirtLocked = !isAdminEdit && isShirtOrderClosed(shirtOrderDeadline);
  const emailDiffersFromSaved = email.trim().toLowerCase() !== savedEmail.trim().toLowerCase();
  const effectiveEmailInvitationStatus = emailDiffersFromSaved ? (email ? "none" : "missing_email") : emailInvitation?.status;
  const emailInvitationMeta = getEmailInvitationMeta(effectiveEmailInvitationStatus || (email ? "none" : "missing_email"));
  const canSendInvitation =
    Boolean(participant?.id) &&
    (directEdit || showModerationNote) &&
    isValidEmail(email) &&
    (emailDiffersFromSaved || !["active", "claimed", "linked"].includes(emailInvitation?.status || "none"));

  const handleSendInvitation = async () => {
    if (!participant?.id) return;
    setSendingInvitation(true);
    setInviteMessage(null);
    setError("");

    try {
      const res = await fetch(`/api/participants/${participant.id}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Einladung konnte nicht gesendet werden");

      setEmailInvitation((current) => ({
        status: "active",
        tokenStatus: "active",
        sentAt: new Date().toISOString(),
        expiresAt: data.participantClaimMail?.expiresAt ?? current?.expiresAt ?? null,
        claimedAt: null,
        revokedAt: null,
      }));
      setSavedEmail(email);
      setInviteMessage({ type: "success", text: "Einladung wurde versendet." });
    } catch (err) {
      setInviteMessage({ type: "error", text: err instanceof Error ? err.message : "Einladung konnte nicht gesendet werden" });
    } finally {
      setSendingInvitation(false);
    }
  };

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
          participantPublicationPreference,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Speichern fehlgeschlagen");
      }

        const data = await res.json();
        if (data.participantClaimMail?.status === "sent" || data.participantClaimMail?.status === "queued") {
          setEmailInvitation((current) => ({
            status: "active",
            tokenStatus: "active",
            sentAt: new Date().toISOString(),
            expiresAt: data.participantClaimMail?.expiresAt ?? current?.expiresAt ?? null,
            claimedAt: null,
            revokedAt: null,
          }));
        }
        if (data.applied || data.participantClaimMail) {
          setSavedEmail(email);
        }
        setResult({
          applied: data.applied,
          message: data.message,
          classificationWarnings: Array.isArray(data.classificationWarnings) ? data.classificationWarnings : [],
        });
        if (!data.applied) {
          setLatestChange({
            id: data.pendingChange?.id || "latest",
            status: "PENDING",
            updatedAt: new Date().toISOString(),
            reviewedAt: null,
            reviewComment: null,
          });
        }

        if (data.applied && (!Array.isArray(data.classificationWarnings) || data.classificationWarnings.length === 0)) {
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

          {result?.classificationWarnings && result.classificationWarnings.length > 0 ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {result.classificationWarnings.map((warning) => (
                <div key={warning}>⚠️ {warning}</div>
              ))}
            </div>
          ) : null}

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
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-muted-foreground">Namensveröffentlichung</label>
                <InfoHint text="Steuert nur, ob der Teilnehmername öffentlich sichtbar werden darf. Die Team-Sichtbarkeit kann diese Freigabe weiterhin übersteuern." />
              </div>
              <Select value={participantPublicationPreference} onValueChange={(value) => setParticipantPublicationPreference(value as "NAME_VERBERGEN" | "NAME_VEROEFFENTLICHEN")}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PARTICIPANT_PUBLICATION_OPTIONS.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

            <div className="space-y-2 rounded-md border border-border/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-muted-foreground">E-Mail (optional)</label>
                  <InfoHint text="Die E-Mail ist nur Kontakt- und Einladungskanal. Sie ist nicht die dauerhafte Identität des Portal-Accounts." />
                </div>
                <Badge variant="outline" className={emailInvitationMeta.className}>
                  {emailInvitationMeta.label}
                </Badge>
              </div>
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="teilnehmer@example.de"
                />
                {canSendInvitation ? (
                  <Button type="button" size="sm" variant="outline" onClick={handleSendInvitation} disabled={sendingInvitation}>
                    <Send className="size-4" />
                    {sendingInvitation ? "Sendet..." : "Einladung senden"}
                  </Button>
                ) : null}
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                {emailInvitation?.sentAt ? <p>Versendet: {formatDateTime(emailInvitation.sentAt)}</p> : null}
                {emailInvitation?.expiresAt ? <p>Gültig bis: {formatDateTime(emailInvitation.expiresAt)}</p> : null}
                {emailInvitation?.claimedAt ? <p>Eingelöst: {formatDateTime(emailInvitation.claimedAt)}</p> : null}
                {email && !isValidEmail(email) ? <p className="text-red-600">Bitte eine gültige E-Mail-Adresse eintragen.</p> : null}
                {inviteMessage ? (
                  <p className={inviteMessage.type === "success" ? "text-green-700" : "text-red-600"}>{inviteMessage.text}</p>
                ) : null}
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
