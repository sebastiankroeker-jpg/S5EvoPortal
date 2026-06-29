"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { StatusMessage } from "@/components/ui/status-message";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, ChevronDown, ChevronUp, Info, Send, XCircle } from "lucide-react";
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
import { evaluateTeamState } from "@/lib/domain/classification";
import { SHIRT_SIZES, isShirtOrderClosed } from "@/lib/domain/shirts";
import type { EditParticipantResult } from "@/lib/participant-edit-result";

type TeamParticipantSnapshot = {
  id?: string;
  birthYear?: number;
  birthDate?: string;
  gender?: string;
  disciplineCode?: string;
  discipline?: string;
};

interface Participant {
  id: string;
  firstName: string;
  lastName: string;
  birthYear?: number;
  birthDate?: string;
  gender: string;
  disciplineCode?: string;
  discipline?: string;
  marketplaceReturnDisciplineCode?: string | null;
  shirtSize?: string | null;
  moderationNote?: string | null;
  email?: string | null;
  linkedUserId?: string | null;
  teamName?: string;
  teamCategory?: string;
  teamRegistrationMode?: "TEAM" | "MARKETPLACE";
  teamMarketplaceStatus?: "NEW" | "REVIEWED" | "MATCHING" | "MATCHED" | "WITHDRAWN";
  emailInvitation?: EmailInvitationStatus | null;
  participantPublicationPreference?: "NAME_VERBERGEN" | "NAME_VEROEFFENTLICHEN" | null;
  isTeamManager?: boolean;
  canBeTeamManager?: boolean;
  teamParticipants?: TeamParticipantSnapshot[];
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

type SaveResult = {
  applied: boolean;
  message?: string;
  classificationWarnings?: string[];
  editResult?: EditParticipantResult | null;
};

interface ParticipantEditDialogProps {
  participant: Participant | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  directEdit: boolean; // true = Admin/Team Manager, false = Teilnehmer (Approval)
  isAdminEdit?: boolean;
  showModerationNote?: boolean;
  moderatorNoteOnly?: boolean;
  showAdminOnlyParticipantFields?: boolean;
}

function normalizeGenderValue(value?: string | null) {
  if (value === "W" || value === "FEMALE") return "FEMALE";
  return "MALE";
}

function normalizeDisciplineValue(value?: string | null) {
  return value || "TBD";
}

function normalizeComparableText(value?: string | null) {
  return value?.normalize("NFC").trim() ?? "";
}

function getDisciplineLabel(value?: string | null) {
  if (!value || value === "TBD") return "Noch offen";
  const discipline = DISCIPLINES.find((entry) => entry.id === value);
  return discipline ? `${discipline.icon} ${discipline.label}` : value;
}

function getStatusMeta(status?: string | null) {
  if (status === "PENDING") {
    return {
      title: "Änderung in Prüfung",
      text: "Dein letzter Änderungsantrag ist aktuell bei der Orga in Prüfung.",
      tone: "warning" as const,
    };
  }

  if (status === "APPROVED") {
    return {
      title: "Letzte Änderung genehmigt",
      text: "Deine letzte Änderungsanfrage wurde genehmigt.",
      tone: "success" as const,
    };
  }

  if (status === "REJECTED") {
    return {
      title: "Letzte Änderung abgelehnt",
      text: "Deine letzte Änderungsanfrage wurde abgelehnt.",
      tone: "error" as const,
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

function getParticipantSaveButtonLabel({
  isSaving,
  isDirectEdit,
  hasApprovalChanges,
  hasDirectChanges,
  sendsInvitation,
}: {
  isSaving: boolean;
  isDirectEdit: boolean;
  hasApprovalChanges: boolean;
  hasDirectChanges: boolean;
  sendsInvitation: boolean;
}) {
  if (isSaving) return "Speichert...";

  if (isDirectEdit) {
    if (sendsInvitation) {
      return hasDirectChanges ? "Speichern & Einladung versenden" : "Einladung versenden";
    }
    return "Speichern";
  }

  if (hasApprovalChanges && sendsInvitation) {
    return "Genehmigung einreichen & Einladung versenden";
  }

  if (hasApprovalChanges) return "Genehmigung einreichen";
  if (sendsInvitation) return "Einladung versenden";
  if (hasDirectChanges) return "Speichern";
  return "Speichern";
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

function ApprovalFieldBadge() {
  return (
    <Badge variant="outline" className="border-amber-300 px-1.5 py-0 text-[10px] font-normal text-amber-700">
      Prüfung
    </Badge>
  );
}

function DirectFieldBadge() {
  return (
    <Badge variant="outline" className="border-green-300 px-1.5 py-0 text-[10px] font-normal text-green-700">
      Direkt
    </Badge>
  );
}

function getEditResultTitle(status?: EditParticipantResult["status"]) {
  if (status === "saved") return "Änderungen gespeichert";
  if (status === "pending_review") return "Änderung zur Prüfung eingereicht";
  if (status === "partial") return "Teilweise gespeichert";
  if (status === "rejected") return "Änderung blockiert";
  if (status === "unchanged") return "Keine Änderung erkannt";
  return "Ergebnis";
}

function getFieldDecisionTone(decision: EditParticipantResult["fieldResults"][number]["decision"]) {
  if (decision === "saved") return "border-green-300 bg-green-50 text-green-800";
  if (decision === "review") return "border-amber-300 bg-amber-50 text-amber-800";
  return "border-red-300 bg-red-50 text-red-800";
}

function getFieldDecisionLabel(decision: EditParticipantResult["fieldResults"][number]["decision"]) {
  if (decision === "saved") return "Gespeichert";
  if (decision === "review") return "Prüfung";
  return "Blockiert";
}

function getNotificationTone(status: EditParticipantResult["notifications"][number]["status"]) {
  if (status === "sent") return "border-green-300 text-green-700";
  if (status === "skipped") return "border-muted text-muted-foreground";
  return "border-red-300 text-red-700";
}

function getNotificationLabel(status: EditParticipantResult["notifications"][number]["status"]) {
  if (status === "sent") return "Mail gesendet";
  if (status === "skipped") return "Mail übersprungen";
  return "Mail fehlgeschlagen";
}

function EditResultDetails({ editResult }: { editResult: EditParticipantResult }) {
  const visibleNotifications = editResult.notifications.filter((notification) => notification.recipient || notification.reason);

  return (
    <div className="mb-3 rounded-md border border-border/60 bg-muted/20 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">{getEditResultTitle(editResult.status)}</p>
          <p className="text-xs text-muted-foreground">
            Kontext: {editResult.context === "MARKETPLACE" ? "Sportler-Börse" : "Mannschaft"}
          </p>
        </div>
        <Badge variant="outline">{editResult.status}</Badge>
      </div>

      {editResult.fieldResults.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {editResult.fieldResults.map((fieldResult) => (
            <div key={fieldResult.field} className="rounded-md border border-border/50 bg-background/70 p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{fieldResult.label}</span>
                <Badge variant="outline" className={getFieldDecisionTone(fieldResult.decision)}>
                  {getFieldDecisionLabel(fieldResult.decision)}
                </Badge>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {fieldResult.beforeLabel} → {fieldResult.afterLabel}
              </div>
            </div>
          ))}
        </div>
      )}

      {visibleNotifications.length > 0 && (
        <div className="mt-3 space-y-1.5 border-t border-border/60 pt-3">
          <p className="text-xs font-medium text-muted-foreground">Benachrichtigungen</p>
          {visibleNotifications.map((notification, index) => (
            <div key={`${notification.template}-${notification.recipient}-${index}`} className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="outline" className={getNotificationTone(notification.status)}>
                {getNotificationLabel(notification.status)}
              </Badge>
              <span className="min-w-0 truncate text-muted-foreground">
                {notification.recipient || notification.reason || notification.template}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
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
  moderatorNoteOnly = false,
  showAdminOnlyParticipantFields = true,
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
  const [resettingLinkedAccount, setResettingLinkedAccount] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [participantPublicationPreference, setParticipantPublicationPreference] = useState<"NAME_VERBERGEN" | "NAME_VEROEFFENTLICHEN">("NAME_VERBERGEN");
  const [shirtOrderDeadline, setShirtOrderDeadline] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<SaveResult | null>(null);
  const [error, setError] = useState("");
  const [latestChange, setLatestChange] = useState<ParticipantChangeStatus | null>(null);
  const [footerIssuesExpanded, setFooterIssuesExpanded] = useState(true);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);

  const hasPendingChange = latestChange?.status === "PENDING" || participant?.pendingChanges?.some(c => c.status === "PENDING");
  const isMarketplaceMatchingParticipant =
    participant?.teamRegistrationMode === "MARKETPLACE" &&
    participant?.teamMarketplaceStatus === "MATCHING" &&
    (participant?.teamParticipants?.length ?? 0) > 1;
  const statusMeta = getStatusMeta(latestChange?.status);
  const saveFeedback = result?.applied
      ? { type: "success" as const, text: "Gespeichert!" }
      : result && result.editResult?.status !== "rejected"
        ? { type: "success" as const, text: result.message || "Änderungsantrag eingereicht!" }
        : null;
  const projectedClassificationWarnings = useMemo(() => {
    if (moderatorNoteOnly || !participant?.id || !participant.teamParticipants?.length) {
      return [];
    }

    const warnings = evaluateTeamState(
      participant.teamParticipants.map((teamParticipant) => {
        if (teamParticipant.id === participant.id) {
          return {
            birthYear: extractBirthYearFromInput(birthDate),
            gender: normalizeGenderValue(gender),
            disciplineCode: normalizeDisciplineValue(disciplineCode),
          };
        }

        return {
          birthYear: extractBirthYearFromInput(
            teamParticipant.birthDate || birthYearToBirthDateInput(teamParticipant.birthYear),
          ),
          gender: normalizeGenderValue(teamParticipant.gender),
          disciplineCode: normalizeDisciplineValue(teamParticipant.disciplineCode || teamParticipant.discipline),
        };
      }),
      participant.teamCategory,
    ).classificationWarnings;

    return Array.from(new Set(warnings));
  }, [birthDate, disciplineCode, gender, moderatorNoteOnly, participant]);
  const visibleClassificationWarnings =
    result?.classificationWarnings && result.classificationWarnings.length > 0
      ? result.classificationWarnings
      : projectedClassificationWarnings;
  const footerIssueCount = visibleClassificationWarnings.length + (error ? 1 : 0);
  const footerIssueTone = error ? "error" : "warning";
  const footerIssueLabel = error && visibleClassificationWarnings.length > 0
    ? `${footerIssueCount} Hinweise`
    : footerIssueTone === "error"
      ? footerIssueCount === 1 ? "1 Fehler" : `${footerIssueCount} Fehler`
      : footerIssueCount === 1 ? "1 Warnung" : `${footerIssueCount} Warnungen`;

  const revealSaveFeedback = () => {
    requestAnimationFrame(() => {
      scrollAreaRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

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
      setFooterIssuesExpanded(true);
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
  const effectiveEmailInvitationStatus =
    emailInvitation?.status === "linked"
      ? "linked"
      : emailDiffersFromSaved
        ? (email ? "none" : "missing_email")
        : emailInvitation?.status;
  const emailInvitationMeta = getEmailInvitationMeta(effectiveEmailInvitationStatus || (email ? "none" : "missing_email"));
  const canSendInvitation =
    Boolean(participant?.id) &&
    (directEdit || showModerationNote) &&
    isValidEmail(email) &&
    (emailDiffersFromSaved || !["active", "claimed", "linked"].includes(emailInvitation?.status || "none"));
  const canResetLinkedAccount =
    Boolean(participant?.id) &&
    isAdminEdit &&
    emailInvitation?.status === "linked";
  const replaceActionLabel =
    participant?.isTeamManager
      ? "Teilnehmer ersetzen & Rechte entziehen"
      : "Teilnehmer ersetzen";
  const sendsInvitationOnSave =
    Boolean(participant?.id) &&
    emailDiffersFromSaved &&
    isValidEmail(email) &&
    emailInvitation?.status !== "linked";
  const approvalRelevantChanges = participant
    ? !moderatorNoteOnly && (
      normalizeComparableText(firstName) !== normalizeComparableText(participant.firstName) ||
      normalizeComparableText(lastName) !== normalizeComparableText(participant.lastName) ||
      extractBirthYearFromInput(birthDate) !== extractBirthYearFromInput(participant.birthDate || birthYearToBirthDateInput(participant.birthYear)) ||
      gender !== normalizeGenderValue(participant.gender) ||
      disciplineCode !== normalizeDisciplineValue(participant.disciplineCode || participant.discipline)
    )
    : false;
  const directChanges = participant
    ? (!moderatorNoteOnly && showAdminOnlyParticipantFields && emailDiffersFromSaved) ||
      (!moderatorNoteOnly && showAdminOnlyParticipantFields && (shirtSize || "") !== (participant.shirtSize || "")) ||
      normalizeComparableText(moderationNote) !== normalizeComparableText(participant.moderationNote) ||
      (!moderatorNoteOnly && participantPublicationPreference !== (participant.participantPublicationPreference || "NAME_VERBERGEN"))
    : false;
  const participantSaveLabel = getParticipantSaveButtonLabel({
    isSaving: saving,
    isDirectEdit: directEdit,
    hasApprovalChanges: approvalRelevantChanges,
    hasDirectChanges: directChanges,
    sendsInvitation: sendsInvitationOnSave,
  });

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

  const handleResetLinkedAccount = async () => {
    if (!participant?.id) return;
    if (!isValidEmail(email)) {
      setInviteMessage({ type: "error", text: "Bitte zuerst eine gültige E-Mail-Adresse hinterlegen." });
      return;
    }

    const confirmed = window.confirm(
      `Teilnehmer wirklich ersetzen? Die bestehende Portal-Verknüpfung wird gelöst${participant?.isTeamManager ? " und aktive Team-Manager-Rechte werden entzogen" : ""}. Danach geht eine neue Einladung an ${email.trim()}.`,
    );
    if (!confirmed) return;

    setResettingLinkedAccount(true);
    setInviteMessage(null);
    setError("");

    try {
      const res = await fetch("/api/admin/claim-links", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resetParticipantLink",
          participantId: participant.id,
          email,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verknüpfung konnte nicht gelöst werden");

      setEmailInvitation({
        status: "active",
        tokenStatus: "active",
        sentAt: new Date().toISOString(),
        expiresAt: data.participantClaimMail?.expiresAt ?? null,
        claimedAt: null,
        revokedAt: null,
      });
      setSavedEmail(data.participantEmail || email);
      setInviteMessage({
        type: "success",
        text:
          data.participantClaimMail?.status === "sent" || data.participantClaimMail?.status === "queued"
            ? `Teilnehmer ersetzt, alte Verknüpfung gelöst${data.revokedTeamManagerAccess ? " und Team-Manager-Rechte entzogen" : ""}, neue Einladung versendet.`
            : `Teilnehmer ersetzt, alte Verknüpfung gelöst${data.revokedTeamManagerAccess ? " und Team-Manager-Rechte entzogen" : ""}, neue Einladung erzeugt.`,
      });
      onSaved();
    } catch (err) {
      setInviteMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Verknüpfung konnte nicht gelöst werden",
      });
    } finally {
      setResettingLinkedAccount(false);
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
        body: JSON.stringify(
          moderatorNoteOnly
            ? { moderationNote: moderationNote || null }
            : {
                firstName,
                lastName,
                birthYear: extractedBirthYear,
                birthDate,
                gender,
                disciplineCode,
                ...(showAdminOnlyParticipantFields ? { shirtSize: shirtSize || null, email: email || null } : {}),
                moderationNote: moderationNote || null,
                participantPublicationPreference,
              },
        ),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.editResult) {
          setResult({
            applied: false,
            message: data.error || "Speichern fehlgeschlagen",
            classificationWarnings: Array.isArray(data.editResult.validation?.warnings)
              ? data.editResult.validation.warnings
              : [],
            editResult: data.editResult,
          });
        }
        throw new Error(data.error || "Speichern fehlgeschlagen");
      }

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
          editResult: data.editResult || null,
        });
        revealSaveFeedback();
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
      setFooterIssuesExpanded(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="flex items-center gap-2">
            {moderatorNoteOnly ? "📝 Moderationshinweis" : "✏️ Teilnehmer bearbeiten"}
            {!directEdit && (
              <Badge variant="outline" className="text-xs">
                Änderung wird geprüft
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {moderatorNoteOnly
              ? "Moderator:innen bearbeiten hier nur den internen Hinweis für Listen und Ausdrucke."
              : directEdit
              ? "Änderungen werden direkt gespeichert."
              : "Mit Prüfung markierte Felder werden genehmigt. Direkt markierte Felder wie E-Mail, T-Shirt, Moderationshinweis und Namensveröffentlichung werden direkt gespeichert."}
          </DialogDescription>
        </DialogHeader>

        <div ref={scrollAreaRef} className="flex-1 overflow-y-auto px-6 pb-6">
          {saveFeedback && (
            <StatusMessage
              tone="success"
              className="mb-3"
              role="status"
            >
              {saveFeedback.text}
            </StatusMessage>
          )}

          {result?.editResult && (
            <EditResultDetails editResult={result.editResult} />
          )}

          {!directEdit && statusMeta && (
            <StatusMessage tone={statusMeta.tone} className="mb-3">
              <div className="font-medium">{statusMeta.title}</div>
              <div>{statusMeta.text}</div>
              {latestChange?.reviewComment ? (
                <div className="mt-1 text-xs opacity-90">Kommentar der Orga: {latestChange.reviewComment}</div>
              ) : null}
              {hasPendingChange ? (
                <div className="mt-1 text-xs opacity-90">Wenn du erneut speicherst, wird der offene Antrag mit deinem neuesten Stand aktualisiert.</div>
              ) : null}
            </StatusMessage>
          )}

          <div className="space-y-3">
            {moderatorNoteOnly && participant ? (
              <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-sm">
                <div className="font-medium">{participant.lastName}, {participant.firstName}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {participant.teamName} · Jg. {participant.birthYear} · {participant.disciplineCode || "TBD"}
                </div>
              </div>
            ) : null}

            {!moderatorNoteOnly && (
              <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-muted-foreground">Vorname</label>
                  {!directEdit && <ApprovalFieldBadge />}
                </div>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="mt-1" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-muted-foreground">Nachname</label>
                  {!directEdit && <ApprovalFieldBadge />}
                </div>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} className="mt-1" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-muted-foreground">Geburtsdatum</label>
                  {!directEdit && <ApprovalFieldBadge />}
                </div>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="TT.MM.JJJJ oder JJJJ"
                  autoComplete="bday"
                  value={birthDate}
                  onChange={(e) => setBirthDate(formatBirthDateInput(e.target.value))}
                  onKeyDown={handleBirthDateKeyDown}
                  className="mt-1"
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-muted-foreground">Geschlecht</label>
                  {!directEdit && <ApprovalFieldBadge />}
                </div>
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
                {!directEdit && <DirectFieldBadge />}
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

            {isMarketplaceMatchingParticipant ? (
              <div className="rounded-md border border-border/60 bg-muted/20 p-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-muted-foreground">Disziplinen im MTC</label>
                  <InfoHint text="Die Wunsch-Disziplin stammt aus der Sportlerbörse. Die zugeordnete Slot-Disziplin wird im MTC-Entwurf geändert." />
                </div>
                <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                  <div className="rounded-md border border-border/50 bg-background/70 p-2">
                    <p className="text-[10px] font-medium uppercase text-muted-foreground">Wunsch-Disziplin</p>
                    <p className="mt-1 font-medium">{getDisciplineLabel(participant.marketplaceReturnDisciplineCode || participant.disciplineCode || participant.discipline)}</p>
                  </div>
                  <div className="rounded-md border border-border/50 bg-background/70 p-2">
                    <p className="text-[10px] font-medium uppercase text-muted-foreground">Zugeordneter Slot</p>
                    <p className="mt-1 font-medium">{getDisciplineLabel(disciplineCode)}</p>
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Slot-Wechsel bitte in den MTC-Details über die Slot-Auswahl ändern.
                </p>
              </div>
            ) : (
            <div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-muted-foreground">
                  {participant?.teamRegistrationMode === "MARKETPLACE" ? "Wunsch-Disziplin" : "Disziplin-Zuordnung"}
                </label>
                {!directEdit && <ApprovalFieldBadge />}
              </div>
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
            )}

            <div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-muted-foreground">T-Shirt-Größe</label>
                {!directEdit && <DirectFieldBadge />}
              </div>
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
              </>
            )}

            <div>
              {showModerationNote && (
                <>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-muted-foreground">Hinweis für Moderation (intern)</label>
                    {!directEdit && <DirectFieldBadge />}
                  </div>
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

            {!moderatorNoteOnly && showAdminOnlyParticipantFields && (
            <div className="space-y-2 rounded-md border border-border/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-muted-foreground">E-Mail (optional)</label>
                  {!directEdit && <DirectFieldBadge />}
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
                {canResetLinkedAccount ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={handleResetLinkedAccount}
                    disabled={resettingLinkedAccount}
                    aria-busy={resettingLinkedAccount}
                  >
                    {resettingLinkedAccount ? "Ersetzt..." : replaceActionLabel}
                  </Button>
                ) : canSendInvitation ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleSendInvitation}
                    disabled={sendingInvitation}
                    aria-busy={sendingInvitation}
                  >
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
                {canResetLinkedAccount ? (
                  <p>
                    Dieser Datensatz ist noch mit einem bestehenden Portal-Konto verknüpft. Nutze diese Aktion nur für einen echten Personenwechsel im Team.
                  </p>
                ) : null}
                {canResetLinkedAccount && participant?.isTeamManager ? (
                  <p>Bestehende Team-Manager-Rechte des alten Accounts werden dabei automatisch entzogen.</p>
                ) : null}
                {inviteMessage ? (
                  <p className={inviteMessage.type === "success" ? "text-green-700" : "text-red-600"}>{inviteMessage.text}</p>
                ) : null}
              </div>
            </div>
            )}
          </div>

        </div>

        <DialogFooter className="border-t bg-background/95 px-6 py-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] backdrop-blur supports-[backdrop-filter]:bg-background/85">
          <div className="flex w-full flex-col gap-2">
            {footerIssueCount > 0 ? (
              <div
                className={
                  footerIssueTone === "error"
                    ? "rounded-md border border-destructive/40 bg-card text-xs shadow-sm"
                    : "rounded-md border border-amber-500/40 bg-card text-xs shadow-sm"
                }
                role="alert"
              >
                <button
                  type="button"
                  className="flex min-h-9 w-full items-center justify-between gap-2 px-2.5 py-2 text-left"
                  onClick={() => setFooterIssuesExpanded((value) => !value)}
                  aria-expanded={footerIssuesExpanded}
                >
                  <span className="flex min-w-0 items-center gap-2 font-medium">
                    {footerIssueTone === "error" ? (
                      <XCircle className="size-4 shrink-0 text-destructive" aria-hidden="true" />
                    ) : (
                      <AlertTriangle className="size-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
                    )}
                    <span className="truncate">{footerIssueLabel}</span>
                  </span>
                  {footerIssuesExpanded ? (
                    <ChevronUp className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  )}
                </button>
                {footerIssuesExpanded ? (
                  <div className="space-y-1 border-t px-2.5 py-2 leading-5">
                    {error ? <div>{error}</div> : null}
                    {visibleClassificationWarnings.map((warning) => (
                      <div key={warning}>{warning}</div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Abbrechen
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || (!!result && result.editResult?.status !== "rejected")}
                aria-busy={saving}
              >
                {participantSaveLabel}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
