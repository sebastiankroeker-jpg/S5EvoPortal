"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  createDefaultTeamForm,
  DISCIPLINES,
  DISCIPLINE_PLACEHOLDER,
  summarizeDisciplines,
  TeamRegistrationInput,
  TeamRegistrationSchema,
  type DisciplineId,
  type ParticipantInput,
} from "@/lib/domain/team";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const testParticipants = [
  { firstName: "Max", lastName: "Mustermann", birthDate: "1995-03-15", gender: "M", email: "", phone: "", discipline: "RUN" },
  { firstName: "Lisa", lastName: "Schmidt", birthDate: "1997-07-22", gender: "W", email: "", phone: "", discipline: "BENCH" },
  { firstName: "Stefan", lastName: "Weber", birthDate: "1992-11-08", gender: "M", email: "", phone: "", discipline: "STOCK" },
  { firstName: "Anna", lastName: "Müller", birthDate: "1999-01-14", gender: "W", email: "", phone: "", discipline: "ROAD" },
  { firstName: "Michael", lastName: "Bauer", birthDate: "1994-09-03", gender: "M", email: "", phone: "", discipline: "MTB" },
] as const;

export default function TeamRegistration() {
  const { data: session } = useSession();
  const userName = session?.user?.name ?? "";
  const userEmail = session?.user?.email ?? "";
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState("");

  const form = useForm<TeamRegistrationInput>({
    resolver: zodResolver(TeamRegistrationSchema),
    defaultValues: createDefaultTeamForm(),
    mode: "onChange",
  });

  const {
    control,
    register,
    handleSubmit,
    formState,
    reset,
    watch,
    trigger,
    setValue,
    getValues,
  } = form;

  const { fields } = useFieldArray({ control, name: "participants" });

  const participants = watch("participants");
  const teamName = watch("teamName");

  const [teamLeadParticipates, setTeamLeadParticipates] = useState(false);
  const [teamLeadDiscipline, setTeamLeadDiscipline] = useState<DisciplineId>(DISCIPLINES[0].id);

  const [teamLeadFirstName, teamLeadLastName] = useMemo(() => {
    if (!userName) return ["", ""];
    const parts = userName.trim().split(" ");
    if (parts.length === 1) return [parts[0], ""];
    return [parts[0], parts.slice(1).join(" ")];
  }, [userName]);

  const disciplineMap = useMemo(
    () => Object.fromEntries(DISCIPLINES.map((discipline) => [discipline.id, discipline])),
    []
  );

  const disciplineSummary = useMemo(() => summarizeDisciplines(participants), [participants]);

  const previousTeamLeadDiscipline = useRef<DisciplineId>(DISCIPLINES[0].id);

  const updateParticipantFields = (discipline: DisciplineId, partial: Partial<ParticipantInput>) => {
    const current = getValues("participants");
    const index = current.findIndex((p) => p.discipline === discipline);
    if (index === -1) return;

    Object.entries(partial).forEach(([key, value]) => {
      setValue(`participants.${index}.${key as keyof ParticipantInput}` as const, value as any, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: false,
      });
    });
  };

  const clearTeamLeadSlot = (discipline: DisciplineId) => {
    updateParticipantFields(discipline, {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
    });
  };

  const fillTeamLeadSlot = (discipline: DisciplineId) => {
    updateParticipantFields(discipline, {
      firstName: teamLeadFirstName || userName || "Teamchef",
      lastName: teamLeadLastName || (!teamLeadFirstName && userName ? userName : ""),
      email: userEmail,
    });
  };

  useEffect(() => {
    if (teamLeadParticipates) {
      if (previousTeamLeadDiscipline.current !== teamLeadDiscipline) {
        clearTeamLeadSlot(previousTeamLeadDiscipline.current);
      }
      fillTeamLeadSlot(teamLeadDiscipline);
      previousTeamLeadDiscipline.current = teamLeadDiscipline;
    } else {
      clearTeamLeadSlot(previousTeamLeadDiscipline.current);
    }
  }, [teamLeadParticipates, teamLeadDiscipline, teamLeadFirstName, teamLeadLastName, userEmail]);

  if (!session?.user) return null;

  const handleNextFromTeam = async () => {
    const ok = await trigger("teamName");
    if (ok) {
      setStep(2);
    }
  };

  const handleNextFromParticipants = async () => {
    const ok = await trigger("participants");
    if (ok) {
      setStep(3);
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    setServerError("");
    try {
      const response = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          contactName: userName,
          contactEmail: userEmail,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Anmeldung fehlgeschlagen");
      }

      setSubmitted(true);
      reset(createDefaultTeamForm());
      setTeamLeadParticipates(false);
      setTeamLeadDiscipline(DISCIPLINES[0].id);
      previousTeamLeadDiscipline.current = DISCIPLINES[0].id;
      setStep(1);
      setTimeout(() => setSubmitted(false), 3500);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Unbekannter Fehler");
    }
  });

  const applyTestData = () => {
    testParticipants.forEach((participant, index) => {
      setValue(`participants.${index}` as const, participant, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
    });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            📋 Mannschaft anmelden
            <Badge variant="outline">Schritt {step}/3</Badge>
          </CardTitle>
          <CardDescription>Registriere deine Mannschaft für den Fünfkampf</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-6">
            {[1, 2, 3].map((s) => (
              <div key={s} className={`flex-1 h-2 rounded-full transition-colors ${s <= step ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>

          {submitted ? (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center p-8 space-y-4">
              <div className="text-6xl">🏅</div>
              <h3 className="text-xl font-semibold text-green-600">Anmeldung erfolgreich!</h3>
              <p className="text-muted-foreground">Eure Mannschaft wurde erfolgreich übermittelt.</p>
            </motion.div>
          ) : (
            <>
              {step === 1 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Teamchef (aus Authentik)</label>
                    <div className="mt-1 px-3 py-2 bg-muted rounded-md text-sm">{userName || "Unbekannt"}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">E-Mail (aus Authentik)</label>
                    <div className="mt-1 px-3 py-2 bg-muted rounded-md text-sm">{userEmail || "Nicht verfügbar"}</div>
                  </div>
                  <div>
                    <label htmlFor="teamName" className="text-sm font-medium">
                      Mannschaftsname *
                    </label>
                    <input
                      id="teamName"
                      type="text"
                      {...register("teamName")}
                      className="mt-1 w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder="z.B. Die Bergziegen"
                    />
                    {formState.errors.teamName && (
                      <p className="text-xs text-red-500 mt-1">{formState.errors.teamName.message}</p>
                    )}
                  </div>

                  <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={teamLeadParticipates}
                        onChange={(event) => setTeamLeadParticipates(event.target.checked)}
                      />
                      Ich starte selbst in einer Disziplin
                    </label>
                    {teamLeadParticipates && (
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Gewünschte Disziplin</label>
                        <select
                          className="px-3 py-2 bg-background border border-input rounded-md text-sm"
                          value={teamLeadDiscipline}
                          onChange={(event) => setTeamLeadDiscipline(event.target.value as DisciplineId)}
                        >
                          {DISCIPLINES.map((discipline) => (
                            <option key={discipline.id} value={discipline.id}>
                              {discipline.icon} {discipline.label}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-muted-foreground">Du wirst automatisch als Teilnehmer dieser Disziplin übernommen.</p>
                      </div>
                    )}
                  </div>
                  <Button onClick={handleNextFromTeam} disabled={!teamName} className="w-full">
                    Zu Teilnehmern →
                  </Button>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                  <div className="text-center space-y-2">
                    <h3 className="text-lg font-medium">Teilnehmer</h3>
                    <p className="text-muted-foreground">Erfasse deine 5 Sportler inkl. Disziplin</p>
                  </div>

                  <div className="flex justify-between items-center mb-4">
                    <span className="text-sm text-muted-foreground">5 Sportler erfassen</span>
                    <Button type="button" variant="outline" size="sm" onClick={applyTestData}>
                      🎲 Testdaten
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {fields.map((field, index) => (
                      <Card key={field.id} className="p-3 space-y-2">
                        <div className="flex items-center justify-between text-sm font-medium">
                          <span>Teilnehmer {disciplineMap[participants[index]?.discipline as DisciplineId]?.label ?? index + 1}</span>
                          {teamLeadParticipates && participants[index]?.discipline === teamLeadDiscipline && (
                            <Badge variant="secondary" className="text-[0.65rem]">Teamchef</Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="hidden"
                            value={participants[index]?.discipline}
                            readOnly
                            {...register(`participants.${index}.discipline` as const)}
                          />
                          <label className="col-span-2 text-xs text-muted-foreground">Disziplin</label>
                          <select
                            className="px-2 py-1 bg-background border border-input rounded text-sm col-span-2"
                            value={participants[index]?.discipline}
                            onChange={(event) =>
                              setValue(`participants.${index}.discipline` as const, event.target.value as DisciplineId, {
                                shouldDirty: true,
                                shouldTouch: true,
                              })
                            }
                          >
                            {DISCIPLINES.map((discipline) => (
                              <option key={discipline.id} value={discipline.id}>
                                {discipline.icon} {discipline.label}
                              </option>
                            ))}
                          </select>
                          <input
                            placeholder="Vorname"
                            className="px-2 py-1 bg-background border border-input rounded text-sm"
                            {...register(`participants.${index}.firstName` as const)}
                          />
                          <input
                            placeholder="Nachname"
                            className="px-2 py-1 bg-background border border-input rounded text-sm"
                            {...register(`participants.${index}.lastName` as const)}
                          />
                          <input
                            type="date"
                            className="px-2 py-1 bg-background border border-input rounded text-sm"
                            {...register(`participants.${index}.birthDate` as const)}
                          />
                          <select
                            className="px-2 py-1 bg-background border border-input rounded text-sm"
                            {...register(`participants.${index}.gender` as const)}
                          >
                            <option value="M">Männlich</option>
                            <option value="W">Weiblich</option>
                            <option value="D">Divers</option>
                          </select>
                          <input
                            placeholder="E-Mail (optional)"
                            className="px-2 py-1 bg-background border border-input rounded text-sm"
                            {...register(`participants.${index}.email` as const)}
                          />
                          <input
                            placeholder="Telefon (optional)"
                            className="px-2 py-1 bg-background border border-input rounded text-sm"
                            {...register(`participants.${index}.phone` as const)}
                          />
                        </div>
                      </Card>
                    ))}
                  </div>

                  {formState.errors.participants && (
                    <p className="text-xs text-red-500">Bitte fehlende Angaben ergänzen.</p>
                  )}

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                      ← Zurück
                    </Button>
                    <Button onClick={handleNextFromParticipants} className="flex-1">
                      Zur Bestätigung →
                    </Button>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                  <div className="text-center space-y-2">
                    <h3 className="text-lg font-medium">Bestätigung</h3>
                    <p className="text-muted-foreground">Prüfe deine Angaben und sende die Anmeldung ab</p>
                  </div>

                  <div className="bg-muted rounded-lg p-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Team:</span>
                      <span className="font-medium">{teamName || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Kontakt:</span>
                      <span className="font-medium">{userName}</span>
                    </div>
                    <div>
                      <span className="font-medium">Disziplin-Status</span>
                      <ul className="mt-2 space-y-1">
                        {DISCIPLINES.map((discipline) => (
                          <li key={discipline.id} className="flex justify-between">
                            <span>
                              {discipline.icon} {discipline.label}
                            </span>
                            <span className="font-mono">
                              {disciplineSummary[discipline.id] ?? 0}
                            </span>
                          </li>
                        ))}
                        <li className="flex justify-between text-muted-foreground text-xs">
                          <span>📝 TBD</span>
                          <span className="font-mono">{disciplineSummary[DISCIPLINE_PLACEHOLDER] ?? 0}</span>
                        </li>
                      </ul>
                    </div>
                    <div className="flex justify-between">
                      <span>Teilnehmer erfasst:</span>
                      <span className="font-medium">
                        {participants.filter((p) => p.firstName && p.lastName).length}/5
                      </span>
                    </div>
                  </div>

                  {serverError && (
                    <div className="text-red-500 text-sm text-center bg-red-50 dark:bg-red-900/20 p-2 rounded">
                      {serverError}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setStep(2)} className="flex-1" disabled={formState.isSubmitting}>
                      ← Zurück
                    </Button>
                    <Button onClick={onSubmit} className="flex-1" disabled={formState.isSubmitting}>
                      {formState.isSubmitting ? "Speichere..." : "Anmelden! 🏅"}
                    </Button>
                  </div>
                </motion.div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
