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
  generateTeamName,
} from "@/lib/domain/team";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { classifyTeam, validateDisciplineAssignment, CLASSIFICATIONS } from "@/lib/domain/classification";
import { useCompetition } from "@/lib/competition-context";
import { SHIRT_SIZES, isShirtOrderClosed } from "@/lib/domain/shirts";

type TeamClassId =
  | "schueler-a"
  | "schueler-b"
  | "jugend"
  | "jungsters"
  | "herren"
  | "masters"
  | "damen-a"
  | "damen-b";

const TEAM_CLASSES: { id: TeamClassId; label: string }[] = [
  { id: "schueler-a", label: "Schüler A" },
  { id: "schueler-b", label: "Schüler B" },
  { id: "jugend", label: "Jugend" },
  { id: "jungsters", label: "Jungsters" },
  { id: "herren", label: "Herren" },
  { id: "masters", label: "Masters" },
  { id: "damen-a", label: "Damen A" },
  { id: "damen-b", label: "Damen B" },
];

const CLASS_CONFIG: Record<TeamClassId, { minYear: number; maxYear: number; gender: "M" | "W" | "mixed" }> = {
  "schueler-a": { minYear: 2016, maxYear: 2018, gender: "mixed" },
  "schueler-b": { minYear: 2013, maxYear: 2015, gender: "mixed" },
  jugend: { minYear: 2009, maxYear: 2012, gender: "mixed" },
  jungsters: { minYear: 2001, maxYear: 2004, gender: "M" },
  herren: { minYear: 1985, maxYear: 1995, gender: "M" },
  masters: { minYear: 1965, maxYear: 1975, gender: "M" },
  "damen-a": { minYear: 1995, maxYear: 2001, gender: "W" },
  "damen-b": { minYear: 1975, maxYear: 1985, gender: "W" },
};

const MALE_NAMES = [
  "Max", "Stefan", "Michael", "Thomas", "Andreas", "Markus", "Christian", "Daniel", "Sebastian", "Jonas",
  "Tobias", "Lukas", "Felix", "Florian", "Alexander", "Moritz", "David", "Simon", "Patrick", "Matthias",
  "Dominik", "Benjamin", "Jan", "Philipp", "Fabian", "Kevin", "Marcel", "Nico", "Leon", "Paul",
  "Tim", "Martin", "Robert", "Peter", "Klaus", "Rainer", "Georg", "Werner", "Helmut", "Franz",
  "Elias", "Noah", "Finn", "Liam", "Emil", "Oskar", "Theo", "Anton", "Jakob", "Valentin",
  "Rafael", "Benedikt", "Lorenz", "Kilian", "Xaver", "Ludwig", "Hugo", "Konrad", "Armin", "Hannes",
  "Christoph", "Roland", "Günter", "Erwin", "Sepp", "Alois", "Bernhard", "Norbert", "Gerhard", "Josef",
];
const FEMALE_NAMES = [
  "Lisa", "Anna", "Sarah", "Julia", "Petra", "Sandra", "Nicole", "Stefanie", "Laura", "Mia",
  "Nina", "Franziska", "Katharina", "Maria", "Lena", "Sophie", "Hannah", "Lea", "Johanna", "Christina",
  "Sabine", "Monika", "Claudia", "Martina", "Birgit", "Heike", "Kerstin", "Andrea", "Simone", "Melanie",
  "Verena", "Theresa", "Magdalena", "Eva", "Elisabeth", "Anja", "Tanja", "Sonja", "Cornelia", "Manuela",
  "Emilia", "Lina", "Ella", "Clara", "Ida", "Frieda", "Greta", "Mathilda", "Rosa", "Alma",
  "Amelie", "Nora", "Paulina", "Antonia", "Victoria", "Carla", "Marlene", "Ronja", "Annika", "Selina",
  "Renate", "Ingrid", "Helga", "Gertrude", "Elfriede", "Rosemarie", "Waltraud", "Hildegard", "Brigitte", "Ursula",
];
const LAST_NAMES = [
  "Müller", "Huber", "Wagner", "Bauer", "Mayer", "Weber", "Schmid", "Lehner", "Berger", "Schneider",
  "Wolf", "Brandt", "Fischer", "Koch", "Gruber", "Steiner", "Wimmer", "Hofer", "Pichler", "Brunner",
  "Eder", "Schwarz", "Reiter", "Fuchs", "Haas", "Lang", "Maier", "Baumann", "Kraus", "Seidl",
  "Riedl", "Winkler", "Moser", "Frank", "Schuster", "Hartl", "Brandl", "Leitner", "Aigner", "Koller",
  "Strasser", "Ziegler", "Ortner", "Kirchner", "Graf", "Hofmann", "Keller", "Richter", "Vogt", "Auer",
  "Stadler", "Lindner", "Lechner", "Holzer", "Wallner", "Prager", "Stöger", "Karner", "Thaler", "Ebner",
  "Doppler", "Mitterer", "Sommer", "Winter", "Neumeier", "Kronberger", "Reisinger", "Feichtinger", "Grassl", "Riedler",
  "Huemer", "Plank", "Stern", "Hinterberger", "Jungwirth", "Altmann", "Binder", "Ertl", "Kopf", "Zangerl",
];

export default function TeamRegistration() {
  const { data: session } = useSession();
  const { active: activeCompetition } = useCompetition();
  const userName = session?.user?.name ?? "";
  const userEmail = session?.user?.email ?? "";
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState("");
  const [shirtOrderDeadline, setShirtOrderDeadline] = useState<string | null>(null);



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

  // Live-Klassifikation basierend auf aktuellen Teilnehmer-Daten
  // watch() ohne useMemo — re-rendert bei jeder Feldänderung
  const watchedParticipants = form.watch("participants");
  const watchedValues = JSON.stringify(
    (watchedParticipants || []).map((p: any) => ({ bd: p.birthDate, g: p.gender, d: p.discipline }))
  );
  const liveClassification = useMemo(() => {
    const inputs = (watchedParticipants || [])
      .filter((p: any) => p.birthDate && p.birthDate.length >= 4)
      .map((p: any) => ({
        birthYear: new Date(p.birthDate).getFullYear(),
        gender: p.gender as "M" | "W" | "D",
      }));
    return classifyTeam(inputs);
  }, [watchedValues]);

  const disciplineCheck = useMemo(() => {
    const discs = (watchedParticipants || []).map((p: any) => p.discipline || "TBD");
    return validateDisciplineAssignment(discs);
  }, [watchedValues]);

  const participants = watch("participants");
  const teamName = watch("teamName");

  const [teamLeadParticipates, setTeamLeadParticipates] = useState(false);
  const [teamLeadDiscipline, setTeamLeadDiscipline] = useState<DisciplineId>(DISCIPLINES[0].id);
  const [teamLeadBirthDate, setTeamLeadBirthDate] = useState("");
  const [teamLeadGender, setTeamLeadGender] = useState<"M" | "W" | "D">("M");
  const [testDataClass, setTestDataClass] = useState<TeamClassId>("schueler-a");

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
  const shirtOrderClosed = useMemo(() => isShirtOrderClosed(shirtOrderDeadline), [shirtOrderDeadline]);

  useEffect(() => {
    if (!teamName) {
      setValue("teamName", generateTeamName(), { shouldDirty: false, shouldTouch: false });
    }
  }, [teamName, setValue]);

  useEffect(() => {
    if (!activeCompetition?.id) {
      setShirtOrderDeadline(null);
      return;
    }

    (async () => {
      try {
        const res = await fetch(`/api/admin/competition?id=${activeCompetition.id}`);
        if (!res.ok) return;
        const data = await res.json();
        setShirtOrderDeadline(data.competition?.shirtOrderDeadline || null);
      } catch (err) {
        console.error("Failed to load competition details:", err);
      }
    })();
  }, [activeCompetition?.id]);

  const previousTeamLeadDiscipline = useRef<DisciplineId>(DISCIPLINES[0].id);

  const updateParticipantFields = (discipline: DisciplineId, partial: Partial<ParticipantInput>) => {
    const current = getValues("participants");
    const index = current.findIndex((p) => p.discipline === discipline);
    if (index === -1) return;

    Object.entries(partial).forEach(([key, value]) => {
      if (value !== undefined) {
        setValue(
          (`participants.${index}.${key as keyof ParticipantInput}` as const),
          value as ParticipantInput[keyof ParticipantInput],
          {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: false,
      });
      }
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
      firstName: teamLeadFirstName || userName || "Teamchef:in",
      lastName: teamLeadLastName || (!teamLeadFirstName && userName ? userName : ""),
      email: userEmail,
      birthDate: teamLeadBirthDate,
      gender: teamLeadGender,
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
  }, [teamLeadParticipates, teamLeadDiscipline, teamLeadFirstName, teamLeadLastName, userEmail, teamLeadBirthDate, teamLeadGender]);

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

  const randomBirthDate = (minYear: number, maxYear: number) => {
    const year = minYear + Math.floor(Math.random() * (maxYear - minYear + 1));
    const month = Math.floor(Math.random() * 12) + 1;
    const day = Math.floor(Math.random() * 28) + 1;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  };

  // Shuffle array helper for high variance
  const shuffled = <T,>(arr: T[]): T[] => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const applyTestData = (selectedClass: TeamClassId) => {
    const config = CLASS_CONFIG[selectedClass];
    const classLabel = TEAM_CLASSES.find((entry) => entry.id === selectedClass)?.label || "Team";

    // Don't reset teamlead state — preserve if already set

    // Immer neuen Mannschaftsnamen generieren aus dem Pool
    const generatedName = generateTeamName(selectedClass);
    setValue("teamName", generatedName, { shouldDirty: true, shouldTouch: true, shouldValidate: true });

    // Shuffled name pools for maximum variance + no duplicate last names
    const malePool = shuffled(MALE_NAMES);
    const femalePool = shuffled(FEMALE_NAMES);
    const lastPool = shuffled(LAST_NAMES);
    let maleIdx = 0;
    let femaleIdx = 0;
    let lastIdx = 0;

    DISCIPLINES.forEach((discipline, index) => {
      const current = getValues(`participants.${index}` as const);
      const hasFirstName = current?.firstName?.trim();
      const hasLastName = current?.lastName?.trim();
      const hasBirthDate = current?.birthDate?.trim();

      const participantGender =
        config.gender === "mixed"
          ? Math.random() > 0.5 ? "M" : "W"
          : config.gender;

      // Participant 0 = team lead (pre-filled from session). Never touched by test data.
      // Classification warnings show mismatches (age, gender) in real-time.
      const isTeamLead = index === 0 && teamLeadParticipates;
      if (isTeamLead) {
        return;
      }

      // All other participants: always overwrite with fresh test data (even on re-roll)
      const firstName = participantGender === "W"
        ? femalePool[femaleIdx++ % femalePool.length]
        : malePool[maleIdx++ % malePool.length];
      const lastName = lastPool[lastIdx++ % lastPool.length];

      const payload: ParticipantInput = {
        firstName,
        lastName,
        birthDate: randomBirthDate(config.minYear, config.maxYear),
        gender: participantGender,
        email: current?.email || "",
        phone: current?.phone || "",
        discipline: discipline.id,
      };

      setValue(`participants.${index}` as const, payload, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
    });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className="">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Mannschaftsanmeldung</CardTitle>
            <Badge variant="outline" className="text-sm px-3 py-1">Schritt {step}/3</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-6">
            {[1, 2, 3].map((s) => (
              <div key={s} className={`flex-1 h-1 rounded-full transition-colors ${s <= step ? "bg-primary/60" : "bg-muted/40"}`} />
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
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Vorname (Authentik)</label>
                      <div className="mt-1 px-3 py-2 bg-muted rounded-md text-sm">{teamLeadFirstName || "—"}</div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Nachname (Authentik)</label>
                      <div className="mt-1 px-3 py-2 bg-muted rounded-md text-sm">{teamLeadLastName || "—"}</div>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">E-Mail (Authentik)</label>
                    <div className="mt-1 px-3 py-2 bg-muted rounded-md text-sm">{userEmail || "Nicht verfügbar"}</div>
                  </div>
                  <div>
                    <label htmlFor="teamName" className="text-sm font-medium">
                      Mannschaftsname (optional)
                    </label>
                    <input
                      id="teamName"
                      type="text"
                      {...register("teamName")}
                      className="mt-1 w-full px-3 py-2 bg-background border border-input/60 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder="z.B. Die Bergziegen"
                    />
                    {formState.errors.teamName && (
                      <p className="text-xs text-red-500 mt-1">{formState.errors.teamName.message}</p>
                    )}
                  </div>

                  <div className="rounded-md border border-border/50 shadow-sm bg-muted/40 p-3 space-y-2">
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
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-muted-foreground">Geburtsdatum</label>
                            <input
                              type="date"
                              className="mt-1 w-full px-3 py-2 bg-background border border-input/60 rounded-md text-sm"
                              value={teamLeadBirthDate}
                              onChange={(e) => setTeamLeadBirthDate(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Geschlecht</label>
                            <select
                              className="mt-1 w-full px-3 py-2 bg-background border border-input/60 rounded-md text-sm"
                              value={teamLeadGender}
                              onChange={(e) => setTeamLeadGender(e.target.value as "M" | "W" | "D")}
                            >
                              <option value="M">♂️ Männlich</option>
                              <option value="W">♀️ Weiblich</option>
                              <option value="D">⚧️ Divers</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Gewünschte Disziplin</label>
                          <select
                            className="mt-1 w-full px-3 py-2 bg-background border border-input/60 rounded-md text-sm"
                            value={teamLeadDiscipline}
                            onChange={(event) => setTeamLeadDiscipline(event.target.value as DisciplineId)}
                          >
                            {DISCIPLINES.map((discipline) => (
                              <option key={discipline.id} value={discipline.id}>
                                {discipline.icon} {discipline.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <p className="text-xs text-muted-foreground">Du wirst automatisch als Teilnehmer übernommen.</p>
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
                  {/* Live-Klassifikation Banner */}
                  <div className={`rounded-lg p-3 border ${
                    liveClassification.code === "unclassified"
                      ? "bg-muted/30 border-border/40"
                      : "bg-primary/5 border-primary/20"
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{liveClassification.emoji}</span>
                        <div>
                          <span className="font-medium text-sm">{liveClassification.label}</span>
                          {!liveClassification.isYouthClass && liveClassification.totalAge > 0 && (
                            <span className="text-xs text-muted-foreground ml-2">
                              Gesamtalter: {liveClassification.totalAge}
                            </span>
                          )}
                        </div>
                      </div>
                      {!disciplineCheck.valid && (
                        <Badge variant="outline" className="text-xs text-amber-600">
                          Disziplinen unvollständig
                        </Badge>
                      )}
                    </div>
                    {liveClassification.info.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {liveClassification.info.map((msg, i) => (
                          <p key={i} className="text-xs text-blue-500 dark:text-blue-400">ℹ️ {msg}</p>
                        ))}
                      </div>
                    )}
                    {(liveClassification.warnings.length > 0 || disciplineCheck.warnings.length > 0) && (
                      <div className="mt-1 space-y-1">
                        {[...liveClassification.warnings, ...disciplineCheck.warnings].map((w, i) => (
                          <p key={i} className="text-xs text-amber-600 dark:text-amber-400">⚠️ {w}</p>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Testdaten-Generierung OBEN */}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium">Test-Klasse</label>
                      <select
                        className="px-3 py-1.5 bg-background border border-input/60 rounded-md text-sm"
                        value={testDataClass}
                        onChange={(event) => setTestDataClass(event.target.value as TeamClassId)}
                      >
                        {TEAM_CLASSES.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.label}
                          </option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => applyTestData(testDataClass)}
                      >
                        🎲 Testdaten
                      </Button>
                    </div>
                  </div>

                  {/* Navigation Buttons OBEN */}
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                      ← Zurück
                    </Button>
                    <Button onClick={handleNextFromParticipants} className="flex-1">
                      Zur Bestätigung →
                    </Button>
                  </div>

                  {/* Mannschafts-Box mit Teamname + alle Teilnehmer */}
                  <Card className="p-4 space-y-4">
                    {/* Editierbarer Mannschaftsname */}
                    <div>
                      <label htmlFor="teamName2" className="text-sm font-medium">Mannschaftsname</label>
                      <input
                        id="teamName2"
                        type="text"
                        {...register("teamName")}
                        className="mt-1 w-full px-3 py-2 bg-background border border-input/60 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="z.B. Die Bergziegen"
                      />
                    </div>

                    {/* Teilnehmer */}
                    <div className="space-y-3">
                      {fields.map((field, index) => (
                        <div key={field.id} className="rounded-md border border-border/50 shadow-sm bg-muted/20 p-3 space-y-2">
                          <div className="flex items-center justify-between text-sm font-medium">
                            <span>{disciplineMap[participants[index]?.discipline as DisciplineId]?.icon} {disciplineMap[participants[index]?.discipline as DisciplineId]?.label ?? `Teilnehmer:in ${index + 1}`}</span>
                            {teamLeadParticipates && participants[index]?.discipline === teamLeadDiscipline && (
                              <Badge variant="secondary" className="text-[0.65rem]">Teamchef:in</Badge>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="hidden"
                              value={participants[index]?.discipline}
                              readOnly
                              {...register(`participants.${index}.discipline` as const)}
                            />
                            <input
                              placeholder="Vorname"
                              className="px-2 py-1 bg-background border border-input/60 rounded text-sm"
                              {...register(`participants.${index}.firstName` as const)}
                            />
                            <input
                              placeholder="Nachname"
                              className="px-2 py-1 bg-background border border-input/60 rounded text-sm"
                              {...register(`participants.${index}.lastName` as const)}
                            />
                            <input
                              type="date"
                              className="px-2 py-1 bg-background border border-input/60 rounded text-sm"
                              {...register(`participants.${index}.birthDate` as const)}
                            />
                            <select
                              className="px-2 py-1 bg-background border border-input/60 rounded text-sm"
                              {...register(`participants.${index}.gender` as const)}
                            >
                              <option value="M">Männlich</option>
                              <option value="W">Weiblich</option>
                              <option value="D">Divers</option>
                            </select>
                            <input
                              placeholder="E-Mail (optional)"
                              className="px-2 py-1 bg-background border border-input/60 rounded text-sm"
                              {...register(`participants.${index}.email` as const)}
                            />
                            <input
                              placeholder="Telefon (optional)"
                              className="px-2 py-1 bg-background border border-input/60 rounded text-sm"
                              {...register(`participants.${index}.phone` as const)}
                            />
                            <select
                              className="px-2 py-1 bg-background border border-input/60 rounded text-sm"
                              disabled={shirtOrderClosed}
                              {...register(`participants.${index}.shirtSize` as const)}
                            >
                              <option value="">T-Shirt-Größe (optional)</option>
                              {SHIRT_SIZES.map((size) => (
                                <option key={size.id} value={size.id}>{size.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>

                  {shirtOrderClosed && (
                    <p className="text-xs text-muted-foreground">T-Shirt-Bestellfrist abgeschlossen, Größen sind nur noch für Admin editierbar.</p>
                  )}

                  {formState.errors.participants && (
                    <p className="text-xs text-red-500">Bitte fehlende Angaben ergänzen.</p>
                  )}

                  {/* Navigation Buttons UNTEN */}
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
                      <span>Klasse:</span>
                      <span className="font-medium">{liveClassification.emoji} {liveClassification.label}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Gesamtalter:</span>
                      <span className="font-medium">{liveClassification.totalAge}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Kontakt:</span>
                      <span className="font-medium">{userName}</span>
                    </div>
                    <div>
                      <span className="font-medium">Disziplin-Status</span>
                      <ul className="mt-2 space-y-1">
                        {DISCIPLINES.map((discipline) => {
                          const assigned = participants.find(
                            (participant) => participant.discipline === discipline.id && participant.firstName && participant.lastName
                          );
                          return (
                            <li key={discipline.id} className="flex items-center justify-between">
                              <div>
                                <span>
                                  {discipline.icon} {discipline.label}
                                </span>
                                <p className="text-xs text-muted-foreground">
                                  {assigned ? `${assigned.firstName} ${assigned.lastName}` : "TBD"}
                                </p>
                              </div>
                              <span className="font-mono">{assigned ? 1 : 0}</span>
                            </li>
                          );
                        })}
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
