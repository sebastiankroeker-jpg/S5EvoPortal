"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusMessage } from "@/components/ui/status-message";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DISCIPLINES,
  MARKETPLACE_STATUS_OPTIONS,
  MARKETPLACE_VISIBILITY_OPTIONS,
  PARTICIPANT_PUBLICATION_OPTIONS,
  TEAM_PUBLICATION_OPTIONS,
  formatBirthDateInput,
  resolveBirthDateInputKey,
} from "@/lib/domain/team";
import { evaluateTeamDraft, validateDisciplineAssignment } from "@/lib/domain/classification";
import { SHIRT_SIZES } from "@/lib/domain/shirts";
import { usePermissions } from "@/lib/permissions-context";
import { useCompetition } from "@/lib/competition-context";
import { useNotifications } from "@/lib/notification-context";
import { canRoleViewAllTeams, isOwnerFilterVisibleForRole } from "@/lib/team-access-config";
import {
  TEAM_FOCUS_STORAGE_KEY,
  TEAM_SEARCH_STORAGE_KEY,
  openChangesDashboard,
  openUserDashboard,
} from "@/lib/admin-routing";
import { DASHBOARD_SCOPE_STORAGE_KEY, getStoredDashboardScope, setStoredDashboardScope } from "@/lib/dashboard-navigation";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  ArrowDownUp,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Info,
  Mail,
  Pencil,
  RotateCcw,
  Search,
  Send,
  SlidersHorizontal,
  Star,
  Trash2,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import ParticipantEditDialog from "./participant-edit-dialog";
import ParticipantPublicationPreferenceIcon from "./participant-publication-preference-icon";

interface Team {
  id: string;
  name: string;
  teamPublicationLevel?: "TEAM_ANONYM" | "TEAMNAME_OEFFENTLICH" | "ALLES_OEFFENTLICH";
  registrationMode?: "TEAM" | "MARKETPLACE";
  marketplaceVisibility?: "PUBLIC" | "MARKETPLACE_USERS" | "PORTAL_USERS" | "ADMIN_MANAGEMENT_ONLY";
  marketplaceStatus?: "NEW" | "REVIEWED" | "MATCHING" | "MATCHED" | "WITHDRAWN";
  marketplaceMessage?: string;
  category: string;
  contactName: string;
  contactEmail: string;
  ownerEmail?: string;
  ownerName?: string;
  createdAt?: string;
  updatedAt?: string;
  isCurrentUserTeam?: boolean;
  canCurrentUserEdit?: boolean;
  canManageTeamManagers?: boolean;
  participants?: Participant[];
}

interface Participant {
  id?: string;
  firstName: string;
  lastName: string;
  gender: string;
  birthDate: string;
  birthYear?: number;
  discipline?: string;
  disciplineCode?: string;
  marketplaceReturnDisciplineCode?: string | null;
  shirtSize?: string;
  moderationNote?: string;
  email?: string | null;
  linkedUserId?: string | null;
  emailInvitation?: EmailInvitationStatus | null;
  participantPublicationPreference?: "NAME_VERBERGEN" | "NAME_VEROEFFENTLICHEN";
  isCurrentUserParticipant?: boolean;
  isTeamManager?: boolean;
  canBeTeamManager?: boolean;
  pendingChanges?: { id: string; status: string }[];
  latestChange?: {
    id: string;
    status: string;
    updatedAt?: string | null;
    reviewedAt?: string | null;
    reviewComment?: string | null;
  } | null;
  teamOwnerEmail?: string;
  teamCanEdit?: boolean;
  teamCategory?: string;
  teamRegistrationMode?: Team["registrationMode"];
  teamMarketplaceStatus?: Team["marketplaceStatus"];
  teamParticipants?: Participant[];
}

type EmailInvitationStatus = {
  status: "missing_email" | "none" | "active" | "claimed" | "expired" | "revoked" | "linked";
  sentAt?: string | null;
  expiresAt?: string | null;
  claimedAt?: string | null;
  revokedAt?: string | null;
};

type TeamEditPayload = {
  teamName: string;
  teamPublicationLevel?: "TEAM_ANONYM" | "TEAMNAME_OEFFENTLICH" | "ALLES_OEFFENTLICH";
  participants: Participant[];
};

type MarketplaceTeamEditPayload = {
  teamName?: string;
  contactName?: string;
  contactEmail?: string;
  teamPublicationLevel: NonNullable<Team["teamPublicationLevel"]>;
  marketplaceVisibility: NonNullable<Team["marketplaceVisibility"]>;
  marketplaceStatus: NonNullable<Team["marketplaceStatus"]>;
  marketplaceMessage: string;
};

type MarketplaceAvailableParticipant = {
  id: string;
  teamId: string;
  teamName: string;
  marketplaceStatus: NonNullable<Team["marketplaceStatus"]>;
  name: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  gender: string;
  disciplineCode: string;
  email: string;
  shirtSize: string;
  participantPublicationPreference: "NAME_VERBERGEN" | "NAME_VEROEFFENTLICHEN";
};

type MarketplaceMatchingFinalizePayload = {
  teamName: string;
  contactName: string;
  contactEmail: string;
  teamPublicationLevel: NonNullable<Team["teamPublicationLevel"]>;
};

function getDisciplineLabel(value?: string | null) {
  if (!value || value === "TBD") return "Noch offen";
  const discipline = DISCIPLINES.find((entry) => entry.id === value);
  return discipline ? `${discipline.icon} ${discipline.label}` : value;
}

type EditableParticipant = Omit<Participant, "id"> & { id: string };

interface DashboardProps {
  ownerFilter?: string;
  marketplaceFocus?: boolean;
}

type DashboardViewMode = "cards" | "list";
type TeamSortField = "name" | "category" | "contactName" | "contactEmail" | "ownerEmail" | "participantCount" | "createdAt" | "updatedAt";
type SortDirection = "asc" | "desc";
type MarketplaceStatusFilter = "all" | NonNullable<Team["marketplaceStatus"]>;
type MarketplaceVisibilityFilter = "all" | NonNullable<Team["marketplaceVisibility"]>;
type MarketplacePublicationFilter = "all" | NonNullable<Team["teamPublicationLevel"]>;
type MarketplaceKindFilter = "all" | "marketplace" | "mtc" | "single";
type TeamOptionalColumnKey =
  | "category"
  | "contactName"
  | "contactEmail"
  | "ownerEmail"
  | "participantCount"
  | "participants"
  | "createdAt"
  | "updatedAt";

const TEAM_LIST_VISIBLE_COLUMNS_STORAGE_KEY = "s5evo.dashboard.visibleColumns";
const SORT_OPTIONS: Array<{ value: TeamSortField; label: string; adminOnly?: boolean }> = [
  { value: "updatedAt", label: "Zuletzt geändert" },
  { value: "createdAt", label: "Anmeldedatum", adminOnly: true },
  { value: "name", label: "Mannschaftsname" },
  { value: "category", label: "Klasse" },
  { value: "contactName", label: "Team Manager:in" },
  { value: "contactEmail", label: "Kontakt E-Mail" },
  { value: "participantCount", label: "Teilnehmer" },
];

const LIST_OPTIONAL_COLUMNS: Array<{ key: TeamOptionalColumnKey; label: string; adminOnly?: boolean }> = [
  { key: "category", label: "Klasse" },
  { key: "contactName", label: "Team Manager:in" },
  { key: "contactEmail", label: "Kontakt E-Mail" },
  { key: "participantCount", label: "Teilnehmer" },
  { key: "participants", label: "Mitglieder" },
  { key: "createdAt", label: "Anmeldedatum", adminOnly: true },
  { key: "updatedAt", label: "Geändert" },
];

function formatDatePart(value?: string) {
  if (!value) return "Unbekannt";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unbekannt";
  return date.toLocaleDateString("de-DE");
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

function formatTimePart(value?: string) {
  if (!value) return "Unbekannt";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unbekannt";
  return date.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeEmail(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function normalizeComparableText(value?: string | null) {
  return value?.normalize("NFC").trim() ?? "";
}

function getMarketplaceStatusOption(status?: Team["marketplaceStatus"] | null) {
  return MARKETPLACE_STATUS_OPTIONS.find((option) => option.id === (status || "NEW")) ?? MARKETPLACE_STATUS_OPTIONS[0];
}

function getMarketplaceStatusClass(status?: Team["marketplaceStatus"] | null) {
  switch (status || "NEW") {
    case "NEW":
      return "border-blue-300 bg-blue-50 text-blue-800";
    case "REVIEWED":
      return "border-slate-300 bg-slate-50 text-slate-800";
    case "MATCHING":
      return "border-amber-300 bg-amber-50 text-amber-800";
    case "MATCHED":
      return "border-green-300 bg-green-50 text-green-800";
    case "WITHDRAWN":
      return "border-zinc-300 bg-zinc-100 text-zinc-700";
    default:
      return "";
  }
}

function getParticipantCount(team: Team) {
  return team.participants?.length || 0;
}

function getParticipantDisplayName(participant: Participant, index?: number) {
  const name = `${participant.firstName} ${participant.lastName}`.trim();

  if (name === "Teilnehmer:in" && typeof index === "number") {
    return `Teilnehmer:in ${index + 1}`;
  }

  return name;
}

function isTeamIncomplete(team: Team) {
  if (getParticipantCount(team) < 5) {
    return true;
  }

  return (team.participants ?? []).some((participant) => !participant.firstName || !participant.lastName);
}

function canShowTeamActionStatus(team: Team, showAdminDashboardInfo: boolean) {
  return showAdminDashboardInfo || team.canCurrentUserEdit === true;
}

function getTeamCompletionMeta(team: Team) {
  const participantCount = getParticipantCount(team);
  const isMtcDraft = isMarketplaceMatchingTeam(team);
  const missingNames = (team.participants ?? []).filter(
    (participant) => !participant.firstName?.trim() || !participant.lastName?.trim(),
  ).length;

  if (participantCount < 5) {
    return {
      label: isMtcDraft ? `MTC: ${participantCount}/5 Slots` : `${participantCount}/5 besetzt`,
      toneClass: "border-amber-300 bg-amber-50 text-amber-800",
      icon: AlertTriangle,
      isImportant: true,
    };
  }

  if (missingNames > 0) {
    return {
      label: isMtcDraft ? `MTC: ${missingNames} Name(n) offen` : `${missingNames} Name(n) offen`,
      toneClass: "border-amber-300 bg-amber-50 text-amber-800",
      icon: AlertTriangle,
      isImportant: true,
    };
  }

  return {
    label: isMtcDraft ? "MTC vollständig" : "Vollständig",
    toneClass: "border-green-300 bg-green-50 text-green-800",
    icon: CheckCircle2,
    isImportant: false,
  };
}

function getTeamDisciplineMeta(team: Team) {
  const participants = team.participants ?? [];
  const isMtcDraft = isMarketplaceMatchingTeam(team);
  const missingDisciplines = participants.filter(
    (participant) => !(participant.discipline || participant.disciplineCode) || (participant.discipline || participant.disciplineCode) === "TBD",
  ).length;
  const disciplineCheck = validateDisciplineAssignment(
    participants.map((participant) => participant.discipline || participant.disciplineCode || "TBD"),
  );

  if (missingDisciplines > 0) {
    return {
      label: isMtcDraft ? `${missingDisciplines} MTC-Slot(s) offen` : `${missingDisciplines} Disziplin(en) offen`,
      toneClass: "border-amber-300 bg-amber-50 text-amber-800",
      icon: AlertTriangle,
      isImportant: true,
    };
  }

  if (!disciplineCheck.valid || disciplineCheck.warnings.length > 0) {
    return {
      label: isMtcDraft ? "MTC-Slots prüfen" : "Disziplinen prüfen",
      toneClass: "border-amber-300 bg-amber-50 text-amber-800",
      icon: AlertTriangle,
      isImportant: true,
    };
  }

  return {
    label: isMtcDraft ? "MTC-Slots ok" : "Disziplinen ok",
    toneClass: "border-green-300 bg-green-50 text-green-800",
    icon: CheckCircle2,
    isImportant: false,
  };
}

function getTeamPendingChangeCount(team: Team) {
  return (team.participants ?? []).reduce(
    (count, participant) => count + (participant.latestChange?.status === "PENDING" ? 1 : 0),
    0,
  );
}

function getParticipantsSummary(team: Team) {
  return (team.participants ?? [])
    .map((participant, index) => getParticipantDisplayName(participant, index))
    .filter(Boolean)
    .join(", ");
}

function hasVisibleContactInfo(team: Team) {
  return Boolean(team.contactName || team.contactEmail);
}

function getContactFallbackLabel(team: Team) {
  return hasVisibleContactInfo(team) ? "—" : "Nicht sichtbar";
}

function getLatestChangeMeta(status?: string | null) {
  if (status === "PENDING") return { label: "In Prüfung", className: "border-amber-300 text-amber-700" };
  if (status === "APPROVED") return { label: "Genehmigt", className: "border-green-300 text-green-700" };
  if (status === "REJECTED") return { label: "Abgelehnt", className: "border-red-300 text-red-700" };
  return null;
}

function getEmailInvitationMeta(status?: EmailInvitationStatus["status"] | null) {
  if (status === "linked") return { label: "Konto verknüpft", className: "border-green-300 text-green-700" };
  if (status === "claimed") return { label: "Einladung eingelöst", className: "border-green-300 text-green-700" };
  if (status === "active") return { label: "Einladung versendet", className: "border-blue-300 text-blue-700" };
  if (status === "expired") return { label: "Einladung abgelaufen", className: "border-amber-300 text-amber-700" };
  if (status === "revoked") return { label: "Einladung gesperrt", className: "border-red-300 text-red-700" };
  if (status === "missing_email") return { label: "Keine E-Mail", className: "border-muted text-muted-foreground" };
  return { label: "Keine Einladung", className: "border-muted text-muted-foreground" };
}

function getParticipantAccessMeta(team: Team, participant: Participant) {
  if (participant.isTeamManager) {
    return {
      label: isMarketplaceMatchingTeam(team) ? "MTC-Teamchef bewusst" : "Team Manager:in",
      className: "border-green-300 text-green-700",
    };
  }

  if (participant.canBeTeamManager) {
    return {
      label: isMarketplaceMatchingTeam(team) ? "Portal-Konto, keine Teamchef-Rolle" : "Teilnehmer:in",
      className: "border-muted text-muted-foreground",
    };
  }

  return {
    label: "Kein Portal-Konto",
    className: "border-muted text-muted-foreground",
  };
}

function isFemaleParticipant(gender?: string | null) {
  return gender === "W" || gender === "FEMALE";
}

function isMaleParticipant(gender?: string | null) {
  return gender === "M" || gender === "MALE";
}

function getGenderedDisciplineRole(disciplineCode?: string | null, gender?: string | null) {
  const code = disciplineCode && disciplineCode !== "TBD" ? disciplineCode : "TBD";
  const labels: Record<string, { female: string; male: string; neutral: string }> = {
    RUN: { female: "Läuferin", male: "Läufer", neutral: "Laufen" },
    BENCH: { female: "Bankdrückerin", male: "Bankdrücker", neutral: "Bankdrücken" },
    STOCK: { female: "Stockschützin", male: "Stockschütze", neutral: "Stockschießen" },
    ROAD: { female: "Rennradfahrerin", male: "Rennradfahrer", neutral: "Rennrad" },
    MTB: { female: "Mountainbikerin", male: "Mountainbiker", neutral: "Mountainbike" },
    TBD: { female: "Teilnehmerin", male: "Teilnehmer", neutral: "Teilnehmer:in" },
  };
  const label = labels[code] || labels.TBD;

  if (isFemaleParticipant(gender)) return label.female;
  if (isMaleParticipant(gender)) return label.male;
  return label.neutral;
}

function hasParticipantDisplayName(participant: Participant, index?: number) {
  const name = getParticipantDisplayName(participant, index);
  return Boolean(name) && name !== "Teilnehmer:in";
}

function canShowParticipantNameOnDashboard(team: Team, participant: Participant, index?: number) {
  const name = getParticipantDisplayName(participant, index);
  return (
    team.teamPublicationLevel === "ALLES_OEFFENTLICH" &&
    participant.participantPublicationPreference === "NAME_VEROEFFENTLICHEN" &&
    name !== "Teilnehmer:in"
  );
}

function canRevealPrivateDashboardName(team: Team, isAdmin: boolean) {
  return isAdmin || (!isAdmin && (team.isCurrentUserTeam === true || team.canCurrentUserEdit === true));
}

function getDashboardParticipantLabel(
  team: Team,
  participant: Participant,
  index?: number,
  options?: { revealPrivateName?: boolean },
) {
  if (options?.revealPrivateName && hasParticipantDisplayName(participant, index)) {
    return getParticipantDisplayName(participant, index);
  }

  if (canShowParticipantNameOnDashboard(team, participant, index)) {
    return getParticipantDisplayName(participant, index);
  }

  return getGenderedDisciplineRole(participant.discipline || participant.disciplineCode, participant.gender);
}

function getTeamDisciplineSlots(team: Team) {
  const remainingParticipants = [...(team.participants ?? [])];

  return DISCIPLINES.map((discipline) => {
    const participantIndex = remainingParticipants.findIndex(
      (participant) => (participant.discipline || participant.disciplineCode) === discipline.id,
    );
    const participant = participantIndex >= 0 ? remainingParticipants.splice(participantIndex, 1)[0] : null;

    return {
      discipline,
      participant,
    };
  });
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function formatInvitationActionLabel(count: number) {
  return count === 1 ? "Einladung versenden" : "Einladungen versenden";
}

function getTeamSaveButtonLabel({
  isAdminEdit,
  hasApprovalChanges,
  hasDirectChanges,
  pendingInvitationCount,
}: {
  isAdminEdit: boolean;
  hasApprovalChanges: boolean;
  hasDirectChanges: boolean;
  pendingInvitationCount: number;
}) {
  const invitationLabel = formatInvitationActionLabel(pendingInvitationCount);

  if (isAdminEdit) {
    if (pendingInvitationCount > 0) {
      return hasDirectChanges ? `Speichern & ${invitationLabel}` : invitationLabel;
    }
    return "Speichern";
  }

  if (hasApprovalChanges && pendingInvitationCount > 0) {
    return `Genehmigung einreichen & ${invitationLabel}`;
  }

  if (hasApprovalChanges) return "Genehmigung einreichen";
  if (pendingInvitationCount > 0) return invitationLabel;
  return "Speichern";
}

function formatDateTime(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("de-DE");
}

function formatDateTimeLocalInput(date: Date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function clampDateTimeLocalToNow(value: string) {
  if (!value) return "";

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return value;
  }

  const now = new Date();
  if (timestamp > now.getTime()) {
    return formatDateTimeLocalInput(now);
  }

  return value;
}

function getDateTimeFilterTimestamp(value: string) {
  if (!value) return null;

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
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

function isMarketplaceMatchingTeam(team: Team) {
  return team.registrationMode === "MARKETPLACE";
}

function getMarketplaceDraftStatusMeta(team: Team) {
  const participantCount = getParticipantCount(team);

  if (team.marketplaceStatus === "MATCHED") {
    return {
      label: "Als Mannschaft übernommen",
      className: "border-green-300 bg-green-50 text-green-800",
    };
  }

  if (team.marketplaceStatus === "WITHDRAWN") {
    return {
      label: "Zurückgezogen",
      className: "border-zinc-300 bg-zinc-100 text-zinc-700",
    };
  }

  if (participantCount === 0) {
    return {
      label: "Offen",
      className: "border-blue-300 bg-blue-50 text-blue-800",
    };
  }

  if (participantCount < 5) {
    return {
      label: "Teilweise gefüllt",
      className: "border-amber-300 bg-amber-50 text-amber-800",
    };
  }

  return {
    label: "Vollständig",
    className: "border-green-300 bg-green-50 text-green-800",
  };
}

function getMarketplaceDraftTeamName(teamName: string) {
  return teamName
    .replace(/^Börsen-Mannschaft:?\s*/i, "")
    .replace(/^Sportlerbörse:?\s*/i, "")
    .trim();
}

function getMarketplaceVisibilityLabel(value?: Team["marketplaceVisibility"] | null) {
  return MARKETPLACE_VISIBILITY_OPTIONS.find((option) => option.id === (value || "ADMIN_MANAGEMENT_ONLY"))?.label || "Nur für Admins/MGMT sichtbar";
}

function getTeamPublicationLabel(value?: Team["teamPublicationLevel"] | null) {
  return TEAM_PUBLICATION_OPTIONS.find((option) => option.id === (value || "TEAM_ANONYM"))?.label || "Team anonym";
}

function getParticipantPublicationLabel(value?: Participant["participantPublicationPreference"] | null) {
  return PARTICIPANT_PUBLICATION_OPTIONS.find((option) => option.id === (value || "NAME_VERBERGEN"))?.label || "Name verbergen";
}

function MarketplaceTeamBadges({ team, compact = false, subtle = false }: { team: Team; compact?: boolean; subtle?: boolean }) {
  if (team.registrationMode !== "MARKETPLACE") return null;

  const isMarketplaceMatching = isMarketplaceMatchingTeam(team);
  const marketplaceStatus = getMarketplaceStatusOption(team.marketplaceStatus);
  const marketplaceDraftStatus = getMarketplaceDraftStatusMeta(team);
  const compactClassName = compact ? "h-6 shrink-0 px-1.5 text-[10px]" : "";
  const statusClassName = subtle
    ? "border-muted-foreground/30 text-muted-foreground"
    : isMarketplaceMatching ? marketplaceDraftStatus.className : getMarketplaceStatusClass(team.marketplaceStatus);

  return (
    <>
      <Badge variant="secondary" className={compactClassName}>
        {isMarketplaceMatching ? `MTC · ${getParticipantCount(team)}/5` : "Sportlerbörse"}
      </Badge>
      <Badge variant="outline" className={`${compactClassName} ${statusClassName}`}>
        {isMarketplaceMatching ? marketplaceDraftStatus.label : marketplaceStatus.label}
      </Badge>
      <Badge variant="outline" className={`${compactClassName} border-primary/30 text-primary`}>
        {getMarketplaceVisibilityLabel(team.marketplaceVisibility)}
      </Badge>
      {!subtle && (
        <Badge variant="outline" className={`${compactClassName} border-muted-foreground/30 text-muted-foreground`}>
          {getTeamPublicationLabel(team.teamPublicationLevel)}
        </Badge>
      )}
    </>
  );
}

function MarketplaceParticipantBadges({ team, participant, compact = false }: { team: Team; participant: Participant; compact?: boolean }) {
  if (!isMarketplaceMatchingTeam(team)) return null;

  return (
    <>
      <Badge variant="secondary" className={`${compact ? "h-4 px-1 text-[9px]" : "h-5 max-w-full px-1.5 text-[10px]"}`}>
        {compact ? "MTC" : "MTC-Slot"}
      </Badge>
      {!compact && (
        <Badge variant="outline" className="h-5 max-w-full justify-center border-border/60 px-1.5 text-[10px] text-muted-foreground">
          {getParticipantPublicationLabel(participant.participantPublicationPreference)}
        </Badge>
      )}
    </>
  );
}

function getTeamCapabilities(team: Team, access: { canEditAll: boolean; canEditOwnTeam?: boolean }) {
  const isMarketplaceTeam = team.registrationMode === "MARKETPLACE";
  const isMtcDraft = isMarketplaceMatchingTeam(team);
  const canEditMarketplaceObject = access.canEditAll && isMarketplaceTeam;

  return {
    isMarketplaceTeam,
    isMtcDraft,
    hasOpenMtcSlots: isMtcDraft && getParticipantCount(team) < 5,
    canEditMarketplaceVisibility: canEditMarketplaceObject,
    canEditPublicationPreferences: canEditMarketplaceObject || access.canEditOwnTeam === true,
    canManageSlots: access.canEditAll && isMtcDraft,
    canSearchParticipants: access.canEditAll && isMtcDraft && getParticipantCount(team) < 5,
  };
}

function TeamDeleteDialog({
  team,
  deleting,
  onDelete,
  className,
  onTriggerClick,
}: {
  team: Team;
  deleting: string | null;
  onDelete: (teamId: string) => void;
  className?: string;
  onTriggerClick?: (event: React.MouseEvent) => void;
}) {
  const participantCount = getParticipantCount(team);
  const isMarketplace = team.registrationMode === "MARKETPLACE";
  const isMarketplaceMatching = isMarketplaceMatchingTeam(team);

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            size="sm"
            variant="destructive"
            disabled={deleting === team.id}
            className={className}
            onClick={onTriggerClick}
          />
        }
      >
        {deleting === team.id ? (
          "..."
        ) : (
          <>
            <Trash2 className="size-3.5" />
            Löschen
          </>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isMarketplaceMatching
              ? "Börsen-Mannschaft archivieren?"
              : isMarketplace
                ? "Sportlerbörse-Meldung archivieren?"
                : "Mannschaft archivieren?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isMarketplaceMatching
              ? `„${team.name}“ wird als Börsen-Mannschaft ausgeblendet. ${participantCount} zugeordnete Teilnehmer:innen bleiben erhalten, Benutzerkonten bleiben erhalten. Admins können den Entwurf später im Archiv wiederherstellen.`
              : isMarketplace
                ? `„${team.name}“ wird aus der Sportlerbörse ausgeblendet. Der zugehörige Teilnehmerdatensatz wird mit archiviert, Benutzerkonten bleiben erhalten. Admins können die Meldung später im Archiv wiederherstellen.`
              : `„${team.name}“ wird aus Dashboards, Ergebnislisten und Exporten ausgeblendet. ${participantCount} Teilnehmer:innen werden mit ausgeblendet, Benutzerkonten bleiben erhalten. Admins können die Mannschaft später im Archiv wiederherstellen.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onDelete(team.id)}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Archivieren
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function MarketplacePersonSummary({
  team,
  participant,
  revealPrivateName,
}: {
  team: Team;
  participant?: Participant | null;
  revealPrivateName: boolean;
}) {
  const participantIndex = participant ? (team.participants ?? []).indexOf(participant) : -1;
  const participantLabel = participant
    ? getDashboardParticipantLabel(team, participant, participantIndex, { revealPrivateName })
    : "Kein Teilnehmer erfasst";
  const disciplineCode = participant?.discipline || participant?.disciplineCode || "TBD";
  const discipline = DISCIPLINES.find((entry) => entry.id === disciplineCode);
  const latestChangeMeta = participant ? getLatestChangeMeta(participant.latestChange?.status) : null;
  const emailInviteMeta = participant ? getEmailInvitationMeta(participant.emailInvitation?.status || (participant.email ? "none" : "missing_email")) : null;

  return (
    <div className="rounded-md border border-border/60 bg-background p-2.5 text-xs">
      <div className="flex min-w-0 items-start gap-2">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/30">
          <UserRound className="size-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <p className="min-w-0 truncate text-sm font-medium" title={participantLabel}>
              {participantLabel}
            </p>
            {participant && (
              <ParticipantPublicationPreferenceIcon
                preference={participant.participantPublicationPreference}
                teamPublicationLevel={team.teamPublicationLevel}
              />
            )}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
            <span>{discipline ? `${discipline.icon} ${discipline.label}` : "Disziplin offen"}</span>
            {participant?.birthDate && <span>{participant.birthDate}</span>}
            {participant?.email && <span>{participant.email}</span>}
          </div>
          {(latestChangeMeta || emailInviteMeta) && (
            <div className="flex flex-wrap gap-1 pt-1">
              {latestChangeMeta && (
                <Badge variant="outline" className={`h-5 px-1.5 text-[10px] ${latestChangeMeta.className}`}>
                  {latestChangeMeta.label}
                </Badge>
              )}
              {emailInviteMeta && (
                <Badge variant="outline" className={`h-5 gap-1 px-1.5 text-[10px] ${emailInviteMeta.className}`}>
                  <Mail className="size-3" />
                  {emailInviteMeta.label}
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MarketplaceSlotSearchPopover({
  team,
  competitionId,
  discipline,
  assignedParticipants,
  onAddParticipant,
}: {
  team: Team;
  competitionId?: string;
  discipline: (typeof DISCIPLINES)[number];
  assignedParticipants: Participant[];
  onAddParticipant: (targetTeamId: string, participantId: string, targetDiscipline?: string) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [availableParticipants, setAvailableParticipants] = useState<MarketplaceAvailableParticipant[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [busyParticipantId, setBusyParticipantId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const assignedParticipantIds = new Set(assignedParticipants.map((participant) => participant.id).filter(Boolean));
  const teamFull = assignedParticipants.length >= 5;

  const loadAvailableParticipants = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (competitionId) params.set("competitionId", competitionId);
      params.set("targetTeamId", team.id);
      const response = await fetch(`/api/admin/marketplace-matching?${params.toString()}`);
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Börsen-Teilnehmer konnten nicht geladen werden.");
      }
      setAvailableParticipants(Array.isArray(data?.availableParticipants) ? data.availableParticipants : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Börsen-Teilnehmer konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [competitionId, team.id]);

  useEffect(() => {
    if (!open) return;
    void loadAvailableParticipants();
  }, [loadAvailableParticipants, open]);

  const filteredParticipants = availableParticipants.filter((participant) => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return true;
    return [
      participant.name,
      participant.email,
      participant.disciplineCode,
      participant.teamName,
      participant.marketplaceStatus,
    ].some((value) => value.toLowerCase().includes(normalizedQuery));
  }).sort((left, right) => {
    const leftMatchesSlot = left.disciplineCode === discipline.id ? 0 : 1;
    const rightMatchesSlot = right.disciplineCode === discipline.id ? 0 : 1;
    if (leftMatchesSlot !== rightMatchesSlot) return leftMatchesSlot - rightMatchesSlot;
    return left.name.localeCompare(right.name, "de");
  });

  const handleAdd = async (participantId: string) => {
    setBusyParticipantId(participantId);
    setError("");
    try {
      await onAddParticipant(team.id, participantId, discipline.id);
      setOpen(false);
      setQuery("");
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : "Teilnehmer konnte nicht zugeordnet werden.");
    } finally {
      setBusyParticipantId(null);
    }
  };

  return (
    <div className="relative mt-auto" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
          setQuery("");
        }}
        className="min-h-7 w-full rounded border border-primary/40 bg-primary/5 px-2 py-0.5 text-[10px] font-medium text-primary transition-colors hover:bg-primary/10"
        title={`${discipline.label}: Teilnehmer suchen`}
      >
        Teilnehmer suchen
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[120] flex items-end bg-black/55 p-0 sm:items-center sm:justify-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`${discipline.label}: Teilnehmer suchen`}
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[84dvh] w-full flex-col rounded-t-lg border border-border bg-card text-xs shadow-xl sm:max-h-[min(42rem,calc(100dvh-2rem))] sm:max-w-2xl sm:rounded-lg"
            onClick={(event) => event.stopPropagation()}
          >
          <div className="flex shrink-0 items-center gap-2 border-b border-border p-3">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`${discipline.label}: Name, E-Mail oder Status`}
              className="h-9"
              autoFocus
            />
            <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
              Schließen
            </Button>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto overscroll-contain p-3 pr-2 [-webkit-overflow-scrolling:touch]">
            {error ? (
              <div className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">{error}</div>
            ) : loading ? (
              <div className="rounded-md border border-border/60 p-3 text-sm text-muted-foreground">Lade freie Teilnehmer...</div>
            ) : filteredParticipants.length === 0 ? (
              <div className="rounded-md border border-border/60 p-3 text-sm text-muted-foreground">Keine freien Börsen-Teilnehmer gefunden.</div>
            ) : (
              filteredParticipants.map((availableParticipant) => {
                const availableDiscipline = DISCIPLINES.find((entry) => entry.id === availableParticipant.disciplineCode);
                const alreadyAssigned = assignedParticipantIds.has(availableParticipant.id);
                const matchesSlot = availableParticipant.disciplineCode === discipline.id;

                return (
                  <div key={availableParticipant.id} className="rounded-md border border-border/60 bg-background p-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{availableParticipant.name}</p>
                        <p className="truncate text-muted-foreground">
                          Wunsch: {availableDiscipline ? `${availableDiscipline.icon} ${availableDiscipline.label}` : "Disziplin offen"}
                          {availableParticipant.birthDate ? ` · ${availableParticipant.birthDate}` : ""}
                          {availableParticipant.email ? ` · ${availableParticipant.email}` : ""}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <Badge variant={matchesSlot ? "default" : "outline"}>
                            {matchesSlot ? "passend" : `als ${discipline.label} zuordnen`}
                          </Badge>
                          <Badge variant="outline" className={getMarketplaceStatusClass(availableParticipant.marketplaceStatus)}>
                            {getMarketplaceStatusOption(availableParticipant.marketplaceStatus).label}
                          </Badge>
                          <Badge variant="outline">{availableParticipant.teamName}</Badge>
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleAdd(availableParticipant.id)}
                        disabled={alreadyAssigned || teamFull || busyParticipantId === availableParticipant.id}
                        aria-busy={busyParticipantId === availableParticipant.id}
                      >
                        Zuordnen
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          </div>
        </div>
      )}
    </div>
  );
}

function compareDates(a?: string, b?: string) {
  const aTime = a ? new Date(a).getTime() : 0;
  const bTime = b ? new Date(b).getTime() : 0;
  return aTime - bTime;
}

function getStoredVisibleColumns() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(TEAM_LIST_VISIBLE_COLUMNS_STORAGE_KEY);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return null;
    }

    const allowedKeys = new Set(LIST_OPTIONAL_COLUMNS.map((column) => column.key));
    const sanitized = parsed.filter(
      (value): value is TeamOptionalColumnKey => typeof value === "string" && allowedKeys.has(value as TeamOptionalColumnKey),
    );

    return sanitized.length > 0 ? sanitized : null;
  } catch {
    return null;
  }
}

export default function Dashboard({ ownerFilter: initialOwnerFilter, marketplaceFocus = false }: DashboardProps = {}) {
  const { data: session } = useSession();
  const { can, activeRole } = usePermissions();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<string>(initialOwnerFilter || "all");
  const [ownTeamsOnly, setOwnTeamsOnly] = useState(() => {
    if (typeof window === "undefined") return false;
    return getStoredDashboardScope() === "mine";
  });
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [incompleteOnly, setIncompleteOnly] = useState(false);
  const [marketplaceKindFilter, setMarketplaceKindFilter] = useState<MarketplaceKindFilter>(marketplaceFocus ? "marketplace" : "all");
  const [marketplaceStatusFilter, setMarketplaceStatusFilter] = useState<MarketplaceStatusFilter>("all");
  const [marketplaceVisibilityFilter, setMarketplaceVisibilityFilter] = useState<MarketplaceVisibilityFilter>("all");
  const [marketplacePublicationFilter, setMarketplacePublicationFilter] = useState<MarketplacePublicationFilter>("all");
  const [openMtcSlotsOnly, setOpenMtcSlotsOnly] = useState(false);
  const [viewMode, setViewMode] = useState<DashboardViewMode>("cards");
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [editingMarketplaceTeam, setEditingMarketplaceTeam] = useState<Team | null>(null);
  const [editingMarketplaceMatchingTeam, setEditingMarketplaceMatchingTeam] = useState<Team | null>(null);
  const [marketplaceMatchingDisciplineFilter, setMarketplaceMatchingDisciplineFilter] = useState("all");
  const [editingParticipant, setEditingParticipant] = useState<EditableParticipant | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [creatingMatchingDraft, setCreatingMatchingDraft] = useState(false);
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [listOptionsOpen, setListOptionsOpen] = useState(false);
  const [sortField, setSortField] = useState<TeamSortField>("updatedAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [visibleColumns, setVisibleColumns] = useState<TeamOptionalColumnKey[]>([
    "category",
    "participantCount",
    "participants",
    "createdAt",
  ]);

  const canEditAll = can("team.edit.all");
  const canViewAll = can("team.view.all");
  const isAdmin = activeRole === "ADMIN";
  const canUseAdminLinks = activeRole === "ADMIN";
  const showAdminDashboardInfo = activeRole === "ADMIN";
  const shouldAutoShowMembersColumn = activeRole !== "TEILNEHMER";
  const userEmail = session?.user?.email;
  const { active: activeCompetition, loading: competitionLoading } = useCompetition();
  const marketplaceGlobalVisibility = activeCompetition?.marketplaceGlobalVisibility === "OFFLINE" ? "OFFLINE" : "SELECTIVE";
  const notifications = useNotifications();
  const showOwnerFilter = isOwnerFilterVisibleForRole(activeRole, activeCompetition);
  const canBrowseAllTeams = canViewAll || canRoleViewAllTeams(activeRole, activeCompetition);
  const sortOptions = useMemo(() => SORT_OPTIONS.filter((option) => !option.adminOnly || isAdmin), [isAdmin]);
  const listOptionalColumns = useMemo(
    () => LIST_OPTIONAL_COLUMNS.filter((column) => !column.adminOnly || isAdmin),
    [isAdmin],
  );

  const fetchTeams = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (activeCompetition?.id) params.set('competitionId', activeCompetition.id);
      if (canBrowseAllTeams) params.set('scope', 'all');
      params.set("roleContext", activeRole);
      const response = await fetch(`/api/teams?${params}`);
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Teams konnten nicht geladen werden.");
      }
      setTeams(data.teams || []);
    } catch (error) {
      console.error('Failed to fetch teams:', error);
      notifications.error(
        "Teams konnten nicht geladen werden",
        error instanceof Error ? error.message : "Bitte versuche es erneut.",
      );
    } finally {
      setLoading(false);
    }
  }, [activeCompetition?.id, activeRole, canBrowseAllTeams, notifications]);

  const handleDeleteTeam = async (teamId: string) => {
    setDeleting(teamId);
    try {
      const response = await fetch(`/api/teams/${teamId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        const data = await response.json().catch(() => null);
        await fetchTeams(); // Refresh list
        notifications.success(
          data?.message || "Team archiviert",
          "Die Teamliste wurde aktualisiert.",
        );
      } else {
        const error = await response.json().catch(() => null);
        notifications.error("Fehler beim Löschen", error?.error || "Das Team konnte nicht archiviert werden.");
      }
    } catch (error) {
      console.error('Failed to delete team:', error);
      notifications.error(
        "Fehler beim Löschen des Teams",
        error instanceof Error ? error.message : "Bitte versuche es erneut.",
      );
    } finally {
      setDeleting(null);
    }
  };

  const handleEditTeam = async (teamData: TeamEditPayload) => {
    const editedTeamId = editingTeam!.id;

    try {
      const response = await fetch(`/api/teams/${editedTeamId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(teamData),
      });
      
      if (response.ok) {
        const data = await response.json();
        setEditingTeam(null);
        setExpandedTeam((current) => (current === editedTeamId ? null : current));
        await fetchTeams(); // Refresh list
        const notices = [
          ...(data.message ? [data.message] : []),
          ...((Array.isArray(data.classificationWarnings) ? data.classificationWarnings : []) as string[]),
        ];
        notifications.success(
          notices[0] || "Team gespeichert",
          notices.length > 1 ? notices.slice(1).join("\n") : "Die Änderungen wurden übernommen.",
        );
      } else {
        const error = await response.json().catch(() => null);
        notifications.error("Fehler beim Speichern", error?.error || "Das Team konnte nicht gespeichert werden.");
      }
    } catch (error) {
      console.error('Failed to edit team:', error);
      notifications.error(
        "Fehler beim Speichern des Teams",
        error instanceof Error ? error.message : "Bitte versuche es erneut.",
      );
    }
  };

  const saveMarketplaceTeamMetadata = async (teamId: string, teamData: MarketplaceTeamEditPayload) => {
    const response = await fetch(`/api/teams/${teamId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(teamData),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.error || "Börsen-Mannschaft konnte nicht gespeichert werden.");
    }
    return data;
  };

  const handleMarketplaceTeamEdit = async (teamData: MarketplaceTeamEditPayload) => {
    const editedTeamId = editingMarketplaceTeam!.id;

    try {
      await saveMarketplaceTeamMetadata(editedTeamId, teamData);
      setEditingMarketplaceTeam(null);
      await fetchTeams();
      notifications.success("Börsen-Mannschaft gespeichert", "Status und Sichtbarkeit wurden aktualisiert.");
    } catch (error) {
      notifications.error(
        "Börsen-Mannschaft konnte nicht gespeichert werden",
        error instanceof Error ? error.message : "Bitte versuche es erneut.",
      );
    }
  };

  const postMarketplaceMatchingAction = async (payload: Record<string, unknown>) => {
    const response = await fetch("/api/admin/marketplace-matching", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        competitionId: activeCompetition?.id,
        ...payload,
      }),
    });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(data?.error || "Börsen-Mannschaft konnte nicht aktualisiert werden.");
    }

    return data;
  };

  const handleCreateMarketplaceMatchingDraft = async () => {
    setCreatingMatchingDraft(true);
    try {
      const data = await postMarketplaceMatchingAction({
        action: "createDraft",
        teamName: "Börsen-Mannschaft",
      });
      await fetchTeams();
      if (data?.teamId) {
        setExpandedTeam(data.teamId);
      }
      notifications.success("Börsen-Mannschaft angelegt", "Der Matching-Entwurf kann jetzt befüllt werden.");
    } catch (error) {
      notifications.error(
        "Börsen-Mannschaft konnte nicht angelegt werden",
        error instanceof Error ? error.message : "Bitte versuche es erneut.",
      );
    } finally {
      setCreatingMatchingDraft(false);
    }
  };

  const handleMarketplaceMatchingAdd = async (targetTeamId: string, participantId: string, targetDiscipline?: string) => {
    const data = await postMarketplaceMatchingAction({
      action: "addParticipant",
      targetTeamId,
      participantId,
      targetDiscipline,
    });
    await fetchTeams();
    notifications.success("Teilnehmer zugeordnet", data?.message || "Die Börsen-Mannschaft wurde aktualisiert.");
  };

  const handleMarketplaceMatchingMove = async (targetTeamId: string, participantId: string, targetDiscipline: string) => {
    const data = await postMarketplaceMatchingAction({
      action: "moveParticipant",
      targetTeamId,
      participantId,
      targetDiscipline,
    });
    await fetchTeams();
    notifications.success("Slot-Zuordnung geändert", data?.message || "Die Börsen-Mannschaft wurde aktualisiert.");
  };

  const handleMarketplaceMatchingRemove = async (targetTeamId: string, participantId: string) => {
    const data = await postMarketplaceMatchingAction({
      action: "removeParticipant",
      targetTeamId,
      participantId,
    });
    await fetchTeams();
    notifications.success("Teilnehmer entfernt", data?.message || "Die Börsen-Mannschaft wurde aktualisiert.");
  };

  const handleMarketplaceMatchingFinalize = async (targetTeamId: string, payload: MarketplaceMatchingFinalizePayload) => {
    const data = await postMarketplaceMatchingAction({
      action: "finalize",
      targetTeamId,
      ...payload,
    });
    setEditingMarketplaceMatchingTeam(null);
    await fetchTeams();
    notifications.success(
      "Mannschaft übernommen",
      [
        data?.message || "Die Börsen-Mannschaft wurde in eine echte Mannschaft überführt.",
        ...((Array.isArray(data?.classificationWarnings) ? data.classificationWarnings : []) as string[]),
      ].filter(Boolean).join("\n"),
    );
  };

  const openParticipantDetails = (team: Team, participant?: Participant | null) => {
    if (!participant?.id) return;

    setEditingParticipant({
      ...participant,
      id: participant.id,
      teamOwnerEmail: team.ownerEmail || team.contactEmail,
      teamCanEdit: team.canCurrentUserEdit,
      teamCategory: team.category,
      teamRegistrationMode: team.registrationMode,
      teamMarketplaceStatus: team.marketplaceStatus,
      teamParticipants: team.participants ?? [],
    });
  };

  const openMarketplaceMatching = (team: Team, disciplineId = "all") => {
    setMarketplaceMatchingDisciplineFilter(disciplineId);
    setEditingMarketplaceMatchingTeam(team);
  };

  // Pending owner filter (set before teams are loaded)
  const [pendingOwnerFilter, setPendingOwnerFilter] = useState<string | null>(null);

  useEffect(() => {
    if (competitionLoading) return;
    void fetchTeams();
  }, [competitionLoading, fetchTeams]);

  useEffect(() => {
    if (!showOwnerFilter) {
      setOwnerFilter("all");
    }
  }, [showOwnerFilter]);

  useEffect(() => {
    setStoredDashboardScope(ownTeamsOnly ? "mine" : "all");
  }, [ownTeamsOnly]);

  useEffect(() => {
    if (viewMode === "list") {
      setExpandedTeam(null);
    }
  }, [viewMode]);

  useEffect(() => {
    const storedColumns = getStoredVisibleColumns();
    if (!storedColumns) return;

    const nextColumns: TeamOptionalColumnKey[] =
      shouldAutoShowMembersColumn && !storedColumns.includes("participants")
        ? [...storedColumns, "participants"]
        : storedColumns;

    setVisibleColumns(nextColumns);
  }, [shouldAutoShowMembersColumn]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(TEAM_LIST_VISIBLE_COLUMNS_STORAGE_KEY, JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  useEffect(() => {
    const allowedKeys = new Set(listOptionalColumns.map((column) => column.key));
    const fallback = listOptionalColumns[0]?.key;

    setVisibleColumns((current) => {
      const sanitized = current.filter((key) => allowedKeys.has(key));
      if (sanitized.length > 0) {
        return sanitized;
      }
      return fallback ? [fallback] : current;
    });
  }, [listOptionalColumns]);

  useEffect(() => {
    const selectedOption = sortOptions.some((option) => option.value === sortField);
    if (!selectedOption) {
      setSortField("updatedAt");
      setSortDirection("desc");
    }
  }, [sortField, sortOptions]);

  useEffect(() => {
    // Listen for switchTab events to handle owner filter
    const handleSwitchTab = (e: CustomEvent) => {
      if (e.detail.tabId !== "dashboard") {
        return;
      }

      if (showOwnerFilter && e.detail.ownerFilter) {
        setOwnerFilter(e.detail.ownerFilter);
        setPendingOwnerFilter(e.detail.ownerFilter);
      }

      if (e.detail.dashboardScope === "mine" || e.detail.dashboardScope === "all") {
        setOwnTeamsOnly(e.detail.dashboardScope === "mine");
      }
    };
    
    const listener: EventListener = (event) => handleSwitchTab(event as CustomEvent);
    window.addEventListener("switchTab", listener);
    return () => window.removeEventListener("switchTab", listener);
  }, [showOwnerFilter]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedScope = window.sessionStorage.getItem(DASHBOARD_SCOPE_STORAGE_KEY);
    if (storedScope === "mine" || storedScope === "all") {
      setOwnTeamsOnly(storedScope === "mine");
    }
  }, []);

  // Apply pending owner filter after teams are loaded
  useEffect(() => {
    if (pendingOwnerFilter && teams.length > 0) {
      setOwnerFilter(pendingOwnerFilter);
      setPendingOwnerFilter(null);
    }
  }, [teams, pendingOwnerFilter]);

  useEffect(() => {
    if (typeof window === "undefined" || teams.length === 0) {
      return;
    }

    const focusTeamId = window.sessionStorage.getItem(TEAM_FOCUS_STORAGE_KEY);
    if (!focusTeamId || !teams.some((team) => team.id === focusTeamId)) {
      return;
    }

    window.sessionStorage.removeItem(TEAM_FOCUS_STORAGE_KEY);
    setExpandedTeam(focusTeamId);
    setViewMode("cards");
  }, [teams]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedSearch = window.sessionStorage.getItem(TEAM_SEARCH_STORAGE_KEY);
    if (!storedSearch) {
      return;
    }

    window.sessionStorage.removeItem(TEAM_SEARCH_STORAGE_KEY);
    setSearchQuery(storedSearch);
  }, []);

  useEffect(() => {
    if (marketplaceFocus) {
      setMarketplaceKindFilter("marketplace");
      setOwnTeamsOnly(false);
    }
  }, [marketplaceFocus]);

  // Filter and search logic
  const filteredTeams = useMemo(() => {
    return teams.filter(team => {
      const capabilities = getTeamCapabilities(team, { canEditAll, canEditOwnTeam: team.canCurrentUserEdit });
      // Category filter
      const matchesCategory = categoryFilter === "all" || team.category === categoryFilter;
      const matchesOwner =
        !showOwnerFilter ||
        ownerFilter === "all" ||
        normalizeEmail(team.ownerEmail || team.contactEmail) === normalizeEmail(ownerFilter);
      const matchesOwnTeam = !ownTeamsOnly || team.isCurrentUserTeam === true;
      const matchesCompleteness =
        !incompleteOnly || (canShowTeamActionStatus(team, showAdminDashboardInfo) && isTeamIncomplete(team));
      const matchesMarketplace =
        marketplaceKindFilter === "all" ||
        (marketplaceKindFilter === "marketplace" && capabilities.isMarketplaceTeam) ||
        (marketplaceKindFilter === "mtc" && capabilities.isMtcDraft) ||
        (marketplaceKindFilter === "single" && capabilities.isMarketplaceTeam && !capabilities.isMtcDraft);
      const matchesMarketplaceStatus =
        marketplaceStatusFilter === "all" ||
        (capabilities.isMarketplaceTeam && (team.marketplaceStatus || "NEW") === marketplaceStatusFilter);
      const matchesMarketplaceVisibility =
        marketplaceVisibilityFilter === "all" ||
        (capabilities.isMarketplaceTeam && (team.marketplaceVisibility || "ADMIN_MANAGEMENT_ONLY") === marketplaceVisibilityFilter);
      const matchesMarketplacePublication =
        marketplacePublicationFilter === "all" ||
        (capabilities.isMarketplaceTeam && (team.teamPublicationLevel || "TEAM_ANONYM") === marketplacePublicationFilter);
      const matchesOpenMtcSlots = !openMtcSlotsOnly || capabilities.hasOpenMtcSlots;
      const createdAtMs = team.createdAt ? new Date(team.createdAt).getTime() : Number.NaN;
      const createdFromMs = getDateTimeFilterTimestamp(createdFrom);
      const createdToMs = getDateTimeFilterTimestamp(createdTo);
      const matchesCreatedAt = !isAdmin || (Number.isNaN(createdAtMs)
        ? createdFrom === "" && createdTo === ""
        : (createdFromMs === null || createdAtMs >= createdFromMs) &&
          (createdToMs === null || createdAtMs <= createdToMs));
      
      // Search filter (team name, contact name, participant names)
      const matchesSearch = searchQuery === "" || 
        team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (team.contactName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (team.participants?.some(p => 
          `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
        ) ?? false);
      
      return matchesCategory &&
        matchesOwner &&
        matchesOwnTeam &&
        matchesCompleteness &&
        matchesMarketplace &&
        matchesMarketplaceStatus &&
        matchesMarketplaceVisibility &&
        matchesMarketplacePublication &&
        matchesOpenMtcSlots &&
        matchesCreatedAt &&
        matchesSearch;
    });
  }, [teams, categoryFilter, searchQuery, ownerFilter, ownTeamsOnly, incompleteOnly, marketplaceKindFilter, marketplaceStatusFilter, marketplaceVisibilityFilter, marketplacePublicationFilter, openMtcSlotsOnly, createdFrom, createdTo, showOwnerFilter, showAdminDashboardInfo, isAdmin, canEditAll]);

  const categories = [...new Set(teams.map(t => t.category))];
  const ownerOptions = [...new Set(teams.map((t) => t.ownerEmail || t.contactEmail).filter(Boolean))] as string[];
  const categoryStats = categories.map(cat => ({
    category: cat,
    count: teams.filter(t => t.category === cat).length
  }));
  const sortedTeams = useMemo(() => {
    const collator = new Intl.Collator("de", { numeric: true, sensitivity: "base" });

    return [...filteredTeams].sort((left, right) => {
      let result = 0;

      switch (sortField) {
        case "name":
          result = collator.compare(left.name, right.name);
          break;
        case "category":
          result = collator.compare(left.category, right.category);
          break;
        case "contactName":
          result = collator.compare(left.contactName || "", right.contactName || "");
          break;
        case "contactEmail":
          result = collator.compare(left.contactEmail || "", right.contactEmail || "");
          break;
        case "ownerEmail":
          result = collator.compare(left.ownerEmail || left.contactEmail || "", right.ownerEmail || right.contactEmail || "");
          break;
        case "participantCount":
          result = getParticipantCount(left) - getParticipantCount(right);
          break;
        case "createdAt":
          result = compareDates(left.createdAt, right.createdAt);
          break;
        case "updatedAt":
          result = compareDates(left.updatedAt, right.updatedAt);
          break;
      }

      if (result === 0) {
        if (!ownTeamsOnly && left.isCurrentUserTeam !== right.isCurrentUserTeam) {
          result = left.isCurrentUserTeam ? -1 : 1;
        }
      }

      if (result === 0) {
        result = collator.compare(left.name, right.name);
      }

      return sortDirection === "asc" ? result : -result;
    });
  }, [filteredTeams, ownTeamsOnly, sortField, sortDirection]);

  const visibleColumnDefs = listOptionalColumns.filter((column) => visibleColumns.includes(column.key));

  const categoryEmojis: { [key: string]: string } = {
    "schueler-a": "🧒",
    "schueler-b": "👦",
    jugend: "🌟", 
    jungsters: "⚡",
    herren: "🏋️",
    masters: "🎖️",
    "damen-a": "🏋️‍♀️",
    "damen-b": "👩‍🦳"
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          <p className="mt-4 text-muted-foreground">Lade Teams...</p>
        </CardContent>
      </Card>
    );
  }

  const incompleteTeams = teams.filter((team) => canShowTeamActionStatus(team, showAdminDashboardInfo) && isTeamIncomplete(team)).length;
  const marketplaceTeams = teams.filter((team) => team.registrationMode === "MARKETPLACE");
  const mtcTeams = marketplaceTeams.filter((team) => isMarketplaceMatchingTeam(team));
  const marketplaceSingleTeams = marketplaceTeams.filter((team) => !isMarketplaceMatchingTeam(team));
  const openMtcSlotTeams = mtcTeams.filter((team) => getTeamCapabilities(team, { canEditAll }).hasOpenMtcSlots);
  const marketplaceStatusCounts = MARKETPLACE_STATUS_OPTIONS.map((option) => ({
    ...option,
    count: marketplaceTeams.filter((team) => (team.marketplaceStatus || "NEW") === option.id).length,
  }));
  const marketplaceVisibilityCounts = MARKETPLACE_VISIBILITY_OPTIONS.map((option) => ({
    ...option,
    count: marketplaceTeams.filter((team) => (team.marketplaceVisibility || "ADMIN_MANAGEMENT_ONLY") === option.id).length,
  }));
  const marketplacePublicationCounts = TEAM_PUBLICATION_OPTIONS.map((option) => ({
    ...option,
    count: marketplaceTeams.filter((team) => (team.teamPublicationLevel || "TEAM_ANONYM") === option.id).length,
  }));
  const marketplacePotentiallyVisibleCount = marketplaceGlobalVisibility === "OFFLINE"
    ? 0
    : marketplaceTeams.filter((team) => (team.marketplaceVisibility || "ADMIN_MANAGEMENT_ONLY") !== "ADMIN_MANAGEMENT_ONLY").length;
  const hasActiveFilters =
    searchQuery !== "" ||
    categoryFilter !== "all" ||
    (showOwnerFilter && ownerFilter !== "all") ||
    ownTeamsOnly ||
    incompleteOnly ||
    marketplaceKindFilter !== (marketplaceFocus ? "marketplace" : "all") ||
    marketplaceStatusFilter !== "all" ||
    marketplaceVisibilityFilter !== "all" ||
    marketplacePublicationFilter !== "all" ||
    openMtcSlotsOnly ||
    (isAdmin && createdFrom !== "") ||
    (isAdmin && createdTo !== "");
  const activeFilterCount = [
    searchQuery !== "",
    categoryFilter !== "all",
    showOwnerFilter && ownerFilter !== "all",
    ownTeamsOnly,
    incompleteOnly,
    marketplaceKindFilter !== (marketplaceFocus ? "marketplace" : "all"),
    marketplaceStatusFilter !== "all",
    marketplaceVisibilityFilter !== "all",
    marketplacePublicationFilter !== "all",
    openMtcSlotsOnly,
    isAdmin && createdFrom !== "",
    isAdmin && createdTo !== "",
  ].filter(Boolean).length;
  const canEditOwn = can("team.edit.own");
  const maxCreatedDateTime = formatDateTimeLocalInput(new Date());

  const resetFilters = () => {
    setSearchQuery("");
    setCategoryFilter("all");
    setOwnerFilter(showOwnerFilter ? (initialOwnerFilter || "all") : "all");
    setOwnTeamsOnly(false);
    setIncompleteOnly(false);
    setMarketplaceKindFilter(marketplaceFocus ? "marketplace" : "all");
    setMarketplaceStatusFilter("all");
    setMarketplaceVisibilityFilter("all");
    setMarketplacePublicationFilter("all");
    setOpenMtcSlotsOnly(false);
    setCreatedFrom("");
    setCreatedTo("");
  };

  const handleHeaderSort = (field: TeamSortField) => {
    if (sortField === field) {
      setSortDirection((direction) => direction === "asc" ? "desc" : "asc");
      return;
    }

    setSortField(field);
    setSortDirection(field === "updatedAt" || field === "createdAt" ? "desc" : "asc");
  };

  const getHeaderSortState = (field: TeamSortField) => {
    if (sortField !== field) {
      return "inactive";
    }

    return sortDirection === "asc" ? "asc" : "desc";
  };

  const sortableHeaderFields: Partial<Record<"name" | TeamOptionalColumnKey, TeamSortField>> = {
    name: "name",
    category: "category",
    contactName: "contactName",
    contactEmail: "contactEmail",
    ownerEmail: "ownerEmail",
    participantCount: "participantCount",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  };
  const activeMarketplaceMatchingTeam = editingMarketplaceMatchingTeam
    ? teams.find((team) => team.id === editingMarketplaceMatchingTeam.id) ?? editingMarketplaceMatchingTeam
    : null;

  return (
    <div className="space-y-4">
      {marketplaceFocus && (
        <Card>
          <CardContent className="space-y-3 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">Statusüberblick</p>
                <p className="text-xs text-muted-foreground">
                  {marketplaceTeams.length} Börsen-Meldung(en), {marketplaceStatusCounts.find((entry) => entry.id === "NEW")?.count ?? 0} neu, {marketplacePotentiallyVisibleCount} potenziell sichtbar
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant="outline"
                  className={
                    marketplaceGlobalVisibility === "OFFLINE"
                      ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-200"
                      : "border-green-300 bg-green-50 text-green-800 dark:border-green-900/60 dark:bg-green-950/25 dark:text-green-200"
                  }
                >
                  {marketplaceGlobalVisibility === "OFFLINE" ? "Global offline" : "Selektiv sichtbar"}
                </Badge>
                <Button
                  type="button"
                  size="sm"
                  variant={
                    marketplaceStatusFilter === "all" &&
                    marketplaceVisibilityFilter === "all" &&
                    marketplacePublicationFilter === "all"
                      ? "default"
                      : "outline"
                  }
                  onClick={() => {
                    setMarketplaceKindFilter("marketplace");
                    setMarketplaceStatusFilter("all");
                    setMarketplaceVisibilityFilter("all");
                    setMarketplacePublicationFilter("all");
                    setOpenMtcSlotsOnly(false);
                  }}
                >
                  Alle anzeigen
                </Button>
                {canEditAll && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleCreateMarketplaceMatchingDraft}
                    disabled={creatingMatchingDraft}
                    aria-busy={creatingMatchingDraft}
                  >
                    {creatingMatchingDraft ? "Lege an..." : "MTC anlegen"}
                  </Button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              {marketplaceStatusCounts.map((status) => (
                <button
                  key={status.id}
                  type="button"
                  onClick={() => setMarketplaceStatusFilter(status.id)}
                  className={`rounded-md border p-3 text-left transition-colors hover:bg-accent ${
                    marketplaceStatusFilter === status.id ? "border-primary bg-primary/5" : "border-border/60 bg-background"
                  }`}
                >
                  <div className="text-2xl font-semibold">{status.count}</div>
                  <div className="text-xs text-muted-foreground">{status.label}</div>
                </button>
              ))}
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Börsen-Sichtbarkeit
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {marketplaceVisibilityCounts.map((visibility) => (
                    <button
                      key={visibility.id}
                      type="button"
                      onClick={() => setMarketplaceVisibilityFilter(visibility.id)}
                      className={`rounded-md border px-3 py-2 text-left text-xs transition-colors hover:bg-accent ${
                        marketplaceVisibilityFilter === visibility.id ? "border-primary bg-primary/5" : "border-border/60 bg-background"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{visibility.label}</span>
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[11px]">{visibility.count}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Veröffentlichung
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-1">
                  {marketplacePublicationCounts.map((publication) => (
                    <button
                      key={publication.id}
                      type="button"
                      onClick={() => setMarketplacePublicationFilter(publication.id)}
                      className={`rounded-md border px-3 py-2 text-left text-xs transition-colors hover:bg-accent ${
                        marketplacePublicationFilter === publication.id ? "border-primary bg-primary/5" : "border-border/60 bg-background"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{publication.label}</span>
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[11px]">{publication.count}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="rounded-md border border-border/60 bg-card/70 p-2.5 shadow-sm">
        <div className="space-y-1.5">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <Button
              size="sm"
              variant={viewMode === "cards" ? "default" : "outline"}
              onClick={() => setViewMode("cards")}
            >
              Kacheln
            </Button>
            <Button
              size="sm"
              variant={viewMode === "list" ? "default" : "outline"}
              onClick={() => setViewMode("list")}
            >
              Liste
            </Button>
            <Button
              type="button"
              size="xs"
              variant={ownTeamsOnly ? "default" : "outline"}
              onClick={() => setOwnTeamsOnly((current) => !current)}
              title="Eigene Mannschaften anzeigen"
              disabled={marketplaceFocus}
            >
              <Star className="size-3" />
              Meine
            </Button>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-8 pl-8 text-xs sm:h-9 sm:text-sm"
              placeholder={marketplaceFocus ? "Sportlerbörse, Kontakt oder Teilnehmer:in" : "Teamname, Team Manager:in oder Teilnehmer:in"}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between gap-1.5">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <Badge className="whitespace-nowrap" variant={hasActiveFilters ? "default" : "outline"}>
                {activeFilterCount} aktiv
              </Badge>
              {hasActiveFilters && (
                <Button className="whitespace-nowrap" size="xs" variant="outline" onClick={resetFilters}>
                  <X className="size-3" />
                  Filter löschen
                </Button>
              )}
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              {viewMode === "list" && (
                <Button
                  type="button"
                  size="xs"
                  variant={listOptionsOpen ? "default" : "outline"}
                  onClick={() => setListOptionsOpen((open) => !open)}
                >
                  Listenoptionen
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => setFiltersOpen((open) => !open)}
                aria-label={filtersOpen ? "Filter einklappen" : "Filter ausklappen"}
              >
                {filtersOpen ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
              </Button>
            </div>
          </div>
        </div>
        {filtersOpen && (
          <div className="mt-3 space-y-4 border-t border-border/60 pt-3">
            <div className="space-y-0.5">
              <CardTitle className="flex items-center gap-2 text-sm">
                <SlidersHorizontal className="size-4" />
                Filter & Suche
              </CardTitle>
              <p className="hidden text-xs text-muted-foreground sm:block">
                {showOwnerFilter
                  ? isAdmin
                    ? "Suche, Klasse, Anleger:in, Vollständigkeit und Zeitraum eingrenzen"
                    : "Suche, Klasse, Anleger:in und Vollständigkeit eingrenzen"
                  : isAdmin
                    ? "Suche, Klasse, Vollständigkeit und Zeitraum eingrenzen"
                    : "Suche, Klasse und Vollständigkeit eingrenzen"}
              </p>
            </div>

            {categories.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-muted-foreground">Klassen-Pillen (setzt direkt den Filter)</p>
                  <Button size="xs" variant={categoryFilter === "all" ? "default" : "outline"} onClick={() => setCategoryFilter("all")}>
                    Alle Klassen
                  </Button>
                </div>
                <div className="flex min-w-0 flex-wrap gap-1.5">
                  {categoryStats.map((cat) => (
                    <Button
                      key={cat.category}
                      size="xs"
                      variant={categoryFilter === cat.category ? "default" : "outline"}
                      onClick={() => setCategoryFilter(cat.category)}
                    >
                      <span>{categoryEmojis[cat.category] || "🏆"}</span>
                      {cat.category} ({cat.count})
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div
              className={`grid gap-4 md:grid-cols-2 ${
                showOwnerFilter
                  ? isAdmin
                    ? "xl:grid-cols-5"
                    : "xl:grid-cols-4"
                  : isAdmin
                    ? "xl:grid-cols-4"
                    : "xl:grid-cols-3"
              }`}
            >
              <div className="min-w-0 space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Klasse</label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Alle Klassen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Klassen</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {categoryEmojis[cat] || "🏆"} {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {showOwnerFilter && (
                <div className="min-w-0 space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Anleger:in</label>
                  <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Alle Anleger" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle Anleger</SelectItem>
                      {ownerOptions.map((owner) => (
                        <SelectItem key={owner} value={owner}>
                          {owner}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="min-w-0 space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Vollständigkeit</label>
                <Button
                  variant={incompleteOnly ? "default" : "outline"}
                  className="w-full justify-between"
                  onClick={() => setIncompleteOnly((current) => !current)}
                >
                  {incompleteOnly ? "Nur unvollständige" : "Alle Teams"}
                  <Badge variant={incompleteOnly ? "secondary" : "outline"}>{incompleteTeams}</Badge>
                </Button>
              </div>

              {isAdmin && (
                <div className="min-w-0 space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Meldungstyp</label>
                  <Select
                    value={marketplaceKindFilter}
                    onValueChange={(value) => {
                      const nextValue = value as MarketplaceKindFilter;
                      setMarketplaceKindFilter(nextValue);
                      if (nextValue !== "mtc") {
                        setOpenMtcSlotsOnly(false);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Alle Meldungen" />
                    </SelectTrigger>
                    <SelectContent>
                      {!marketplaceFocus && <SelectItem value="all">Alle Meldungen</SelectItem>}
                      <SelectItem value="marketplace">Sportlerbörse ({marketplaceTeams.length})</SelectItem>
                      <SelectItem value="mtc">MTC ({mtcTeams.length})</SelectItem>
                      <SelectItem value="single">Einzelmeldungen ({marketplaceSingleTeams.length})</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {isAdmin && (
                <>
                  <div className="min-w-0 space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Börsen-Status</label>
                    <Select value={marketplaceStatusFilter} onValueChange={(value) => setMarketplaceStatusFilter(value as MarketplaceStatusFilter)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Alle Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Alle Status</SelectItem>
                        {MARKETPLACE_STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="min-w-0 space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Börsen-Sichtbarkeit</label>
                    <Select value={marketplaceVisibilityFilter} onValueChange={(value) => setMarketplaceVisibilityFilter(value as MarketplaceVisibilityFilter)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Alle Sichtbarkeiten" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Alle Sichtbarkeiten</SelectItem>
                        {MARKETPLACE_VISIBILITY_OPTIONS.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="min-w-0 space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Veröffentlichung</label>
                    <Select value={marketplacePublicationFilter} onValueChange={(value) => setMarketplacePublicationFilter(value as MarketplacePublicationFilter)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Alle Veröffentlichungen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Alle Veröffentlichungen</SelectItem>
                        {TEAM_PUBLICATION_OPTIONS.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="min-w-0 space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">MTC-Slots</label>
                    <Button
                      variant={openMtcSlotsOnly ? "default" : "outline"}
                      className="w-full justify-between"
                      onClick={() => {
                        setOpenMtcSlotsOnly((current) => !current);
                        setMarketplaceKindFilter("mtc");
                      }}
                    >
                      {openMtcSlotsOnly ? "Nur offene MTCs" : "Alle MTCs"}
                      <Badge variant={openMtcSlotsOnly ? "secondary" : "outline"}>{openMtcSlotTeams.length}</Badge>
                    </Button>
                  </div>
                </>
              )}

              {isAdmin && (
                <div className="min-w-0 space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Angemeldet ab</label>
                  <Input
                    className="max-w-full"
                    type="datetime-local"
                    value={createdFrom}
                    max={maxCreatedDateTime}
                    onChange={(e) => setCreatedFrom(clampDateTimeLocalToNow(e.target.value))}
                    aria-label="Angemeldet ab"
                  />
                </div>
              )}

              {isAdmin && (
                <div className="min-w-0 space-y-1 md:col-span-2 xl:col-span-1">
                  <label className="text-xs font-medium text-muted-foreground">Angemeldet bis</label>
                  <Input
                    className="max-w-full"
                    type="datetime-local"
                    value={createdTo}
                    max={maxCreatedDateTime}
                    onChange={(e) => setCreatedTo(clampDateTimeLocalToNow(e.target.value))}
                    aria-label="Angemeldet bis"
                  />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                {hasActiveFilters ? "Aktive Filter können hier gesammelt zurückgesetzt werden." : "Noch keine zusätzlichen Filter aktiv."}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={resetFilters}
                  disabled={!hasActiveFilters}
                >
                  Filter zurücksetzen
                </Button>
                <Button type="button" onClick={fetchTeams} variant="outline">
                  <RotateCcw className="size-4" />
                  Aktualisieren
                </Button>
                {!(viewMode === "list" && listOptionsOpen) && (
                  <Button type="button" onClick={() => setFiltersOpen(false)} variant="outline">
                    <ChevronUp className="size-4" />
                    Filter zuklappen
                  </Button>
                )}
              </div>
            </div>

            {viewMode === "list" && listOptionsOpen && (
              <div className="space-y-4 border-t border-border/60 pt-4">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <ArrowDownUp className="size-4" />
                    Listenoptionen
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Sortierung festlegen, per Tabellenkopf umschalten und sichtbare Spalten anpassen
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-[minmax(0,260px)_200px]">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Sortieren nach</label>
                    <Select value={sortField} onValueChange={(value) => setSortField(value as TeamSortField)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sortierfeld wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {sortOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Reihenfolge</label>
                    <Button
                      variant="outline"
                      className="w-full justify-between"
                      onClick={() => setSortDirection((direction) => direction === "asc" ? "desc" : "asc")}
                    >
                      {sortDirection === "asc" ? "Aufsteigend" : "Absteigend"}
                      <ArrowDownUp className="size-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Sichtbare Spalten</p>
                  <div className="flex flex-wrap gap-2">
                    {listOptionalColumns.map((column) => {
                      const selected = visibleColumns.includes(column.key);
                      const disableRemoval = selected && visibleColumns.length === 1;

                      return (
                        <label
                          key={column.key}
                          className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${selected ? "border-primary bg-primary/5" : "border-border/60 bg-background"} ${disableRemoval ? "opacity-70" : "cursor-pointer hover:bg-muted/40"}`}
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={selected}
                            disabled={disableRemoval}
                            onChange={() => {
                              setVisibleColumns((current) => {
                                if (current.includes(column.key)) {
                                  if (current.length === 1) return current;
                                  return current.filter((entry) => entry !== column.key);
                                }

                                return [...current, column.key];
                              });
                            }}
                          />
                          <span>{column.label}</span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">Die Teamspalte bleibt immer sichtbar.</p>
                </div>

                <div className="flex flex-wrap justify-end gap-2 border-t border-border/60 pt-4">
                  <Button type="button" onClick={() => setListOptionsOpen(false)} variant="outline">
                    <ChevronUp className="size-4" />
                    Listenmenü zuklappen
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setListOptionsOpen(false);
                      setFiltersOpen(false);
                    }}
                    variant="outline"
                  >
                    <ChevronUp className="size-4" />
                    Filter zuklappen
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Team-Kacheln (kompakt) */}
      {filteredTeams.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">
              {teams.length === 0
                ? marketplaceFocus
                  ? "Noch keine Sportlerbörse-Meldungen vorhanden."
                  : "Noch keine Teams angemeldet."
                : "Keine Teams gefunden. Versuche eine andere Suche."}
            </p>
          </CardContent>
        </Card>
      ) : viewMode === "list" ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr className="border-b border-border/60">
                  <th className="px-4 py-3 font-medium">
                    <button
                      type="button"
                      onClick={() => handleHeaderSort("name")}
                      className="inline-flex items-center gap-2 transition-colors hover:text-foreground"
                    >
                      <span>Mannschaftsname</span>
                      {getHeaderSortState("name") === "inactive" ? (
                        <ArrowDownUp className="size-4 text-muted-foreground" />
                      ) : getHeaderSortState("name") === "asc" ? (
                        <ChevronUp className="size-4 text-foreground" />
                      ) : (
                        <ChevronDown className="size-4 text-foreground" />
                      )}
                    </button>
                  </th>
                  {visibleColumnDefs.map((column) => (
                    <th key={column.key} className="px-4 py-3 font-medium whitespace-nowrap">
                      {sortableHeaderFields[column.key] ? (
                        <button
                          type="button"
                          onClick={() => handleHeaderSort(sortableHeaderFields[column.key]!)}
                          className="inline-flex items-center gap-2 transition-colors hover:text-foreground"
                        >
                          <span>{column.label}</span>
                          {getHeaderSortState(sortableHeaderFields[column.key]!) === "inactive" ? (
                            <ArrowDownUp className="size-4 text-muted-foreground" />
                          ) : getHeaderSortState(sortableHeaderFields[column.key]!) === "asc" ? (
                            <ChevronUp className="size-4 text-foreground" />
                          ) : (
                            <ChevronDown className="size-4 text-foreground" />
                          )}
                        </button>
                      ) : (
                        column.label
                      )}
                    </th>
                  ))}
                  {(canEditAll || canEditOwn) && (
                    <th className="px-4 py-3 font-medium text-right">Aktionen</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {sortedTeams.map((team) => {
                  const capabilities = getTeamCapabilities(team, { canEditAll, canEditOwnTeam: team.canCurrentUserEdit });
                  const isEditable = team.canCurrentUserEdit === true && team.registrationMode !== "MARKETPLACE";
                  const isMarketplaceMatching = capabilities.isMtcDraft;
                  const marketplaceParticipant = team.registrationMode === "MARKETPLACE" ? team.participants?.[0] : null;
                  const canEditMarketplaceParticipant = Boolean(!isMarketplaceMatching && marketplaceParticipant?.id && (canEditAll || team.canCurrentUserEdit));
                  const canEditMarketplaceTeam = capabilities.canEditMarketplaceVisibility;
                  const canEditMarketplaceMatching = capabilities.canManageSlots;
                  const canDeleteTeam = team.canManageTeamManagers === true;

                  return (
                    <tr key={team.id} className="border-b border-border/50 align-top transition-colors hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <div className="font-medium">{team.name}</div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <MarketplaceTeamBadges team={team} />
                            <Badge variant="outline" className="gap-1">
                              <span>{categoryEmojis[team.category] || "🏆"}</span>
                              {team.category}
                            </Badge>
                            <span>{getParticipantCount(team)} / 5 Teilnehmer:innen</span>
                          </div>
                        </div>
                      </td>

                      {visibleColumnDefs.map((column) => {
                        let content: React.ReactNode = null;

                        switch (column.key) {
                          case "category":
                            content = (
                              <Badge variant="outline" className="gap-1">
                                <span>{categoryEmojis[team.category] || "🏆"}</span>
                                {team.category}
                              </Badge>
                            );
                            break;
                          case "contactName":
                            content = team.contactName || getContactFallbackLabel(team);
                            break;
                          case "contactEmail":
                            content = team.contactEmail || getContactFallbackLabel(team);
                            break;
                          case "ownerEmail":
                            content = team.ownerEmail || "Nicht sichtbar";
                            break;
                          case "participantCount":
                            content = getParticipantCount(team);
                            break;
                          case "participants":
                            content = (
                              <div className="max-w-sm whitespace-normal text-muted-foreground">
                                {getParticipantsSummary(team) || "Keine Teilnehmer erfasst"}
                              </div>
                            );
                            break;
                          case "createdAt":
                            content = team.createdAt ? new Date(team.createdAt).toLocaleString("de-DE") : "—";
                            break;
                          case "updatedAt":
                            content = team.updatedAt ? new Date(team.updatedAt).toLocaleString("de-DE") : "—";
                            break;
                        }

                        return (
                          <td key={column.key} className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                            {content}
                          </td>
                        );
                      })}

                      {(canEditAll || canEditOwn) && (
                        <td className="px-4 py-3">
                          {team.registrationMode === "MARKETPLACE" && (canEditMarketplaceParticipant || canEditMarketplaceTeam || canEditMarketplaceMatching || canDeleteTeam) ? (
                            <div className="flex justify-end gap-2">
                              {canEditMarketplaceMatching && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openMarketplaceMatching(team)}
                                >
                                  Entwurf bearbeiten
                                </Button>
                              )}
                              {canEditMarketplaceParticipant && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openParticipantDetails(team, marketplaceParticipant)}
                                >
                                  <Pencil className="size-3.5" />
                                  Person
                                </Button>
                              )}
                              {canEditMarketplaceTeam && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditingMarketplaceTeam(team)}
                                >
                                  Börse
                                </Button>
                              )}
                              {canDeleteTeam && (
                                <TeamDeleteDialog team={team} deleting={deleting} onDelete={handleDeleteTeam} />
                              )}
                            </div>
                          ) : isEditable ? (
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingTeam(team)}
                              >
                                ✏️ Bearbeiten
                              </Button>

                              {team.canManageTeamManagers && (
                                <TeamDeleteDialog team={team} deleting={deleting} onDelete={handleDeleteTeam} />
                              )}
                            </div>
                          ) : (
                            <div className="text-right text-xs text-muted-foreground">Keine Bearbeitung</div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            {sortedTeams.map((team) => {
              const completionMeta = getTeamCompletionMeta(team);
              const disciplineMeta = getTeamDisciplineMeta(team);
              const pendingChangeCount = getTeamPendingChangeCount(team);
              const CompletionIcon = completionMeta.icon;
              const DisciplineIcon = disciplineMeta.icon;
              const showActionStatus = canShowTeamActionStatus(team, showAdminDashboardInfo);
              const disciplineSlots = getTeamDisciplineSlots(team);
              const revealPrivateDashboardNames = canRevealPrivateDashboardName(team, isAdmin);
              const capabilities = getTeamCapabilities(team, { canEditAll, canEditOwnTeam: team.canCurrentUserEdit });
              const isMarketplaceMatching = capabilities.isMtcDraft;
              const marketplaceParticipant = team.registrationMode === "MARKETPLACE" ? team.participants?.[0] : null;
              const canEditMarketplaceParticipant = Boolean(!isMarketplaceMatching && marketplaceParticipant?.id && (canEditAll || team.canCurrentUserEdit));
              const canEditMarketplaceTeam = capabilities.canEditMarketplaceVisibility;
              const canEditMarketplaceMatching = capabilities.canManageSlots;
              const canDeleteTeam = team.canManageTeamManagers === true;
              const showCompactStatusRow =
                (showActionStatus && (completionMeta.isImportant || disciplineMeta.isImportant)) ||
                (showAdminDashboardInfo && pendingChangeCount > 0);

              return (
              <div key={team.id} className="space-y-2">
                {/* Team-Kachel mit Teilnehmern */}
                {expandedTeam !== team.id && (
                  <Card
                    className="cursor-pointer transition-colors hover:bg-muted/50"
                    onClick={() => {
                      setExpandedTeam(team.id);
                    }}
                  >
                    <CardContent className="p-2">
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-1.5">
                        <div className="min-w-0 space-y-1.5">
                          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                            <h3 className="min-w-0 truncate text-sm font-medium">{team.name}</h3>
                            <Badge variant="outline" className="h-6 shrink-0 gap-1 px-1.5 text-[10px]">
                              <span>{categoryEmojis[team.category] || "🏆"}</span>
                              {team.category}
                            </Badge>
                            <MarketplaceTeamBadges team={team} compact />
                            {team.isCurrentUserTeam && (
                              <Badge variant="secondary" className="h-6 px-1.5 text-[10px]">
                                <Star className="size-3" />
                                Mein Team
                              </Badge>
                            )}
                          </div>
                          {team.registrationMode === "MARKETPLACE" && !isMarketplaceMatching ? (
                            <MarketplacePersonSummary
                              team={team}
                              participant={marketplaceParticipant}
                              revealPrivateName={revealPrivateDashboardNames}
                            />
                          ) : (
                            <div className="grid gap-1 sm:grid-cols-5">
                              {disciplineSlots.map(({ discipline, participant }) => {
                                const participantIndex = participant ? (team.participants ?? []).indexOf(participant) : -1;
                                const participantLabel = participant
                                  ? getDashboardParticipantLabel(team, participant, participantIndex, {
                                      revealPrivateName: revealPrivateDashboardNames,
                                    })
                                  : "Offen";
                                const canOpenParticipant = Boolean(
                                  participant?.id &&
                                    (canEditAll ||
                                      team.canCurrentUserEdit ||
                                      (participant.isCurrentUserParticipant && can("participant.edit.self"))),
                                );
                                const canFillMarketplaceSlot = Boolean(capabilities.canSearchParticipants && !participant);
                                const canUseSlotAction = canOpenParticipant || canFillMarketplaceSlot;

                                return (
                                  <div
                                    key={discipline.id}
                                    className={`flex min-h-8 min-w-0 items-center gap-1.5 rounded-md border border-border/50 bg-background/70 px-2 py-1 ${
                                      canUseSlotAction ? "cursor-pointer transition-colors hover:border-primary/40 hover:bg-primary/5" : ""
                                    }`}
                                    title={participant ? `${participantLabel} öffnen` : `${discipline.label}: Teilnehmer suchen`}
                                    role={canUseSlotAction ? "button" : undefined}
                                    tabIndex={canUseSlotAction ? 0 : undefined}
                                    onClick={(event) => {
                                      if (!canUseSlotAction) return;
                                      event.stopPropagation();
                                      if (participant) {
                                        openParticipantDetails(team, participant);
                                      } else {
                                        openMarketplaceMatching(team, discipline.id);
                                      }
                                    }}
                                    onKeyDown={(event) => {
                                      if (!canUseSlotAction || (event.key !== "Enter" && event.key !== " ")) return;
                                      event.preventDefault();
                                      event.stopPropagation();
                                      if (participant) {
                                        openParticipantDetails(team, participant);
                                      } else {
                                        openMarketplaceMatching(team, discipline.id);
                                      }
                                    }}
                                  >
                                    <span className="shrink-0 text-sm" aria-hidden="true">{discipline.icon}</span>
                                    <span className="min-w-0 truncate text-xs font-medium leading-5 text-foreground">
                                      {participantLabel}
                                    </span>
                                    {participant && (
                                      <ParticipantPublicationPreferenceIcon
                                        preference={participant.participantPublicationPreference}
                                        teamPublicationLevel={team.teamPublicationLevel}
                                      />
                                    )}
                                    {participant && <MarketplaceParticipantBadges team={team} participant={participant} compact />}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {marketplaceFocus && team.registrationMode === "MARKETPLACE" && team.createdAt && (
                            <div className="text-xs text-muted-foreground">Gemeldet: {formatDatePart(team.createdAt)}</div>
                          )}
                          {showCompactStatusRow && (
                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                              {showActionStatus && completionMeta.isImportant && (
                                <Badge variant="outline" className={`h-5 gap-1 px-1.5 text-[10px] ${completionMeta.toneClass}`}>
                                  <CompletionIcon className="size-3" />
                                  {completionMeta.label}
                                </Badge>
                              )}
                              {showActionStatus && disciplineMeta.isImportant && (
                                <Badge variant="outline" className={`h-5 gap-1 px-1.5 text-[10px] ${disciplineMeta.toneClass}`}>
                                  <DisciplineIcon className="size-3" />
                                  {disciplineMeta.label}
                                </Badge>
                              )}
                              {showAdminDashboardInfo && pendingChangeCount > 0 && (
                                <Badge variant="outline" className="h-5 gap-1 border-amber-300 bg-amber-50 px-1.5 text-[10px] text-amber-800">
                                  <ClipboardList className="size-3" />
                                  {pendingChangeCount} Änderung(en)
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                          <div className="flex items-start justify-end">
                          <div className="flex flex-col gap-1">
                            {canEditMarketplaceMatching && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 shrink-0 px-2 text-[11px]"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openMarketplaceMatching(team);
                                }}
                              >
                                Entwurf
                              </Button>
                            )}
                            {canEditMarketplaceParticipant && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 shrink-0 px-2 text-[11px]"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openParticipantDetails(team, marketplaceParticipant);
                                }}
                              >
                                Person
                              </Button>
                            )}
                            {canEditMarketplaceTeam && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 shrink-0 px-2 text-[11px]"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setEditingMarketplaceTeam(team);
                                }}
                              >
                                Börse
                              </Button>
                            )}
                            {canDeleteTeam && team.registrationMode === "MARKETPLACE" && (
                              <TeamDeleteDialog
                                team={team}
                                deleting={deleting}
                                onDelete={handleDeleteTeam}
                                className="h-7 shrink-0 px-2 text-[11px]"
                                onTriggerClick={(event) => event.stopPropagation()}
                              />
                            )}
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 shrink-0 px-2 text-[11px]"
                              onClick={(event) => {
                                event.stopPropagation();
                                setExpandedTeam(team.id);
                              }}
                            >
                              Details
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Expandierte Detail-View */}
                <AnimatePresence>
                  {expandedTeam === team.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Card className="border-l-4 border-l-primary shadow-sm">
                        <CardContent className="space-y-2 p-2">
                          <div className="flex flex-wrap items-center justify-between gap-1.5">
                            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                              <h3 className="min-w-0 truncate text-base font-semibold">{team.name}</h3>
                              <Badge variant="outline" className="h-6 shrink-0 gap-1 px-1.5 text-[10px]">
                                <span>{categoryEmojis[team.category] || "🏆"}</span>
                                {team.category}
                              </Badge>
                              <MarketplaceTeamBadges team={team} compact subtle={expandedTeam === team.id} />
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                              {canEditMarketplaceParticipant && (
                                <Button
                                  size="xs"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openParticipantDetails(team, marketplaceParticipant);
                                  }}
                                >
                                  <Pencil className="size-3.5" />
                                  Person
                                </Button>
                              )}
                              {canEditMarketplaceMatching && (
                                <Button
                                  size="xs"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openMarketplaceMatching(team);
                                  }}
                                >
                                  Entwurf
                                </Button>
                              )}
                              {canEditMarketplaceTeam && (
                                <Button
                                  size="xs"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingMarketplaceTeam(team);
                                  }}
                                >
                                  Börse
                                </Button>
                              )}
                              {canDeleteTeam && team.registrationMode === "MARKETPLACE" && (
                                <TeamDeleteDialog
                                  team={team}
                                  deleting={deleting}
                                  onDelete={handleDeleteTeam}
                                  className="h-6 px-2 text-xs"
                                  onTriggerClick={(event) => event.stopPropagation()}
                                />
                              )}
                              {team.canCurrentUserEdit && team.registrationMode !== "MARKETPLACE" && (
                                <Button
                                  size="xs"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingTeam(team);
                                  }}
                                >
                                  Bearbeiten
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedTeam(null);
                                }}
                                className="h-8 w-8 shrink-0 p-0"
                                aria-label="Details schließen"
                              >
                                <X className="size-4" />
                              </Button>
                            </div>
                          </div>

                          {((showActionStatus && (completionMeta.isImportant || disciplineMeta.isImportant)) ||
                            (showAdminDashboardInfo && pendingChangeCount > 0) ||
                            team.isCurrentUserTeam) && (
                            <div className="flex flex-wrap gap-1">
                              {showActionStatus && completionMeta.isImportant && (
                                <Badge variant="outline" className={`h-5 gap-1 px-1.5 text-[10px] ${completionMeta.toneClass}`}>
                                  <CompletionIcon className="size-3" />
                                  {completionMeta.label}
                                </Badge>
                              )}
                              {showActionStatus && disciplineMeta.isImportant && (
                                <Badge variant="outline" className={`h-5 gap-1 px-1.5 text-[10px] ${disciplineMeta.toneClass}`}>
                                  <DisciplineIcon className="size-3" />
                                  {disciplineMeta.label}
                                </Badge>
                              )}
                              {showAdminDashboardInfo && pendingChangeCount > 0 && (
                                <Badge variant="outline" className="h-5 gap-1 border-amber-300 bg-amber-50 px-1.5 text-[10px] text-amber-800">
                                  <ClipboardList className="size-3" />
                                  {pendingChangeCount} Änderung(en)
                                </Badge>
                              )}
                              {team.isCurrentUserTeam && (
                                <Badge variant="secondary" className="h-5 gap-1 px-1.5 text-[10px]">
                                  <Star className="size-3" />
                                  Eigenes Team
                                </Badge>
                              )}
                            </div>
                          )}

                          {team.registrationMode === "MARKETPLACE" && (
                            <div className={isMarketplaceMatching ? "space-y-1 text-xs text-muted-foreground" : "grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.85fr)]"}>
                              {!isMarketplaceMatching && (
                                <MarketplacePersonSummary
                                  team={team}
                                  participant={marketplaceParticipant}
                                  revealPrivateName={revealPrivateDashboardNames}
                                />
                              )}
                              <div className={isMarketplaceMatching ? "flex flex-wrap gap-x-3 gap-y-1" : "space-y-2 rounded-md border border-border/60 bg-muted/20 p-2 text-xs"}>
                                {team.contactName && <span>{team.contactName}</span>}
                                {team.contactEmail && <span>{team.contactEmail}</span>}
                                {team.createdAt && <span>Gemeldet: {formatDatePart(team.createdAt)}</span>}
                                {team.marketplaceMessage?.trim() && <span className="truncate">Notiz: {team.marketplaceMessage}</span>}
                              </div>
                            </div>
                          )}

                          {(team.registrationMode !== "MARKETPLACE" || isMarketplaceMatching) && (
                            <div className="space-y-1">
                              <div className="grid gap-1 md:grid-cols-5">
                                {disciplineSlots.map(({ discipline, participant }) => {
                                  const participantIndex = participant ? (team.participants ?? []).indexOf(participant) : -1;
                                  const participantLabel = participant
                                    ? getDashboardParticipantLabel(team, participant, participantIndex, {
                                        revealPrivateName: revealPrivateDashboardNames,
                                      })
                                    : "Noch offen";
                                  const canManageModerationNote = Boolean(participant) && (canEditAll || team.canCurrentUserEdit === true);
                                  const emailInviteMeta = participant && canEditAll
                                    ? getEmailInvitationMeta(participant.emailInvitation?.status || (participant.email ? "none" : "missing_email"))
                                    : null;
                                  const latestChangeMeta = participant ? getLatestChangeMeta(participant.latestChange?.status) : null;
                                  const participantAccessMeta = participant ? getParticipantAccessMeta(team, participant) : null;
                                  const showRights = Boolean(participant && (participant.isTeamManager || participant.canBeTeamManager || canEditAll));
                                  const canOpenParticipant = Boolean(
                                    participant?.id &&
                                      (canEditAll ||
                                        team.canCurrentUserEdit ||
                                        (participant.isCurrentUserParticipant && can("participant.edit.self"))),
                                  );
                                  const canFillMarketplaceSlot = Boolean(capabilities.canSearchParticipants && !participant);
                                  const canUseSlotAction = canOpenParticipant;
                                  const assignedDisciplineId = participant?.discipline || participant?.disciplineCode || "TBD";
                                  const desiredDisciplineId = participant?.marketplaceReturnDisciplineCode || assignedDisciplineId;
                                  const participantByDiscipline = new Map(
                                    (team.participants ?? [])
                                      .map((entry) => [entry.discipline || entry.disciplineCode, entry] as const)
                                      .filter(([value]) => Boolean(value) && value !== "TBD"),
                                  );

                                  return (
                                    <div
                                      key={discipline.id}
                                      className={`flex min-w-0 flex-col gap-1 rounded-md border border-border/60 bg-background p-1.5 text-xs ${
                                        canUseSlotAction ? "cursor-pointer transition-colors hover:border-primary/40 hover:bg-primary/5" : ""
                                      }`}
                                      role={canUseSlotAction ? "button" : undefined}
                                      tabIndex={canUseSlotAction ? 0 : undefined}
                                      onClick={() => {
                                        if (!canUseSlotAction) return;
                                        if (participant) {
                                          openParticipantDetails(team, participant);
                                        }
                                      }}
                                      onKeyDown={(event) => {
                                        if (!canUseSlotAction || (event.key !== "Enter" && event.key !== " ")) return;
                                        event.preventDefault();
                                        if (participant) {
                                          openParticipantDetails(team, participant);
                                        }
                                      }}
                                    >
                                      <div className="flex min-w-0 items-center gap-2">
                                        <span
                                          className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/30 text-base"
                                          title={discipline.label}
                                        >
                                          {discipline.icon}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                          <p className="truncate text-[10px] font-medium uppercase text-muted-foreground" title={discipline.label}>
                                            {discipline.label}
                                          </p>
                                          <div className="flex min-w-0 items-center gap-1.5">
                                            <p className="min-w-0 truncate text-sm font-medium" title={participantLabel}>
                                              {participantLabel}
                                            </p>
                                            {participant && (
                                              <ParticipantPublicationPreferenceIcon
                                                preference={participant.participantPublicationPreference}
                                                teamPublicationLevel={team.teamPublicationLevel}
                                              />
                                            )}
                                          </div>
                                        </div>
                                      </div>

                                      {((participant && isMarketplaceMatching) || latestChangeMeta || emailInviteMeta || showRights) && (
                                        <div className="flex min-w-0 flex-wrap gap-1">
                                          {participant && <MarketplaceParticipantBadges team={team} participant={participant} />}
                                          {latestChangeMeta && (
                                            <Badge
                                              variant="outline"
                                              className={`h-5 max-w-full justify-center px-1.5 text-[10px] ${latestChangeMeta.className} ${canUseAdminLinks ? "cursor-pointer" : ""}`}
                                              onClick={(event) => {
                                                event.stopPropagation();
                                                if (canUseAdminLinks) {
                                                  openChangesDashboard({
                                                    participantId: participant?.id,
                                                    teamId: team.id,
                                                    status: participant?.latestChange?.status as "PENDING" | "APPROVED" | "REJECTED" | undefined,
                                                  });
                                                }
                                              }}
                                              role={canUseAdminLinks ? "link" : undefined}
                                              title={canUseAdminLinks ? "Zum Änderungsdashboard" : undefined}
                                            >
                                              {latestChangeMeta.label}
                                            </Badge>
                                          )}
                                          {emailInviteMeta && (
                                            <Badge
                                              variant="outline"
                                              className={`h-5 max-w-full justify-center gap-1 px-1.5 text-[10px] ${emailInviteMeta.className} ${canUseAdminLinks && (participant?.linkedUserId || participant?.email) ? "cursor-pointer" : ""}`}
                                              onClick={(event) => {
                                                event.stopPropagation();
                                                if (canUseAdminLinks && (participant?.linkedUserId || participant?.email)) {
                                                  openUserDashboard({ userId: participant.linkedUserId, email: participant.email, teamId: team.id });
                                                }
                                              }}
                                              role={canUseAdminLinks && (participant?.linkedUserId || participant?.email) ? "link" : undefined}
                                              title={canUseAdminLinks && (participant?.linkedUserId || participant?.email) ? "Benutzerverwaltung öffnen" : undefined}
                                            >
                                              <Mail className="size-3" />
                                              {emailInviteMeta.label}
                                            </Badge>
                                          )}

                                          {showRights && participant && (
                                            <Badge
                                              variant="outline"
                                              className={`h-5 max-w-full justify-center px-1.5 text-[10px] ${participantAccessMeta?.className ?? "border-muted text-muted-foreground"} ${canUseAdminLinks && participant.isTeamManager && participant.linkedUserId ? "cursor-pointer" : ""}`}
                                              onClick={(event) => {
                                                event.stopPropagation();
                                                if (canUseAdminLinks && participant.isTeamManager && participant.linkedUserId) {
                                                  openUserDashboard({ userId: participant.linkedUserId, teamId: team.id });
                                                }
                                              }}
                                              role={canUseAdminLinks && participant.isTeamManager && participant.linkedUserId ? "link" : undefined}
                                              title={canUseAdminLinks && participant.isTeamManager && participant.linkedUserId ? "Benutzerverwaltung öffnen" : undefined}
                                            >
                                              {participantAccessMeta?.label ?? "Kein Portal-Konto"}
                                            </Badge>
                                          )}
                                        </div>
                                      )}

                                      {participant && isMarketplaceMatching && desiredDisciplineId !== assignedDisciplineId && (
                                        <div className="rounded border border-amber-300/60 bg-amber-50 px-1.5 py-1 text-[10px] text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
                                          Wunsch: {getDisciplineLabel(desiredDisciplineId)}
                                        </div>
                                      )}

                                      {participant ? (
                                        <div className="mt-auto flex flex-wrap gap-1">
                                          {canEditMarketplaceMatching && participant.id && (
                                            <div className="w-full" onClick={(event) => event.stopPropagation()}>
                                              <Select
                                                value={assignedDisciplineId}
                                                onValueChange={(value) => {
                                                  if (value !== assignedDisciplineId && participant.id) {
                                                    void handleMarketplaceMatchingMove(team.id, participant.id, value);
                                                  }
                                                }}
                                              >
                                                <SelectTrigger className="h-7 text-[10px]" title="Zugeordneten MTC-Slot ändern">
                                                  <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  {DISCIPLINES.map((slotOption) => {
                                                    const slotParticipant = participantByDiscipline.get(slotOption.id);
                                                    const isSwapTarget = Boolean(slotParticipant && slotParticipant.id !== participant.id);

                                                    return (
                                                      <SelectItem key={slotOption.id} value={slotOption.id}>
                                                        {slotOption.icon} Slot: {slotOption.label}
                                                        {isSwapTarget && slotParticipant ? ` - tauschen mit ${getParticipantDisplayName(slotParticipant)}` : ""}
                                                      </SelectItem>
                                                    );
                                                  })}
                                                </SelectContent>
                                              </Select>
                                            </div>
                                          )}
                                          {canManageModerationNote && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              openParticipantDetails(team, participant);
                                            }}
                                            className={`min-h-7 flex-1 rounded border px-2 py-0.5 text-[10px] transition-colors ${participant.moderationNote?.trim() ? "border-primary/40 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground hover:text-primary"}`}
                                            title="Moderationshinweis bearbeiten"
                                          >
                                            {participant.moderationNote?.trim() ? "Notiz" : "Notiz +"}
                                          </button>
                                          )}
                                          {isMarketplaceMatching && canEditAll && participant.id && (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                openParticipantDetails(team, participant);
                                              }}
                                              className="min-h-7 flex-1 rounded border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:text-primary"
                                              title="Teilnehmerdialog mit Einladung öffnen"
                                            >
                                              Einladung
                                            </button>
                                          )}
                                          {(team.canCurrentUserEdit || (participant.isCurrentUserParticipant && can("participant.edit.self"))) && (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                openParticipantDetails(team, participant);
                                              }}
                                              className="min-h-7 flex-1 rounded border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:text-primary"
                                              title="Teilnehmer bearbeiten"
                                            >
                                              Bearbeiten
                                            </button>
                                          )}
                                        </div>
                                      ) : canFillMarketplaceSlot ? (
                                        <MarketplaceSlotSearchPopover
                                          team={team}
                                          competitionId={activeCompetition?.id}
                                          discipline={discipline}
                                          assignedParticipants={team.participants ?? []}
                                          onAddParticipant={handleMarketplaceMatchingAdd}
                                        />
                                      ) : null}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          <div className="flex flex-col gap-1.5 border-t border-border/60 pt-2 sm:flex-row sm:items-center sm:justify-end">
                            {canEditMarketplaceParticipant && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openParticipantDetails(team, marketplaceParticipant);
                                }}
                                className="flex-1"
                              >
                                <Pencil className="size-4" />
                                Person bearbeiten
                              </Button>
                            )}
                            {canEditMarketplaceMatching && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openMarketplaceMatching(team);
                                }}
                                className="flex-1"
                              >
                                Entwurf bearbeiten
                              </Button>
                            )}
                            {canDeleteTeam && team.registrationMode === "MARKETPLACE" && (
                              <TeamDeleteDialog
                                team={team}
                                deleting={deleting}
                                onDelete={handleDeleteTeam}
                                className="flex-1"
                                onTriggerClick={(event) => event.stopPropagation()}
                              />
                            )}
                            {team.canCurrentUserEdit && team.registrationMode !== "MARKETPLACE" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingTeam(team);
                                  }}
                                  className="flex-1"
                                >
                                  ✏️ Bearbeiten
                                </Button>

                                {team.canManageTeamManagers && (
                                  <TeamDeleteDialog
                                    team={team}
                                    deleting={deleting}
                                    onDelete={handleDeleteTeam}
                                    className="flex-1"
                                    onTriggerClick={(event) => event.stopPropagation()}
                                  />
                                )}
                              </>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedTeam(null);
                              }}
                              className="flex-1"
                            >
                              <ChevronUp className="size-4" />
                              Zuklappen
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Edit Team Modal */}
      {editingTeam && (
        <EditTeamModal 
          team={editingTeam}
          onSave={handleEditTeam}
          onCancel={() => setEditingTeam(null)}
          showAdminInfo={canEditAll}
          canManageTeamManagers={editingTeam.canManageTeamManagers === true}
        />
      )}
      {editingMarketplaceTeam && (
        <EditMarketplaceTeamModal
          team={editingMarketplaceTeam}
          onSave={handleMarketplaceTeamEdit}
          onCancel={() => setEditingMarketplaceTeam(null)}
        />
      )}
      {activeMarketplaceMatchingTeam && (
        <MarketplaceMatchingModal
          team={activeMarketplaceMatchingTeam}
          competitionId={activeCompetition?.id}
          initialDisciplineFilter={marketplaceMatchingDisciplineFilter}
          onAddParticipant={handleMarketplaceMatchingAdd}
          onMoveParticipant={handleMarketplaceMatchingMove}
          onRemoveParticipant={handleMarketplaceMatchingRemove}
          onSaveMetadata={async (targetTeamId, metadata) => {
            await saveMarketplaceTeamMetadata(targetTeamId, metadata);
            await fetchTeams();
            notifications.success("Entwurf gespeichert", "MTC-Daten und Admin-Infos wurden aktualisiert.");
          }}
          onFinalize={handleMarketplaceMatchingFinalize}
          onCancel={() => setEditingMarketplaceMatchingTeam(null)}
        />
      )}

      {/* Participant Edit Dialog */}
      <ParticipantEditDialog
        participant={editingParticipant}
        open={!!editingParticipant}
        onOpenChange={(open) => { if (!open) setEditingParticipant(null); }}
        onSaved={() => { setEditingParticipant(null); fetchTeams(); }}
        directEdit={canEditAll}
        isAdminEdit={canEditAll}
        showModerationNote={canEditAll || editingParticipant?.teamCanEdit === true || normalizeEmail(editingParticipant?.teamOwnerEmail) === normalizeEmail(userEmail)}
      />
    </div>
  );
}

function MarketplaceMatchingModal({
  team,
  competitionId,
  initialDisciplineFilter,
  onAddParticipant,
  onMoveParticipant,
  onRemoveParticipant,
  onSaveMetadata,
  onFinalize,
  onCancel,
}: {
  team: Team;
  competitionId?: string;
  initialDisciplineFilter?: string;
  onAddParticipant: (targetTeamId: string, participantId: string, targetDiscipline?: string) => void | Promise<void>;
  onMoveParticipant: (targetTeamId: string, participantId: string, targetDiscipline: string) => void | Promise<void>;
  onRemoveParticipant: (targetTeamId: string, participantId: string) => void | Promise<void>;
  onSaveMetadata: (targetTeamId: string, data: MarketplaceTeamEditPayload) => void | Promise<void>;
  onFinalize: (targetTeamId: string, data: MarketplaceMatchingFinalizePayload) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [availableParticipants, setAvailableParticipants] = useState<MarketplaceAvailableParticipant[]>([]);
  const [query, setQuery] = useState("");
  const [openSearchSlotId, setOpenSearchSlotId] = useState<string | null>(initialDisciplineFilter || null);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [busyParticipantId, setBusyParticipantId] = useState<string | null>(null);
  const [savingMetadata, setSavingMetadata] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState<MarketplaceMatchingFinalizePayload>({
    teamName: getMarketplaceDraftTeamName(team.name),
    contactName: team.contactName || "",
    contactEmail: team.contactEmail || "",
    teamPublicationLevel: team.teamPublicationLevel || "TEAM_ANONYM",
  });
  const [metadataForm, setMetadataForm] = useState<MarketplaceTeamEditPayload>({
    teamPublicationLevel: team.teamPublicationLevel || "TEAM_ANONYM",
    marketplaceVisibility: team.marketplaceVisibility || "ADMIN_MANAGEMENT_ONLY",
    marketplaceStatus: team.marketplaceStatus || "MATCHING",
    marketplaceMessage: team.marketplaceMessage || "",
  });
  const assignedParticipants = team.participants ?? [];
  const assignedParticipantIds = new Set(assignedParticipants.map((participant) => participant.id).filter(Boolean));
  const assignedDisciplineSlots = getTeamDisciplineSlots(team);
  const canReleaseAssignedParticipants = assignedParticipants.length > 1;
  const getSlotSearchParticipants = (slotDisciplineId: string) => availableParticipants.filter((participant) => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return true;
    return [
      participant.name,
      participant.email,
      participant.disciplineCode,
      participant.teamName,
      participant.marketplaceStatus,
    ].some((value) => value.toLowerCase().includes(normalizedQuery));
  }).sort((left, right) => {
    const leftMatchesSlot = left.disciplineCode === slotDisciplineId ? 0 : 1;
    const rightMatchesSlot = right.disciplineCode === slotDisciplineId ? 0 : 1;
    if (leftMatchesSlot !== rightMatchesSlot) return leftMatchesSlot - rightMatchesSlot;
    return left.name.localeCompare(right.name, "de");
  });
  const draftEvaluation = evaluateTeamDraft({
    mode: "admin-edit",
    teamName: formData.teamName || "Börsen-Mannschaft",
    participants: assignedParticipants.map((participant) => ({
      firstName: participant.firstName,
      lastName: participant.lastName,
      birthDate: participant.birthDate,
      gender: participant.gender === "W" || participant.gender === "FEMALE" ? "W" : "M",
      discipline: participant.discipline || participant.disciplineCode || "TBD",
    })),
    oldClassificationCode: team.category,
  });
  const canFinalize =
    assignedParticipants.length === 5 &&
    formData.teamName.trim().length >= 3 &&
    formData.contactName.trim().length >= 2 &&
    isValidEmail(formData.contactEmail) &&
    draftEvaluation.blockingErrors.length === 0;

  const loadAvailableParticipants = useCallback(async () => {
    setLoadingAvailable(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (competitionId) params.set("competitionId", competitionId);
      params.set("targetTeamId", team.id);
      const response = await fetch(`/api/admin/marketplace-matching?${params.toString()}`);
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Börsen-Teilnehmer konnten nicht geladen werden.");
      }
      setAvailableParticipants(Array.isArray(data?.availableParticipants) ? data.availableParticipants : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Börsen-Teilnehmer konnten nicht geladen werden.");
    } finally {
      setLoadingAvailable(false);
    }
  }, [competitionId, team.id]);

  useEffect(() => {
    void loadAvailableParticipants();
  }, [loadAvailableParticipants]);

  useEffect(() => {
    setOpenSearchSlotId(initialDisciplineFilter || null);
    setQuery("");
  }, [initialDisciplineFilter, team.id]);

  useEffect(() => {
    setFormData((current) => ({
      ...current,
      teamName: current.teamName || getMarketplaceDraftTeamName(team.name),
      contactName: current.contactName || team.contactName || "",
      contactEmail: current.contactEmail || team.contactEmail || "",
      teamPublicationLevel: current.teamPublicationLevel || team.teamPublicationLevel || "TEAM_ANONYM",
    }));
    setMetadataForm({
      teamPublicationLevel: team.teamPublicationLevel || "TEAM_ANONYM",
      marketplaceVisibility: team.marketplaceVisibility || "ADMIN_MANAGEMENT_ONLY",
      marketplaceStatus: team.marketplaceStatus || "MATCHING",
      marketplaceMessage: team.marketplaceMessage || "",
    });
  }, [team.contactEmail, team.contactName, team.marketplaceMessage, team.marketplaceStatus, team.marketplaceVisibility, team.name, team.teamPublicationLevel]);

  const handleAdd = async (participantId: string, targetDiscipline?: string) => {
    setBusyParticipantId(participantId);
    setError("");
    try {
      await onAddParticipant(team.id, participantId, targetDiscipline);
      setAvailableParticipants((current) => current.filter((participant) => participant.id !== participantId));
      setOpenSearchSlotId(null);
      setQuery("");
      await loadAvailableParticipants();
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : "Teilnehmer konnte nicht zugeordnet werden.");
    } finally {
      setBusyParticipantId(null);
    }
  };

  const handleMove = async (participantId: string | undefined, targetDiscipline: string) => {
    if (!participantId) return;
    setBusyParticipantId(participantId);
    setError("");
    try {
      await onMoveParticipant(team.id, participantId, targetDiscipline);
    } catch (moveError) {
      setError(moveError instanceof Error ? moveError.message : "Slot-Zuordnung konnte nicht geändert werden.");
    } finally {
      setBusyParticipantId(null);
    }
  };

  const handleRemove = async (participantId?: string) => {
    if (!participantId) return;
    setBusyParticipantId(participantId);
    setError("");
    try {
      await onRemoveParticipant(team.id, participantId);
      await loadAvailableParticipants();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Teilnehmer konnte nicht entfernt werden.");
    } finally {
      setBusyParticipantId(null);
    }
  };

  const handleSaveDraft = async () => {
    setSavingMetadata(true);
    setError("");
    try {
      await onSaveMetadata(team.id, {
        teamName: formData.teamName.trim() || team.name,
        contactName: formData.contactName.trim(),
        contactEmail: formData.contactEmail.trim(),
        teamPublicationLevel: formData.teamPublicationLevel,
        marketplaceVisibility: metadataForm.marketplaceVisibility,
        marketplaceStatus: metadataForm.marketplaceStatus,
        marketplaceMessage: metadataForm.marketplaceMessage,
      });
    } catch (metadataError) {
      setError(metadataError instanceof Error ? metadataError.message : "Entwurf konnte nicht gespeichert werden.");
    } finally {
      setSavingMetadata(false);
    }
  };

  const handleFinalize = async () => {
    if (!canFinalize) return;
    setFinalizing(true);
    setError("");
    try {
      await onFinalize(team.id, {
        teamName: formData.teamName.trim(),
        contactName: formData.contactName.trim(),
        contactEmail: formData.contactEmail.trim(),
        teamPublicationLevel: formData.teamPublicationLevel,
      });
    } catch (finalizeError) {
      setError(finalizeError instanceof Error ? finalizeError.message : "Börsen-Mannschaft konnte nicht überführt werden.");
    } finally {
      setFinalizing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-50 p-3">
      <Card size="sm" className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-5xl flex-col overflow-hidden">
        <CardHeader className="px-4">
          <CardTitle className="truncate text-base">Mannschaftsentwurf bearbeiten: {team.name}</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 space-y-4 overflow-y-auto px-4 pb-4">
          <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">Mannschaftsname</label>
                  <Input
                    value={formData.teamName}
                    onChange={(event) => setFormData({ ...formData, teamName: event.target.value })}
                    placeholder="Finaler Mannschaftsname"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Kontaktname</label>
                  <Input
                    value={formData.contactName}
                    onChange={(event) => setFormData({ ...formData, contactName: event.target.value })}
                    placeholder="Team Manager:in"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Kontakt-E-Mail</label>
                  <Input
                    type="email"
                    value={formData.contactEmail}
                    onChange={(event) => setFormData({ ...formData, contactEmail: event.target.value })}
                    placeholder="team@example.de"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">Veröffentlichung</label>
                  <Select
                    value={formData.teamPublicationLevel}
                    onValueChange={(value) => {
                      setFormData({
                        ...formData,
                        teamPublicationLevel: value as MarketplaceMatchingFinalizePayload["teamPublicationLevel"],
                      });
                      setMetadataForm({
                        ...metadataForm,
                        teamPublicationLevel: value as MarketplaceTeamEditPayload["teamPublicationLevel"],
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEAM_PUBLICATION_OPTIONS.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-2.5">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">MTC-Status</label>
                    <Select
                      value={metadataForm.marketplaceStatus}
                      onValueChange={(value) =>
                        setMetadataForm({
                          ...metadataForm,
                          marketplaceStatus: value as MarketplaceTeamEditPayload["marketplaceStatus"],
                        })
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MARKETPLACE_STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Sichtbarkeit</label>
                    <Select
                      value={metadataForm.marketplaceVisibility}
                      onValueChange={(value) =>
                        setMetadataForm({
                          ...metadataForm,
                          marketplaceVisibility: value as MarketplaceTeamEditPayload["marketplaceVisibility"],
                        })
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MARKETPLACE_VISIBILITY_OPTIONS.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Nachricht / Admin-Notiz</label>
                  <Textarea
                    value={metadataForm.marketplaceMessage}
                    onChange={(event) => setMetadataForm({ ...metadataForm, marketplaceMessage: event.target.value })}
                    className="min-h-20"
                    placeholder="Hinweise zur Vermittlung"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">Slots</p>
                  <Badge variant={assignedParticipants.length === 5 ? "default" : "outline"}>
                    {assignedParticipants.length}/5 belegt
                  </Badge>
                </div>
                <div className="grid gap-2">
                  {assignedDisciplineSlots.map(({ discipline, participant }) => {
                    const participantIndex = participant ? assignedParticipants.indexOf(participant) : -1;
                    const slotSearchOpen = !participant && openSearchSlotId === discipline.id;
                    const slotSearchParticipants = slotSearchOpen ? getSlotSearchParticipants(discipline.id) : [];
                    const teamFull = assignedParticipants.length >= 5;
                    const assignedDisciplineId = participant?.discipline || participant?.disciplineCode || "TBD";
                    const desiredDisciplineId = participant?.marketplaceReturnDisciplineCode || assignedDisciplineId;
                    const participantByDiscipline = new Map(
                      assignedParticipants
                        .map((entry) => [entry.discipline || entry.disciplineCode, entry] as const)
                        .filter(([value]) => Boolean(value) && value !== "TBD"),
                    );

                    return (
                      <div key={discipline.id} className="relative rounded-md border border-border/60 bg-background p-2">
                        <div className="flex min-h-12 items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-muted-foreground">{discipline.icon} {discipline.label}</p>
                            {participant ? (
                              <>
                                <p className="truncate text-sm font-medium">{getParticipantDisplayName(participant, participantIndex)}</p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {[participant.birthDate, participant.email].filter(Boolean).join(" · ") || "Keine weiteren Angaben"}
                                </p>
                                {desiredDisciplineId !== assignedDisciplineId && (
                                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                                    Wunsch: {getDisciplineLabel(desiredDisciplineId)}
                                  </p>
                                )}
                              </>
                            ) : (
                              <p className="text-sm text-muted-foreground">Noch frei</p>
                            )}
                          </div>
                          {participant?.id && (
                            <div className="flex shrink-0 flex-col gap-1.5 sm:min-w-44">
                              <Select
                                value={assignedDisciplineId}
                                onValueChange={(value) => {
                                  if (value !== assignedDisciplineId) {
                                    void handleMove(participant.id, value);
                                  }
                                }}
                                disabled={busyParticipantId === participant.id}
                              >
                                <SelectTrigger className="h-8 text-xs" title="Zugeordneten MTC-Slot ändern">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {DISCIPLINES.map((slotOption) => {
                                    const slotParticipant = participantByDiscipline.get(slotOption.id);
                                    const isSwapTarget = Boolean(slotParticipant && slotParticipant.id !== participant.id);

                                    return (
                                      <SelectItem key={slotOption.id} value={slotOption.id}>
                                        {slotOption.icon} Slot: {slotOption.label}
                                        {isSwapTarget && slotParticipant ? ` - tauschen mit ${getParticipantDisplayName(slotParticipant)}` : ""}
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                              {canReleaseAssignedParticipants ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleRemove(participant.id)}
                                  disabled={busyParticipantId === participant.id}
                                  aria-busy={busyParticipantId === participant.id}
                                >
                                  Entfernen
                                </Button>
                              ) : (
                                <Badge variant="outline" className="justify-center">
                                  Freie Meldung
                                </Badge>
                              )}
                            </div>
                          )}
                          {!participant && (
                            <Button
                              type="button"
                              size="sm"
                              variant={slotSearchOpen ? "default" : "outline"}
                              onClick={() => {
                                setOpenSearchSlotId(slotSearchOpen ? null : discipline.id);
                                setQuery("");
                              }}
                            >
                              Suchen
                            </Button>
                          )}
                        </div>

                        {slotSearchOpen && (
                          <div
                            className="fixed inset-0 z-[120] flex items-end bg-black/55 p-0 sm:items-center sm:justify-center sm:p-4"
                            role="dialog"
                            aria-modal="true"
                            aria-label={`${discipline.label}: Teilnehmer suchen`}
                            onClick={() => setOpenSearchSlotId(null)}
                          >
                            <div
                              className="flex max-h-[84dvh] w-full flex-col rounded-t-lg border border-border bg-card text-xs shadow-xl sm:max-h-[min(42rem,calc(100dvh-2rem))] sm:max-w-2xl sm:rounded-lg"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <div className="flex shrink-0 items-center gap-2 border-b border-border p-3">
                                <Input
                                  value={query}
                                  onChange={(event) => setQuery(event.target.value)}
                                  placeholder={`${discipline.label}: Name, E-Mail oder Status`}
                                  className="h-9"
                                  autoFocus
                                />
                                <Button type="button" size="sm" variant="outline" onClick={() => setOpenSearchSlotId(null)}>
                                  Schließen
                                </Button>
                              </div>
                              <div className="flex-1 space-y-2 overflow-y-auto overscroll-contain p-3 pr-2 [-webkit-overflow-scrolling:touch]">
                                {loadingAvailable ? (
                                  <div className="rounded-md border border-border/60 p-3 text-sm text-muted-foreground">Lade freie Teilnehmer...</div>
                                ) : slotSearchParticipants.length === 0 ? (
                                  <div className="rounded-md border border-border/60 p-3 text-sm text-muted-foreground">Keine freien Börsen-Teilnehmer gefunden.</div>
                                ) : (
                                  slotSearchParticipants.map((availableParticipant) => {
                                    const availableDiscipline = DISCIPLINES.find((entry) => entry.id === availableParticipant.disciplineCode);
                                    const alreadyAssigned = assignedParticipantIds.has(availableParticipant.id);
                                    const matchesSlot = availableParticipant.disciplineCode === discipline.id;

                                    return (
                                      <div key={availableParticipant.id} className="rounded-md border border-border/60 bg-background p-2 text-xs">
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="min-w-0">
                                            <p className="truncate text-sm font-medium">{availableParticipant.name}</p>
                                            <p className="truncate text-muted-foreground">
                                              Wunsch: {availableDiscipline ? `${availableDiscipline.icon} ${availableDiscipline.label}` : "Disziplin offen"}
                                              {availableParticipant.birthDate ? ` · ${availableParticipant.birthDate}` : ""}
                                              {availableParticipant.email ? ` · ${availableParticipant.email}` : ""}
                                            </p>
                                            <div className="mt-1 flex flex-wrap gap-1">
                                              <Badge variant={matchesSlot ? "default" : "outline"}>
                                                {matchesSlot ? "passend" : `als ${discipline.label} zuordnen`}
                                              </Badge>
                                              <Badge variant="outline" className={getMarketplaceStatusClass(availableParticipant.marketplaceStatus)}>
                                                {getMarketplaceStatusOption(availableParticipant.marketplaceStatus).label}
                                              </Badge>
                                              <Badge variant="outline">{availableParticipant.teamName}</Badge>
                                            </div>
                                          </div>
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleAdd(availableParticipant.id, discipline.id)}
                                            disabled={alreadyAssigned || teamFull || busyParticipantId === availableParticipant.id}
                                            aria-busy={busyParticipantId === availableParticipant.id}
                                          >
                                            Zuordnen
                                          </Button>
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
          </div>

          {(error || draftEvaluation.blockingErrors.length > 0 || draftEvaluation.warnings.length > 0 || !isValidEmail(formData.contactEmail)) && (
            <div className="space-y-1 rounded-md border border-amber-500/40 bg-card p-2 text-xs">
              {error && <p className="text-destructive">{error}</p>}
              {formData.contactEmail && !isValidEmail(formData.contactEmail) && <p>Kontakt-E-Mail ist ungültig.</p>}
              {draftEvaluation.blockingErrors.map((issue) => <p key={issue}>{issue}</p>)}
              {draftEvaluation.warnings.map((warning) => <p key={warning}>{warning}</p>)}
            </div>
          )}
        </CardContent>
        <div className="flex shrink-0 flex-col gap-2 border-t border-border bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Übernehmen ist möglich, sobald 5 Slots belegt sind und die Mannschaft fachlich plausibel ist.
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={onCancel} disabled={finalizing || savingMetadata}>
              Schließen
            </Button>
            <Button variant="outline" onClick={handleSaveDraft} disabled={savingMetadata || finalizing} aria-busy={savingMetadata}>
              {savingMetadata ? "Speichert..." : "Entwurf speichern"}
            </Button>
            <Button onClick={handleFinalize} disabled={!canFinalize || finalizing} aria-busy={finalizing}>
              {finalizing ? "Übernehme..." : "Als Mannschaft übernehmen"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function EditMarketplaceTeamModal({ team, onSave, onCancel }: {
  team: Team;
  onSave: (data: MarketplaceTeamEditPayload) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<MarketplaceTeamEditPayload>({
    teamPublicationLevel: team.teamPublicationLevel || "TEAM_ANONYM",
    marketplaceVisibility: team.marketplaceVisibility || "ADMIN_MANAGEMENT_ONLY",
    marketplaceStatus: team.marketplaceStatus || "NEW",
    marketplaceMessage: team.marketplaceMessage || "",
  });

  const handleSubmit = async () => {
    if (saving) return;

    setSaving(true);
    try {
      await onSave(formData);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-50 p-3">
      <Card size="sm" className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-lg flex-col overflow-hidden">
        <CardHeader className="px-4">
          <CardTitle className="truncate text-base">Börsen-Mannschaft bearbeiten</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 space-y-3 overflow-y-auto px-4 pb-4">
          <StatusMessage tone="info" role="note" className="px-2.5 py-2 text-xs">
            Teilnehmerdaten bleiben im Teilnehmerdialog. Hier steuerst du den Börsen-Container: Status, Sichtbarkeit und Veröffentlichung.
          </StatusMessage>

          <div className="space-y-1 rounded-md border border-border/60 bg-muted/30 p-2.5 text-xs">
            <div><strong>Container:</strong> {team.name}</div>
            {team.contactName && <div><strong>Kontakt:</strong> {team.contactName}</div>}
            {team.contactEmail && <div><strong>E-Mail:</strong> {team.contactEmail}</div>}
          </div>

          <div>
            <label className="text-sm font-medium">Börsen-Status</label>
            <Select
              value={formData.marketplaceStatus}
              onValueChange={(value) =>
                setFormData({
                  ...formData,
                  marketplaceStatus: value as MarketplaceTeamEditPayload["marketplaceStatus"],
                })
              }
            >
              <SelectTrigger className="mt-1 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MARKETPLACE_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Börsen-Sichtbarkeit</label>
            <Select
              value={formData.marketplaceVisibility}
              onValueChange={(value) =>
                setFormData({
                  ...formData,
                  marketplaceVisibility: value as MarketplaceTeamEditPayload["marketplaceVisibility"],
                })
              }
            >
              <SelectTrigger className="mt-1 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MARKETPLACE_VISIBILITY_OPTIONS.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Team veröffentlichen</label>
            <Select
              value={formData.teamPublicationLevel}
              onValueChange={(value) =>
                setFormData({
                  ...formData,
                  teamPublicationLevel: value as MarketplaceTeamEditPayload["teamPublicationLevel"],
                })
              }
            >
              <SelectTrigger className="mt-1 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEAM_PUBLICATION_OPTIONS.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Nachricht / Admin-Notiz</label>
            <Textarea
              value={formData.marketplaceMessage}
              onChange={(event) => setFormData({ ...formData, marketplaceMessage: event.target.value })}
              className="mt-1 min-h-24"
              placeholder="Interne Hinweise zur Vermittlung oder öffentliche Nachricht aus der Meldung"
            />
          </div>
        </CardContent>
        <div className="flex shrink-0 justify-end gap-2 border-t border-border bg-background px-4 py-3">
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Speichert..." : "Börse speichern"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

// Edit Team Modal Component
function EditTeamModal({ team, onSave, onCancel, showAdminInfo = false, canManageTeamManagers = false }: {
  team: Team;
  onSave: (data: TeamEditPayload) => void | Promise<void>;
  onCancel: () => void;
  showAdminInfo?: boolean;
  canManageTeamManagers?: boolean;
}) {
  const [showInfo, setShowInfo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openModerationNotes, setOpenModerationNotes] = useState<Record<number, boolean>>({});
  const [sendingInvitationIndex, setSendingInvitationIndex] = useState<number | null>(null);
  const [updatingManagerIndex, setUpdatingManagerIndex] = useState<number | null>(null);
  const [inviteMessages, setInviteMessages] = useState<Record<number, { type: "success" | "error"; text: string }>>({});
  const [managerMessages, setManagerMessages] = useState<Record<number, { type: "success" | "error"; text: string }>>({});
  const [footerIssuesExpanded, setFooterIssuesExpanded] = useState(true);
  const [savedInvitationEmails, setSavedInvitationEmails] = useState<Record<number, string>>(() =>
    Object.fromEntries((team.participants || []).map((participant, index) => [index, participant.email || ""])),
  );
  const [formData, setFormData] = useState({
    teamName: team.name,
    teamPublicationLevel: team.teamPublicationLevel || "TEAM_ANONYM",
    participants: team.participants || []
  });
  const teamDraftEvaluation = useMemo(
    () =>
      evaluateTeamDraft({
        mode: showAdminInfo ? "admin-edit" : "team-edit",
        teamName: formData.teamName,
        participants: formData.participants.map((participant) => ({
          firstName: participant.firstName,
          lastName: participant.lastName,
          birthDate: participant.birthDate,
          gender:
            participant.gender === "W" || participant.gender === "FEMALE"
              ? "W"
              : participant.gender === "D" || participant.gender === "DIVERSE"
                ? "D"
                : "M",
          discipline: participant.discipline || participant.disciplineCode || "TBD",
        })),
        oldClassificationCode: team.category,
      }),
    [formData.participants, formData.teamName, showAdminInfo, team.category],
  );
  const blockingValidationErrors = teamDraftEvaluation.blockingErrors;
  const validationWarnings = teamDraftEvaluation.warnings;
  const footerIssueCount = blockingValidationErrors.length + validationWarnings.length;
  const footerIssueTone = blockingValidationErrors.length > 0 ? "error" : "warning";
  const footerIssueLabel = blockingValidationErrors.length > 0 && validationWarnings.length > 0
    ? `${footerIssueCount} Hinweise`
    : footerIssueTone === "error"
      ? footerIssueCount === 1 ? "1 Fehler" : `${footerIssueCount} Fehler`
      : footerIssueCount === 1 ? "1 Warnung" : `${footerIssueCount} Warnungen`;
  const pendingInvitationCount = useMemo(
    () =>
      formData.participants.filter((participant, index) => {
        const normalizedCurrentEmail = normalizeEmail(participant.email);
        const normalizedSavedEmail = normalizeEmail(savedInvitationEmails[index] || "");
        return (
          Boolean(participant.id) &&
          Boolean(normalizedCurrentEmail) &&
          isValidEmail(participant.email || "") &&
          normalizedCurrentEmail !== normalizedSavedEmail &&
          participant.emailInvitation?.status !== "linked"
        );
      }).length,
    [formData.participants, savedInvitationEmails],
  );
  const approvalRelevantChanges = useMemo(
    () =>
      formData.participants.some((participant, index) => {
        const original = team.participants?.[index];
        if (!original) return true;

        return (
          normalizeComparableText(participant.firstName) !== normalizeComparableText(original.firstName) ||
          normalizeComparableText(participant.lastName) !== normalizeComparableText(original.lastName) ||
          participant.birthDate !== original.birthDate ||
          participant.gender !== original.gender ||
          (participant.discipline || participant.disciplineCode || "TBD") !== (original.discipline || original.disciplineCode || "TBD")
        );
      }),
    [formData.participants, team.participants],
  );
  const directChanges = useMemo(
    () =>
      formData.teamName !== team.name ||
      (formData.teamPublicationLevel || "TEAM_ANONYM") !== (team.teamPublicationLevel || "TEAM_ANONYM") ||
      formData.participants.some((participant, index) => {
        const original = team.participants?.[index];
        if (!original) return true;

        return (
          normalizeEmail(participant.email) !== normalizeEmail(original.email) ||
          (participant.shirtSize || "") !== (original.shirtSize || "") ||
          normalizeComparableText(participant.moderationNote) !== normalizeComparableText(original.moderationNote) ||
          (participant.participantPublicationPreference || "NAME_VERBERGEN") !==
            (original.participantPublicationPreference || "NAME_VERBERGEN")
        );
      }),
    [formData.participants, formData.teamName, formData.teamPublicationLevel, team.name, team.participants, team.teamPublicationLevel],
  );
  const saveButtonLabel = getTeamSaveButtonLabel({
    isAdminEdit: showAdminInfo,
    hasApprovalChanges: approvalRelevantChanges,
    hasDirectChanges: directChanges,
    pendingInvitationCount,
  });

  useEffect(() => {
    setFooterIssuesExpanded(true);
  }, [team.id]);

  const handleParticipantChange = (index: number, field: string, value: string) => {
    const newParticipants = [...formData.participants];
    newParticipants[index] = { ...newParticipants[index], [field]: value };
    setFormData({ ...formData, participants: newParticipants });
    if (field === "email") {
      setInviteMessages((current) => {
        const next = { ...current };
        delete next[index];
        return next;
      });
    }
  };

  const handleSubmit = async () => {
    if (!teamDraftEvaluation.canSubmit || saving) return;

    setSaving(true);
    try {
      await onSave(formData);
    } finally {
      setSaving(false);
    }
  };

  const toggleModerationNote = (index: number) => {
    setOpenModerationNotes((current) => ({
      ...current,
      [index]: !current[index],
    }));
  };

  const updateParticipantInviteState = (index: number, nextValues: Partial<Participant>) => {
    const newParticipants = [...formData.participants];
    newParticipants[index] = { ...newParticipants[index], ...nextValues };
    setFormData({ ...formData, participants: newParticipants });
  };

  const handleSendInvitation = async (index: number) => {
    const participant = formData.participants[index];
    if (!participant?.id) return;

    setSendingInvitationIndex(index);
    setInviteMessages((current) => {
      const next = { ...current };
      delete next[index];
      return next;
    });

    try {
      const response = await fetch(`/api/participants/${participant.id}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: participant.email || "" }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Einladung konnte nicht gesendet werden");
      }

      updateParticipantInviteState(index, {
        email: participant.email,
        emailInvitation: {
          status: "active",
          sentAt: new Date().toISOString(),
          expiresAt: data.participantClaimMail?.expiresAt ?? participant.emailInvitation?.expiresAt ?? null,
          claimedAt: null,
          revokedAt: null,
        },
      });
      setSavedInvitationEmails((current) => ({
        ...current,
        [index]: participant.email || "",
      }));
      setInviteMessages((current) => ({
        ...current,
        [index]: { type: "success", text: "Einladung wurde versendet." },
      }));
    } catch (error) {
      setInviteMessages((current) => ({
        ...current,
        [index]: {
          type: "error",
          text: error instanceof Error ? error.message : "Einladung konnte nicht gesendet werden",
        },
      }));
    } finally {
      setSendingInvitationIndex(null);
    }
  };

  const handleToggleTeamManager = async (index: number) => {
    const participant = formData.participants[index];
    if (!participant?.id) return;

    setUpdatingManagerIndex(index);
    setManagerMessages((current) => {
      const next = { ...current };
      delete next[index];
      return next;
    });

    try {
      const response = await fetch(
        participant.isTeamManager
          ? `/api/teams/${team.id}/managers?participantId=${encodeURIComponent(participant.id)}`
          : `/api/teams/${team.id}/managers`,
        {
          method: participant.isTeamManager ? "DELETE" : "POST",
          headers: participant.isTeamManager ? undefined : { "Content-Type": "application/json" },
          body: participant.isTeamManager ? undefined : JSON.stringify({ participantId: participant.id }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Team-Manager-Rechte konnten nicht geändert werden");
      }

      const newParticipants = [...formData.participants];
      newParticipants[index] = {
        ...newParticipants[index],
        isTeamManager: !participant.isTeamManager,
      };
      setFormData({ ...formData, participants: newParticipants });
      setManagerMessages((current) => ({
        ...current,
        [index]: {
          type: "success",
          text: participant.isTeamManager ? "Team-Manager-Rechte entfernt." : "Team-Manager-Rechte vergeben.",
        },
      }));
    } catch (error) {
      setManagerMessages((current) => ({
        ...current,
        [index]: {
          type: "error",
          text: error instanceof Error ? error.message : "Team-Manager-Rechte konnten nicht geändert werden",
        },
      }));
    } finally {
      setUpdatingManagerIndex(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-50 p-3">
      <Card size="sm" className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden">
        <CardHeader className="px-4">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="truncate text-base">Team bearbeiten: {team.name}</CardTitle>
            {showAdminInfo && (
              <Button variant="ghost" size="sm" className="h-8 shrink-0 px-2 text-xs" onClick={() => setShowInfo((value) => !value)}>
                <Info className="size-4" />
                Info
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex-1 space-y-3 overflow-y-auto px-4 pb-4">
          {!showAdminInfo && (
            <StatusMessage tone="info" role="note" className="px-2.5 py-2 text-xs">
              Geprüfte Teilnehmerdaten gehen zur Genehmigung. E-Mail, T-Shirt, Notiz und Veröffentlichung speichern direkt.
            </StatusMessage>
          )}
          {showAdminInfo && showInfo && (
            <div className="space-y-1 rounded-md border border-border/60 bg-muted/30 p-2.5 text-xs">
              {team.createdAt && (
                <>
                  <div><strong>Anlagedatum:</strong> {formatDatePart(team.createdAt)}</div>
                  <div><strong>Anlageuhrzeit:</strong> {formatTimePart(team.createdAt)}</div>
                </>
              )}
              {(team.ownerName || team.ownerEmail) && (
                <div><strong>Anlage-User:</strong> {team.ownerName || team.ownerEmail}</div>
              )}
              {team.updatedAt && (
                <div><strong>Zuletzt geändert:</strong> {new Date(team.updatedAt).toLocaleString('de-DE')}</div>
              )}
              {team.ownerEmail && (
                <div><strong>Owner-Mail:</strong> {team.ownerEmail}</div>
              )}
            </div>
          )}

          <div>
            <label className="text-sm font-medium">Team-Name</label>
            <Input
              value={formData.teamName}
              onChange={(e) => setFormData({ ...formData, teamName: e.target.value })}
              className="mt-1 h-9"
              disabled={!showAdminInfo}
            />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Team veröffentlichen</label>
              {!showAdminInfo && <DirectFieldBadge />}
            </div>
            <Select
              value={formData.teamPublicationLevel}
              onValueChange={(value) =>
                setFormData({
                  ...formData,
                  teamPublicationLevel: value as "TEAM_ANONYM" | "TEAMNAME_OEFFENTLICH" | "ALLES_OEFFENTLICH",
                })
              }
            >
              <SelectTrigger className="mt-1 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEAM_PUBLICATION_OPTIONS.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              Steuert, wie das Team später für andere Rollen oder öffentlich erscheinen darf.
            </p>
          </div>

          <div>
            <label className="text-sm font-medium">Teilnehmer</label>
            <div className="mt-2 space-y-2">
              {formData.participants.map((participant, index) => {
                const savedParticipantEmail = savedInvitationEmails[index] || "";
                const emailDiffersFromSaved = normalizeEmail(participant.email) !== normalizeEmail(savedParticipantEmail);
                const effectiveEmailInvitationStatus = emailDiffersFromSaved
                  ? (participant.email ? "none" : "missing_email")
                  : participant.emailInvitation?.status;
                const emailInvitationMeta = getEmailInvitationMeta(
                  effectiveEmailInvitationStatus || (participant.email ? "none" : "missing_email"),
                );
                const canSendInvitation =
                  Boolean(participant.id) &&
                  isValidEmail(participant.email || "") &&
                  (emailDiffersFromSaved || !["active", "claimed", "linked"].includes(participant.emailInvitation?.status || "none"));
                const inviteMessage = inviteMessages[index];
                const managerMessage = managerMessages[index];

                return (
                <div key={index} className="space-y-2 rounded-md border border-border/50 p-2 shadow-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-muted-foreground">Vorname</label>
                        {!showAdminInfo && <ApprovalFieldBadge />}
                      </div>
                      <Input
                        value={participant.firstName}
                        onChange={(e) => handleParticipantChange(index, 'firstName', e.target.value)}
                        className="h-8"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-muted-foreground">Nachname</label>
                        {!showAdminInfo && <ApprovalFieldBadge />}
                      </div>
                      <Input
                        value={participant.lastName}
                        onChange={(e) => handleParticipantChange(index, 'lastName', e.target.value)}
                        className="h-8"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-muted-foreground">Geschlecht</label>
                        {!showAdminInfo && <ApprovalFieldBadge />}
                      </div>
                      <Select
                        value={participant.gender}
                        onValueChange={(value) => handleParticipantChange(index, 'gender', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="M">♂ Männlich</SelectItem>
                          <SelectItem value="W">♀ Weiblich</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-muted-foreground">T-Shirt</label>
                        {!showAdminInfo && <DirectFieldBadge />}
                      </div>
                      <Select
                        value={participant.shirtSize || "none"}
                        onValueChange={(value) => handleParticipantChange(index, 'shirtSize', value === 'none' ? '' : value)}
                      >
                        <SelectTrigger>
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
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-muted-foreground">Geburtsdatum</label>
                        {!showAdminInfo && <ApprovalFieldBadge />}
                      </div>
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="TT.MM.JJJJ"
                        autoComplete="bday"
                        value={participant.birthDate}
                        onChange={(e) => handleParticipantChange(index, 'birthDate', formatBirthDateInput(e.target.value))}
                        onKeyDown={(event) =>
                          handleBirthDateKeyDown(event, participant.birthDate, (nextValue) =>
                            handleParticipantChange(index, "birthDate", nextValue),
                          )
                        }
                        className="h-8"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-muted-foreground">Disziplin</label>
                        {!showAdminInfo && <ApprovalFieldBadge />}
                      </div>
                      <Select
                        value={participant.discipline || "TBD"}
                        onValueChange={(value) => handleParticipantChange(index, 'discipline', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="TBD">❓ Noch offen</SelectItem>
                          {DISCIPLINES.map((discipline) => (
                            <SelectItem key={discipline.id} value={discipline.id}>
                              {discipline.icon} {discipline.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-muted-foreground">Namensveröffentlichung</label>
                      {!showAdminInfo && <DirectFieldBadge />}
                    </div>
                    <Select
                      value={participant.participantPublicationPreference || "NAME_VERBERGEN"}
                      onValueChange={(value) => handleParticipantChange(index, "participantPublicationPreference", value)}
                    >
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
                  {canManageTeamManagers && (
                    <div className="space-y-2 rounded-md border border-border/60 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Team-Manager-Rechte</p>
                          <p className="text-xs text-muted-foreground">Gilt nur für diese Mannschaft.</p>
                        </div>
                        <Badge variant="outline" className={participant.isTeamManager ? "border-green-300 text-green-700" : "border-muted text-muted-foreground"}>
                          {participant.isTeamManager ? "Team Manager:in" : participant.canBeTeamManager ? "Teilnehmer:in" : "Kein Portal-Konto"}
                        </Badge>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant={participant.isTeamManager ? "outline" : "secondary"}
                        onClick={() => handleToggleTeamManager(index)}
                        disabled={!participant.canBeTeamManager || updatingManagerIndex === index}
                        aria-busy={updatingManagerIndex === index}
                        className="h-8 w-full sm:w-auto"
                      >
                        {updatingManagerIndex === index
                          ? "Speichert..."
                          : participant.isTeamManager
                            ? "Team Manager:in entfernen"
                            : "Als Team Manager:in freigeben"}
                      </Button>
                      {!participant.canBeTeamManager && (
                        <p className="text-xs text-muted-foreground">
                          Erst eine Einladung senden und vom Teilnehmer einlösen lassen, danach kann die Rolle vergeben werden.
                        </p>
                      )}
                      {managerMessage ? (
                        <p className={managerMessage.type === "success" ? "text-xs text-green-700" : "text-xs text-red-600"}>
                          {managerMessage.text}
                        </p>
                      ) : null}
                    </div>
                  )}
                  <div className="space-y-2 rounded-md border border-border/60 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-medium text-muted-foreground">E-Mail (optional)</label>
                        {!showAdminInfo && <DirectFieldBadge />}
                        <InfoHint text="Die E-Mail ist nur Kontakt- und Einladungskanal. Sie ist nicht die dauerhafte Identität des Portal-Accounts." />
                      </div>
                      <Badge variant="outline" className={emailInvitationMeta.className}>
                        {emailInvitationMeta.label}
                      </Badge>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                      <Input
                        type="email"
                        value={participant.email || ""}
                        onChange={(e) => handleParticipantChange(index, "email", e.target.value)}
                        placeholder="teilnehmer@example.de"
                        className="h-8"
                      />
                      {canSendInvitation ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleSendInvitation(index)}
                          disabled={sendingInvitationIndex === index}
                          aria-busy={sendingInvitationIndex === index}
                          className="h-8"
                        >
                          <Send className="size-4" />
                          {sendingInvitationIndex === index ? "Sendet..." : "Einladung senden"}
                        </Button>
                      ) : null}
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {participant.emailInvitation?.sentAt ? <p>Versendet: {formatDateTime(participant.emailInvitation.sentAt)}</p> : null}
                      {participant.emailInvitation?.expiresAt ? <p>Gültig bis: {formatDateTime(participant.emailInvitation.expiresAt)}</p> : null}
                      {participant.emailInvitation?.claimedAt ? <p>Eingelöst: {formatDateTime(participant.emailInvitation.claimedAt)}</p> : null}
                      {participant.email && !isValidEmail(participant.email) ? <p className="text-red-600">Bitte eine gültige E-Mail-Adresse eintragen.</p> : null}
                      {inviteMessage ? (
                        <p className={inviteMessage.type === "success" ? "text-green-700" : "text-red-600"}>{inviteMessage.text}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="pt-1">
                    <Button
                      type="button"
                      size="sm"
                      variant={participant.moderationNote?.trim() ? "secondary" : "outline"}
                      onClick={() => toggleModerationNote(index)}
                      className="text-[11px]"
                    >
                      {participant.moderationNote?.trim() ? "📝 Moderationshinweis vorhanden" : "📝 Moderationshinweis"}
                    </Button>
                  </div>
                  {openModerationNotes[index] && (
                    <div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-muted-foreground">Hinweis für Moderation (intern)</label>
                        {!showAdminInfo && <DirectFieldBadge />}
                      </div>
                      <Textarea
                        value={participant.moderationNote || ""}
                        onChange={(e) => handleParticipantChange(index, 'moderationNote', e.target.value)}
                        placeholder="Optionaler interner Hinweis für Startliste / Moderation"
                        maxLength={280}
                        className="mt-1 min-h-[84px]"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">{(participant.moderationNote || "").length}/280 Zeichen</p>
                    </div>
                  )}
                </div>
              );
              })}
            </div>
          </div>

        </CardContent>
        <div className="border-t bg-background/95 px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur supports-[backdrop-filter]:bg-background/85">
          <div className="flex flex-col gap-2">
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
                    {blockingValidationErrors.map((error, index) => (
                      <div key={`error-${index}`}>{error}</div>
                    ))}
                    {validationWarnings.map((warning, index) => (
                      <div key={`warning-${index}`}>{warning}</div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={onCancel} className="min-h-9 sm:w-auto">
                Abbrechen
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={saving || !teamDraftEvaluation.canSubmit}
                aria-busy={saving}
                className="min-h-9 whitespace-normal text-center leading-tight sm:w-auto"
              >
                {saving ? "Speichert..." : saveButtonLabel}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
