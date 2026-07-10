"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Save } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  DISCIPLINES,
  DISCIPLINE_PLACEHOLDER,
  extractBirthYearFromInput,
  formatBirthDateInput,
  resolveBirthDateInputKey,
} from "@/lib/domain/team";

type MtcAnonymousParticipant = {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  gender: "M" | "W";
  discipline: string;
  desiredDiscipline?: string | null;
  participantPublicationPreference: "NAME_VERBERGEN" | "NAME_VEROEFFENTLICHEN";
  email: string;
  moderationNote: string;
  shirtSize: string;
};

type MtcAnonymousState = {
  token: {
    expiresAt: string;
  };
  competition: {
    name: string;
    year: number;
  };
  team: {
    id: string;
    name: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    marketplaceMessage: string;
    participants: MtcAnonymousParticipant[];
    evaluation: {
      blockingErrors: string[];
      warnings: string[];
      classificationCode: string;
      canSubmit: boolean;
    };
  };
};

function getDisciplineLabel(value?: string | null) {
  if (!value || value === DISCIPLINE_PLACEHOLDER) return "Offen";
  return DISCIPLINES.find((discipline) => discipline.id === value)?.label || value;
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("de-DE");
}

function normalizeComparableText(value?: string | null) {
  return (value || "").normalize("NFC").trim().toLocaleLowerCase("de-DE");
}

function formatParticipantIdentityId(id?: string | null) {
  if (!id || id.startsWith("new:")) return "neu";
  return id.slice(0, 8);
}

function getParticipantDisplayName(participant?: Pick<MtcAnonymousParticipant, "firstName" | "lastName"> | null) {
  const name = `${participant?.firstName || ""} ${participant?.lastName || ""}`.trim();
  return name || "Offener Slot";
}

function hasSuspiciousParticipantIdentityChange(
  current?: MtcAnonymousParticipant | null,
  original?: MtcAnonymousParticipant | null,
) {
  if (!current || !original || original.id.startsWith("new:")) return false;

  const firstNameChanged = normalizeComparableText(current.firstName) !== normalizeComparableText(original.firstName);
  const lastNameChanged = normalizeComparableText(current.lastName) !== normalizeComparableText(original.lastName);
  const currentBirthYear = extractBirthYearFromInput(current.birthDate || "");
  const originalBirthYear = extractBirthYearFromInput(original.birthDate || "");
  const birthYearChanged = currentBirthYear !== originalBirthYear;

  return (firstNameChanged && lastNameChanged) || ((firstNameChanged || lastNameChanged) && birthYearChanged);
}

export default function MtcAnonymousPage() {
  const params = useParams<{ token: string }>();
  const token = Array.isArray(params?.token) ? params.token[0] : params?.token;
  const [data, setData] = useState<MtcAnonymousState | null>(null);
  const [teamName, setTeamName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [participants, setParticipants] = useState<MtcAnonymousParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const validationIssues = useMemo(
    () => [...(data?.team.evaluation.blockingErrors || []), ...(data?.team.evaluation.warnings || [])],
    [data?.team.evaluation.blockingErrors, data?.team.evaluation.warnings],
  );

  useEffect(() => {
    if (!token) return;

    (async () => {
      try {
        const response = await fetch(`/api/mtc-anonym/${token}`, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "MTC-Link konnte nicht geladen werden");

        setData(payload);
        setTeamName(payload.team.name || "");
        setContactName(payload.team.contactName || "");
        setContactEmail(payload.team.contactEmail || "");
        setContactPhone(payload.team.contactPhone || "");
        setParticipants(payload.team.participants || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "MTC-Link konnte nicht geladen werden");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const updateParticipant = (id: string, patch: Partial<MtcAnonymousParticipant>) => {
    setParticipants((current) =>
      current.map((participant) => (participant.id === id ? { ...participant, ...patch } : participant)),
    );
  };

  const saveDraft = async () => {
    if (!token) return;
    const suspiciousIdentityChanges = participants
      .map((participant) => ({
        participant,
        original: data?.team.participants.find((originalParticipant) => originalParticipant.id === participant.id),
      }))
      .filter(({ participant, original }) => hasSuspiciousParticipantIdentityChange(participant, original));

    let confirmIdentityChange = false;
    if (suspiciousIdentityChanges.length > 0) {
      const changedParticipants = suspiciousIdentityChanges
        .slice(0, 3)
        .map(({ participant, original }) => {
          const beforeName = getParticipantDisplayName(original);
          const afterName = getParticipantDisplayName(participant);
          return `#${formatParticipantIdentityId(original?.id)} ${beforeName} -> ${afterName}`;
        })
        .join("\n");
      const additionalChanges =
        suspiciousIdentityChanges.length > 3 ? `\n... und ${suspiciousIdentityChanges.length - 3} weitere` : "";
      confirmIdentityChange = window.confirm(
        `Du änderst Identitätsfelder bestehender MTC-Teilnehmer:\n\n${changedParticipants}${additionalChanges}\n\nBeim Speichern bleiben dieselben Teilnehmer-IDs erhalten. Bitte nur fortfahren, wenn das Korrekturen sind und keine anderen Personen in die Slots sollen.`,
      );
      if (!confirmIdentityChange) return;
    }

    setSaving(true);
    setError("");
    setSavedAt(null);

    try {
      const response = await fetch(`/api/mtc-anonym/${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamName, contactName, contactEmail, contactPhone, participants, confirmIdentityChange }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "MTC konnte nicht gespeichert werden");

      setData(payload);
      setTeamName(payload.team.name || "");
      setContactName(payload.team.contactName || "");
      setContactEmail(payload.team.contactEmail || "");
      setContactPhone(payload.team.contactPhone || "");
      setParticipants(payload.team.participants || []);
      setSavedAt(new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "MTC konnte nicht gespeichert werden");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background px-3 py-4 sm:px-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <section className="flex flex-col gap-3 border-b border-border/60 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold leading-tight sm:text-2xl">MTC bearbeiten</h1>
              {data?.team.evaluation.canSubmit ? (
                <Badge variant="secondary">plausibel</Badge>
              ) : (
                <Badge variant="outline">Pruefung offen</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {data ? `${data.competition.name} ${data.competition.year} · Link gueltig bis ${formatDateTime(data.token.expiresAt)}` : "MTC-Link"}
            </p>
          </div>
          <Button onClick={saveDraft} disabled={saving || !data} className="w-full sm:w-auto">
            <Save className="size-4" />
            {saving ? "Speichere..." : "Speichern"}
          </Button>
        </section>

        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {savedAt ? (
          <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            Gespeichert: {formatDateTime(savedAt)}
          </div>
        ) : null}

        {data ? (
          <>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="team-name">MTC-Name</label>
                <Input id="team-name" value={teamName} onChange={(event) => setTeamName(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="contact-name">Kontakt</label>
                <Input id="contact-name" value={contactName} onChange={(event) => setContactName(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="contact-email">Kontakt-E-Mail</label>
                <Input id="contact-email" type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="contact-phone">Telefonnummer</label>
                <Input id="contact-phone" type="tel" value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} />
                <p className="text-xs text-muted-foreground">Fuer kurzfristige Abstimmung falls es schnell gehen muss.</p>
              </div>
            </div>

            {data.team.marketplaceMessage ? (
              <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Notiz:</span> {data.team.marketplaceMessage}
              </div>
            ) : null}

            {validationIssues.length > 0 ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {validationIssues.map((issue) => (
                  <p key={issue}>{issue}</p>
                ))}
              </div>
            ) : null}

            <div className="grid gap-3">
              {participants.map((participant, index) => {
                const originalParticipant = data.team.participants.find((entry) => entry.id === participant.id);
                const isExistingParticipant = Boolean(originalParticipant && !participant.id.startsWith("new:"));
                const suspiciousIdentityChange = hasSuspiciousParticipantIdentityChange(participant, originalParticipant);

                return (
                <Card key={participant.id} size="sm">
                  <CardHeader>
                    <CardTitle className="flex flex-wrap items-center gap-2">
                      <span>Slot {index + 1}</span>
                      <Badge variant="outline">{getDisciplineLabel(participant.discipline)}</Badge>
                      {participant.desiredDiscipline ? (
                        <Badge variant="outline">Wunsch: {getDisciplineLabel(participant.desiredDiscipline)}</Badge>
                      ) : null}
                    </CardTitle>
                    <CardDescription>Teilnehmerdaten fuer diesen MTC-Slot</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-6">
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-xs font-medium text-muted-foreground">Vorname</label>
                      <Input
                        value={participant.firstName}
                        onChange={(event) => updateParticipant(participant.id, { firstName: event.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-xs font-medium text-muted-foreground">Nachname</label>
                      <Input
                        value={participant.lastName}
                        onChange={(event) => updateParticipant(participant.id, { lastName: event.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Geburtsdatum</label>
                      <Input
                        inputMode="numeric"
                        placeholder="TT.MM.JJJJ oder JJJJ"
                        value={participant.birthDate}
                        onKeyDown={(event) => {
                          const target = event.currentTarget;
                          const resolved = resolveBirthDateInputKey(
                            target.value,
                            event.key,
                            target.selectionStart,
                            target.selectionEnd,
                          );
                          if (!resolved) return;
                          event.preventDefault();
                          updateParticipant(participant.id, { birthDate: resolved.value });
                          window.requestAnimationFrame(() => target.setSelectionRange(resolved.caret, resolved.caret));
                        }}
                        onChange={(event) => updateParticipant(participant.id, { birthDate: formatBirthDateInput(event.target.value) })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Geschlecht</label>
                      <Select value={participant.gender} onValueChange={(value) => updateParticipant(participant.id, { gender: value as "M" | "W" })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="M">M</SelectItem>
                          <SelectItem value="W">W</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-xs font-medium text-muted-foreground">MTC-Slot</label>
                      <Select value={participant.discipline} onValueChange={(value) => updateParticipant(participant.id, { discipline: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DISCIPLINES.map((discipline) => (
                            <SelectItem key={discipline.id} value={discipline.id}>
                              {discipline.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-xs font-medium text-muted-foreground">E-Mail</label>
                      <Input
                        type="email"
                        value={participant.email}
                        onChange={(event) => updateParticipant(participant.id, { email: event.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-xs font-medium text-muted-foreground">Namenssichtbarkeit</label>
                      <Select
                        value={participant.participantPublicationPreference}
                        onValueChange={(value) =>
                          updateParticipant(participant.id, {
                            participantPublicationPreference: value as MtcAnonymousParticipant["participantPublicationPreference"],
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NAME_VERBERGEN">Name verbergen</SelectItem>
                          <SelectItem value="NAME_VEROEFFENTLICHEN">Name veroeffentlichen</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {isExistingParticipant ? (
                      <div
                        className={`rounded-md border px-3 py-2 text-xs md:col-span-6 ${
                          suspiciousIdentityChange
                            ? "border-amber-200 bg-amber-50 text-amber-800"
                            : "border-sky-200 bg-sky-50 text-sky-800"
                        }`}
                      >
                        <p className="font-medium">
                          Teilnehmer-ID #{formatParticipantIdentityId(participant.id)} bleibt beim Speichern erhalten
                        </p>
                        <p>
                          <span className="font-medium">Korrektur:</span> hier speichern, gleiche Teilnehmer-ID bleibt.
                        </p>
                        <p>
                          <span className="font-medium">Andere Person:</span> diesen Slot nicht überschreiben, sondern durch die Orga ersetzen lassen.
                        </p>
                        {suspiciousIdentityChange ? (
                          <p className="mt-1 font-medium">
                            Die Änderung sieht nach Personenwechsel aus. Speichere nur, wenn es eine Korrektur ist.
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="space-y-1.5 md:col-span-6">
                      <label className="text-xs font-medium text-muted-foreground">Hinweis</label>
                      <Textarea
                        className="min-h-20"
                        value={participant.moderationNote}
                        onChange={(event) => updateParticipant(participant.id, { moderationNote: event.target.value })}
                      />
                    </div>
                  </CardContent>
                </Card>
                );
              })}
            </div>

            <div className="flex justify-end border-t border-border/60 pt-4">
              <Button onClick={saveDraft} disabled={saving} className="w-full sm:w-auto">
                <Save className="size-4" />
                {saving ? "Speichere..." : "MTC speichern"}
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
