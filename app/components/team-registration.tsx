"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  createEmptyParticipant,
  createDefaultTeamForm,
  DISCIPLINES,
  DISCIPLINE_PLACEHOLDER,
  extractBirthYearFromInput,
  summarizeDisciplines,
  TeamRegistrationInput,
  TeamRegistrationSchema,
  type DisciplineId,
  type ParticipantInput,
} from "@/lib/domain/team";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { classifyTeam, validateDisciplineAssignment } from "@/lib/domain/classification";
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

interface TeamRegistrationProps {
  allowAnonymous?: boolean;
}

type PublicCompetitionInfo = {
  id: string;
  name: string;
  year: number;
  status: string;
  registrationDeadline: string | null;
  shirtOrderDeadline: string | null;
  maxTeams: number | null;
  teamSize: number;
  location: string | null;
  teamCount: number;
};

function isRegistrationDeadlineReached(deadline?: string | null) {
  if (!deadline) return false;
  return new Date(deadline) < new Date();
}

function getPublicRegistrationStatus(competition: PublicCompetitionInfo | null) {
  if (!competition) {
    return {
      phaseLabel: "Lade Status",
      availabilityLabel: "prüfen",
      canRegister: true,
      detail: "Wettkampfparameter werden geladen.",
    };
  }

  const deadlineReached = isRegistrationDeadlineReached(competition.registrationDeadline);
  const teamLimitReached = Boolean(
    competition.maxTeams && competition.maxTeams > 0 && competition.teamCount >= competition.maxTeams,
  );
  const statusAllowsRegistration = competition.status === "DRAFT" || competition.status === "OPEN";

  const phaseLabel =
    competition.status === "DRAFT"
      ? "Simulation"
      : competition.status === "OPEN"
        ? "Live"
        : competition.status === "RUNNING"
          ? "Wettkampf läuft"
          : "Geschlossen";

  if (!statusAllowsRegistration) {
    return {
      phaseLabel,
      availabilityLabel: "geschlossen",
      canRegister: false,
      detail: "Die Anmeldung ist in diesem Wettkampfstatus nicht mehr offen.",
    };
  }

  if (deadlineReached) {
    return {
      phaseLabel,
      availabilityLabel: "geschlossen",
      canRegister: false,
      detail: "Der Anmeldeschluss ist erreicht.",
    };
  }

  if (teamLimitReached) {
    return {
      phaseLabel,
      availabilityLabel: "voll",
      canRegister: false,
      detail: "Die maximale Teamzahl ist erreicht.",
    };
  }

  return {
    phaseLabel,
    availabilityLabel: "offen",
    canRegister: true,
    detail:
      competition.status === "DRAFT"
        ? "Die Anmeldung ist aktuell als Simulation für Tests geöffnet."
        : "Die Anmeldung ist aktuell geöffnet.",
  };
}

export default function TeamRegistration({ allowAnonymous = false }: TeamRegistrationProps) {
  const { data: session } = useSession();
  const { active: activeCompetition } = useCompetition();
  const userName = session?.user?.name ?? "";
  const userEmail = session?.user?.email ?? "";
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState("");
  const [submissionWarning, setSubmissionWarning] = useState("");
  const [competitionInfo, setCompetitionInfo] = useState<PublicCompetitionInfo | null>(null);



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
      .map((p: any) => ({
        birthYear: extractBirthYearFromInput(p.birthDate),
        gender: p.gender as "M" | "W",
      }))
      .filter((p: any) => p.birthYear !== null) as Array<{ birthYear: number; gender: "M" | "W" }>;
    return classifyTeam(inputs);
  }, [watchedValues]);

  const disciplineCheck = useMemo(() => {
    const discs = (watchedParticipants || []).map((p: any) => p.discipline || "TBD");
    return validateDisciplineAssignment(discs);
  }, [watchedValues]);

  const participants = watch("participants");
  const teamName = watch("teamName");
  const contactFirstName = watch("contactFirstName");
  const contactLastName = watch("contactLastName");
  const contactName = watch("contactName");
  const contactEmail = watch("contactEmail");
  const effectiveContactName = userName || [contactFirstName, contactLastName].filter(Boolean).join(" ").trim() || contactName || "";
  const effectiveContactEmail = userEmail || contactEmail || "";
  const isAnonymousRegistration = allowAnonymous && !session?.user;

  const [teamLeadParticipates, setTeamLeadParticipates] = useState(false);
  const [teamLeadDiscipline, setTeamLeadDiscipline] = useState<DisciplineId>(DISCIPLINES[0].id);
  const [teamLeadBirthDate, setTeamLeadBirthDate] = useState("");
  const [teamLeadGender, setTeamLeadGender] = useState<"M" | "W">("M");
  const [liabilityAccepted, setLiabilityAccepted] = useState(false);
  const [testDataClass, setTestDataClass] = useState<TeamClassId>("schueler-a");

  const [teamLeadFirstName, teamLeadLastName] = useMemo(() => {
    if (!userName) {
      return [contactFirstName || "", contactLastName || ""];
    }
    const parts = userName.trim().split(" ");
    if (parts.length === 1) return [parts[0], ""];
    return [parts[0], parts.slice(1).join(" ")];
  }, [userName, contactFirstName, contactLastName]);

  const disciplineMap = useMemo(
    () => Object.fromEntries(DISCIPLINES.map((discipline) => [discipline.id, discipline])),
    []
  );

  const disciplineSummary = useMemo(() => summarizeDisciplines(participants), [participants]);
  const shirtOrderClosed = useMemo(() => isShirtOrderClosed(competitionInfo?.shirtOrderDeadline), [competitionInfo?.shirtOrderDeadline]);
  const publicRegistrationStatus = useMemo(() => getPublicRegistrationStatus(competitionInfo), [competitionInfo]);
  const showTestDataTools = !isAnonymousRegistration && competitionInfo?.status === "DRAFT";

  useEffect(() => {
    if (!userName) {
      const composedName = [contactFirstName, contactLastName].filter(Boolean).join(" ").trim();
      setValue("contactName", composedName, { shouldDirty: true, shouldTouch: false, shouldValidate: false });
    }
  }, [userName, contactFirstName, contactLastName, setValue]);

  useEffect(() => {
    (async () => {
      try {
        const query = activeCompetition?.id ? `?id=${activeCompetition.id}` : "";
        const res = await fetch(`/api/competition${query}`);
        if (!res.ok) return;
        const data = await res.json();
        setCompetitionInfo(data.competition || null);
      } catch (err) {
        console.error("Failed to load competition details:", err);
      }
    })();
  }, [activeCompetition?.id]);

  const previousTeamLeadDiscipline = useRef<DisciplineId>(DISCIPLINES[0].id);

  const findParticipantIndexByDiscipline = (discipline: DisciplineId) => {
    const current = getValues("participants");
    return current.findIndex((participant) => participant.discipline === discipline);
  };

  const replaceParticipantByDiscipline = (discipline: DisciplineId, participant: ParticipantInput) => {
    const index = findParticipantIndexByDiscipline(discipline);
    if (index === -1) return;

    setValue(`participants.${index}` as const, participant, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  };

  const clearTeamLeadSlot = (discipline: DisciplineId) => {
    replaceParticipantByDiscipline(discipline, {
      ...createEmptyParticipant(),
      discipline,
    });
  };

  const fillTeamLeadSlot = (discipline: DisciplineId) => {
    const index = findParticipantIndexByDiscipline(discipline);
    const current = index === -1 ? undefined : getValues(`participants.${index}` as const);

    replaceParticipantByDiscipline(discipline, {
      ...createEmptyParticipant(),
      firstName: teamLeadFirstName || effectiveContactName || "Teamchef:in",
      lastName: teamLeadLastName || (!teamLeadFirstName && effectiveContactName ? effectiveContactName : ""),
      email: effectiveContactEmail,
      phone: current?.phone || "",
      birthDate: teamLeadBirthDate,
      gender: teamLeadGender,
      shirtSize: current?.shirtSize || "",
      discipline,
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
  }, [teamLeadParticipates, teamLeadDiscipline, teamLeadFirstName, teamLeadLastName, effectiveContactEmail, effectiveContactName, teamLeadBirthDate, teamLeadGender]);

  if (!session?.user && !allowAnonymous) return null;

  const handleNextFromTeam = async () => {
    const fieldsToValidate = isAnonymousRegistration
      ? (["teamName", "contactFirstName", "contactLastName", "contactEmail"] as const)
      : (["teamName"] as const);
    const ok = await trigger(fieldsToValidate);
    if (ok) {
      setStep(2);
    }
  };

  const handleNextFromParticipants = async () => {
    const ok = await trigger(["teamName", "participants"]);
    if (ok) {
      setStep(3);
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    setServerError("");
    setSubmissionWarning("");

    if (!publicRegistrationStatus.canRegister) {
      setServerError(publicRegistrationStatus.detail);
      return;
    }

    if (!liabilityAccepted) {
      setServerError("Bitte bestätige zuerst den Haftungsausschluss und die Veranstaltungsinformationen.");
      return;
    }

    try {
      const response = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          contactName: effectiveContactName,
          contactEmail: effectiveContactEmail,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Anmeldung fehlgeschlagen");
      }

      const mailAttempts = Array.isArray(payload.mail?.attempts) ? payload.mail.attempts : [];
      const hasMailIssues = mailAttempts.some((attempt: { status?: string }) => attempt.status && attempt.status !== "sent");
      if (hasMailIssues) {
        setSubmissionWarning(
          "Die Mannschaft ist angelegt, aber der Mailversand konnte nicht vollstaendig bestaetigt werden. Bitte kurz Spam/Werbung pruefen und die Orga informieren, falls keine Mail ankommt."
        );
      }

      setSubmitted(true);
      reset(createDefaultTeamForm());
      setTeamLeadParticipates(false);
      setTeamLeadDiscipline(DISCIPLINES[0].id);
      setLiabilityAccepted(false);
      previousTeamLeadDiscipline.current = DISCIPLINES[0].id;
      setStep(1);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Unbekannter Fehler");
    }
  });

  const startAnotherRegistration = () => {
    setServerError("");
    setSubmissionWarning("");
    setSubmitted(false);
    setLiabilityAccepted(false);
    setStep(1);
  };

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

    // Shuffled name pools for maximum variance + no duplicate last names
    const malePool = shuffled(MALE_NAMES);
    const femalePool = shuffled(FEMALE_NAMES);
    const lastPool = shuffled(LAST_NAMES);
    let maleIdx = 0;
    let femaleIdx = 0;
    let lastIdx = 0;

    DISCIPLINES.forEach((discipline, index) => {
      const current = getValues(`participants.${index}` as const);

      const participantGender =
        config.gender === "mixed"
          ? Math.random() > 0.5 ? "M" : "W"
          : config.gender;

      const isTeamLead = teamLeadParticipates && discipline.id === teamLeadDiscipline;
      if (isTeamLead) {
        fillTeamLeadSlot(discipline.id);
        return;
      }

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
        shirtSize: current?.shirtSize || "",
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

              {allowAnonymous && (
                <div className="mb-6 rounded-lg border border-border/60 bg-muted/20 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{publicRegistrationStatus.phaseLabel}</Badge>
                    <Badge variant={publicRegistrationStatus.canRegister ? "default" : "secondary"}>
                      {publicRegistrationStatus.availabilityLabel}
                    </Badge>
                  </div>
                  <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                    <p>{publicRegistrationStatus.detail}</p>
                    {competitionInfo?.registrationDeadline && (
                      <p>Anmeldeschluss: {new Date(competitionInfo.registrationDeadline).toLocaleDateString("de-DE")}</p>
                    )}
                  </div>
                </div>
              )}

          {submitted ? (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center p-8 space-y-4">
              <div className="text-6xl">🏅</div>
              <h3 className="text-xl font-semibold text-green-600">Anmeldung erfolgreich uebermittelt</h3>
              <p className="text-muted-foreground">Die Mannschaft ist im Portal erfasst. Alles Weitere haengt jetzt davon ab, ob du mit oder ohne Login angemeldet hast.</p>
              {submissionWarning && (
                <div className="max-w-xl mx-auto rounded-lg border border-amber-300 bg-amber-50 p-4 text-left text-sm text-amber-900">
                  {submissionWarning}
                </div>
              )}
              {isAnonymousRegistration ? (
                <div className="max-w-xl mx-auto rounded-lg border border-border/50 bg-muted/30 p-4 text-left space-y-3">
                  <p className="text-sm font-medium">So geht es jetzt weiter</p>
                  <ol className="list-decimal pl-5 text-sm text-muted-foreground space-y-1">
                    <li>Wir schicken den Uebernahmelink an <strong>{effectiveContactEmail}</strong>.</li>
                    <li>Oeffne den Link aus der Mail und melde dich dort mit derselben E-Mail im Portal an oder lege damit ein neues Konto an.</li>
                    <li>Danach ist das Team deinem Account zugeordnet und du kannst Aenderungen direkt im Portal pflegen.</li>
                  </ol>
                  <p className="text-xs text-muted-foreground">Wenn nichts ankommt, pruefe bitte auch Spam und Werbung. Wenn nach ein paar Minuten immer noch keine Mail da ist, melde dich direkt bei der Orga.</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Du kannst jetzt direkt im Portal ins Mannschafts-Dashboard wechseln und dort weiterarbeiten.</p>
              )}
              <div className="flex justify-center pt-2">
                <Button onClick={startAnotherRegistration}>Weitere Mannschaft anmelden</Button>
              </div>
            </motion.div>
          ) : (
            <>
              {step === 1 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                  {isAnonymousRegistration ? (
                    <>
                      <div className="rounded-md border border-border/50 shadow-sm bg-muted/20 p-3 text-sm text-muted-foreground">
                        Du kannst die Mannschaft jetzt ohne Login anmelden. Danach bekommst du per Mail einen Uebernahmelink, mit dem du das Team spaeter deinem Portal-Konto zuordnen kannst.
                      </div>
                      <div className="rounded-md border border-border/50 shadow-sm bg-muted/20 p-4 space-y-4">
                        <div>
                          <p className="text-sm font-medium text-foreground">Kontakt</p>
                          <p className="text-xs text-muted-foreground">An diese E-Mail senden wir spaeter den Uebernahmelink fuer die weitere Bearbeitung im Portal.</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label htmlFor="contactLastName" className="text-sm font-medium">Nachname</label>
                            <input
                              id="contactLastName"
                              type="text"
                              {...register("contactLastName")}
                              className="mt-1 w-full px-3 py-2 bg-background border border-input/60 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                              placeholder="z.B. Mustermann"
                            />
                            {formState.errors.contactLastName && (
                              <p className="text-xs text-red-500 mt-1">{formState.errors.contactLastName.message}</p>
                            )}
                          </div>
                          <div>
                            <label htmlFor="contactFirstName" className="text-sm font-medium">Vorname</label>
                            <input
                              id="contactFirstName"
                              type="text"
                              {...register("contactFirstName")}
                              className="mt-1 w-full px-3 py-2 bg-background border border-input/60 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                              placeholder="z.B. Max"
                            />
                            {formState.errors.contactFirstName && (
                              <p className="text-xs text-red-500 mt-1">{formState.errors.contactFirstName.message}</p>
                            )}
                          </div>
                        </div>
                        <div>
                          <label htmlFor="contactEmail" className="text-sm font-medium">E-Mail</label>
                          <input
                            id="contactEmail"
                            type="email"
                            {...register("contactEmail")}
                            className="mt-1 w-full px-3 py-2 bg-background border border-input/60 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            placeholder="teamchef@example.de"
                          />
                          {formState.errors.contactEmail && (
                            <p className="text-xs text-red-500 mt-1">{formState.errors.contactEmail.message}</p>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Vorname (aus deinem Konto)</label>
                          <div className="mt-1 px-3 py-2 bg-muted rounded-md text-sm">{teamLeadFirstName || "—"}</div>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Nachname (aus deinem Konto)</label>
                          <div className="mt-1 px-3 py-2 bg-muted rounded-md text-sm">{teamLeadLastName || "—"}</div>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">E-Mail (aus deinem Konto)</label>
                        <div className="mt-1 px-3 py-2 bg-muted rounded-md text-sm">{userEmail || "Nicht verfügbar"}</div>
                      </div>
                    </>
                  )}
                  <div>
                    <label htmlFor="teamName" className="text-sm font-medium">
                      Mannschaftsname
                    </label>
                    <input
                      id="teamName"
                      type="text"
                      {...register("teamName")}
                      className="mt-1 w-full px-3 py-2 bg-background border border-input/60 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder="z.B. Die Bergziegen"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Der Mannschaftsname ist Pflicht, kann auf der Folgeseite aber noch angepasst werden.</p>
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
                              type="text"
                              inputMode="numeric"
                              placeholder="TT.MM.JJJJ"
                              autoComplete="bday"
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
                              onChange={(e) => setTeamLeadGender(e.target.value as "M" | "W")}
                            >
                              <option value="M">♂️ Männlich</option>
                              <option value="W">♀️ Weiblich</option>
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
                  <Button onClick={handleNextFromTeam} disabled={!publicRegistrationStatus.canRegister || (isAnonymousRegistration ? !teamName || !contactFirstName || !contactLastName || !contactEmail : !teamName)} className="w-full">
                    Weiter zu Teilnehmern →
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
                  {showTestDataTools && (
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
                  )}

                  {/* Navigation Buttons OBEN */}
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                      ← Zurück
                    </Button>
                    <Button onClick={handleNextFromParticipants} className="flex-1" disabled={!publicRegistrationStatus.canRegister}>
                      Weiter zur Pruefung →
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
                              type="text"
                              inputMode="numeric"
                              placeholder="TT.MM.JJJJ"
                              autoComplete="bday"
                              className="px-2 py-1 bg-background border border-input/60 rounded text-sm"
                              {...register(`participants.${index}.birthDate` as const)}
                            />
                            <select
                              className="px-2 py-1 bg-background border border-input/60 rounded text-sm"
                              {...register(`participants.${index}.gender` as const)}
                            >
                              <option value="M">Männlich</option>
                              <option value="W">Weiblich</option>
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
                    <Button onClick={handleNextFromParticipants} className="flex-1" disabled={!publicRegistrationStatus.canRegister}>
                      Zur finalen Prüfung →
                    </Button>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                  <div className="text-center space-y-2">
                    <h3 className="text-lg font-medium">Letzter Schritt: Angaben pruefen und absenden</h3>
                    <p className="text-muted-foreground">Pruefe hier alles noch einmal in Ruhe. Erst mit dem letzten Klick wird die Mannschaft wirklich angemeldet.</p>
                    {isAnonymousRegistration && (
                      <p className="text-xs text-muted-foreground">Der Uebernahmelink fuer die spaetere Weiterbearbeitung geht an {effectiveContactEmail || "deine Kontakt-E-Mail"}.</p>
                    )}
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
                      <span className="font-medium">{effectiveContactName || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Kontakt-E-Mail:</span>
                      <span className="font-medium">{effectiveContactEmail || "—"}</span>
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

                  <div className="rounded-md border border-border/50 bg-muted/20 p-4">
                    <label className="flex items-start gap-3 text-sm leading-relaxed">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 shrink-0"
                        checked={liabilityAccepted}
                        onChange={(event) => setLiabilityAccepted(event.target.checked)}
                      />
                      <span>
                        Mit dem Klick auf den Button bestätigen Sie, dass Sie den{" "}
                        <a
                          href="https://www.esvbadbayersoien.de/veranstaltungen/5-kampf/"
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-primary underline underline-offset-2"
                        >
                          Haftungsausschluss und Informationen zur Veranstaltung
                        </a>{" "}
                        zur Kenntnis genommen haben und diesen zustimmen.
                      </span>
                    </label>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setStep(2)} className="flex-1" disabled={formState.isSubmitting}>
                      ← Zurück
                    </Button>
                    <Button onClick={onSubmit} className="flex-1" disabled={formState.isSubmitting || !publicRegistrationStatus.canRegister || !liabilityAccepted}>
                      {formState.isSubmitting ? "Sende Anmeldung ab..." : "Mannschaft jetzt anmelden 🏅"}
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
