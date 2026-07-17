"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  createEmptyParticipant,
  createDefaultTeamForm,
  DISCIPLINES,
  DISCIPLINE_PLACEHOLDER,
  extractBirthYearFromInput,
  formatBirthDateInput,
  MARKETPLACE_VISIBILITY_OPTIONS,
  PARTICIPANT_PUBLICATION_OPTIONS,
  TEAM_PUBLICATION_OPTIONS,
  resolveBirthDateInputKey,
  summarizeDisciplines,
  type MarketplaceVisibilityId,
  TeamRegistrationFormInput,
  TeamRegistrationSchema,
  type DisciplineId,
  type ParticipantInput,
} from "@/lib/domain/team";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCompetition } from "@/lib/competition-context";
import { SHIRT_SIZES, isShirtOrderClosed } from "@/lib/domain/shirts";
import { evaluateTeamDraft, YOUTH_CLASS_YEAR_RANGES } from "@/lib/domain/classification";

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

type RegistrationMode = "TEAM" | "MARKETPLACE";

const CLASS_CONFIG: Record<TeamClassId, { minYear: number; maxYear: number; gender: "M" | "W" | "mixed" }> = {
  "schueler-a": { ...YOUTH_CLASS_YEAR_RANGES["schueler-a"], gender: "mixed" },
  "schueler-b": { ...YOUTH_CLASS_YEAR_RANGES["schueler-b"], gender: "mixed" },
  jugend: { ...YOUTH_CLASS_YEAR_RANGES.jugend, gender: "mixed" },
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
  initialMode?: RegistrationMode;
  lockRegistrationMode?: boolean;
  presentation?: "default" | "marketplace" | "mtc-draft";
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
  teamCount: number | null;
};

function isRegistrationDeadlineReached(deadline?: string | null) {
  if (!deadline) return false;
  return new Date(deadline) < new Date();
}

function getPublicRegistrationStatus(competition: PublicCompetitionInfo | null) {
  if (!competition) {
    return {
      availabilityLabel: "prüfen",
      canRegister: true,
      detail: "Wettkampfparameter werden geladen.",
    };
  }

  const deadlineReached = isRegistrationDeadlineReached(competition.registrationDeadline);
  const teamLimitReached = Boolean(
    competition.maxTeams && competition.maxTeams > 0 && (competition.teamCount ?? 0) >= competition.maxTeams,
  );
  const statusAllowsRegistration = competition.status === "DRAFT" || competition.status === "OPEN";

  if (!statusAllowsRegistration) {
    return {
      availabilityLabel: "geschlossen",
      canRegister: false,
      detail: "Die Anmeldung ist in diesem Wettkampfstatus nicht mehr offen.",
    };
  }

  if (deadlineReached) {
    return {
      availabilityLabel: "geschlossen",
      canRegister: false,
      detail: "Der Anmeldeschluss ist erreicht.",
    };
  }

  if (teamLimitReached) {
    return {
      availabilityLabel: "voll",
      canRegister: false,
      detail: "Die maximale Teamzahl ist erreicht.",
    };
  }

  return {
    availabilityLabel: "offen",
    canRegister: true,
    detail:
      competition.status === "DRAFT"
        ? "Die Anmeldung ist aktuell als Simulation für Tests geöffnet."
        : "Die Anmeldung ist aktuell geöffnet.",
  };
}

function handleBirthDateKeyDown(
  event: React.KeyboardEvent<HTMLInputElement>,
  value: string,
  onValueChange: (nextValue: string) => void,
) {
  const nextState = resolveBirthDateInputKey(
    value,
    event.key,
    event.currentTarget.selectionStart,
    event.currentTarget.selectionEnd,
  );

  if (!nextState) return;

  event.preventDefault();
  onValueChange(nextState.value);
  requestAnimationFrame(() => {
    event.currentTarget.setSelectionRange(nextState.caret, nextState.caret);
  });
}

export default function TeamRegistration({
  allowAnonymous = false,
  initialMode = "TEAM",
  lockRegistrationMode = false,
  presentation = "default",
}: TeamRegistrationProps) {
  const { data: session } = useSession();
  const { active: activeCompetition } = useCompetition();
  const userName = session?.user?.name ?? "";
  const userEmail = session?.user?.email ?? "";
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [submittedRecipientEmail, setSubmittedRecipientEmail] = useState("");
  const [serverError, setServerError] = useState("");
  const [submissionWarning, setSubmissionWarning] = useState("");
  const [submittedMtcAnonymousUrl, setSubmittedMtcAnonymousUrl] = useState("");
  const [savingMtcDraft, setSavingMtcDraft] = useState(false);
  const [competitionInfo, setCompetitionInfo] = useState<PublicCompetitionInfo | null>(null);
  const [registrationMode, setRegistrationMode] = useState<RegistrationMode>(initialMode);
  const [marketplaceBirthDate, setMarketplaceBirthDate] = useState("");
  const [marketplaceGender, setMarketplaceGender] = useState<"M" | "W">("M");
  const [marketplaceDiscipline, setMarketplaceDiscipline] = useState<DisciplineId | typeof DISCIPLINE_PLACEHOLDER>(DISCIPLINE_PLACEHOLDER);
  const [marketplaceClubName, setMarketplaceClubName] = useState("");
  const [marketplaceVisibility, setMarketplaceVisibility] = useState<MarketplaceVisibilityId>("ADMIN_MANAGEMENT_ONLY");
  const [marketplaceParticipantPublication, setMarketplaceParticipantPublication] = useState<"NAME_VERBERGEN" | "NAME_VEROEFFENTLICHEN">("NAME_VERBERGEN");
  const [marketplaceMessage, setMarketplaceMessage] = useState("");



  const form = useForm<TeamRegistrationFormInput>({
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

  const watchedParticipants = useWatch({ control, name: "participants" });
  const participants = useMemo(() => watchedParticipants ?? [], [watchedParticipants]);

  const teamName = watch("teamName");
  const contactFirstName = watch("contactFirstName");
  const contactLastName = watch("contactLastName");
  const contactName = watch("contactName");
  const contactEmail = watch("contactEmail");
  const contactPhone = watch("contactPhone");
  const effectiveContactName = userName || [contactFirstName, contactLastName].filter(Boolean).join(" ").trim() || contactName || "";
  const effectiveContactEmail = userEmail || contactEmail || "";
  const isAnonymousRegistration = allowAnonymous && !session?.user;
  const isMarketplaceRegistration = registrationMode === "MARKETPLACE";
  const isMarketplacePresentation = presentation === "marketplace";
  const isMtcDraftPresentation = presentation === "mtc-draft";
  const teamDraftEvaluation = useMemo(
    () =>
      evaluateTeamDraft({
        mode: isAnonymousRegistration ? "anonymous-create" : "authenticated-create",
        teamName,
        contactFirstName,
        contactLastName,
        contactName,
        contactEmail,
        participants,
      }),
    [contactEmail, contactFirstName, contactLastName, contactName, isAnonymousRegistration, participants, teamName],
  );
  const liveClassification = teamDraftEvaluation.classification;
  const disciplineCheck = teamDraftEvaluation.discipline;
  const stepTwoBlockingErrors = teamDraftEvaluation.blockingErrors;
  const stepTwoWarnings = teamDraftEvaluation.warnings;
  const hasBlockingValidationErrors = stepTwoBlockingErrors.length > 0;
  const hasMtcDraftAlternative = isMtcDraftPresentation && !isMarketplaceRegistration;

  const [teamLeadParticipates, setTeamLeadParticipates] = useState(false);
  const [teamLeadDiscipline, setTeamLeadDiscipline] = useState<DisciplineId>(DISCIPLINES[0].id);
  const [teamLeadBirthDate, setTeamLeadBirthDate] = useState("");
  const [teamLeadGender, setTeamLeadGender] = useState<"M" | "W">("M");
  const [liabilityAccepted, setLiabilityAccepted] = useState(false);
  const [testDataClass, setTestDataClass] = useState<TeamClassId>("schueler-a");
  const [openModerationNotes, setOpenModerationNotes] = useState<Record<number, boolean>>({});
  const [marketplaceValidationOpen, setMarketplaceValidationOpen] = useState(false);

  const [teamLeadFirstName, teamLeadLastName] = useMemo(() => {
    if (!userName) {
      return [contactFirstName || "", contactLastName || ""];
    }
    const parts = userName.trim().split(" ");
    if (parts.length === 1) return [parts[0], ""];
    return [parts[0], parts.slice(1).join(" ")];
  }, [userName, contactFirstName, contactLastName]);
  const marketplaceValidation = useMemo(() => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const birthDateLooksPlausible = extractBirthYearFromInput(marketplaceBirthDate) !== null;

    if (isAnonymousRegistration) {
      if (!contactFirstName) errors.push("Vorname fehlt");
      if (!contactLastName) errors.push("Nachname fehlt");
      if (!contactEmail) errors.push("E-Mail fehlt");
    } else {
      if (!effectiveContactName) errors.push("Kontaktname fehlt");
      if (!effectiveContactEmail) errors.push("E-Mail fehlt");
    }

    if (!marketplaceBirthDate) {
      errors.push("Geburtsdatum fehlt");
    } else if (!birthDateLooksPlausible) {
      errors.push("Geburtsdatum unplausibel");
    }

    if (marketplaceDiscipline === DISCIPLINE_PLACEHOLDER) {
      errors.push("Disziplin fehlt");
    }

    if (marketplaceVisibility === "ADMIN_MANAGEMENT_ONLY") {
      warnings.push("Die Meldung ist nach dem Absenden nur fuer Admins/MGMT sichtbar.");
    }

    return { errors, warnings };
  }, [
    contactEmail,
    contactFirstName,
    contactLastName,
    effectiveContactEmail,
    effectiveContactName,
    isAnonymousRegistration,
    marketplaceBirthDate,
    marketplaceDiscipline,
    marketplaceVisibility,
  ]);
  const hasMarketplaceValidationHints = marketplaceValidation.errors.length > 0 || marketplaceValidation.warnings.length > 0;

  const disciplineMap = useMemo(
    () => Object.fromEntries(DISCIPLINES.map((discipline) => [discipline.id, discipline])),
    []
  );

  const disciplineSummary = useMemo(() => summarizeDisciplines(participants), [participants]);
  const shirtOrderClosed = useMemo(() => isShirtOrderClosed(competitionInfo?.shirtOrderDeadline), [competitionInfo?.shirtOrderDeadline]);
  const publicRegistrationStatus = useMemo(() => getPublicRegistrationStatus(competitionInfo), [competitionInfo]);
  const showTestDataTools = !isAnonymousRegistration && competitionInfo?.status === "DRAFT";
  const completedParticipantCount = participants.filter((participant) => participant.firstName && participant.lastName).length;
  const publicationLabel = TEAM_PUBLICATION_OPTIONS.find((option) => option.id === watch("teamPublicationLevel"))?.label || "-";
  const contactTitle = isMarketplaceRegistration || isMtcDraftPresentation ? "Kontakt für Rückfragen" : "Kontakt Team Manager:in";

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
  const teamLeadWasParticipating = useRef(false);

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
      firstName: teamLeadFirstName || effectiveContactName || "Team Manager:in",
      lastName: teamLeadLastName || (!teamLeadFirstName && effectiveContactName ? effectiveContactName : ""),
      email: effectiveContactEmail,
      birthDate: teamLeadBirthDate,
      gender: teamLeadGender,
      shirtSize: current?.shirtSize || "",
      discipline,
    });
  };

  useEffect(() => {
    if (teamLeadParticipates) {
      if (teamLeadWasParticipating.current && previousTeamLeadDiscipline.current !== teamLeadDiscipline) {
        clearTeamLeadSlot(previousTeamLeadDiscipline.current);
      }
      fillTeamLeadSlot(teamLeadDiscipline);
      previousTeamLeadDiscipline.current = teamLeadDiscipline;
      teamLeadWasParticipating.current = true;
    } else if (teamLeadWasParticipating.current) {
      clearTeamLeadSlot(previousTeamLeadDiscipline.current);
      previousTeamLeadDiscipline.current = teamLeadDiscipline;
      teamLeadWasParticipating.current = false;
    }
  }, [teamLeadParticipates, teamLeadDiscipline, teamLeadFirstName, teamLeadLastName, effectiveContactEmail, effectiveContactName, teamLeadBirthDate, teamLeadGender]);

  if (!session?.user && !allowAnonymous) return null;

  const handleNextFromTeam = async () => {
    if (isMarketplaceRegistration) {
      const fieldsToValidate = isAnonymousRegistration
        ? (["contactFirstName", "contactLastName", "contactEmail"] as const)
        : ([] as const);
      const ok = fieldsToValidate.length === 0 ? true : await trigger(fieldsToValidate);
      if (!ok) return;
      if (!marketplaceBirthDate || !marketplaceBirthDate.match(/\d{1,2}\.\d{1,2}\.\d{4}/)) {
        setServerError("Bitte gib ein plausibles Geburtsdatum für die Sportlerbörse an.");
        return;
      }
      if (marketplaceDiscipline === DISCIPLINE_PLACEHOLDER) {
        setServerError("Bitte wähle eine Disziplin für die Sportlerbörse aus.");
        return;
      }
      setServerError("");
      setStep(3);
      return;
    }

    const fieldsToValidate = isAnonymousRegistration
      ? (["teamName", "contactFirstName", "contactLastName", "contactEmail", "contactPhone"] as const)
      : (["teamName", "contactPhone"] as const);
    const mtcFieldsToValidate = isAnonymousRegistration
      ? (["teamName", "contactFirstName", "contactLastName", "contactEmail", "contactPhone"] as const)
      : (["teamName", "contactPhone"] as const);
    const ok = await trigger(isMtcDraftPresentation ? mtcFieldsToValidate : fieldsToValidate);
    if (ok) {
      setStep(2);
    }
  };

  const handleNextFromParticipants = async () => {
    if (isMtcDraftPresentation) {
      await submitMtcDraftRegistration();
      return;
    }

    const ok = await trigger(["teamName", "participants"]);
    if (ok) {
      setStep(3);
    }
  };

  const handleParticipantModerationNoteChange = (index: number, value: string) => {
    setValue(`participants.${index}.moderationNote` as const, value, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: false,
    });
  };

  const toggleModerationNote = (index: number) => {
    setOpenModerationNotes((current) => ({
      ...current,
      [index]: !current[index],
    }));
  };

  const submitMarketplaceRegistration = async () => {
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

    const values = getValues();
    const response = await trigger(
      isAnonymousRegistration ? ["contactFirstName", "contactLastName", "contactEmail", "contactPhone"] : ["contactPhone"],
    );
    if (!response) return;
    const userContactPhone = values.contactPhone?.trim() || "";
    if (!userContactPhone) {
      setServerError("Telefonnummer ist fuer Sportlerboerse-Meldungen erforderlich.");
      return;
    }

    try {
      const submitResponse = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registrationMode: "MARKETPLACE",
          contactFirstName: userName ? teamLeadFirstName : values.contactFirstName,
          contactLastName: userName ? teamLeadLastName : values.contactLastName,
          contactName: effectiveContactName,
          contactEmail: effectiveContactEmail,
          contactPhone: userContactPhone,
          birthDate: marketplaceBirthDate,
          gender: marketplaceGender,
          discipline: marketplaceDiscipline,
          clubName: marketplaceClubName,
          marketplaceVisibility,
          participantPublicationPreference: marketplaceParticipantPublication,
          marketplaceMessage,
        }),
      });

      const payload = await submitResponse.json();
      if (!submitResponse.ok) {
        throw new Error(payload.error || "Sportlerbörse-Anmeldung fehlgeschlagen");
      }

      const mailAttempts = Array.isArray(payload.mail?.attempts) ? payload.mail.attempts : [];
      const hasMailIssues = mailAttempts.some((attempt: { status?: string }) => attempt.status && attempt.status !== "sent");
      if (hasMailIssues) {
        setSubmissionWarning(
          "Die Sportlerbörse-Meldung ist angelegt, aber der Mailversand konnte nicht vollständig bestätigt werden."
        );
      }

      setSubmitted(true);
      setSubmittedRecipientEmail(effectiveContactEmail);
      reset(createDefaultTeamForm());
      setMarketplaceBirthDate("");
      setMarketplaceGender("M");
      setMarketplaceDiscipline(DISCIPLINE_PLACEHOLDER);
      setMarketplaceClubName("");
      setMarketplaceVisibility("ADMIN_MANAGEMENT_ONLY");
      setMarketplaceParticipantPublication("NAME_VERBERGEN");
      setMarketplaceMessage("");
      setLiabilityAccepted(false);
      setStep(1);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Unbekannter Fehler");
    }
  };

  const submitMtcDraftRegistration = async () => {
    setServerError("");
    setSubmissionWarning("");
    setSubmittedMtcAnonymousUrl("");

    if (!publicRegistrationStatus.canRegister) {
      setServerError(publicRegistrationStatus.detail);
      return;
    }

    const fieldsToValidate = isAnonymousRegistration
      ? (["teamName", "contactFirstName", "contactLastName", "contactEmail", "contactPhone"] as const)
      : (["teamName", "contactPhone"] as const);
    const ok = await trigger(fieldsToValidate);
    if (!ok) return;

    const values = getValues();
    const userContactName = effectiveContactName || values.contactName || [values.contactFirstName, values.contactLastName].filter(Boolean).join(" ").trim();
    const userContactEmail = effectiveContactEmail || values.contactEmail;
    const userContactPhone = values.contactPhone?.trim() || "";

    if (!userContactName || !userContactEmail || !userContactPhone) {
      setServerError("Kontaktname, Kontakt-E-Mail und Telefonnummer sind für den MTC-Entwurf erforderlich.");
      return;
    }

    setSavingMtcDraft(true);
    try {
      const submitResponse = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registrationMode: "MARKETPLACE",
          marketplaceDraftType: "MTC",
          teamName: values.teamName,
          contactFirstName: userName ? teamLeadFirstName : values.contactFirstName,
          contactLastName: userName ? teamLeadLastName : values.contactLastName,
          contactName: userContactName,
          contactEmail: userContactEmail,
          contactPhone: userContactPhone,
          teamPublicationLevel: values.teamPublicationLevel,
          participants: values.participants,
          marketplaceVisibility: "ADMIN_MANAGEMENT_ONLY",
          marketplaceMessage: "Aus der Mannschaftsanmeldung als unvollständiger MTC-Entwurf gespeichert.",
        }),
      });

      const payload = await submitResponse.json();
      if (!submitResponse.ok) {
        throw new Error(payload.error || "MTC-Entwurf konnte nicht gespeichert werden");
      }

      const mailAttempts = Array.isArray(payload.mail?.attempts) ? payload.mail.attempts : [];
      const hasMailIssues = mailAttempts.some((attempt: { status?: string }) => attempt.status && attempt.status !== "sent");
      if (hasMailIssues) {
        setSubmissionWarning(
          "Der MTC-Entwurf ist angelegt, aber der Mailversand konnte nicht vollständig bestätigt werden."
        );
      }

      setSubmittedMtcAnonymousUrl(payload.mtcAnonymousUrl || "");
      setSubmittedRecipientEmail(userContactEmail);
      setSubmitted(true);
      reset(createDefaultTeamForm());
      setLiabilityAccepted(false);
      setStep(1);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "MTC-Entwurf konnte nicht gespeichert werden");
    } finally {
      setSavingMtcDraft(false);
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

    if (!disciplineCheck.valid) {
      setServerError(disciplineCheck.warnings.join(" · "));
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
          contactPhone: values.contactPhone.trim(),
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
      if (Array.isArray(payload.classificationWarnings) && payload.classificationWarnings.length > 0) {
        setSubmissionWarning(payload.classificationWarnings.join(" · "));
      }
      setSubmittedRecipientEmail(effectiveContactEmail);
      reset(createDefaultTeamForm());
      setTeamLeadParticipates(false);
      setTeamLeadDiscipline(DISCIPLINES[0].id);
      setLiabilityAccepted(false);
      setOpenModerationNotes({});
      previousTeamLeadDiscipline.current = DISCIPLINES[0].id;
      teamLeadWasParticipating.current = false;
      setStep(1);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Unbekannter Fehler");
    }
  });

  const startAnotherRegistration = () => {
    setServerError("");
    setSubmissionWarning("");
    setSubmitted(false);
    setSubmittedRecipientEmail("");
    setSubmittedMtcAnonymousUrl("");
    setLiabilityAccepted(false);
    setOpenModerationNotes({});
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
        participantPublicationPreference: current?.participantPublicationPreference || "NAME_VERBERGEN",
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
            <CardTitle className={isMarketplacePresentation ? "text-xl" : "text-lg"}>
              {isMarketplaceRegistration ? "Sportlerbörse" : "Mannschaftsanmeldung"}
            </CardTitle>
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
              <p className="text-muted-foreground">
                {submittedMtcAnonymousUrl
                  ? "Der MTC-Entwurf ist gespeichert. Die Orga sieht ihn als unvollständigen Entwurf; über den Link kann er weiter gepflegt werden."
                  : isMarketplaceRegistration
                  ? "Die Sportlerbörse-Meldung ist im Portal erfasst und kann durch die Orga bearbeitet werden."
                  : "Die Mannschaft ist im Portal erfasst. Alles Weitere haengt jetzt davon ab, ob du mit oder ohne Login angemeldet hast."}
              </p>
              {submissionWarning && (
                <div className="max-w-xl mx-auto rounded-lg border border-amber-300 bg-amber-50 p-4 text-left text-sm text-amber-900">
                  {submissionWarning}
                </div>
              )}
              {submittedMtcAnonymousUrl ? (
                <div className="max-w-xl mx-auto rounded-lg border border-border/50 bg-muted/30 p-4 text-left space-y-3">
                  <p className="text-sm font-medium">MTC-Entwurf weiter bearbeiten</p>
                  <p className="text-sm text-muted-foreground">
                    Der Link ist vertraulich und führt direkt auf genau diesen Entwurf, ohne Login und ohne Dashboard-Zugriff.
                  </p>
                  <div className="rounded-md border bg-background px-3 py-2 text-xs break-all">
                    {submittedMtcAnonymousUrl}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Wir schicken den Link zusätzlich an <strong>{submittedRecipientEmail || effectiveContactEmail || "die angegebene Kontakt-E-Mail"}</strong>.
                  </p>
                </div>
              ) : isAnonymousRegistration ? (
                  <div className="max-w-xl mx-auto rounded-lg border border-border/50 bg-muted/30 p-4 text-left space-y-3">
                  <p className="text-sm font-medium">So geht es jetzt weiter</p>
                  <ol className="list-decimal pl-5 text-sm text-muted-foreground space-y-1">
                    <li>Wir schicken den Uebernahmelink an <strong>{submittedRecipientEmail || effectiveContactEmail || "die angegebene Kontakt-E-Mail"}</strong>.</li>
                    <li>Oeffne den Link aus der Mail und melde dich dort mit derselben E-Mail im Portal an oder lege damit ein neues Konto an.</li>
                    <li>Danach ist {isMarketplaceRegistration ? "die Meldung" : "die Mannschaft"} deinem Account zugeordnet und du kannst Aenderungen direkt im Portal pflegen.</li>
                  </ol>
                  <p className="text-xs text-muted-foreground">Wenn nichts ankommt, pruefe bitte auch Spam und Werbung. Wenn nach ein paar Minuten immer noch keine Mail da ist, melde dich direkt bei der Orga.</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Du kannst jetzt direkt im Portal ins Mannschafts-Dashboard wechseln und dort weiterarbeiten.</p>
              )}
              <div className="flex justify-center pt-2">
                <Button onClick={startAnotherRegistration}>
                  {submittedMtcAnonymousUrl ? "Weitere Anmeldung erfassen" : isMarketplaceRegistration ? "Weitere Meldung erfassen" : "Weitere Mannschaft anmelden"}
                </Button>
              </div>
            </motion.div>
          ) : (
            <>
              {step === 1 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                  {lockRegistrationMode ? (
                    isMtcDraftPresentation ? (
                      <div className="rounded-md border border-primary/20 bg-primary/5 p-4 text-sm">
                        <p className="font-medium">Unvollständige Mannschaft als MTC-Entwurf melden</p>
                        <p className="mt-1 text-muted-foreground">
                          Nutze diesen Weg, wenn noch Slots offen sind oder Angaben später ergänzt werden sollen. Der Entwurf geht an die Orga und kann über einen vertraulichen Link weiter gepflegt werden.
                        </p>
                      </div>
                    ) : isMarketplaceRegistration && (
                      <div className="rounded-md border border-primary/20 bg-primary/5 p-4 text-sm">
                        <p className="font-medium">Einzelteilnehmer für die Sportlerbörse melden</p>
                        <p className="mt-1 text-muted-foreground">
                          Deine Meldung geht direkt an die Orga. Du erhältst per E-Mail einen Übernahmelink, damit du den Eintrag später mit einem Portal-Konto verbinden kannst.
                        </p>
                      </div>
                    )
                  ) : (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => {
                          setRegistrationMode("TEAM");
                          setServerError("");
                        }}
                        className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                          !isMarketplaceRegistration ? "border-primary bg-primary/10" : "border-border/60 bg-background hover:bg-muted/30"
                        }`}
                      >
                        <span className="block font-medium">Mannschaft anmelden</span>
                        <span className="text-xs text-muted-foreground">Vollständiges Team mit 5 Disziplinen</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRegistrationMode("MARKETPLACE");
                          setServerError("");
                        }}
                        className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                          isMarketplaceRegistration ? "border-primary bg-primary/10" : "border-border/60 bg-background hover:bg-muted/30"
                        }`}
                      >
                        <span className="block font-medium">Einzelteilnehmer / Sportlerbörse</span>
                        <span className="text-xs text-muted-foreground">Meldung an Admins mit Claim-Link</span>
                      </button>
                    </div>
                  )}

                  {isAnonymousRegistration ? (
                    <>
                      <div className="rounded-md border border-border/50 shadow-sm bg-muted/20 p-3 text-sm text-muted-foreground space-y-2">
                        <p>
                          {isMarketplaceRegistration
                            ? "Du kannst dich jetzt ohne Login an der Sportlerbörse melden. Danach bekommst du per Mail einen Uebernahmelink/Claim-Token, mit dem du die Meldung spaeter deinem Portal-Konto zuordnen kannst."
                            : isMtcDraftPresentation
                              ? "Du kannst eine unvollständige Mannschaft als MTC-Entwurf ohne Login melden. Danach bekommst du per Mail einen vertraulichen Bearbeitungslink für genau diesen Entwurf."
                            : "Du kannst die Mannschaft jetzt ohne Login anmelden. Danach bekommst du per Mail einen Uebernahmelink/Claim-Token, mit dem du die Mannschaft spaeter deinem Portal-Konto zuordnen kannst."}
                        </p>
                        <p>
                          {isMarketplaceRegistration
                            ? "Falls sich Angaben aendern, kannst du sie nach der Anmeldung im Portal selbst pflegen."
                            : isMtcDraftPresentation
                              ? "Eine verbindliche Mannschaft entsteht erst, wenn der Entwurf vollständig und durch die Orga übernommen ist."
                            : "Falls es noch zu Veraenderungen innerhalb der Mannschaft kommen sollte kannst Du diese dort nach Anmeldung selbst pflegen."}
                        </p>
                        {!isMarketplaceRegistration && !isMtcDraftPresentation && (
                          <p>Alle T-Shirt Groessen waeren am besten mit der Mannschafts-Anmeldung hilfreich.</p>
                        )}
                        <p>Ansonsten bauen wir an weiteren Faehigkeiten um das digitale Benutzererlebnis zu verbessern.</p>
                        <p>Der Token ist nur in Verbindung mit der hier angegebenen E-Mail Adresse gueltig.</p>
                        <p>Habt Ihr Fragen, Anpassungswuensche oder braucht Support gerne bei esv(at)s5evo.de melden.</p>
                      </div>
                      <div className="rounded-md border border-border/50 shadow-sm bg-muted/20 p-4 space-y-4">
                        <div>
                          <p className="text-sm font-medium text-foreground">{contactTitle}</p>
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
                            placeholder="teammanager@example.de"
                          />
                          {formState.errors.contactEmail && (
                            <p className="text-xs text-red-500 mt-1">{formState.errors.contactEmail.message}</p>
                          )}
                        </div>
                        <div>
                          <label htmlFor="contactPhone" className="text-sm font-medium">Telefonnummer</label>
                          <input
                            id="contactPhone"
                            type="tel"
                            {...register("contactPhone")}
                            className="mt-1 w-full px-3 py-2 bg-background border border-input/60 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            placeholder="+49 170 1234567"
                          />
                          <p className="mt-1 text-xs text-muted-foreground">Fuer kurzfristige Abstimmung falls es schnell gehen muss.</p>
                          {formState.errors.contactPhone && (
                            <p className="text-xs text-red-500 mt-1">{formState.errors.contactPhone.message}</p>
                          )}
                        </div>
                      </div>
                    </>
                  ) : isMarketplaceRegistration ? (
                    <div className="rounded-md border border-border/50 bg-muted/20 p-3 text-sm text-muted-foreground space-y-3">
                      <p>
                        Die Meldung wird mit deinem Portal-Konto verknuepft. Rueckfragen und der Uebernahmelink gehen an{" "}
                        <span className="font-medium text-foreground">{effectiveContactEmail || "deine Konto-E-Mail"}</span>.
                      </p>
                      <div>
                        <label htmlFor="contactPhone" className="text-sm font-medium text-foreground">Telefonnummer</label>
                        <input
                          id="contactPhone"
                          type="tel"
                          {...register("contactPhone")}
                          className="mt-1 w-full px-3 py-2 bg-background border border-input/60 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          placeholder="+49 170 1234567"
                        />
                        <p className="mt-1 text-xs text-muted-foreground">Fuer kurzfristige Abstimmung falls es schnell gehen muss.</p>
                        {formState.errors.contactPhone && (
                          <p className="text-xs text-red-500 mt-1">{formState.errors.contactPhone.message}</p>
                        )}
                      </div>
                    </div>
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
                      <div>
                        <label htmlFor="contactPhone" className="text-sm font-medium">Telefonnummer</label>
                        <input
                          id="contactPhone"
                          type="tel"
                          {...register("contactPhone")}
                          className="mt-1 w-full px-3 py-2 bg-background border border-input/60 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          placeholder="+49 170 1234567"
                        />
                        <p className="mt-1 text-xs text-muted-foreground">Fuer kurzfristige Abstimmung falls es schnell gehen muss.</p>
                        {formState.errors.contactPhone && (
                          <p className="text-xs text-red-500 mt-1">{formState.errors.contactPhone.message}</p>
                        )}
                      </div>
                    </>
                  )}
                  {isMarketplaceRegistration ? (
                    <>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div>
                          <label className="text-sm font-medium">Geburtsdatum</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="TT.MM.JJJJ oder JJJJ"
                            autoComplete="bday"
                            className="mt-1 w-full px-3 py-2 bg-background border border-input/60 rounded-md text-sm"
                            value={marketplaceBirthDate}
                            onChange={(e) => setMarketplaceBirthDate(formatBirthDateInput(e.target.value))}
                            onKeyDown={(event) =>
                              handleBirthDateKeyDown(event, marketplaceBirthDate, setMarketplaceBirthDate)
                            }
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Geschlecht</label>
                          <select
                            className="mt-1 w-full px-3 py-2 bg-background border border-input/60 rounded-md text-sm"
                            value={marketplaceGender}
                            onChange={(event) => setMarketplaceGender(event.target.value as "M" | "W")}
                          >
                            <option value="M">Männlich</option>
                            <option value="W">Weiblich</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div>
                          <label className="text-sm font-medium">Wunschdisziplin</label>
                          <select
                            className="mt-1 w-full px-3 py-2 bg-background border border-input/60 rounded-md text-sm"
                            value={marketplaceDiscipline}
                            onChange={(event) =>
                              setMarketplaceDiscipline(event.target.value as DisciplineId | typeof DISCIPLINE_PLACEHOLDER)
                            }
                          >
                            <option value={DISCIPLINE_PLACEHOLDER} disabled>
                              Bitte Disziplin wählen
                            </option>
                            {DISCIPLINES.map((discipline) => (
                              <option key={discipline.id} value={discipline.id}>
                                {discipline.icon} {discipline.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-sm font-medium">Verein / Region optional</label>
                          <input
                            type="text"
                            value={marketplaceClubName}
                            onChange={(event) => setMarketplaceClubName(event.target.value)}
                            className="mt-1 w-full px-3 py-2 bg-background border border-input/60 rounded-md text-sm"
                            placeholder="z.B. ESV Bad Bayersoien"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-sm font-medium">Sichtbarkeit</label>
                        <select
                          className="mt-1 w-full px-3 py-2 bg-background border border-input/60 rounded-md text-sm"
                          value={marketplaceVisibility}
                          onChange={(event) => setMarketplaceVisibility(event.target.value as MarketplaceVisibilityId)}
                        >
                          {MARKETPLACE_VISIBILITY_OPTIONS.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-sm font-medium">Namensveröffentlichung</label>
                        <select
                          className="mt-1 w-full px-3 py-2 bg-background border border-input/60 rounded-md text-sm"
                          value={marketplaceParticipantPublication}
                          onChange={(event) =>
                            setMarketplaceParticipantPublication(event.target.value as "NAME_VERBERGEN" | "NAME_VEROEFFENTLICHEN")
                          }
                        >
                          {PARTICIPANT_PUBLICATION_OPTIONS.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-sm font-medium">Nachricht an Admins/MGMT</label>
                        <textarea
                          value={marketplaceMessage}
                          onChange={(event) => setMarketplaceMessage(event.target.value)}
                          maxLength={3000}
                          className="mt-1 min-h-[150px] w-full rounded-md border border-input/60 bg-background px-3 py-2 text-sm"
                          placeholder="Was soll die Orga wissen? Wunsch-Team, Einschränkungen, Verfügbarkeit, Kontaktwunsch ..."
                        />
                        <p className="mt-1 text-xs text-muted-foreground">{marketplaceMessage.length}/3000 Zeichen</p>
                      </div>
                    </>
                  ) : (
                    <>
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

                  <div>
                    <label htmlFor="teamPublicationLevel" className="text-sm font-medium">Team veröffentlichen</label>
                    <select
                      id="teamPublicationLevel"
                      {...register("teamPublicationLevel")}
                      className="mt-1 w-full px-3 py-2 bg-background border border-input/60 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {TEAM_PUBLICATION_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Standard für V1 ist zurückhaltend. Einzelne Teilnehmer können ihren eigenen Namen später separat freigeben.
                    </p>
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
                              placeholder="TT.MM.JJJJ oder JJJJ"
                              autoComplete="bday"
                              className="mt-1 w-full px-3 py-2 bg-background border border-input/60 rounded-md text-sm"
                              value={teamLeadBirthDate}
                              onChange={(e) => setTeamLeadBirthDate(formatBirthDateInput(e.target.value))}
                              onKeyDown={(event) =>
                                handleBirthDateKeyDown(event, teamLeadBirthDate, setTeamLeadBirthDate)
                              }
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
                    </>
                  )}
                  {isMarketplaceRegistration && hasMarketplaceValidationHints && (
                    <div
                      className={
                        "rounded-md border px-3 py-2 text-xs " +
                        (marketplaceValidation.errors.length > 0
                          ? "border-red-200 bg-red-50/70 text-red-800 dark:border-red-900/60 dark:bg-red-950/25 dark:text-red-200"
                          : "border-amber-200 bg-amber-50/70 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-200")
                      }
                    >
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-2 text-left"
                        onClick={() => setMarketplaceValidationOpen((current) => !current)}
                        aria-expanded={marketplaceValidationOpen}
                      >
                        <span className="font-medium">
                          {marketplaceValidation.errors.length > 0
                            ? `${marketplaceValidation.errors.length} Pflichtangabe${marketplaceValidation.errors.length === 1 ? "" : "n"} offen`
                            : `${marketplaceValidation.warnings.length} Hinweis${marketplaceValidation.warnings.length === 1 ? "" : "e"}`}
                        </span>
                        <span className="shrink-0 text-[11px] opacity-75">
                          {marketplaceValidationOpen ? "Ausblenden" : "Details"}
                        </span>
                      </button>
                      {marketplaceValidationOpen && (
                        <div className="mt-2 space-y-1">
                          {marketplaceValidation.errors.map((message) => (
                            <p key={message}>• {message}</p>
                          ))}
                          {marketplaceValidation.warnings.map((message) => (
                            <p key={message}>⚠️ {message}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <Button
                    onClick={handleNextFromTeam}
                    disabled={
                      !publicRegistrationStatus.canRegister ||
                      (isMarketplaceRegistration
                        ? !marketplaceBirthDate ||
                          marketplaceDiscipline === DISCIPLINE_PLACEHOLDER ||
                          !contactPhone?.trim() ||
                          (isAnonymousRegistration ? !contactFirstName || !contactLastName || !contactEmail : !effectiveContactName || !effectiveContactEmail)
                        : (isAnonymousRegistration
                            ? !teamName || !contactFirstName || !contactLastName || !contactEmail || !contactPhone?.trim()
                            : !teamName || !contactPhone?.trim()))
                    }
                    className="w-full"
                  >
                    {isMarketplaceRegistration ? "Weiter zur Prüfung →" : "Weiter zu Teilnehmern →"}
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
                    {stepTwoWarnings.length > 0 && (
                      <div className="mt-1 space-y-1">
                        {stepTwoWarnings.map((w, i) => (
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
                    <Button onClick={handleNextFromParticipants} className="flex-1" disabled={!publicRegistrationStatus.canRegister || savingMtcDraft}>
                      {isMtcDraftPresentation ? savingMtcDraft ? "Speichere..." : "Als MTC-Entwurf speichern" : "Weiter zur Pruefung →"}
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
                              <Badge variant="secondary" className="text-[0.65rem]">Team Manager:in</Badge>
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
                            <Controller
                              control={control}
                              name={`participants.${index}.birthDate` as const}
                              render={({ field }) => (
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  placeholder="TT.MM.JJJJ oder JJJJ"
                                  autoComplete="bday"
                                  className="px-2 py-1 bg-background border border-input/60 rounded text-sm"
                                  value={field.value || ""}
                                  onBlur={field.onBlur}
                                  onChange={(e) => field.onChange(formatBirthDateInput(e.target.value))}
                                  onKeyDown={(event) =>
                                    handleBirthDateKeyDown(
                                      event,
                                      field.value || "",
                                      field.onChange,
                                    )
                                  }
                                  ref={field.ref}
                                />
                              )}
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
                          <div className="pt-1">
                            <Button
                              type="button"
                              size="sm"
                              variant={participants[index]?.moderationNote?.trim() ? "secondary" : "outline"}
                              onClick={() => toggleModerationNote(index)}
                              className="text-[11px]"
                            >
                              {participants[index]?.moderationNote?.trim() ? "📝 Hinweis vorhanden" : "📝 Hinweis für Moderation"}
                            </Button>
                          </div>
                          {openModerationNotes[index] && (
                            <div>
                              <label className="text-xs text-muted-foreground">Hinweis für Moderation (intern)</label>
                              <textarea
                                value={participants[index]?.moderationNote || ""}
                                onChange={(e) => handleParticipantModerationNoteChange(index, e.target.value)}
                                placeholder="Optionaler interner Hinweis für Startliste / Moderation"
                                maxLength={280}
                                className="mt-1 min-h-[84px] w-full rounded border border-input/60 bg-background px-2 py-1 text-sm"
                              />
                              <p className="mt-1 text-xs text-muted-foreground">{(participants[index]?.moderationNote || "").length}/280 Zeichen</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </Card>

                  {shirtOrderClosed && (
                    <p className="text-xs text-muted-foreground">T-Shirt-Bestellfrist abgeschlossen, Größen sind nur noch für Admin editierbar.</p>
                  )}

                  {(hasBlockingValidationErrors || stepTwoWarnings.length > 0) && (
                    <div className="space-y-2">
                      {hasBlockingValidationErrors && (
                        <div className="space-y-1">
                          <p className="text-xs text-red-500">Bitte fehlende Angaben ergänzen.</p>
                          <div className="space-y-1 text-xs text-red-600">
                            {stepTwoBlockingErrors.map((message) => (
                              <p key={message}>• {message}</p>
                            ))}
                          </div>
                        </div>
                      )}
                      {stepTwoWarnings.length > 0 && (
                        <div className="space-y-1 text-xs text-amber-600">
                          {stepTwoWarnings.map((warning) => (
                            <p key={warning}>⚠️ {warning}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {hasMtcDraftAlternative && (hasBlockingValidationErrors || stepTwoWarnings.length > 0 || completedParticipantCount < 5) && (
                    <div className="rounded-md border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-100">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                          <p className="font-medium">MTC-Entwurf mit offenen Slots</p>
                          <p className="text-xs">
                            Speichere den aktuellen Stand als MTC-Entwurf. Vollständige Teilnehmerzeilen werden übernommen, offene oder unvollständige Slots bleiben als MTC-Slots offen.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={submitMtcDraftRegistration}
                          disabled={savingMtcDraft || !publicRegistrationStatus.canRegister}
                          className="shrink-0"
                        >
                          {savingMtcDraft ? "Speichere..." : "Als MTC-Entwurf speichern"}
                        </Button>
                      </div>
                      {serverError && (
                        <p className="mt-2 text-xs text-red-600 dark:text-red-300">{serverError}</p>
                      )}
                    </div>
                  )}

                  {/* Navigation Buttons UNTEN */}
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                      ← Zurück
                    </Button>
                    <Button onClick={handleNextFromParticipants} className="flex-1" disabled={!publicRegistrationStatus.canRegister || savingMtcDraft}>
                      {isMtcDraftPresentation ? savingMtcDraft ? "Speichere..." : "MTC-Entwurf speichern" : "Zur finalen Prüfung →"}
                    </Button>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-3">
                  <div className="space-y-1">
                    <h3 className="text-base font-medium">Angaben pruefen und absenden</h3>
                    <p className="text-xs text-muted-foreground">
                      Erst mit dem letzten Klick wird {isMarketplaceRegistration ? "die Sportlerbörse-Meldung" : "die Mannschaft"} angemeldet.
                    </p>
                  </div>

                  {isMarketplaceRegistration ? (
                    <div className="space-y-2">
                      <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-sm">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="min-w-0 max-w-full truncate font-semibold">
                            {[teamLeadFirstName || contactFirstName, teamLeadLastName || contactLastName].filter(Boolean).join(" ") || "Sportler:in"}
                          </span>
                          <span className="text-muted-foreground">{marketplaceGender} · {marketplaceBirthDate}</span>
                          <span className="text-muted-foreground">
                            {disciplineMap[marketplaceDiscipline as DisciplineId]?.label || "Bitte Disziplin wählen"}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span>Empfänger: {effectiveContactEmail || "-"}</span>
                          <span>
                            Sichtbarkeit: {MARKETPLACE_VISIBILITY_OPTIONS.find((option) => option.id === marketplaceVisibility)?.label || "-"}
                          </span>
                          {marketplaceClubName && <span>Verein/Region: {marketplaceClubName}</span>}
                        </div>
                      </div>
                      {marketplaceMessage.trim() && (
                        <div className="rounded-md border border-border/60 bg-background p-3 text-sm">
                          <p className="mb-1 text-xs font-medium text-muted-foreground">Nachricht an Admins/MGMT</p>
                          <p className="whitespace-pre-wrap">{marketplaceMessage}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                    <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-sm">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="min-w-0 max-w-full truncate font-semibold">{teamName || "Mannschaft ohne Namen"}</span>
                        <span className="text-muted-foreground">{liveClassification.emoji} {liveClassification.label}</span>
                        <span className="text-muted-foreground">{completedParticipantCount}/5 Teilnehmer</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>Gesamtalter: {liveClassification.totalAge}</span>
                        <span>Empfaenger: {effectiveContactEmail || "-"}</span>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      {participants.map((participant, index) => {
                      const discipline = disciplineMap[participant.discipline as DisciplineId];
                      const name = [participant.firstName, participant.lastName].filter(Boolean).join(" ").trim() || "Name fehlt";
                      const shirtSize = SHIRT_SIZES.find((size) => size.id === participant.shirtSize)?.label;
                      const isTeamLead = teamLeadParticipates && participant.discipline === teamLeadDiscipline;

                      return (
                        <div key={`${participant.discipline}-${index}`} className="rounded-md border border-border/50 bg-background px-2.5 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="min-w-0 truncate font-medium">
                              {discipline?.icon} {name}
                            </span>
                            <span className="shrink-0 text-muted-foreground">{participant.gender} · {participant.birthDate || "-"}</span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-muted-foreground">
                            <span>{discipline?.label || `Teilnehmer:in ${index + 1}`}</span>
                            {participant.email && <span>{participant.email}</span>}
                            {shirtSize && <span>{shirtSize}</span>}
                            {isTeamLead && <span>Team Manager:in</span>}
                            {participant.moderationNote?.trim() && <span>Hinweis vorhanden</span>}
                          </div>
                        </div>
                      );
                    })}
                    </div>
                    </>
                  )}

                  <details className="rounded-md border border-border/60 bg-muted/10 p-3 text-sm">
                    <summary className="cursor-pointer font-medium">
                      {isMarketplaceRegistration ? "Metadaten & Kontakt" : "Metadaten & Kontakt Team Manager:in"}
                    </summary>
                    <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                      <div className="flex justify-between gap-3">
                        <span>{isMarketplaceRegistration ? "Kontakt" : "Team Manager:in"}</span>
                        <span className="text-right font-medium text-foreground">{effectiveContactName || "-"}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span>Kontakt-E-Mail</span>
                        <span className="text-right font-medium text-foreground">{effectiveContactEmail || "-"}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span>Veröffentlichung</span>
                        <span className="text-right font-medium text-foreground">{publicationLabel}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span>TBD-Disziplinen</span>
                        <span className="text-right font-medium text-foreground">{disciplineSummary[DISCIPLINE_PLACEHOLDER] ?? 0}</span>
                      </div>
                    </div>
                  </details>

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
                    <Button variant="outline" onClick={() => setStep(isMarketplaceRegistration ? 1 : 2)} className="flex-1" disabled={formState.isSubmitting}>
                      ← Zurück
                    </Button>
                    <Button
                      onClick={isMarketplaceRegistration ? submitMarketplaceRegistration : onSubmit}
                      className="flex-1"
                      disabled={formState.isSubmitting || !publicRegistrationStatus.canRegister || !liabilityAccepted}
                    >
                      {formState.isSubmitting
                        ? "Sende Anmeldung ab..."
                        : isMarketplaceRegistration
                          ? "Sportlerbörse melden 🏅"
                          : "Mannschaft jetzt anmelden 🏅"}
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
