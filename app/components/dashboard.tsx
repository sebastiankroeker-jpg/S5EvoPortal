"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
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
  extractBirthYearFromInput,
  formatBirthDateInput,
  resolveBirthDateInputKey,
} from "@/lib/domain/team";
import { compareClassificationCodes, evaluateTeamDraft, validateDisciplineAssignment } from "@/lib/domain/classification";
import { SHIRT_SIZES } from "@/lib/domain/shirts";
import { usePermissions } from "@/lib/permissions-context";
import { useCompetition } from "@/lib/competition-context";
import { useNotifications } from "@/lib/notification-context";
import { canRoleViewAllTeams, isOwnerFilterVisibleForRole } from "@/lib/team-access-config";
import {
  TEAM_DASHBOARD_FOCUS_EVENT,
  TEAM_FOCUS_STORAGE_KEY,
  TEAM_SEARCH_STORAGE_KEY,
  openAdminMessageComposer,
  openChangesDashboard,
  openTeamDashboard,
  openUserDashboard,
} from "@/lib/admin-routing";
import {
  deriveAccountLinkStatus,
  type AccountLinkClaimStatus,
} from "@/lib/account-link-status";
import { DASHBOARD_SCOPE_STORAGE_KEY, getStoredDashboardScope, setStoredDashboardScope } from "@/lib/dashboard-navigation";
import { formatOfflineCacheTimestamp, readOfflineCache, writeOfflineCache } from "@/lib/pwa-offline-cache";
import { DisciplineBrandBadge, DisciplineBrandIcon } from "./discipline-brand";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  ArrowDownUp,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Download,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Info,
  Mail,
  Pencil,
  RotateCcw,
  Search,
  Send,
  SlidersHorizontal,
  Star,
  Trash2,
  Upload,
  UserRound,
  UsersRound,
  X,
  XCircle,
} from "lucide-react";
import AccountLinkStatusDialog from "./account-link-status-dialog";
import ParticipantEditDialog from "./participant-edit-dialog";
import ParticipantPublicationPreferenceIcon from "./participant-publication-preference-icon";
import type {
  DashboardLayoutScope,
  TeamDashboardLayoutConfig,
  TeamExportColumnKey,
} from "@/lib/dashboard-layout-config";

interface Team {
  id: string;
  name: string;
  startNumber?: string | null;
  teamPublicationLevel?: "TEAM_ANONYM" | "TEAMNAME_OEFFENTLICH" | "ALLES_OEFFENTLICH";
  registrationMode?: "TEAM" | "MARKETPLACE";
  marketplaceVisibility?: "PUBLIC" | "MARKETPLACE_USERS" | "PORTAL_USERS" | "ADMIN_MANAGEMENT_ONLY";
  marketplaceStatus?: "NEW" | "REVIEWED" | "MATCHING" | "MATCHED" | "WITHDRAWN";
  marketplaceMessage?: string;
  category: string;
  contactName: string;
  contactEmail: string;
  ownerId?: string | null;
  ownerHasPortalAccount?: boolean;
  ownerEmail?: string;
  ownerName?: string;
  teamChiefId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  isCurrentUserTeam?: boolean;
  canCurrentUserEdit?: boolean;
  canFinalizeMarketplaceMatching?: boolean;
  canManageTeamManagers?: boolean;
  ownerClaim?: OwnerClaimInfo | null;
  participants?: Participant[];
}

type OwnerClaimInfo = {
  suggestedEmail?: string | null;
  suggestedName?: string | null;
  sentAt?: string | null;
  expiresAt?: string | null;
  claimedAt?: string | null;
  revokedAt?: string | null;
};

interface Participant {
  id?: string;
  replaceParticipant?: boolean;
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
  portalAccount?: { id: string; email?: string | null; name?: string | null } | null;
  hasPlaceholderUser?: boolean;
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
  return discipline ? discipline.label : value;
}

type EditableParticipant = Omit<Participant, "id"> & { id: string };

interface DashboardProps {
  ownerFilter?: string;
  marketplaceFocus?: boolean;
}

type DashboardViewMode = "cards" | "list";
type TeamSortField = "name" | "startNumber" | "category" | "contactName" | "contactEmail" | "ownerEmail" | "participantCount" | "createdAt" | "updatedAt";
type SortDirection = "asc" | "desc";
type MarketplaceStatusFilter = "all" | NonNullable<Team["marketplaceStatus"]>;
type MarketplaceVisibilityFilter = "all" | NonNullable<Team["marketplaceVisibility"]>;
type MarketplacePublicationFilter = "all" | NonNullable<Team["teamPublicationLevel"]>;
type MarketplaceKindFilter = "all" | "marketplace" | "mtc" | "single";
type QuickFilterMode = "exclude" | "neutral" | "include";
type QuickFilterKey = "mine" | "needsReview" | "marketplace" | "mtc" | "openSlots";
type TeamOptionalColumnKey =
  | "startNumber"
  | "category"
  | "contactName"
  | "contactEmail"
  | "ownerEmail"
  | "participantCount"
  | "participants"
  | "participantRUN"
  | "participantBENCH"
  | "participantSTOCK"
  | "participantROAD"
  | "participantMTB"
  | "createdAt"
  | "updatedAt";

const TEAM_LIST_VISIBLE_COLUMNS_STORAGE_KEY = "s5evo.dashboard.visibleColumns";
const TEAM_DASHBOARD_PREFERENCES_STORAGE_PREFIX = "s5evo.dashboard.preferences.v1";
const TEAM_DASHBOARD_SELECTED_LAYOUT_STORAGE_PREFIX = "s5evo.dashboard.selectedLayout.v1";
const QUICK_FILTER_KEYS: QuickFilterKey[] = ["mine", "needsReview", "marketplace", "mtc", "openSlots"];
const DAMEN_CATEGORY_KEYS = new Set(["damen-a", "damen-b"]);
const HERREN_CATEGORY_KEYS = new Set(["jungsters", "herren", "masters"]);
const DAMEN_CATEGORY_FILTER_VALUE = "group:damen";
const HERREN_CATEGORY_FILTER_VALUE = "group:herren";
const EMPTY_QUICK_EXCLUDES: Record<QuickFilterKey, boolean> = {
  mine: false,
  needsReview: false,
  marketplace: false,
  mtc: false,
  openSlots: false,
};
const DEFAULT_TEAM_SORT_FIELD: TeamSortField = "updatedAt";
const DEFAULT_TEAM_SORT_DIRECTION: SortDirection = "desc";
const SORT_OPTIONS: Array<{ value: TeamSortField; label: string; adminOnly?: boolean }> = [
  { value: "updatedAt", label: "Zuletzt geändert" },
  { value: "createdAt", label: "Anmeldedatum", adminOnly: true },
  { value: "name", label: "Mannschaftsname" },
  { value: "startNumber", label: "Startnummer" },
  { value: "category", label: "Klasse" },
  { value: "contactName", label: "Team Manager:in" },
  { value: "contactEmail", label: "Kontakt E-Mail" },
  { value: "participantCount", label: "Teilnehmer" },
];

const LIST_OPTIONAL_COLUMNS: Array<{ key: TeamOptionalColumnKey; label: string; adminOnly?: boolean }> = [
  { key: "startNumber", label: "Startnummer" },
  { key: "category", label: "Klasse" },
  { key: "contactName", label: "Team Manager:in" },
  { key: "contactEmail", label: "Kontakt E-Mail" },
  { key: "ownerEmail", label: "Anleger:in" },
  { key: "participantCount", label: "Teilnehmer" },
  { key: "participants", label: "Mitglieder" },
  { key: "participantRUN", label: "Laufen" },
  { key: "participantBENCH", label: "Bankdrücken" },
  { key: "participantSTOCK", label: "Stockschießen" },
  { key: "participantROAD", label: "Rennrad" },
  { key: "participantMTB", label: "Mountainbike" },
  { key: "createdAt", label: "Anmeldedatum", adminOnly: true },
  { key: "updatedAt", label: "Geändert" },
];

const DASHBOARD_VIEW_MODES = ["cards", "list"] as const;
const TEAM_SORT_FIELDS = ["name", "startNumber", "category", "contactName", "contactEmail", "ownerEmail", "participantCount", "createdAt", "updatedAt"] as const;
const SORT_DIRECTIONS = ["asc", "desc"] as const;
const MARKETPLACE_KIND_FILTERS = ["all", "marketplace", "mtc", "single"] as const;
const MARKETPLACE_STATUS_FILTERS = ["all", "NEW", "REVIEWED", "MATCHING", "MATCHED", "WITHDRAWN"] as const;
const MARKETPLACE_VISIBILITY_FILTERS = ["all", "PUBLIC", "MARKETPLACE_USERS", "PORTAL_USERS", "ADMIN_MANAGEMENT_ONLY"] as const;
const MARKETPLACE_PUBLICATION_FILTERS = ["all", "TEAM_ANONYM", "TEAMNAME_OEFFENTLICH", "ALLES_OEFFENTLICH"] as const;
const DISCIPLINE_PARTICIPANT_COLUMN_KEYS: TeamOptionalColumnKey[] = [
  "participantRUN",
  "participantBENCH",
  "participantSTOCK",
  "participantROAD",
  "participantMTB",
];
const DEFAULT_TEAM_LIST_VISIBLE_COLUMNS: TeamOptionalColumnKey[] = [
  "startNumber",
  "category",
  ...DISCIPLINE_PARTICIPANT_COLUMN_KEYS,
  "createdAt",
];

type DashboardFilterPreferences = {
  searchQuery?: string;
  categoryFilter?: string;
  categoryFilters?: string[];
  ownerFilter?: string;
  ownTeamsOnly?: boolean;
  incompleteOnly?: boolean;
  marketplaceKindFilter?: MarketplaceKindFilter;
  marketplaceStatusFilter?: MarketplaceStatusFilter;
  marketplaceVisibilityFilter?: MarketplaceVisibilityFilter;
  marketplacePublicationFilter?: MarketplacePublicationFilter;
  openMtcSlotsOnly?: boolean;
  quickFilterExcludes?: Record<QuickFilterKey, boolean>;
  createdFrom?: string;
  createdTo?: string;
  viewMode?: DashboardViewMode;
  sortField?: TeamSortField;
  sortDirection?: SortDirection;
};

type SavedDashboardLayout = {
  id: string;
  name: string;
  scope: DashboardLayoutScope;
  competitionId: string | null;
  ownerId: string | null;
  isDefault: boolean;
  config: TeamDashboardLayoutConfig;
  createdAt: string;
  updatedAt: string;
};

const VISIBLE_COLUMN_EXPORT_MAP: Partial<Record<TeamOptionalColumnKey, TeamExportColumnKey>> = {
  startNumber: "startNumber",
  category: "category",
  contactName: "contactName",
  contactEmail: "contactEmail",
  ownerEmail: "ownerEmail",
  participantCount: "participantCount",
  participants: "participants",
  participantRUN: "participantRUN",
  participantBENCH: "participantBENCH",
  participantSTOCK: "participantSTOCK",
  participantROAD: "participantROAD",
  participantMTB: "participantMTB",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
};

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

function formatParticipantIdentityId(id?: string | null) {
  return id ? id.slice(0, 8) : "neu";
}

function hasParticipantLinkedAccount(participant?: Pick<Participant, "linkedUserId" | "emailInvitation"> | null) {
  return Boolean(participant?.linkedUserId || participant?.emailInvitation?.status === "linked");
}

function isParticipantIdentityAnchored(
  participant?: Pick<Participant, "linkedUserId" | "emailInvitation" | "isTeamManager" | "pendingChanges" | "latestChange"> | null,
) {
  return Boolean(
    hasParticipantLinkedAccount(participant) ||
      participant?.isTeamManager ||
      participant?.latestChange ||
      participant?.pendingChanges?.length ||
      participant?.emailInvitation?.sentAt ||
      participant?.emailInvitation?.claimedAt ||
      participant?.emailInvitation?.revokedAt,
  );
}

function hasSuspiciousParticipantIdentityChange(current?: Participant | null, original?: Participant | null) {
  if (!current || !original || !isParticipantIdentityAnchored(original)) return false;

  const firstNameChanged = normalizeComparableText(current.firstName) !== normalizeComparableText(original.firstName);
  const lastNameChanged = normalizeComparableText(current.lastName) !== normalizeComparableText(original.lastName);
  const birthYearChanged = extractBirthYearFromInput(current.birthDate) !== extractBirthYearFromInput(original.birthDate);

  return (firstNameChanged && lastNameChanged) || ((firstNameChanged || lastNameChanged) && birthYearChanged);
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

function getMtcCombinedActionMeta(
  completionMeta: ReturnType<typeof getTeamCompletionMeta>,
  disciplineMeta: ReturnType<typeof getTeamDisciplineMeta>,
) {
  if (!disciplineMeta.isImportant) return null;

  return {
    label: disciplineMeta.label,
    toneClass: disciplineMeta.toneClass || completionMeta.toneClass,
    icon: AlertTriangle,
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
  return null;
}

function getEmailInvitationMeta(status?: EmailInvitationStatus["status"] | null) {
  if (status === "linked") return { label: "Konto verknüpft", className: "border-green-300 text-green-700" };
  if (status === "claimed") return { label: "Einladung eingelöst", className: "border-green-300 text-green-700" };
  if (status === "active") return { label: "Einladung versendet", className: "border-blue-300 text-blue-700" };
  if (status === "expired") return { label: "Einladung abgelaufen", className: "border-amber-300 text-amber-700" };
  if (status === "revoked") return { label: "Einladung gesperrt", className: "border-red-300 text-red-700" };
  if (status === "missing_email") return { label: "Keine E-Mail hinterlegt", className: "border-muted text-muted-foreground" };
  return { label: "Keine Einladung versendet", className: "border-muted text-muted-foreground" };
}

function getClaimStatus(token?: {
  claimedAt?: string | null;
  revokedAt?: string | null;
  expiresAt?: string | null;
} | null): AccountLinkClaimStatus {
  if (!token) return "none";
  if (token.revokedAt) return "revoked";
  if (token.claimedAt) return "claimed";

  const expiresAt = token.expiresAt ? new Date(token.expiresAt).getTime() : Number.NaN;
  if (!Number.isNaN(expiresAt) && expiresAt < Date.now()) return "expired";

  return "active";
}

function getOwnerClaimMeta(team: Team) {
  return deriveAccountLinkStatus({
    entityLabel: "Team-Owner",
    hasEmail: Boolean(team.ownerEmail || team.contactEmail || team.ownerClaim?.suggestedEmail),
    hasEntityLink: Boolean((team.ownerId && team.ownerHasPortalAccount) || team.ownerClaim?.claimedAt),
    hasPortalAccount: Boolean(team.ownerHasPortalAccount),
    hasPlaceholderUser: Boolean(team.ownerId && !team.ownerHasPortalAccount),
    claimStatus: team.ownerClaim ? getClaimStatus(team.ownerClaim) : "none",
  });
}

function getParticipantLinkMeta(team: Team, participant: Participant) {
  const participantEmail = normalizeEmail(participant.email);
  const emailMatchesPortalOwner =
    Boolean(participantEmail && team.ownerHasPortalAccount) &&
    [team.ownerEmail, team.contactEmail].some((email) => normalizeEmail(email) === participantEmail);
  const emailMatchesPlaceholderOwner =
    Boolean(participantEmail && team.ownerId && !team.ownerHasPortalAccount) &&
    [team.ownerEmail, team.contactEmail].some((email) => normalizeEmail(email) === participantEmail);

  return deriveAccountLinkStatus({
    entityLabel: "Teilnehmer",
    hasEmail: Boolean(participant.email),
    hasEntityLink: Boolean(participant.linkedUserId || participant.emailInvitation?.status === "linked"),
    hasPortalAccount: Boolean(participant.portalAccount || emailMatchesPortalOwner),
    hasPlaceholderUser: Boolean(participant.hasPlaceholderUser || emailMatchesPlaceholderOwner),
    claimStatus: participant.emailInvitation?.status || (participant.email ? "none" : "missing_email"),
  });
}

function OwnerClaimBadge({ team, canUseAdminLinks = false }: { team: Team; canUseAdminLinks?: boolean }) {
  const meta = getOwnerClaimMeta(team);
  const ownerMessageUserId = team.ownerHasPortalAccount ? team.ownerId : null;
  const ownerMessageLabel = team.ownerName || team.ownerEmail || team.contactName || team.contactEmail || "Team-Owner";

  return (
    <AccountLinkStatusDialog
      meta={meta}
      title="Team-Owner Status"
      rows={[
        { label: "Team", value: team.name, targetType: "team", onClick: () => openTeamDashboard({ teamId: team.id }) },
        { label: "Person", value: team.ownerName || team.contactName || "Unbekannt" },
        {
          label: "User",
          value: team.ownerEmail || team.contactEmail || team.ownerClaim?.suggestedEmail,
          targetType: "user",
          onClick: team.ownerEmail || team.contactEmail
            ? () => openUserDashboard({ email: team.ownerEmail || team.contactEmail, teamId: team.id })
            : undefined,
        },
        { label: "Portal-Konto", value: team.ownerHasPortalAccount ? "vorhanden" : team.ownerId ? "Login noch nicht aktiviert" : "nicht erkannt" },
        { label: "Claim", value: meta.label, targetType: "claim", onClick: () => { window.location.href = "/claim-links"; } },
        { label: "Erstellt", value: team.ownerClaim?.sentAt ? formatDateTime(team.ownerClaim.sentAt) : null },
        { label: "Gültig bis", value: team.ownerClaim?.expiresAt && !team.ownerClaim.claimedAt ? formatDateTime(team.ownerClaim.expiresAt) : null },
        { label: "Eingelöst", value: team.ownerClaim?.claimedAt ? formatDateTime(team.ownerClaim.claimedAt) : null },
      ]}
      actions={canUseAdminLinks && ownerMessageUserId
        ? [{
            label: "Nachricht schreiben",
            onClick: () => openAdminMessageComposer({
              userId: ownerMessageUserId,
              email: team.ownerEmail || team.contactEmail,
              name: ownerMessageLabel,
              teamId: team.id,
            }),
          }]
        : undefined}
    />
  );
}

function getParticipantAccessMeta(team: Team, participant: Participant) {
  if (participant.isTeamManager) {
    return {
      label: isMarketplaceMatchingTeam(team) ? "MTC-Teamchef bewusst" : "Team Manager:in",
      className: "border-green-300 bg-green-50 text-green-800",
    };
  }

  if (participant.canBeTeamManager) {
    return {
      label: isMarketplaceMatchingTeam(team) ? "Portal-Konto, keine Teamchef-Rolle" : "Teilnehmer:in",
      className: "border-muted bg-muted/30 text-muted-foreground",
    };
  }

  if (team.registrationMode === "MARKETPLACE" && normalizeEmail(participant.email) && [team.ownerEmail, team.contactEmail].some((email) => normalizeEmail(email) === normalizeEmail(participant.email))) {
    return {
      label: isMarketplaceMatchingTeam(team) ? "MTC-Kontakt" : "Börsen-Kontakt",
      className: "border-sky-300 bg-sky-50 text-sky-800",
    };
  }

  return {
    label: "Kein Portal-Konto",
    className: "border-muted bg-muted/30 text-muted-foreground",
  };
}

function getParticipantEmailInvitationMeta(team: Team, participant: Participant) {
  return getParticipantLinkMeta(team, participant);
}

function getMarketplaceContainerAccessMeta(team: Team) {
  if (team.teamChiefId && team.ownerClaim?.claimedAt) {
    return {
      label: "Team Manager:in",
      className: "border-green-300 bg-green-50 text-green-800",
    };
  }

  if (team.registrationMode === "MARKETPLACE" && team.ownerId) {
    return {
      label: isMarketplaceMatchingTeam(team) ? "MTC-Kontakt" : "Börsen-Kontakt",
      className: "border-sky-300 bg-sky-50 text-sky-800",
    };
  }

  return {
    label: "Kein Portal-Konto",
    className: "border-muted bg-muted/30 text-muted-foreground",
  };
}

function getMarketplaceContainerAccountMeta(team: Team) {
  return getOwnerClaimMeta(team);
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

function getParticipantForDiscipline(team: Team, disciplineCode: string) {
  return (team.participants ?? []).find(
    (participant) => (participant.discipline || participant.disciplineCode) === disciplineCode,
  ) ?? null;
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

function isStringOption<const T extends readonly string[]>(value: unknown, options: T): value is T[number] {
  return typeof value === "string" && options.includes(value);
}

function sanitizeStoredQuickFilterExcludes(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const source = value as Partial<Record<QuickFilterKey, unknown>>;
  return QUICK_FILTER_KEYS.reduce<Record<QuickFilterKey, boolean>>((result, key) => {
    result[key] = source[key] === true;
    return result;
  }, { ...EMPTY_QUICK_EXCLUDES });
}

function sanitizeStoredCategoryFilters(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  const filters = value
    .filter((entry): entry is string => typeof entry === "string")
    .filter((entry) => entry !== "all");

  return [...new Set(filters)];
}

function sanitizeDashboardFilterPreferences(value: unknown): DashboardFilterPreferences | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const source = value as Record<string, unknown>;
  const quickFilterExcludes = sanitizeStoredQuickFilterExcludes(source.quickFilterExcludes);
  const categoryFilters = sanitizeStoredCategoryFilters(source.categoryFilters);
  const preferences: DashboardFilterPreferences = {};

  if (typeof source.searchQuery === "string") preferences.searchQuery = source.searchQuery;
  if (typeof source.categoryFilter === "string") preferences.categoryFilter = source.categoryFilter;
  if (categoryFilters) preferences.categoryFilters = categoryFilters;
  if (typeof source.ownerFilter === "string") preferences.ownerFilter = source.ownerFilter;
  if (typeof source.ownTeamsOnly === "boolean") preferences.ownTeamsOnly = source.ownTeamsOnly;
  if (typeof source.incompleteOnly === "boolean") preferences.incompleteOnly = source.incompleteOnly;
  if (isStringOption(source.marketplaceKindFilter, MARKETPLACE_KIND_FILTERS)) preferences.marketplaceKindFilter = source.marketplaceKindFilter;
  if (isStringOption(source.marketplaceStatusFilter, MARKETPLACE_STATUS_FILTERS)) preferences.marketplaceStatusFilter = source.marketplaceStatusFilter;
  if (isStringOption(source.marketplaceVisibilityFilter, MARKETPLACE_VISIBILITY_FILTERS)) preferences.marketplaceVisibilityFilter = source.marketplaceVisibilityFilter;
  if (isStringOption(source.marketplacePublicationFilter, MARKETPLACE_PUBLICATION_FILTERS)) preferences.marketplacePublicationFilter = source.marketplacePublicationFilter;
  if (typeof source.openMtcSlotsOnly === "boolean") preferences.openMtcSlotsOnly = source.openMtcSlotsOnly;
  if (quickFilterExcludes) preferences.quickFilterExcludes = quickFilterExcludes;
  if (typeof source.createdFrom === "string") preferences.createdFrom = clampDateTimeLocalToNow(source.createdFrom);
  if (typeof source.createdTo === "string") preferences.createdTo = clampDateTimeLocalToNow(source.createdTo);
  if (isStringOption(source.viewMode, DASHBOARD_VIEW_MODES)) preferences.viewMode = source.viewMode;
  if (isStringOption(source.sortField, TEAM_SORT_FIELDS)) preferences.sortField = source.sortField;
  if (isStringOption(source.sortDirection, SORT_DIRECTIONS)) preferences.sortDirection = source.sortDirection;

  return preferences;
}

function getStoredDashboardFilterPreferences(storageKey: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(storageKey);
    if (!rawValue) {
      return null;
    }

    return sanitizeDashboardFilterPreferences(JSON.parse(rawValue));
  } catch {
    return null;
  }
}

function getDateTimeFilterTimestamp(value: string) {
  if (!value) return null;

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function getCategoryFilterKeys(value: string) {
  if (value === DAMEN_CATEGORY_FILTER_VALUE) return [...DAMEN_CATEGORY_KEYS];
  if (value === HERREN_CATEGORY_FILTER_VALUE) return [...HERREN_CATEGORY_KEYS];
  return value === "all" ? [] : [value];
}

function getCategoryFilterKeySet(values: string[]) {
  return new Set(values.flatMap(getCategoryFilterKeys));
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
  return team.registrationMode === "MARKETPLACE" && team.marketplaceStatus === "MATCHING";
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

function getMarketplaceVisibilityMeta(value?: Team["marketplaceVisibility"] | null) {
  const normalized = value || "ADMIN_MANAGEMENT_ONLY";
  const label = getMarketplaceVisibilityLabel(normalized);

  if (normalized === "PUBLIC") {
    return {
      label,
      shortLabel: "Öffentlich",
      icon: Eye,
      className: "border-green-300 text-green-700",
    };
  }

  if (normalized === "MARKETPLACE_USERS") {
    return {
      label,
      shortLabel: "Börse",
      icon: UserRound,
      className: "border-blue-300 text-blue-700",
    };
  }

  if (normalized === "PORTAL_USERS") {
    return {
      label,
      shortLabel: "Portal",
      icon: UserRound,
      className: "border-indigo-300 text-indigo-700",
    };
  }

  return {
    label,
    shortLabel: "Admin/MGMT",
    icon: EyeOff,
    className: "border-amber-300 text-amber-700",
  };
}

function getTeamPublicationLabel(value?: Team["teamPublicationLevel"] | null) {
  return TEAM_PUBLICATION_OPTIONS.find((option) => option.id === (value || "TEAM_ANONYM"))?.label || "Team anonym";
}

function getParticipantPublicationLabel(value?: Participant["participantPublicationPreference"] | null) {
  return PARTICIPANT_PUBLICATION_OPTIONS.find((option) => option.id === (value || "NAME_VERBERGEN"))?.label || "Name verbergen";
}

function getTeamVisibilityMeta(team: Team): { label: string; icon: LucideIcon; className: string } {
  if (team.registrationMode === "MARKETPLACE") {
    const visibilityMeta = getMarketplaceVisibilityMeta(team.marketplaceVisibility);
    return {
      label: visibilityMeta.label,
      icon: visibilityMeta.icon,
      className: visibilityMeta.className,
    };
  }

  const publicationLevel = team.teamPublicationLevel || "TEAM_ANONYM";

  if (publicationLevel === "ALLES_OEFFENTLICH") {
    return {
      label: getTeamPublicationLabel(publicationLevel),
      icon: Eye,
      className: "border-green-300 text-green-700",
    };
  }

  if (publicationLevel === "TEAMNAME_OEFFENTLICH") {
    return {
      label: getTeamPublicationLabel(publicationLevel),
      icon: Eye,
      className: "border-blue-300 text-blue-700",
    };
  }

  return {
    label: getTeamPublicationLabel(publicationLevel),
    icon: EyeOff,
    className: "border-amber-300 text-amber-700",
  };
}

function TeamVisibilityIconBadge({ team, active, onToggle }: { team: Team; active: boolean; onToggle: () => void }) {
  const visibilityMeta = getTeamVisibilityMeta(team);
  const VisibilityIcon = visibilityMeta.icon;

  return (
    <span className="relative inline-flex shrink-0">
      <button
        type="button"
        className={`inline-flex size-6 items-center justify-center rounded-full border bg-background shadow-sm transition-colors hover:bg-muted ${visibilityMeta.className}`}
        title={visibilityMeta.label}
        aria-label={visibilityMeta.label}
        aria-expanded={active}
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
      >
        <VisibilityIcon className="size-3.5" aria-hidden="true" />
      </button>
      {active && (
        <span className="absolute left-1/2 top-full z-30 mt-1 max-w-[min(70vw,16rem)] -translate-x-1/2 whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-[11px] text-popover-foreground shadow-md">
          {visibilityMeta.label}
        </span>
      )}
    </span>
  );
}

function TeamAdminInfoButton({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground"
      title="Mannschafts-Info"
      aria-label="Mannschafts-Info"
      aria-expanded={active}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
    >
      <Info className="size-3.5" aria-hidden="true" />
    </button>
  );
}

function TeamAdminInfoPanel({
  team,
  compact = false,
  onClick,
}: {
  team: Team;
  compact?: boolean;
  onClick?: (event: React.MouseEvent) => void;
}) {
  const ownerClaimMeta = getOwnerClaimMeta(team);

  return (
    <div
      className={`rounded-md border border-border/60 bg-muted/20 ${compact ? "p-2 text-[11px]" : "p-2.5 text-xs"}`}
      onClick={onClick}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <OwnerClaimBadge team={team} canUseAdminLinks />
        <span className="text-muted-foreground">{ownerClaimMeta.description}</span>
      </div>
      <div className="mt-1.5 grid gap-x-3 gap-y-1 text-muted-foreground sm:grid-cols-2">
        {team.createdAt && <span><strong className="text-foreground">Angelegt:</strong> {formatDatePart(team.createdAt)}, {formatTimePart(team.createdAt)}</span>}
        {team.updatedAt && <span><strong className="text-foreground">Geändert:</strong> {formatDateTime(team.updatedAt) || "Unbekannt"}</span>}
        {(team.ownerName || team.ownerEmail) && (
          <span className="min-w-0 truncate">
            <strong className="text-foreground">Owner:</strong> {team.ownerName || team.ownerEmail}
          </span>
        )}
        {(team.ownerEmail || team.contactEmail) && (
          <span className="min-w-0 truncate">
            <strong className="text-foreground">Owner-Mail:</strong> {team.ownerEmail || team.contactEmail}
          </span>
        )}
        {team.ownerClaim?.suggestedEmail && (
          <span className="min-w-0 truncate">
            <strong className="text-foreground">Claim-Mail:</strong> {team.ownerClaim.suggestedEmail}
          </span>
        )}
        {team.ownerClaim?.sentAt && <span><strong className="text-foreground">Claim erstellt:</strong> {formatDateTime(team.ownerClaim.sentAt) || "Unbekannt"}</span>}
        {team.ownerClaim?.claimedAt && <span><strong className="text-foreground">Claim eingelöst:</strong> {formatDateTime(team.ownerClaim.claimedAt) || "Unbekannt"}</span>}
        {team.ownerClaim?.expiresAt && !team.ownerClaim.claimedAt && (
          <span><strong className="text-foreground">Claim gültig bis:</strong> {formatDateTime(team.ownerClaim.expiresAt) || "Unbekannt"}</span>
        )}
      </div>
    </div>
  );
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
      {isMarketplaceMatching ? (
        <Badge variant="outline" className={`${compactClassName} ${statusClassName}`}>
          MTC {getParticipantCount(team)}/5
        </Badge>
      ) : (
        <>
          <Badge variant="secondary" className={compactClassName}>
            Sportlerbörse
          </Badge>
          <Badge variant="outline" className={`${compactClassName} ${statusClassName}`}>
            {marketplaceStatus.label}
          </Badge>
        </>
      )}
      {!subtle && !isMarketplaceMatching && (
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
  const canFinalizeMtcDraft = isMtcDraft && (access.canEditAll || team.canFinalizeMarketplaceMatching === true);

  return {
    isMarketplaceTeam,
    isMtcDraft,
    hasOpenMtcSlots: isMtcDraft && getParticipantCount(team) < 5,
    canEditMarketplaceVisibility: canEditMarketplaceObject,
    canEditPublicationPreferences: canEditMarketplaceObject || access.canEditOwnTeam === true,
    canManageSlots: access.canEditAll && isMtcDraft,
    canSearchParticipants: access.canEditAll && isMtcDraft && getParticipantCount(team) < 5,
    canFinalizeMtcDraft,
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
  canUseAdminLinks = false,
}: {
  team: Team;
  participant?: Participant | null;
  revealPrivateName: boolean;
  canUseAdminLinks?: boolean;
}) {
  const participantIndex = participant ? (team.participants ?? []).indexOf(participant) : -1;
  const participantLabel = participant
    ? getDashboardParticipantLabel(team, participant, participantIndex, { revealPrivateName })
    : "Kein Teilnehmer erfasst";
  const disciplineCode = participant?.discipline || participant?.disciplineCode || "TBD";
  const discipline = DISCIPLINES.find((entry) => entry.id === disciplineCode);
  const latestChangeMeta = participant ? getLatestChangeMeta(participant.latestChange?.status) : null;
  const emailInviteMeta = participant ? getParticipantEmailInvitationMeta(team, participant) : null;
  const participantMessageUserId = participant?.linkedUserId ?? null;
  const participantMessageEmail = participant?.portalAccount?.email || participant?.email || null;

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
            <DisciplineBrandBadge code={disciplineCode} label={discipline?.label || "Disziplin offen"} />
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
                <AccountLinkStatusDialog
                  meta={emailInviteMeta}
                  title="Teilnehmer Status"
                  rows={[
                    { label: "Teilnehmer", value: participantLabel },
                    { label: "Team", value: team.name, targetType: "team", onClick: () => openTeamDashboard({ teamId: team.id }) },
                    { label: "E-Mail", value: participant?.email },
                    {
                      label: "User",
                      value: participant?.portalAccount?.email || participant?.email || "nicht verknüpft",
                      targetType: "user",
                      onClick: participant?.linkedUserId || participant?.portalAccount?.email || participant?.email
                        ? () => openUserDashboard({ userId: participant?.linkedUserId, email: participant?.portalAccount?.email || participant?.email, teamId: team.id })
                        : undefined,
                    },
                    { label: "Portal-Konto", value: participant?.linkedUserId ? "verknüpft" : participant?.portalAccount?.email || "nicht verknüpft" },
                    { label: "Claim", value: emailInviteMeta.label, targetType: "claim", onClick: () => { window.location.href = "/claim-links"; } },
                    { label: "Versendet", value: participant?.emailInvitation?.sentAt ? formatDateTime(participant.emailInvitation.sentAt) : null },
                    { label: "Gültig bis", value: participant?.emailInvitation?.expiresAt && !participant.emailInvitation.claimedAt ? formatDateTime(participant.emailInvitation.expiresAt) : null },
                    { label: "Eingelöst", value: participant?.emailInvitation?.claimedAt ? formatDateTime(participant.emailInvitation.claimedAt) : null },
                  ]}
                  actions={canUseAdminLinks && participantMessageUserId
                    ? [{
                        label: "Nachricht schreiben",
                        onClick: () => openAdminMessageComposer({
                          userId: participantMessageUserId,
                          email: participantMessageEmail,
                          name: participantLabel,
                          teamId: team.id,
                          participantId: participant?.id,
                        }),
                      }]
                    : undefined}
                />
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
      (value): value is TeamOptionalColumnKey =>
        typeof value === "string" &&
        allowedKeys.has(value as TeamOptionalColumnKey) &&
        value !== "participants",
    );

    return sanitized.length > 0 ? sanitized : null;
  } catch {
    return null;
  }
}

function buildTeamDashboardLayoutConfig(input: {
  viewMode: DashboardViewMode;
  visibleColumns: TeamOptionalColumnKey[];
  sortField: TeamSortField;
  sortDirection: SortDirection;
}): TeamDashboardLayoutConfig {
  const exportColumns: TeamExportColumnKey[] = ["teamName"];
  for (const column of input.visibleColumns) {
    const exportColumn = VISIBLE_COLUMN_EXPORT_MAP[column];
    if (exportColumn && !exportColumns.includes(exportColumn)) {
      exportColumns.push(exportColumn);
    }
  }

  return {
    version: 1,
    viewMode: input.viewMode,
    visibleColumns: input.visibleColumns,
    sortField: input.sortField,
    sortDirection: input.sortDirection,
    exportColumns,
  };
}

function areLayoutConfigsEqual(left: TeamDashboardLayoutConfig, right: TeamDashboardLayoutConfig) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export default function Dashboard({ ownerFilter: initialOwnerFilter, marketplaceFocus = false }: DashboardProps = {}) {
  const { data: session, status: sessionStatus } = useSession();
  const { can, activeRole } = usePermissions();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingTeams, setRefreshingTeams] = useState(false);
  const [offlineCacheState, setOfflineCacheState] = useState<{ storedAt: string | null; fallback: boolean } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilters, setCategoryFilters] = useState<string[]>([]);
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
  const [openingMtcEditTeamId, setOpeningMtcEditTeamId] = useState<string | null>(null);
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const pendingFocusTeamIdRef = useRef<string | null>(null);
  const [expandedMarketplaceContainerTeam, setExpandedMarketplaceContainerTeam] = useState<string | null>(null);
  const [teamVisibilityInfoTeamId, setTeamVisibilityInfoTeamId] = useState<string | null>(null);
  const [teamAdminInfoTeamId, setTeamAdminInfoTeamId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [quickFilterMenuOpen, setQuickFilterMenuOpen] = useState(false);
  const [quickFilterExcludes, setQuickFilterExcludes] = useState<Record<QuickFilterKey, boolean>>(EMPTY_QUICK_EXCLUDES);
  const [listOptionsOpen, setListOptionsOpen] = useState(false);
  const [layoutManagerOpen, setLayoutManagerOpen] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [importingLegacyCsv, setImportingLegacyCsv] = useState(false);
  const legacyImportInputRef = useRef<HTMLInputElement | null>(null);
  const [sortField, setSortField] = useState<TeamSortField>(DEFAULT_TEAM_SORT_FIELD);
  const [sortDirection, setSortDirection] = useState<SortDirection>(DEFAULT_TEAM_SORT_DIRECTION);
  const [preferencesLoadedForKey, setPreferencesLoadedForKey] = useState("");
  const [visibleColumns, setVisibleColumns] = useState<TeamOptionalColumnKey[]>(DEFAULT_TEAM_LIST_VISIBLE_COLUMNS);
  const [dashboardLayouts, setDashboardLayouts] = useState<SavedDashboardLayout[]>([]);
  const [layoutsLoading, setLayoutsLoading] = useState(false);
  const [layoutsLoaded, setLayoutsLoaded] = useState(false);
  const [selectedLayoutId, setSelectedLayoutId] = useState("");
  const [layoutName, setLayoutName] = useState("");
  const [layoutScope, setLayoutScope] = useState<DashboardLayoutScope>("PERSONAL");
  const [savingLayout, setSavingLayout] = useState(false);
  const [deletingLayout, setDeletingLayout] = useState(false);

  const canEditAll = can("team.edit.all");
  const canViewAll = can("team.view.all");
  const isAdmin = activeRole === "ADMIN";
  const canUseAdminLinks = activeRole === "ADMIN";
  const showAdminDashboardInfo = activeRole === "ADMIN";
  const canExportCompetitionCsv = activeRole === "ADMIN" || activeRole === "MODERATOR";
  const canImportLegacyStartNumbers = activeRole === "ADMIN";
  const userEmail = session?.user?.email;
  const preferenceStorageKey = useMemo(() => {
    const userPart = userEmail ? normalizeEmail(userEmail) : "anonymous";
    const focusPart = marketplaceFocus ? "marketplace" : "teams";
    return `${TEAM_DASHBOARD_PREFERENCES_STORAGE_PREFIX}.${userPart}.${activeRole}.${focusPart}`;
  }, [activeRole, marketplaceFocus, userEmail]);
  const { active: activeCompetition, loading: competitionLoading } = useCompetition();
  const selectedLayoutStorageKey = useMemo(() => {
    const userPart = userEmail ? normalizeEmail(userEmail) : "anonymous";
    const focusPart = marketplaceFocus ? "marketplace" : "teams";
    const competitionPart = activeCompetition?.id || "none";
    return `${TEAM_DASHBOARD_SELECTED_LAYOUT_STORAGE_PREFIX}.${userPart}.${activeRole}.${focusPart}.${competitionPart}`;
  }, [activeCompetition?.id, activeRole, marketplaceFocus, userEmail]);
  const marketplaceGlobalVisibility = activeCompetition?.marketplaceGlobalVisibility === "OFFLINE" ? "OFFLINE" : "SELECTIVE";
  const notifications = useNotifications();
  const showOwnerFilter = isOwnerFilterVisibleForRole(activeRole, activeCompetition);
  const canBrowseAllTeams = canViewAll || canRoleViewAllTeams(activeRole, activeCompetition);
  const offlineTeamsCacheKey = useMemo(() => {
    const userPart = userEmail ? normalizeEmail(userEmail) : "anonymous";
    const competitionPart = activeCompetition?.id || "none";
    const focusPart = marketplaceFocus ? "marketplace" : "teams";
    const scopePart = canBrowseAllTeams ? "all" : "own";
    return `s5evo.offline.dashboardTeams.v1.${competitionPart}.${userPart}.${activeRole}.${focusPart}.${scopePart}`;
  }, [activeCompetition?.id, activeRole, canBrowseAllTeams, marketplaceFocus, userEmail]);
  const sortOptions = useMemo(() => SORT_OPTIONS.filter((option) => !option.adminOnly || isAdmin), [isAdmin]);
  const listOptionalColumns = useMemo(
    () => LIST_OPTIONAL_COLUMNS.filter((column) => !column.adminOnly || isAdmin),
    [isAdmin],
  );
  const currentLayoutConfig = useMemo(
    () => buildTeamDashboardLayoutConfig({ viewMode, visibleColumns, sortField, sortDirection }),
    [sortDirection, sortField, viewMode, visibleColumns],
  );
  const selectedLayout = useMemo(
    () => dashboardLayouts.find((layout) => layout.id === selectedLayoutId) || null,
    [dashboardLayouts, selectedLayoutId],
  );
  const selectedLayoutDirty = Boolean(selectedLayout && !areLayoutConfigsEqual(currentLayoutConfig, selectedLayout.config));
  const canManageSelectedLayout = Boolean(selectedLayout && (selectedLayout.scope === "PERSONAL" || isAdmin));

  useEffect(() => {
    if (sessionStatus === "loading") {
      return;
    }

    const preferences = getStoredDashboardFilterPreferences(preferenceStorageKey);
    if (preferences) {
      if (typeof preferences.searchQuery === "string") setSearchQuery(preferences.searchQuery);
      if (preferences.categoryFilters) {
        setCategoryFilters(preferences.categoryFilters);
      } else if (typeof preferences.categoryFilter === "string") {
        setCategoryFilters(preferences.categoryFilter === "all" ? [] : [preferences.categoryFilter]);
      }
      if (showOwnerFilter && !initialOwnerFilter && typeof preferences.ownerFilter === "string") {
        setOwnerFilter(preferences.ownerFilter);
      }
      if (typeof preferences.ownTeamsOnly === "boolean") setOwnTeamsOnly(preferences.ownTeamsOnly);
      if (typeof preferences.incompleteOnly === "boolean") setIncompleteOnly(preferences.incompleteOnly);
      if (preferences.marketplaceKindFilter) {
        setMarketplaceKindFilter(marketplaceFocus && preferences.marketplaceKindFilter === "all" ? "marketplace" : preferences.marketplaceKindFilter);
      }
      if (preferences.marketplaceStatusFilter) setMarketplaceStatusFilter(preferences.marketplaceStatusFilter);
      if (preferences.marketplaceVisibilityFilter) setMarketplaceVisibilityFilter(preferences.marketplaceVisibilityFilter);
      if (preferences.marketplacePublicationFilter) setMarketplacePublicationFilter(preferences.marketplacePublicationFilter);
      if (typeof preferences.openMtcSlotsOnly === "boolean") setOpenMtcSlotsOnly(preferences.openMtcSlotsOnly);
      if (preferences.quickFilterExcludes) setQuickFilterExcludes(preferences.quickFilterExcludes);
      if (typeof preferences.createdFrom === "string") setCreatedFrom(preferences.createdFrom);
      if (typeof preferences.createdTo === "string") setCreatedTo(preferences.createdTo);
      if (preferences.viewMode) setViewMode(preferences.viewMode);
      if (preferences.sortField) setSortField(preferences.sortField);
      if (preferences.sortDirection) setSortDirection(preferences.sortDirection);
    }

    setPreferencesLoadedForKey(preferenceStorageKey);
  }, [initialOwnerFilter, marketplaceFocus, preferenceStorageKey, sessionStatus, showOwnerFilter]);

  useEffect(() => {
    if (typeof window === "undefined" || preferencesLoadedForKey !== preferenceStorageKey) {
      return;
    }

    const preferences: DashboardFilterPreferences = {
      searchQuery,
      categoryFilter: categoryFilters[0] ?? "all",
      categoryFilters,
      ownerFilter: showOwnerFilter ? ownerFilter : "all",
      ownTeamsOnly,
      incompleteOnly,
      marketplaceKindFilter,
      marketplaceStatusFilter,
      marketplaceVisibilityFilter,
      marketplacePublicationFilter,
      openMtcSlotsOnly,
      quickFilterExcludes,
      createdFrom,
      createdTo,
      viewMode,
      sortField,
      sortDirection,
    };

    window.localStorage.setItem(preferenceStorageKey, JSON.stringify(preferences));
  }, [
    categoryFilters,
    createdFrom,
    createdTo,
    incompleteOnly,
    marketplaceKindFilter,
    marketplacePublicationFilter,
    marketplaceStatusFilter,
    marketplaceVisibilityFilter,
    openMtcSlotsOnly,
    ownerFilter,
    ownTeamsOnly,
    preferenceStorageKey,
    preferencesLoadedForKey,
    quickFilterExcludes,
    searchQuery,
    showOwnerFilter,
    sortDirection,
    sortField,
    viewMode,
  ]);

  const fetchTeams = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") setLoading(true);
    if (mode === "refresh") setRefreshingTeams(true);

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
      const nextTeams = data.teams || [];
      setTeams(nextTeams);
      const stored = writeOfflineCache(offlineTeamsCacheKey, { teams: nextTeams });
      setOfflineCacheState({ storedAt: stored?.storedAt ?? new Date().toISOString(), fallback: false });
    } catch (error) {
      console.error('Failed to fetch teams:', error);
      const cached = readOfflineCache<{ teams: Team[] }>(offlineTeamsCacheKey);
      if (cached) {
        setTeams(cached.data.teams || []);
        setOfflineCacheState({ storedAt: cached.storedAt, fallback: true });
        notifications.info(
          "Lokaler Mannschaftsstand geladen",
          `Datenstand: ${formatOfflineCacheTimestamp(cached.storedAt)}.`,
        );
      } else {
        notifications.error(
          "Teams konnten nicht geladen werden",
          error instanceof Error ? error.message : "Bitte versuche es erneut.",
        );
      }
    } finally {
      setLoading(false);
      setRefreshingTeams(false);
    }
  }, [activeCompetition?.id, activeRole, canBrowseAllTeams, notifications, offlineTeamsCacheKey]);

  const fetchDashboardLayouts = useCallback(async () => {
    if (sessionStatus === "loading") {
      return;
    }

    setLayoutsLoading(true);
    setLayoutsLoaded(false);
    try {
      const params = new URLSearchParams();
      if (activeCompetition?.id) params.set("competitionId", activeCompetition.id);
      const response = await fetch(`/api/dashboard-layouts?${params.toString()}`);
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Layouts konnten nicht geladen werden.");
      }

      setDashboardLayouts(data.layouts || []);
    } catch (error) {
      console.error("Failed to fetch dashboard layouts:", error);
      notifications.error(
        "Layouts konnten nicht geladen werden",
        error instanceof Error ? error.message : "Bitte versuche es erneut.",
      );
    } finally {
      setLayoutsLoading(false);
      setLayoutsLoaded(true);
    }
  }, [activeCompetition?.id, notifications, sessionStatus]);

  useEffect(() => {
    if (sessionStatus === "loading") {
      return;
    }

    fetchDashboardLayouts();
  }, [fetchDashboardLayouts, sessionStatus]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setSelectedLayoutId(window.localStorage.getItem(selectedLayoutStorageKey) || "");
  }, [selectedLayoutStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (selectedLayoutId) {
      window.localStorage.setItem(selectedLayoutStorageKey, selectedLayoutId);
    } else {
      window.localStorage.removeItem(selectedLayoutStorageKey);
    }
  }, [selectedLayoutId, selectedLayoutStorageKey]);

  useEffect(() => {
    if (!layoutsLoaded) {
      return;
    }

    if (dashboardLayouts.length === 0) {
      setSelectedLayoutId("");
      setLayoutName("");
      return;
    }

    if (selectedLayoutId && dashboardLayouts.some((layout) => layout.id === selectedLayoutId)) {
      return;
    }

    const defaultLayout = dashboardLayouts.find((layout) => layout.isDefault) || null;
    if (defaultLayout) {
      setSelectedLayoutId(defaultLayout.id);
    }
  }, [dashboardLayouts, layoutsLoaded, selectedLayoutId]);

  useEffect(() => {
    if (!selectedLayout) {
      return;
    }

    setLayoutName(selectedLayout.name);
    setLayoutScope(selectedLayout.scope);
    setViewMode(selectedLayout.config.viewMode);
    setVisibleColumns(selectedLayout.config.visibleColumns as TeamOptionalColumnKey[]);
    setSortField(selectedLayout.config.sortField as TeamSortField);
    setSortDirection(selectedLayout.config.sortDirection as SortDirection);
  }, [selectedLayout]);

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

  const handleCreateLayout = async () => {
    const name = layoutName.trim();
    if (!name) {
      notifications.error("Layoutname fehlt", "Bitte gib einen Namen fuer das Layout ein.");
      return;
    }

    setSavingLayout(true);
    try {
      const response = await fetch("/api/dashboard-layouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          scope: isAdmin ? layoutScope : "PERSONAL",
          competitionId: null,
          config: currentLayoutConfig,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Layout konnte nicht gespeichert werden.");
      }

      await fetchDashboardLayouts();
      setSelectedLayoutId(data.layout?.id || "");
      notifications.success("Layout gespeichert", `"${name}" ist jetzt verfuegbar.`);
    } catch (error) {
      console.error("Failed to create dashboard layout:", error);
      notifications.error(
        "Layout konnte nicht gespeichert werden",
        error instanceof Error ? error.message : "Bitte versuche es erneut.",
      );
    } finally {
      setSavingLayout(false);
    }
  };

  const handleUpdateLayout = async () => {
    if (!selectedLayout || !canManageSelectedLayout) {
      return;
    }

    const name = layoutName.trim();
    if (!name) {
      notifications.error("Layoutname fehlt", "Bitte gib einen Namen fuer das Layout ein.");
      return;
    }

    setSavingLayout(true);
    try {
      const response = await fetch(`/api/dashboard-layouts/${selectedLayout.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          config: currentLayoutConfig,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Layout konnte nicht aktualisiert werden.");
      }

      await fetchDashboardLayouts();
      setSelectedLayoutId(data.layout?.id || selectedLayout.id);
      notifications.success("Layout aktualisiert", `"${name}" wurde gespeichert.`);
    } catch (error) {
      console.error("Failed to update dashboard layout:", error);
      notifications.error(
        "Layout konnte nicht aktualisiert werden",
        error instanceof Error ? error.message : "Bitte versuche es erneut.",
      );
    } finally {
      setSavingLayout(false);
    }
  };

  const handleDeleteLayout = async () => {
    if (!selectedLayout || !canManageSelectedLayout) {
      return;
    }

    setDeletingLayout(true);
    try {
      const response = await fetch(`/api/dashboard-layouts/${selectedLayout.id}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Layout konnte nicht geloescht werden.");
      }

      setSelectedLayoutId("");
      setLayoutName("");
      await fetchDashboardLayouts();
      notifications.success("Layout geloescht", "Das Dashboard nutzt wieder deine lokalen Einstellungen.");
    } catch (error) {
      console.error("Failed to delete dashboard layout:", error);
      notifications.error(
        "Layout konnte nicht geloescht werden",
        error instanceof Error ? error.message : "Bitte versuche es erneut.",
      );
    } finally {
      setDeletingLayout(false);
    }
  };

  const handleDownloadCompetitionCsv = async (format: "default" | "legacy-stammdaten" = "default") => {
    if (!activeCompetition?.id) {
      notifications.error("CSV-Export nicht möglich", "Es ist kein aktiver Wettkampf ausgewählt.");
      return;
    }

    setExportingCsv(true);
    try {
      const response = format === "legacy-stammdaten"
        ? await fetch("/api/admin/teams-export", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              competitionId: activeCompetition.id,
              format: "legacy-stammdaten",
              teamIds: sortedTeams.map((team) => team.id),
            }),
          })
        : selectedLayout
        ? await fetch("/api/admin/teams-export", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              competitionId: activeCompetition.id,
              layoutId: selectedLayout.id,
              teamIds: sortedTeams.map((team) => team.id),
            }),
          })
        : await fetch(`/api/admin/teams-export?${new URLSearchParams({ competitionId: activeCompetition.id }).toString()}`);
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "CSV-Export fehlgeschlagen.");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      const filenameMatch = disposition.match(/filename="([^"]+)"/);
      const filename = filenameMatch?.[1] || `teams-export-${new Date().toISOString().slice(0, 10)}.csv`;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      notifications.success(
        "CSV exportiert",
        format === "legacy-stammdaten"
          ? "Die Legacy-Stammdaten-Schnittstelle mit den aktuell gefilterten Mannschaften wurde heruntergeladen."
          : selectedLayout
          ? "Der Layout-Export mit den aktuell gefilterten Mannschaften wurde heruntergeladen."
          : "Der Mannschaftsexport wurde heruntergeladen.",
      );
    } catch (error) {
      console.error("Failed to download team CSV export:", error);
      notifications.error(
        "CSV-Export fehlgeschlagen",
        error instanceof Error ? error.message : "Bitte versuche es erneut.",
      );
    } finally {
      setExportingCsv(false);
    }
  };

  const readLegacyCsvFile = async (file: File) => {
    const buffer = await file.arrayBuffer();
    const utf8 = new TextDecoder("utf-8").decode(buffer);
    if (!utf8.includes("\uFFFD")) return utf8;
    return new TextDecoder("windows-1252").decode(buffer);
  };

  const postLegacyStartNumberImport = async (csv: string, dryRun: boolean) => {
    if (!activeCompetition?.id) {
      throw new Error("Es ist kein aktiver Wettkampf ausgewählt.");
    }

    const response = await fetch("/api/admin/start-numbers/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        competitionId: activeCompetition.id,
        csv,
        delimiter: ";",
        dryRun,
      }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.error || "Legacy-Import fehlgeschlagen.");
    }
    return data as {
      changed?: number;
      assignments?: number;
      parsedRows?: number;
      warnings?: Array<{
        row?: number;
        startNumber?: string | null;
        teamName?: string;
        reason?: string;
      }>;
    };
  };

  const formatLegacyImportWarning = (warning: { row?: number; startNumber?: string | null; teamName?: string; reason?: string }) => {
    const reasonLabels: Record<string, string> = {
      missing_team_name: "Mannschaftsname fehlt",
      missing_start_number: "Startnummer fehlt",
      unmatched_team: "Mannschaft nicht gefunden",
      ambiguous_team: "Mannschaft mehrdeutig",
    };
    const row = warning.row ? `Zeile ${warning.row}` : "Zeile ?";
    const team = warning.teamName ? `: ${warning.teamName}` : "";
    const startNumber = warning.startNumber ? ` (${warning.startNumber})` : "";
    const reason = warning.reason ? reasonLabels[warning.reason] || warning.reason : "Warnung";
    return `${row}${team}${startNumber} - ${reason}`;
  };

  const formatLegacyImportWarnings = (warnings?: Array<{ row?: number; startNumber?: string | null; teamName?: string; reason?: string }>) => {
    if (!warnings?.length) return "";
    const preview = warnings.slice(0, 5).map(formatLegacyImportWarning).join("\n");
    const remaining = warnings.length > 5 ? `\n... plus ${warnings.length - 5} weitere Warnungen` : "";
    return `\n\nWarnungen:\n${preview}${remaining}`;
  };

  const handleLegacyStartNumberImport = async (file: File | null) => {
    if (!file) return;
    if (!activeCompetition?.id) {
      notifications.error("Import nicht möglich", "Es ist kein aktiver Wettkampf ausgewählt.");
      return;
    }

    setImportingLegacyCsv(true);
    try {
      const csv = await readLegacyCsvFile(file);
      const preview = await postLegacyStartNumberImport(csv, true);
      const changed = preview.changed ?? 0;
      const assignments = preview.assignments ?? 0;
      const warnings = preview.warnings?.length ?? 0;

      if (assignments === 0 || changed === 0) {
        notifications.info(
          "Legacy-Import geprüft",
          warnings > 0
            ? `Keine Startnummern geändert. ${warnings} Zeilen brauchen Prüfung.`
            : "Keine Startnummernänderungen gefunden.",
        );
        if (warnings > 0) {
          window.alert(`Legacy-Import Warnungen${formatLegacyImportWarnings(preview.warnings)}`);
        }
        return;
      }

      const confirmed = window.confirm(
        `Legacy-Import übernehmen?\n\nZuordnungen: ${assignments}\nÄnderungen: ${changed}\nWarnungen: ${warnings}${formatLegacyImportWarnings(preview.warnings)}\n\nEs werden nur Startnummern geschrieben.`,
      );
      if (!confirmed) {
        notifications.info("Legacy-Import abgebrochen", "Es wurden keine Startnummern geändert.");
        return;
      }

      const result = await postLegacyStartNumberImport(csv, false);
      await fetchTeams("refresh");
      notifications.success(
        "Startnummern importiert",
        `${result.changed ?? changed} Mannschaften wurden aktualisiert.${warnings > 0 ? ` ${warnings} Warnungen bleiben zur Prüfung.` : ""}`,
      );
    } catch (error) {
      console.error("Failed to import legacy start numbers:", error);
      notifications.error(
        "Legacy-Import fehlgeschlagen",
        error instanceof Error ? error.message : "Bitte Datei prüfen und erneut versuchen.",
      );
    } finally {
      setImportingLegacyCsv(false);
      if (legacyImportInputRef.current) {
        legacyImportInputRef.current.value = "";
      }
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

  const handleOpenMtcOwnerEdit = async (teamId: string) => {
    setOpeningMtcEditTeamId(teamId);
    try {
      const response = await fetch(`/api/teams/${teamId}/mtc-edit-link`, {
        method: "POST",
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.mtcAnonymousUrl) {
        throw new Error(data?.error || "MTC-Bearbeitungslink konnte nicht erstellt werden.");
      }

      window.location.href = data.mtcAnonymousUrl;
    } catch (error) {
      notifications.error(
        "MTC kann nicht geöffnet werden",
        error instanceof Error ? error.message : "Bitte versuche es erneut.",
      );
    } finally {
      setOpeningMtcEditTeamId((current) => (current === teamId ? null : current));
    }
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

  const toggleTeamVisibilityInfo = useCallback((teamId: string) => {
    setTeamVisibilityInfoTeamId((currentTeamId) => (currentTeamId === teamId ? null : teamId));
  }, []);

  const toggleTeamAdminInfo = useCallback((teamId: string) => {
    setTeamAdminInfoTeamId((currentTeamId) => (currentTeamId === teamId ? null : teamId));
  }, []);

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

    let nextColumns: TeamOptionalColumnKey[] = [...storedColumns];

    if (!nextColumns.includes("startNumber")) {
      nextColumns = ["startNumber", ...nextColumns];
    }

    const missingDisciplineColumns = DISCIPLINE_PARTICIPANT_COLUMN_KEYS.filter((key) => !nextColumns.includes(key));
    if (missingDisciplineColumns.length > 0) {
      const categoryIndex = nextColumns.indexOf("category");
      const insertAt = categoryIndex >= 0 ? categoryIndex + 1 : Math.min(1, nextColumns.length);
      nextColumns = [
        ...nextColumns.slice(0, insertAt),
        ...missingDisciplineColumns,
        ...nextColumns.slice(insertAt),
      ];
    }

    setVisibleColumns(nextColumns);
  }, []);

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
      setSortField(DEFAULT_TEAM_SORT_FIELD);
      setSortDirection(DEFAULT_TEAM_SORT_DIRECTION);
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

  const scrollTeamIntoView = useCallback((teamId: string) => {
    const scroll = () => {
      document.getElementById(`team-${teamId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    window.requestAnimationFrame(() => {
      scroll();
      window.setTimeout(scroll, 260);
    });
  }, []);

  const focusTeam = useCallback((teamId?: string | null, search?: string | null) => {
    if (!teamId || !teams.some((team) => team.id === teamId)) {
      if (search?.trim()) {
        setSearchQuery(search.trim());
      }
      return;
    }

    setSearchQuery(search?.trim() || "");
    setViewMode("cards");
    pendingFocusTeamIdRef.current = teamId;
    setExpandedTeam(teamId);
    scrollTeamIntoView(teamId);
  }, [scrollTeamIntoView, teams]);

  useEffect(() => {
    const pendingFocusTeamId = pendingFocusTeamIdRef.current;
    if (!pendingFocusTeamId || expandedTeam !== pendingFocusTeamId || viewMode !== "cards") {
      return;
    }

    pendingFocusTeamIdRef.current = null;
    scrollTeamIntoView(pendingFocusTeamId);
  }, [expandedTeam, scrollTeamIntoView, viewMode]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const listener: EventListener = (event) => {
      const detail = (event as CustomEvent<{ teamId?: string | null; search?: string | null }>).detail;
      focusTeam(detail?.teamId, detail?.search);
    };

    window.addEventListener(TEAM_DASHBOARD_FOCUS_EVENT, listener);
    return () => window.removeEventListener(TEAM_DASHBOARD_FOCUS_EVENT, listener);
  }, [focusTeam]);

  useEffect(() => {
    if (typeof window === "undefined" || teams.length === 0) {
      return;
    }

    const focusTeamId = window.sessionStorage.getItem(TEAM_FOCUS_STORAGE_KEY);
    if (!focusTeamId || !teams.some((team) => team.id === focusTeamId)) {
      return;
    }

    window.sessionStorage.removeItem(TEAM_FOCUS_STORAGE_KEY);
    focusTeam(focusTeamId);
  }, [focusTeam, teams]);

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
    const selectedCategoryKeys = getCategoryFilterKeySet(categoryFilters);

    return teams.filter(team => {
      const capabilities = getTeamCapabilities(team, { canEditAll, canEditOwnTeam: team.canCurrentUserEdit });
      // Category filter
      const matchesCategory = selectedCategoryKeys.size === 0 || selectedCategoryKeys.has(team.category);
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
      const matchesQuickExcludes =
        (!quickFilterExcludes.mine || team.isCurrentUserTeam !== true) &&
        (!quickFilterExcludes.needsReview || !(canShowTeamActionStatus(team, showAdminDashboardInfo) && isTeamIncomplete(team))) &&
        (!quickFilterExcludes.marketplace || !(capabilities.isMarketplaceTeam && !capabilities.isMtcDraft)) &&
        (!quickFilterExcludes.mtc || !capabilities.isMtcDraft) &&
        (!quickFilterExcludes.openSlots || !capabilities.hasOpenMtcSlots);
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
        matchesQuickExcludes &&
        matchesCreatedAt &&
        matchesSearch;
    });
  }, [teams, categoryFilters, searchQuery, ownerFilter, ownTeamsOnly, incompleteOnly, marketplaceKindFilter, marketplaceStatusFilter, marketplaceVisibilityFilter, marketplacePublicationFilter, openMtcSlotsOnly, quickFilterExcludes, createdFrom, createdTo, showOwnerFilter, showAdminDashboardInfo, isAdmin, canEditAll]);

  const statisticBaseTeams = marketplaceFocus ? teams.filter((team) => team.registrationMode === "MARKETPLACE") : teams;
  const categories = [...new Set(statisticBaseTeams.map(t => t.category))].sort(compareClassificationCodes);
  const ownerOptions = [...new Set(teams.map((t) => t.ownerEmail || t.contactEmail).filter(Boolean))] as string[];
  const categoryStats = categories.map(cat => ({
    category: cat,
    count: statisticBaseTeams.filter(t => t.category === cat).length
  }));
  const sortedTeams = useMemo(() => {
    const collator = new Intl.Collator("de", { numeric: true, sensitivity: "base" });

    return [...filteredTeams].sort((left, right) => {
      let result = 0;

      switch (sortField) {
        case "name":
          result = collator.compare(left.name, right.name);
          break;
        case "startNumber":
          result = collator.compare(left.startNumber || "", right.startNumber || "");
          break;
        case "category":
          result = compareClassificationCodes(left.category, right.category);
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

  const visibleColumnDefs = visibleColumns
    .map((key) => listOptionalColumns.find((column) => column.key === key))
    .filter((column): column is (typeof listOptionalColumns)[number] => Boolean(column));

  const categoryMeta: Record<string, { icon: string; className: string; label?: string }> = {
    "schueler-a": { icon: "SA", label: "Schüler A", className: "border-sky-300 bg-sky-50 text-sky-800" },
    "schueler-b": { icon: "SB", label: "Schüler B", className: "border-cyan-300 bg-cyan-50 text-cyan-800" },
    jugend: { icon: "J", label: "Jugend", className: "border-violet-300 bg-violet-50 text-violet-800" },
    "damen-a": { icon: "DA", label: "Damen A", className: "border-pink-300 bg-pink-50 text-pink-800" },
    "damen-b": { icon: "DB", label: "Damen B", className: "border-rose-300 bg-rose-50 text-rose-800" },
    jungsters: { icon: "HA", label: "Jungsters", className: "border-yellow-300 bg-yellow-50 text-yellow-800" },
    herren: { icon: "HB", label: "Herren", className: "border-blue-300 bg-blue-50 text-blue-800" },
    masters: { icon: "HC", label: "Masters", className: "border-amber-300 bg-amber-50 text-amber-800" },
    sportlerboerse: { icon: "", label: "Sportlerbörse", className: "border-emerald-300 bg-emerald-50 text-emerald-800" },
  };

  const getCategoryMeta = (category: string) =>
    categoryMeta[category] || { icon: "🏆", label: category, className: "border-muted-foreground/30 text-muted-foreground" };

  const renderCategoryBadge = (team: Team, className = "") => {
    const meta = getCategoryMeta(team.category);

    return (
      <Badge variant="outline" className={`gap-1 ${meta.className} ${className}`}>
        {team.category === "sportlerboerse" ? (
          <UsersRound className="size-3" aria-hidden="true" />
        ) : (
          <span>{meta.icon}</span>
        )}
        {meta.label || team.category}
      </Badge>
    );
  };

  const renderCategoryIconBadge = (team: Team, className = "") => {
    const meta = getCategoryMeta(team.category);

    return (
      <Badge
        variant="outline"
        className={`h-6 w-8 shrink-0 px-0 text-[10px] font-semibold ${meta.className} ${className}`}
        title={`Klasse: ${meta.label || team.category}`}
        aria-label={`Klasse: ${meta.label || team.category}`}
      >
      {team.category === "sportlerboerse" ? (
        <UsersRound className="size-3" aria-hidden="true" />
      ) : (
        <span aria-hidden="true">{meta.icon}</span>
      )}
      </Badge>
    );
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
  const ownTeamCount = teams.filter((team) => team.isCurrentUserTeam === true).length;
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
  const quickExcludeCount = QUICK_FILTER_KEYS.filter((key) => quickFilterExcludes[key]).length;
  const hasActiveFilters =
    searchQuery !== "" ||
    categoryFilters.length > 0 ||
    (showOwnerFilter && ownerFilter !== "all") ||
    ownTeamsOnly ||
    incompleteOnly ||
    marketplaceKindFilter !== (marketplaceFocus ? "marketplace" : "all") ||
    marketplaceStatusFilter !== "all" ||
    marketplaceVisibilityFilter !== "all" ||
    marketplacePublicationFilter !== "all" ||
    openMtcSlotsOnly ||
    quickExcludeCount > 0 ||
    (isAdmin && createdFrom !== "") ||
    (isAdmin && createdTo !== "");
  const hasCustomSort = sortField !== DEFAULT_TEAM_SORT_FIELD || sortDirection !== DEFAULT_TEAM_SORT_DIRECTION;
  const hasResettableDashboardState = hasActiveFilters || hasCustomSort;
  const activeFilterCount = [
    searchQuery !== "",
    categoryFilters.length > 0,
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
  const teamHitStats = [
    {
      key: "total",
      label: "Gesamt",
      shortLabel: "Ges.",
      filterValue: "all",
      current: filteredTeams.length,
      total: statisticBaseTeams.length,
      variant: "default" as const,
    },
    {
      key: "damen",
      label: "Damen",
      shortLabel: "D",
      filterValue: DAMEN_CATEGORY_FILTER_VALUE,
      current: filteredTeams.filter((team) => DAMEN_CATEGORY_KEYS.has(team.category)).length,
      total: statisticBaseTeams.filter((team) => DAMEN_CATEGORY_KEYS.has(team.category)).length,
      variant: "secondary" as const,
    },
    {
      key: "herren",
      label: "Herren",
      shortLabel: "H",
      filterValue: HERREN_CATEGORY_FILTER_VALUE,
      current: filteredTeams.filter((team) => HERREN_CATEGORY_KEYS.has(team.category)).length,
      total: statisticBaseTeams.filter((team) => HERREN_CATEGORY_KEYS.has(team.category)).length,
      variant: "secondary" as const,
    },
    ...categoryStats.map((cat) => {
      const meta = getCategoryMeta(cat.category);

      return {
        key: `category-${cat.category}`,
        label: meta.label || cat.category,
        shortLabel: cat.category === "sportlerboerse" ? "Börse" : meta.icon,
        filterValue: cat.category,
        current: filteredTeams.filter((team) => team.category === cat.category).length,
        total: cat.count,
        variant: "outline" as const,
      };
    }),
  ].filter((entry) => entry.total > 0 || entry.current > 0);
  const canEditOwn = can("team.edit.own");
  const maxCreatedDateTime = formatDateTimeLocalInput(new Date());

  const getQuickFilterMode = (key: QuickFilterKey): QuickFilterMode => {
    if (quickFilterExcludes[key]) return "exclude";
    if (key === "mine") return ownTeamsOnly ? "include" : "neutral";
    if (key === "needsReview") return incompleteOnly ? "include" : "neutral";
    if (key === "marketplace") return marketplaceKindFilter === "single" && !openMtcSlotsOnly ? "include" : "neutral";
    if (key === "mtc") return marketplaceKindFilter === "mtc" && !openMtcSlotsOnly ? "include" : "neutral";
    if (key === "openSlots") return openMtcSlotsOnly ? "include" : "neutral";
    return "neutral";
  };

  const setQuickFilterMode = (key: QuickFilterKey, mode: QuickFilterMode) => {
    setQuickFilterExcludes((current) => ({ ...current, [key]: mode === "exclude" }));

    if (key === "mine") {
      setOwnTeamsOnly(mode === "include");
      return;
    }
    if (key === "needsReview") {
      setIncompleteOnly(mode === "include");
      return;
    }
    if (key === "marketplace") {
      setOpenMtcSlotsOnly(false);
      setMarketplaceKindFilter(mode === "include" ? "single" : marketplaceFocus ? "marketplace" : "all");
      return;
    }
    if (key === "mtc") {
      setOpenMtcSlotsOnly(false);
      setMarketplaceKindFilter(mode === "include" ? "mtc" : marketplaceFocus ? "marketplace" : "all");
      return;
    }
    if (key === "openSlots") {
      setOpenMtcSlotsOnly(mode === "include");
      setMarketplaceKindFilter(mode === "include" ? "mtc" : marketplaceFocus ? "marketplace" : "all");
    }
  };

  const quickFilterRows = [
    !marketplaceFocus && {
      key: "mine" as const,
      icon: <Star className="size-3.5" />,
      label: "Meine Teams",
      count: ownTeamCount,
    },
    {
      key: "needsReview" as const,
      icon: <AlertTriangle className="size-3.5" />,
      label: "Prüfen",
      count: incompleteTeams,
    },
    isAdmin && !marketplaceFocus && {
      key: "marketplace" as const,
      icon: <Search className="size-3.5" />,
      label: "Einzelsportler",
      count: marketplaceSingleTeams.length,
    },
    isAdmin && {
      key: "mtc" as const,
      icon: <ClipboardList className="size-3.5" />,
      label: "MTC",
      count: mtcTeams.length,
    },
    isAdmin && {
      key: "openSlots" as const,
      icon: <AlertTriangle className="size-3.5" />,
      label: "Offene Slots",
      count: openMtcSlotTeams.length,
    },
  ].filter(Boolean) as Array<{ key: QuickFilterKey; icon: ReactNode; label: string; count: number }>;
  const quickActiveCount = quickFilterRows.filter((row) => getQuickFilterMode(row.key) !== "neutral").length;
  const layoutBadgeLabel = selectedLayoutDirty ? "!" : selectedLayout ? "1" : layoutManagerOpen ? "•" : null;
  const toolbarCounterBadgeClass = (open: boolean) =>
    `pointer-events-none absolute -right-1 -top-1 h-4 min-w-4 justify-center border-2 px-1 text-[10px] shadow-sm ${
      open
        ? "border-background bg-primary text-primary-foreground ring-1 ring-primary-foreground/60"
        : "border-primary/50 bg-background text-primary"
    }`;

  const resetFilters = () => {
    setSearchQuery("");
    setCategoryFilters([]);
    setOwnerFilter(showOwnerFilter ? (initialOwnerFilter || "all") : "all");
    setOwnTeamsOnly(false);
    setIncompleteOnly(false);
    setMarketplaceKindFilter(marketplaceFocus ? "marketplace" : "all");
    setMarketplaceStatusFilter("all");
    setMarketplaceVisibilityFilter("all");
    setMarketplacePublicationFilter("all");
    setOpenMtcSlotsOnly(false);
    setQuickFilterExcludes(EMPTY_QUICK_EXCLUDES);
    setCreatedFrom("");
    setCreatedTo("");
    setSortField(DEFAULT_TEAM_SORT_FIELD);
    setSortDirection(DEFAULT_TEAM_SORT_DIRECTION);
  };

  const toggleStatFilter = (filterValue: string) => {
    if (filterValue === "all") {
      setCategoryFilters([]);
      return;
    }

    setCategoryFilters((current) =>
      current.includes(filterValue)
        ? current.filter((entry) => entry !== filterValue)
        : [...current, filterValue],
    );
  };

  const handleHeaderSort = (field: TeamSortField) => {
    if (sortField === field) {
      setSortDirection((direction) => direction === "asc" ? "desc" : "asc");
      return;
    }

    setSortField(field);
    setSortDirection(field === "updatedAt" || field === "createdAt" ? "desc" : "asc");
  };

  const moveVisibleColumn = (key: TeamOptionalColumnKey, direction: "up" | "down") => {
    setVisibleColumns((current) => {
      const index = current.indexOf(key);
      if (index < 0) return current;

      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= current.length) return current;

      const nextColumns = [...current];
      [nextColumns[index], nextColumns[targetIndex]] = [nextColumns[targetIndex], nextColumns[index]];
      return nextColumns;
    });
  };

  const getHeaderSortState = (field: TeamSortField) => {
    if (sortField !== field) {
      return "inactive";
    }

    return sortDirection === "asc" ? "asc" : "desc";
  };

  const sortableHeaderFields: Partial<Record<"name" | TeamOptionalColumnKey, TeamSortField>> = {
    name: "name",
    startNumber: "startNumber",
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
      <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-card px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium">Mannschafts-Dashboard</p>
          <p className={`text-xs ${offlineCacheState?.fallback ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"}`}>
            {offlineCacheState?.fallback ? "Lokaler Stand" : "Datenstand"}: {formatOfflineCacheTimestamp(offlineCacheState?.storedAt)}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void fetchTeams("refresh")} disabled={refreshingTeams}>
          {refreshingTeams ? "Aktualisiere..." : "Daten aktualisieren"}
        </Button>
      </div>

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
        <div className="space-y-2">
          <div className="space-y-2">
            <div className="grid gap-2 lg:grid-cols-[auto_minmax(16rem,1fr)] lg:items-center">
              <div className="inline-flex w-fit rounded-md border border-border/60 bg-muted/20 p-0.5">
                {[
                  { value: "cards" as const, label: "Kacheln" },
                  { value: "list" as const, label: "Liste" },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setViewMode(option.value)}
                    className={`h-8 rounded px-3 text-xs font-medium transition-colors ${
                      viewMode === option.value
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
                    }`}
                    aria-pressed={viewMode === option.value}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="relative min-w-0">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-9 pl-8 text-sm"
                  placeholder={marketplaceFocus ? "Sportlerbörse, Kontakt oder Teilnehmer:in" : "Teamname, Team Manager:in oder Teilnehmer:in"}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div
              className="flex min-w-0 items-center gap-1 overflow-x-auto whitespace-nowrap"
              aria-label="Trefferstatistik"
            >
              {teamHitStats.map((stat) => {
                const valueLabel = hasActiveFilters ? `${stat.current}/${stat.total}` : `${stat.total}`;
                const title = hasActiveFilters
                  ? `${stat.label}: ${stat.current} Treffer von ${stat.total} ohne Filter`
                  : `${stat.label}: ${stat.total} Treffer`;
                const active = stat.filterValue === "all" ? categoryFilters.length === 0 : categoryFilters.includes(stat.filterValue);
                const inactiveClassName =
                  stat.variant === "secondary"
                    ? "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    : stat.variant === "default"
                      ? "border-primary/40 bg-primary/5 text-primary hover:bg-primary/10"
                      : "border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground";

                return (
                  <button
                    key={stat.key}
                    type="button"
                    className={`inline-flex h-6 shrink-0 items-center gap-1 rounded-full border px-2 text-[10px] leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
                      active ? "border-primary bg-primary text-primary-foreground shadow-sm" : inactiveClassName
                    }`}
                    title={`${title} · Tippen zum Filtern`}
                    aria-label={`${stat.label} filtern`}
                    aria-pressed={active}
                    onClick={() => toggleStatFilter(stat.filterValue)}
                  >
                    <span className="hidden sm:inline">{stat.label}</span>
                    <span className="sm:hidden">{stat.shortLabel}</span>
                    <span className="font-semibold tabular-nums">{valueLabel}</span>
                  </button>
                );
              })}
            </div>

            <div className="grid w-full min-w-0 grid-cols-[repeat(auto-fit,minmax(2.25rem,1fr))] items-center gap-1.5 lg:flex lg:w-full lg:flex-wrap lg:justify-end">
              <div className="relative flex min-w-0 items-center lg:size-6">
                <Button
                  type="button"
                  size="icon-xs"
                  className="h-7 w-full lg:size-6"
                  variant={quickActiveCount > 0 || quickFilterMenuOpen ? "default" : "outline"}
                  onClick={() => {
                    setQuickFilterMenuOpen((open) => !open);
                    setFiltersOpen(false);
                    setListOptionsOpen(false);
                    setLayoutManagerOpen(false);
                  }}
                  aria-expanded={quickFilterMenuOpen}
                  title="Schnellfilter"
                  aria-label="Schnellfilter"
                >
                  <SlidersHorizontal className="size-3.5" />
                </Button>
                {quickActiveCount > 0 && (
                  <Badge className={toolbarCounterBadgeClass(quickFilterMenuOpen)} variant="default">
                    {quickActiveCount}
                  </Badge>
                )}
              </div>
              <div className="relative flex min-w-0 items-center lg:size-6">
                <Button
                  type="button"
                  size="icon-xs"
                  className="h-7 w-full lg:size-6"
                  variant={filtersOpen ? "default" : "outline"}
                  onClick={() => {
                    setFiltersOpen((open) => !open);
                    setQuickFilterMenuOpen(false);
                    setListOptionsOpen(false);
                    setLayoutManagerOpen(false);
                  }}
                  title="Filter"
                  aria-label="Filter"
                  aria-expanded={filtersOpen}
                >
                  <SlidersHorizontal className="size-3.5" />
                </Button>
                {activeFilterCount > 0 && (
                  <Badge className={toolbarCounterBadgeClass(filtersOpen)} variant="default">
                    {activeFilterCount}
                  </Badge>
                )}
              </div>
              {viewMode === "list" && (
                <Button
                  type="button"
                  size="icon-xs"
                  className="h-7 w-full lg:size-6"
                  variant={listOptionsOpen ? "default" : "outline"}
                  onClick={() => {
                    setListOptionsOpen((open) => !open);
                    setQuickFilterMenuOpen(false);
                    setFiltersOpen(false);
                    setLayoutManagerOpen(false);
                  }}
                  title="Spalten & Sortierung"
                  aria-label="Spalten & Sortierung"
                  aria-expanded={listOptionsOpen}
                >
                  <ArrowDownUp className="size-3.5" />
                </Button>
              )}
              <div className="relative flex min-w-0 items-center lg:size-6">
                <Button
                  type="button"
                  size="icon-xs"
                  className="h-7 w-full lg:size-6"
                  variant={layoutManagerOpen || selectedLayout || selectedLayoutDirty ? "default" : "outline"}
                  onClick={() => {
                    setLayoutManagerOpen((open) => !open);
                    setQuickFilterMenuOpen(false);
                    setFiltersOpen(false);
                    setListOptionsOpen(false);
                  }}
                  title="Layout"
                  aria-label="Layout"
                  aria-expanded={layoutManagerOpen}
                >
                  <ClipboardList className="size-3.5" />
                </Button>
                {layoutBadgeLabel && (
                  <Badge className={toolbarCounterBadgeClass(layoutManagerOpen)} variant="default">
                    {layoutBadgeLabel}
                  </Badge>
                )}
              </div>
              {canExportCompetitionCsv && (
                <Button
                  type="button"
                  size="icon-xs"
                  className="h-7 w-full lg:size-6"
                  variant="outline"
                  onClick={() => handleDownloadCompetitionCsv()}
                  disabled={exportingCsv || !activeCompetition?.id}
                  title={selectedLayout ? "CSV im gewählten Layout mit gefilterten Zeilen herunterladen" : "Vollständigen Mannschaftsexport als CSV herunterladen"}
                  aria-label="CSV exportieren"
                >
                  <Download className="size-3.5" />
                </Button>
              )}
              {canExportCompetitionCsv && (
                <Button
                  type="button"
                  size="icon-xs"
                  className="h-7 w-full lg:size-6"
                  variant="outline"
                  onClick={() => handleDownloadCompetitionCsv("legacy-stammdaten")}
                  disabled={exportingCsv || !activeCompetition?.id}
                  title="Legacy-Stammdaten-Schnittstelle mit gefilterten Zeilen herunterladen"
                  aria-label="Legacy-Stammdaten exportieren"
                >
                  <FileSpreadsheet className="size-3.5" />
                </Button>
              )}
              {canImportLegacyStartNumbers && (
                <>
                  <input
                    ref={legacyImportInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(event) => void handleLegacyStartNumberImport(event.target.files?.[0] ?? null)}
                  />
                  <Button
                    type="button"
                    size="icon-xs"
                    className="h-7 w-full lg:size-6"
                    variant="outline"
                    onClick={() => legacyImportInputRef.current?.click()}
                    disabled={importingLegacyCsv || !activeCompetition?.id}
                    title="Startnummern aus Legacy-Stammdaten-CSV importieren"
                    aria-label="Legacy-Stammdaten importieren"
                  >
                    <Upload className="size-3.5" />
                  </Button>
                </>
              )}
              <Button
                type="button"
                size="icon-xs"
                className="h-7 w-full lg:size-6"
                variant={hasResettableDashboardState ? "default" : "outline"}
                onClick={resetFilters}
                title={hasCustomSort ? "Filter und Sortierung zurücksetzen" : "Filter zurücksetzen"}
                aria-label={hasCustomSort ? "Filter und Sortierung zurücksetzen" : "Filter zurücksetzen"}
              >
                <XCircle className="size-3.5" />
              </Button>
            </div>
          </div>

          {quickFilterMenuOpen && (
            <div className="rounded-md border border-border/50 bg-popover p-1.5 text-popover-foreground shadow-sm">
              <div className="flex items-center justify-between gap-2 px-2 py-1">
                <div className="text-[10px] font-medium uppercase text-muted-foreground">
                  Schnellfilter kombinieren
                </div>
                <button
                  type="button"
                  onClick={() => setQuickFilterMenuOpen(false)}
                  className="inline-flex h-7 items-center gap-1 rounded px-2 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  title="Schnellzugriff zuklappen"
                  aria-label="Schnellzugriff zuklappen"
                >
                  <ChevronUp className="size-3.5" />
                  Zuklappen
                </button>
              </div>
              <div className="grid gap-1 md:grid-cols-2">
                {quickFilterRows.map((row) => {
                  const mode = getQuickFilterMode(row.key);
                  const modeOptions: Array<{ value: QuickFilterMode; label: string; icon: ReactNode; title: string }> = [
                    { value: "exclude", label: "Ohne", icon: <XCircle className="size-3" />, title: `${row.label} ausschließen` },
                    { value: "neutral", label: "Neutral", icon: <RotateCcw className="size-3" />, title: `${row.label} neutral behandeln` },
                    { value: "include", label: "Nur", icon: <CheckCircle2 className="size-3" />, title: `${row.label} einschließen` },
                  ];

                  return (
                    <div key={row.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-accent/50">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="text-muted-foreground">{row.icon}</span>
                        <span className="min-w-0 truncate text-xs font-medium">{row.label}</span>
                        <Badge variant="outline" className="h-5 px-1.5 text-[10px]">{row.count}</Badge>
                      </div>
                      <div className="flex shrink-0 rounded-md border border-border/60 bg-background/80 p-0.5">
                        {modeOptions.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setQuickFilterMode(row.key, option.value)}
                            className={`inline-flex h-7 items-center gap-1 rounded px-2 text-[10px] transition-colors ${
                              mode === option.value
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                            }`}
                            title={option.title}
                            aria-pressed={mode === option.value}
                          >
                            {option.icon}
                            <span className={option.value === "neutral" ? "hidden sm:inline" : ""}>{option.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
        {(filtersOpen || listOptionsOpen || layoutManagerOpen) && (
          <div className="mt-3 space-y-4 border-t border-border/60 pt-3">
            {layoutManagerOpen && (
              <div className="space-y-3">
                <div className="space-y-0.5">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <ClipboardList className="size-4" />
                    Layout
                  </CardTitle>
                  <p className="hidden text-xs text-muted-foreground sm:block">
                    Ansicht auswählen, speichern oder bestehendes Layout aktualisieren
                  </p>
                </div>

                <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_150px] lg:items-end">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Aktives Layout</label>
                    <Select
                      value={selectedLayoutId || "none"}
                      onValueChange={(value) => {
                        if (value === "none") {
                          setSelectedLayoutId("");
                          setLayoutName("");
                          return;
                        }
                        setSelectedLayoutId(value);
                      }}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Layout wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Lokale Ansicht</SelectItem>
                        {dashboardLayouts.map((layout) => (
                          <SelectItem key={layout.id} value={layout.id}>
                            {layout.scope === "GLOBAL" ? "Global" : "Persönlich"} · {layout.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Layoutname</label>
                    <Input
                      className="h-9 text-xs"
                      value={layoutName}
                      onChange={(event) => setLayoutName(event.target.value)}
                      placeholder="Neues Layout"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Typ</label>
                    <Select
                      value={isAdmin ? layoutScope : "PERSONAL"}
                      onValueChange={(value) => setLayoutScope(value as DashboardLayoutScope)}
                      disabled={!isAdmin || Boolean(selectedLayout)}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PERSONAL">Persönlich</SelectItem>
                        {isAdmin && <SelectItem value="GLOBAL">Global</SelectItem>}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex flex-wrap justify-end gap-1.5 border-t border-border/60 pt-3">
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={handleCreateLayout}
                    disabled={savingLayout || layoutsLoading || !layoutName.trim()}
                  >
                    <ClipboardList className="size-3.5" />
                    Neu speichern
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    variant={selectedLayoutDirty ? "default" : "outline"}
                    onClick={handleUpdateLayout}
                    disabled={savingLayout || !selectedLayout || !canManageSelectedLayout || !layoutName.trim()}
                    title={selectedLayoutDirty ? "Änderungen im gewählten Layout speichern" : "Gewähltes Layout aktualisieren"}
                  >
                    <Pencil className="size-3.5" />
                    Aktualisieren
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    onClick={handleDeleteLayout}
                    disabled={deletingLayout || !selectedLayout || !canManageSelectedLayout}
                    title="Gewähltes Layout löschen"
                  >
                    <Trash2 className="size-3.5" />
                    Löschen
                  </Button>
                  <Button type="button" size="xs" variant="outline" onClick={() => setLayoutManagerOpen(false)}>
                    <ChevronUp className="size-3.5" />
                    Schließen
                  </Button>
                </div>
              </div>
            )}

            {filtersOpen && (
              <>
            <div className="space-y-0.5">
              <CardTitle className="flex items-center gap-2 text-sm">
                <SlidersHorizontal className="size-4" />
                Filter
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
                  <p className="text-xs font-medium text-muted-foreground">Klassen</p>
                  <Button size="xs" variant={categoryFilters.length === 0 ? "default" : "outline"} onClick={() => setCategoryFilters([])}>
                    Alle Klassen
                  </Button>
                </div>
                <div className="flex min-w-0 flex-wrap gap-1.5">
                  {categoryStats.map((cat) => (
                    <Button
                      key={cat.category}
                      size="xs"
                      variant={categoryFilters.includes(cat.category) ? "default" : "outline"}
                      onClick={() => toggleStatFilter(cat.category)}
                    >
                      <span>{cat.category === "sportlerboerse" ? "👥" : getCategoryMeta(cat.category).icon}</span>
                      {cat.category} ({cat.count})
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className={`grid gap-4 md:grid-cols-2 ${showOwnerFilter ? "xl:grid-cols-4" : isAdmin ? "xl:grid-cols-3" : "xl:grid-cols-2"}`}>
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
                {hasResettableDashboardState
                  ? "Aktive Filter und Sortierung können hier gesammelt zurückgesetzt werden."
                  : "Noch keine zusätzlichen Filter oder Sortierung aktiv."}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={resetFilters}
                  disabled={!hasResettableDashboardState}
                >
                  Filter & Sortierung zurücksetzen
                </Button>
                {!(viewMode === "list" && listOptionsOpen) && (
                  <Button type="button" onClick={() => setFiltersOpen(false)} variant="outline">
                    <ChevronUp className="size-4" />
                    Filter zuklappen
                  </Button>
                )}
              </div>
            </div>
              </>
            )}

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
                  <p className="text-xs font-medium text-muted-foreground">Sichtbare Spalten & Reihenfolge</p>
                  <div className="space-y-1.5">
                    {visibleColumnDefs.map((column, index) => {
                      const disableRemoval = visibleColumnDefs.length === 1;

                      return (
                        <div
                          key={column.key}
                          className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-primary/40 bg-primary/5 px-2 py-1.5 text-sm"
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked
                            disabled={disableRemoval}
                            aria-label={`${column.label} ausblenden`}
                            onChange={() => {
                              if (disableRemoval) return;
                              setVisibleColumns((current) => current.filter((entry) => entry !== column.key));
                            }}
                          />
                          <span className="min-w-0 truncate">{column.label}</span>
                          <span className="flex shrink-0 gap-1">
                            <button
                              type="button"
                              className="inline-flex size-7 items-center justify-center rounded border border-border/60 bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
                              title={`${column.label} nach links schieben`}
                              aria-label={`${column.label} nach links schieben`}
                              disabled={index === 0}
                              onClick={() => moveVisibleColumn(column.key, "up")}
                            >
                              <ChevronUp className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              className="inline-flex size-7 items-center justify-center rounded border border-border/60 bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
                              title={`${column.label} nach rechts schieben`}
                              aria-label={`${column.label} nach rechts schieben`}
                              disabled={index === visibleColumnDefs.length - 1}
                              onClick={() => moveVisibleColumn(column.key, "down")}
                            >
                              <ChevronDown className="size-3.5" />
                            </button>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {listOptionalColumns
                      .filter((column) => !visibleColumns.includes(column.key))
                      .map((column) => (
                        <button
                          key={column.key}
                          type="button"
                          className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-background px-3 py-2 text-sm transition-colors hover:bg-muted/40"
                          onClick={() => setVisibleColumns((current) => [...current, column.key])}
                        >
                          <span className="inline-flex size-4 items-center justify-center rounded border border-border/70 text-[10px]">+</span>
                          <span>{column.label}</span>
                        </button>
                      ))}
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
            <table className="min-w-[1280px] w-full text-sm">
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
                  const canEditMarketplaceMatching = capabilities.canManageSlots || capabilities.canFinalizeMtcDraft;
                  const canOpenOwnMtcEdit = isMarketplaceMatching && team.canCurrentUserEdit === true && !canEditAll;
                  const canDeleteTeam = team.canManageTeamManagers === true;
                  const revealPrivateDashboardNames = canRevealPrivateDashboardName(team, isAdmin);

                  return (
                    <tr key={team.id} className="border-b border-border/50 align-top transition-colors hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <div className="font-medium">{team.name}</div>
                          {team.registrationMode === "MARKETPLACE" && (
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <MarketplaceTeamBadges team={team} />
                            </div>
                          )}
                        </div>
                      </td>

                      {visibleColumnDefs.map((column) => {
                        let content: React.ReactNode = null;

                        switch (column.key) {
                          case "startNumber":
                            content = team.startNumber || "—";
                            break;
                          case "category":
                            content = renderCategoryBadge(team);
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
                          case "participantRUN":
                          case "participantBENCH":
                          case "participantSTOCK":
                          case "participantROAD":
                          case "participantMTB": {
                            const disciplineId = column.key.replace("participant", "");
                            const participant = getParticipantForDiscipline(team, disciplineId);
                            const participantIndex = participant ? (team.participants ?? []).indexOf(participant) : -1;
                            const participantLabel = participant
                              ? getDashboardParticipantLabel(team, participant, participantIndex, { revealPrivateName: revealPrivateDashboardNames })
                              : "—";

                            content = (
                              <span className="inline-block max-w-[12rem] truncate" title={participantLabel}>
                                {participantLabel}
                              </span>
                            );
                            break;
                          }
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
                                  {capabilities.canManageSlots ? "Entwurf bearbeiten" : "Als Mannschaft übernehmen"}
                                </Button>
                              )}
                              {canOpenOwnMtcEdit && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOpenMtcOwnerEdit(team.id)}
                                  disabled={openingMtcEditTeamId === team.id}
                                  aria-busy={openingMtcEditTeamId === team.id}
                                >
                                  {openingMtcEditTeamId === team.id ? "Öffne..." : "MTC bearbeiten"}
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
              const canEditMarketplaceMatching = capabilities.canManageSlots || capabilities.canFinalizeMtcDraft;
              const canOpenOwnMtcEdit = isMarketplaceMatching && team.canCurrentUserEdit === true && !canEditAll;
              const canDeleteTeam = team.canManageTeamManagers === true;
              const isMarketplaceContainerOpen = expandedMarketplaceContainerTeam === team.id;
              const marketplaceContainerMailMeta = getEmailInvitationMeta(team.contactEmail ? "none" : "missing_email");
              const marketplaceContainerAccountMeta = getMarketplaceContainerAccountMeta(team);
              const marketplaceContainerAccessMeta = getMarketplaceContainerAccessMeta(team);
              const showCompactActionColumn = true;
              const mtcCombinedActionMeta = isMarketplaceMatching
                ? getMtcCombinedActionMeta(completionMeta, disciplineMeta)
                : null;
              const MtcCombinedActionIcon = mtcCombinedActionMeta?.icon;
              const showCompactStatusRow =
                (showActionStatus && (isMarketplaceMatching
                  ? mtcCombinedActionMeta
                  : completionMeta.isImportant || disciplineMeta.isImportant)) ||
                (showAdminDashboardInfo && pendingChangeCount > 0);

              return (
                <div key={team.id} id={`team-${team.id}`} className="space-y-2 scroll-mt-24">
                  {/* Team-Kachel mit Teilnehmern */}
                  {expandedTeam !== team.id && (
                    <Card
                      className="cursor-pointer transition-colors hover:bg-muted/50"
                      onClick={() => {
                        setExpandedTeam(team.id);
                      }}
                    >
                      <CardContent className="p-2">
                        <div className={`grid items-start gap-1.5 ${showCompactActionColumn ? "grid-cols-[minmax(0,1fr)_auto]" : "grid-cols-1"}`}>
                          <div className="min-w-0 space-y-1.5">
                            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                              <div className="flex min-w-0 max-w-full flex-1 basis-40 items-center gap-1.5">
                                {renderCategoryIconBadge(team)}
                                <h3 className="min-w-0 truncate text-sm font-medium" title={team.name}>{team.name}</h3>
                                <TeamVisibilityIconBadge
                                  team={team}
                                  active={teamVisibilityInfoTeamId === team.id}
                                  onToggle={() => toggleTeamVisibilityInfo(team.id)}
                                />
                                {showAdminDashboardInfo && (
                                  <TeamAdminInfoButton
                                    active={teamAdminInfoTeamId === team.id}
                                    onToggle={() => toggleTeamAdminInfo(team.id)}
                                  />
                                )}
                              </div>
                              {team.isCurrentUserTeam && (
                                <Badge variant="secondary" className="h-6 px-1.5 text-[10px]">
                                  <Star className="size-3" />
                                  Mein Team
                                </Badge>
                              )}
                              <MarketplaceTeamBadges team={team} compact />
                            </div>
                            {showAdminDashboardInfo && teamAdminInfoTeamId === team.id && (
                              <TeamAdminInfoPanel
                                team={team}
                                compact
                                onClick={(event) => event.stopPropagation()}
                              />
                            )}
                            {team.registrationMode === "MARKETPLACE" && !isMarketplaceMatching ? (
                              <MarketplacePersonSummary
                                team={team}
                                participant={marketplaceParticipant}
                                revealPrivateName={revealPrivateDashboardNames}
                                canUseAdminLinks={canUseAdminLinks}
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
                                      <DisciplineBrandIcon code={discipline.id} label={discipline.label} className="size-6 rounded" />
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
                                {showActionStatus && mtcCombinedActionMeta && MtcCombinedActionIcon && (
                                  <Badge variant="outline" className={`h-5 gap-1 px-1.5 text-[10px] ${mtcCombinedActionMeta.toneClass}`}>
                                    <MtcCombinedActionIcon className="size-3" />
                                    {mtcCombinedActionMeta.label}
                                  </Badge>
                                )}
                                {showActionStatus && !isMarketplaceMatching && !mtcCombinedActionMeta && completionMeta.isImportant && (
                                  <Badge variant="outline" className={`h-5 gap-1 px-1.5 text-[10px] ${completionMeta.toneClass}`}>
                                    <CompletionIcon className="size-3" />
                                    {completionMeta.label}
                                  </Badge>
                                )}
                                {showActionStatus && !isMarketplaceMatching && !mtcCombinedActionMeta && disciplineMeta.isImportant && (
                                  <Badge variant="outline" className={`h-5 gap-1 px-1.5 text-[10px] ${disciplineMeta.toneClass}`}>
                                    <DisciplineIcon className="size-3" />
                                    {disciplineMeta.label}
                                  </Badge>
                                )}
                                {showAdminDashboardInfo && pendingChangeCount > 0 && (
                                  <Badge
                                    variant="outline"
                                    className="h-5 cursor-pointer gap-1 border-amber-300 bg-amber-50 px-1.5 text-[10px] text-amber-800"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      openChangesDashboard({ teamId: team.id, status: "PENDING" });
                                    }}
                                    role="link"
                                    title="Zum Änderungsdashboard"
                                  >
                                    <ClipboardList className="size-3" />
                                    {pendingChangeCount} Änderung(en)
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                          {showCompactActionColumn && (
                            <div className="flex items-start justify-end">
                              <div className="flex flex-col gap-1">
                                {canOpenOwnMtcEdit && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-7 shrink-0 px-2 text-[11px]"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void handleOpenMtcOwnerEdit(team.id);
                                    }}
                                    disabled={openingMtcEditTeamId === team.id}
                                    aria-busy={openingMtcEditTeamId === team.id}
                                  >
                                    {openingMtcEditTeamId === team.id ? "Öffne..." : "MTC"}
                                  </Button>
                                )}
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
                                    {capabilities.canManageSlots ? "Entwurf" : "Übernehmen"}
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
                                {canEditMarketplaceTeam && !isMarketplaceMatching && (
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
                                {canDeleteTeam && team.registrationMode === "MARKETPLACE" && !isMarketplaceMatching && (
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
                          )}
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
                              <div className="flex min-w-0 max-w-full flex-1 basis-48 items-center gap-1.5">
                                {!isMarketplaceMatching && renderCategoryIconBadge(team)}
                                <h3 className="min-w-0 truncate text-base font-semibold" title={team.name}>{team.name}</h3>
                                <TeamVisibilityIconBadge
                                  team={team}
                                  active={teamVisibilityInfoTeamId === team.id}
                                  onToggle={() => toggleTeamVisibilityInfo(team.id)}
                                />
                                {showAdminDashboardInfo && (
                                  <TeamAdminInfoButton
                                    active={teamAdminInfoTeamId === team.id}
                                    onToggle={() => toggleTeamAdminInfo(team.id)}
                                  />
                                )}
                              </div>
                              {team.isCurrentUserTeam && (
                                <Badge variant="secondary" className="h-6 px-1.5 text-[10px]">
                                  <Star className="size-3" />
                                  Mein Team
                                </Badge>
                              )}
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
                                  {capabilities.canManageSlots ? "Entwurf" : "Übernehmen"}
                                </Button>
                              )}
                              {canOpenOwnMtcEdit && (
                                <Button
                                  size="xs"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleOpenMtcOwnerEdit(team.id);
                                  }}
                                  disabled={openingMtcEditTeamId === team.id}
                                  aria-busy={openingMtcEditTeamId === team.id}
                                >
                                  {openingMtcEditTeamId === team.id ? "Öffne..." : "MTC bearbeiten"}
                                </Button>
                              )}
                              {canEditMarketplaceTeam && !isMarketplaceMatching && (
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
                              {canDeleteTeam && team.registrationMode === "MARKETPLACE" && !isMarketplaceMatching && (
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

                          {showAdminDashboardInfo && teamAdminInfoTeamId === team.id && (
                            <TeamAdminInfoPanel team={team} onClick={(event) => event.stopPropagation()} />
                          )}

                          {((showActionStatus && (isMarketplaceMatching
                            ? mtcCombinedActionMeta
                            : completionMeta.isImportant || disciplineMeta.isImportant)) ||
                            (showAdminDashboardInfo && pendingChangeCount > 0)) && (
                            <div className="flex flex-wrap gap-1">
                              {showActionStatus && mtcCombinedActionMeta && MtcCombinedActionIcon && (
                                <Badge variant="outline" className={`h-5 gap-1 px-1.5 text-[10px] ${mtcCombinedActionMeta.toneClass}`}>
                                  <MtcCombinedActionIcon className="size-3" />
                                  {mtcCombinedActionMeta.label}
                                </Badge>
                              )}
                              {showActionStatus && !isMarketplaceMatching && !mtcCombinedActionMeta && completionMeta.isImportant && (
                                <Badge variant="outline" className={`h-5 gap-1 px-1.5 text-[10px] ${completionMeta.toneClass}`}>
                                  <CompletionIcon className="size-3" />
                                  {completionMeta.label}
                                </Badge>
                              )}
                              {showActionStatus && !isMarketplaceMatching && !mtcCombinedActionMeta && disciplineMeta.isImportant && (
                                <Badge variant="outline" className={`h-5 gap-1 px-1.5 text-[10px] ${disciplineMeta.toneClass}`}>
                                  <DisciplineIcon className="size-3" />
                                  {disciplineMeta.label}
                                </Badge>
                              )}
                            {showAdminDashboardInfo && pendingChangeCount > 0 && (
                              <Badge
                                variant="outline"
                                className="h-5 cursor-pointer gap-1 border-amber-300 bg-amber-50 px-1.5 text-[10px] text-amber-800"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openChangesDashboard({ teamId: team.id, status: "PENDING" });
                                }}
                                role="link"
                                title="Zum Änderungsdashboard"
                              >
                                <ClipboardList className="size-3" />
                                {pendingChangeCount} Änderung(en)
                              </Badge>
                            )}
                            </div>
                          )}

                          {team.registrationMode === "MARKETPLACE" && (
                            isMarketplaceMatching ? (
                              <div className="space-y-1 text-xs">
                                <button
                                  type="button"
                                  className="flex min-h-8 w-full min-w-0 items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-2 py-1 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
                                  aria-expanded={isMarketplaceContainerOpen}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setExpandedMarketplaceContainerTeam(isMarketplaceContainerOpen ? null : team.id);
                                  }}
                                >
                                  <Info className="size-3.5 shrink-0 text-muted-foreground" />
                                  <span className="shrink-0 font-medium text-foreground">Container</span>
                                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                                    {[team.contactName, team.contactEmail, team.createdAt ? `Gemeldet: ${formatDatePart(team.createdAt)}` : null]
                                      .filter(Boolean)
                                      .join(" · ") || "Infos anzeigen"}
                                  </span>
                                  {isMarketplaceContainerOpen ? (
                                    <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
                                  ) : (
                                    <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                                  )}
                                </button>

                                {isMarketplaceContainerOpen && (
                                  <div className="rounded-md border border-border/60 bg-background p-2.5">
                                    <div className="flex min-w-0 items-start gap-2">
                                      <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/30">
                                        <UserRound className="size-4 text-muted-foreground" />
                                      </div>
                                      <div className="min-w-0 flex-1 space-y-1.5">
                                        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                                          <p className="min-w-0 truncate text-sm font-medium text-foreground" title={team.contactName || team.name}>
                                            {team.contactName || team.name}
                                          </p>
                                          <Badge variant="outline" className={`h-5 max-w-full justify-center gap-1 px-1.5 text-[10px] ${marketplaceContainerMailMeta.className}`}>
                                            <Mail className="size-3" />
                                            {marketplaceContainerMailMeta.label}
                                          </Badge>
                                          <Badge variant="outline" className={`h-5 max-w-full justify-center px-1.5 text-[10px] ${marketplaceContainerAccountMeta.className}`}>
                                            {marketplaceContainerAccountMeta.label}
                                          </Badge>
                                          <Badge variant="outline" className={`h-5 max-w-full justify-center px-1.5 text-[10px] ${marketplaceContainerAccessMeta.className}`}>
                                            {marketplaceContainerAccessMeta.label}
                                          </Badge>
                                        </div>
                                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
                                          {team.contactEmail && <span className="truncate">{team.contactEmail}</span>}
                                          {team.createdAt && <span>Gemeldet: {formatDatePart(team.createdAt)}</span>}
                                        </div>
                                        {team.marketplaceMessage?.trim() && (
                                          <div className="rounded-md border border-border/50 bg-muted/20 px-2 py-1 text-muted-foreground">
                                            <span className="text-foreground">Notiz:</span> {team.marketplaceMessage}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <div className="mt-2 flex items-center gap-2 border-t border-border/60 pt-2">
                                      {canEditMarketplaceTeam && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-8 flex-1"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            setEditingMarketplaceTeam(team);
                                          }}
                                        >
                                          <SlidersHorizontal className="size-4" />
                                          Container bearbeiten
                                        </Button>
                                      )}
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 w-8 shrink-0 p-0"
                                        title="Container-Information schließen"
                                        aria-label="Container-Information schließen"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          setExpandedMarketplaceContainerTeam(null);
                                        }}
                                      >
                                        <X className="size-4" />
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.85fr)]">
                                <MarketplacePersonSummary
                                  team={team}
                                  participant={marketplaceParticipant}
                                  revealPrivateName={revealPrivateDashboardNames}
                                  canUseAdminLinks={canUseAdminLinks}
                                />
                                <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-2 text-xs">
                                  {team.contactName && <span>{team.contactName}</span>}
                                  {team.contactEmail && <span>{team.contactEmail}</span>}
                                  {team.createdAt && <span>Gemeldet: {formatDatePart(team.createdAt)}</span>}
                                  {team.marketplaceMessage?.trim() && <span className="truncate">Notiz: {team.marketplaceMessage}</span>}
                                </div>
                              </div>
                            )
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
                                  const emailInviteMeta = participant && canEditAll ? getParticipantEmailInvitationMeta(team, participant) : null;
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
                                        <DisciplineBrandIcon code={discipline.id} label={discipline.label} className="size-8" />
                                        <div className="min-w-0 flex-1">
                                          <p className="truncate text-[10px] font-medium uppercase text-muted-foreground" title={discipline.label}>
                                            {discipline.label}
                                          </p>
                                          <div className="flex min-w-0 items-center gap-1.5">
                                            <p className="min-w-0 truncate text-sm font-medium" title={participantLabel}>
                                              {participantLabel}
                                            </p>
                                            {participant && isMarketplaceMatching && desiredDisciplineId !== assignedDisciplineId && (
                                              <span
                                                className="max-w-full shrink truncate rounded border border-border/60 bg-muted/20 px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground"
                                                title={`Wunsch: ${getDisciplineLabel(desiredDisciplineId)}`}
                                              >
                                                Wunsch {getDisciplineLabel(desiredDisciplineId)}
                                              </span>
                                            )}
                                            {participant && (
                                              <ParticipantPublicationPreferenceIcon
                                                preference={participant.participantPublicationPreference}
                                                teamPublicationLevel={team.teamPublicationLevel}
                                              />
                                            )}
                                          </div>
                                        </div>
                                      </div>

                                      {(latestChangeMeta || emailInviteMeta || showRights) && (
                                        <div className="flex min-w-0 flex-wrap gap-1">
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
                                            <AccountLinkStatusDialog
                                              meta={emailInviteMeta}
                                              title="Teilnehmer Status"
                                              rows={[
                                                { label: "Teilnehmer", value: participantLabel },
                                                { label: "Team", value: team.name, targetType: "team", onClick: () => openTeamDashboard({ teamId: team.id }) },
                                                { label: "E-Mail", value: participant?.email },
                                                {
                                                  label: "User",
                                                  value: participant?.portalAccount?.email || participant?.email || "nicht verknüpft",
                                                  targetType: "user",
                                                  onClick: participant?.linkedUserId || participant?.portalAccount?.email || participant?.email
                                                    ? () => openUserDashboard({ userId: participant?.linkedUserId, email: participant?.portalAccount?.email || participant?.email, teamId: team.id })
                                                    : undefined,
                                                },
                                                { label: "Portal-Konto", value: participant?.linkedUserId ? "verknüpft" : participant?.portalAccount?.email || "nicht verknüpft" },
                                                { label: "Claim", value: emailInviteMeta.label, targetType: "claim", onClick: () => { window.location.href = "/claim-links"; } },
                                                { label: "Versendet", value: participant?.emailInvitation?.sentAt ? formatDateTime(participant.emailInvitation.sentAt) : null },
                                                { label: "Gültig bis", value: participant?.emailInvitation?.expiresAt && !participant.emailInvitation.claimedAt ? formatDateTime(participant.emailInvitation.expiresAt) : null },
                                                { label: "Eingelöst", value: participant?.emailInvitation?.claimedAt ? formatDateTime(participant.emailInvitation.claimedAt) : null },
                                              ]}
                                              actions={canUseAdminLinks && participant?.linkedUserId
                                                ? [{
                                                    label: "Nachricht schreiben",
                                                    onClick: () => openAdminMessageComposer({
                                                      userId: participant.linkedUserId,
                                                      email: participant.portalAccount?.email || participant.email,
                                                      name: participantLabel,
                                                      teamId: team.id,
                                                      participantId: participant.id,
                                                    }),
                                                  }]
                                                : undefined}
                                              compact
                                            />
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

                                      {participant ? (
                                        <div className="mt-auto flex flex-wrap gap-1">
                                          {canEditMarketplaceMatching && participant.id && (
                                            <div className="min-w-[7.5rem] flex-[1.15_1_0]" onClick={(event) => event.stopPropagation()}>
                                              <Select
                                                value={assignedDisciplineId}
                                                onValueChange={(value) => {
                                                  if (value !== assignedDisciplineId && participant.id) {
                                                    void handleMarketplaceMatchingMove(team.id, participant.id, value);
                                                  }
                                                }}
                                              >
                                                <SelectTrigger className="h-7 px-2 text-[10px]" title="Zugeordneten MTC-Slot ändern">
                                                  <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  {DISCIPLINES.map((slotOption) => {
                                                    const slotParticipant = participantByDiscipline.get(slotOption.id);
                                                    const isSwapTarget = Boolean(slotParticipant && slotParticipant.id !== participant.id);

                                                    return (
                                                      <SelectItem key={slotOption.id} value={slotOption.id}>
                                                        {slotOption.icon} {slotOption.label}
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
                                            className={`min-h-7 min-w-[4.75rem] flex-1 rounded border px-2 py-0.5 text-[10px] transition-colors ${participant.moderationNote?.trim() ? "border-primary/40 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground hover:text-primary"}`}
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
                                              className="min-h-7 min-w-[4.75rem] flex-1 rounded border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:text-primary"
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
                                              className="min-h-7 min-w-[4.75rem] flex-1 rounded border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:text-primary"
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
                                {capabilities.canManageSlots ? "Entwurf bearbeiten" : "Als Mannschaft übernehmen"}
                              </Button>
                            )}
                            {canOpenOwnMtcEdit && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleOpenMtcOwnerEdit(team.id);
                                }}
                                disabled={openingMtcEditTeamId === team.id}
                                aria-busy={openingMtcEditTeamId === team.id}
                                className="flex-1"
                              >
                                {openingMtcEditTeamId === team.id ? "Öffne..." : "MTC bearbeiten"}
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
          showOwnerClaimInfo={isAdmin}
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
          canManageSlots={canEditAll}
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
        onSaved={() => { fetchTeams(); }}
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
  canManageSlots = false,
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
  canManageSlots?: boolean;
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
    if (!canManageSlots) {
      setAvailableParticipants([]);
      setLoadingAvailable(false);
      return;
    }
    void loadAvailableParticipants();
  }, [canManageSlots, loadAvailableParticipants]);

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

              {canManageSlots && (
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
              )}

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
                            <p className="text-xs font-medium text-muted-foreground">
                              <DisciplineBrandBadge code={discipline.id} label={discipline.label} />
                            </p>
                            {participant ? (
                              <>
                                <p className="truncate text-sm font-medium">{getParticipantDisplayName(participant, participantIndex)}</p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {[
                                    participant.birthDate,
                                    participant.email,
                                    desiredDisciplineId !== assignedDisciplineId ? `Wunsch: ${getDisciplineLabel(desiredDisciplineId)}` : null,
                                  ].filter(Boolean).join(" · ") || "Keine weiteren Angaben"}
                                </p>
                              </>
                            ) : (
                              <p className="text-sm text-muted-foreground">Noch frei</p>
                            )}
                          </div>
                          {participant?.id && canManageSlots && (
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
                                        {slotOption.icon} {slotOption.label}
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
                          {!participant && canManageSlots && (
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
            {canManageSlots && (
              <Button variant="outline" onClick={handleSaveDraft} disabled={savingMetadata || finalizing} aria-busy={savingMetadata}>
                {savingMetadata ? "Speichert..." : "Entwurf speichern"}
              </Button>
            )}
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
function EditTeamModal({
  team,
  onSave,
  onCancel,
  showAdminInfo = false,
  showOwnerClaimInfo = false,
  canManageTeamManagers = false,
}: {
  team: Team;
  onSave: (data: TeamEditPayload) => void | Promise<void>;
  onCancel: () => void;
  showAdminInfo?: boolean;
  showOwnerClaimInfo?: boolean;
  canManageTeamManagers?: boolean;
}) {
  const [showInfo, setShowInfo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openModerationNotes, setOpenModerationNotes] = useState<Record<number, boolean>>({});
  const [sendingInvitationIndex, setSendingInvitationIndex] = useState<number | null>(null);
  const [updatingManagerIndex, setUpdatingManagerIndex] = useState<number | null>(null);
  const [inviteMessages, setInviteMessages] = useState<Record<number, { type: "success" | "error"; text: string }>>({});
  const [managerMessages, setManagerMessages] = useState<Record<number, { type: "success" | "error"; text: string }>>({});
  const [disciplineSwapMessages, setDisciplineSwapMessages] = useState<Record<number, string>>({});
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
  const replacementCount = useMemo(
    () => formData.participants.filter((participant) => participant.replaceParticipant === true).length,
    [formData.participants],
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
    const currentParticipant = newParticipants[index];

    if (field === "discipline" && currentParticipant) {
      const previousDiscipline = currentParticipant.discipline || currentParticipant.disciplineCode || "TBD";
      const occupiedIndex = newParticipants.findIndex((participant, participantIndex) =>
        participantIndex !== index &&
        participant.replaceParticipant !== true &&
        (participant.discipline || participant.disciplineCode || "TBD") === value,
      );

      if (occupiedIndex !== -1) {
        const occupiedParticipant = newParticipants[occupiedIndex];
        newParticipants[occupiedIndex] = { ...occupiedParticipant, discipline: previousDiscipline };
        newParticipants[index] = { ...currentParticipant, discipline: value };

        const currentName = getParticipantDisplayName(currentParticipant, index);
        const occupiedName = getParticipantDisplayName(occupiedParticipant, occupiedIndex);
        const currentTarget = getDisciplineLabel(value);
        const occupiedTarget = getDisciplineLabel(previousDiscipline);
        setFormData({ ...formData, participants: newParticipants });
        setDisciplineSwapMessages((current) => ({
          ...current,
          [index]: `Tausch erkannt: ${currentName} -> ${currentTarget}, ${occupiedName} -> ${occupiedTarget}.`,
          [occupiedIndex]: `Tausch erkannt: ${occupiedName} -> ${occupiedTarget}, ${currentName} -> ${currentTarget}.`,
        }));
        return;
      }
    }

    newParticipants[index] = { ...newParticipants[index], [field]: value };
    setFormData({ ...formData, participants: newParticipants });
    if (field === "email") {
      setInviteMessages((current) => {
        const next = { ...current };
        delete next[index];
        return next;
      });
    }
    if (field === "discipline") {
      setDisciplineSwapMessages((current) => {
        const next = { ...current };
        delete next[index];
        return next;
      });
    }
  };

  const handleParticipantReplacementToggle = (index: number, replaceParticipant: boolean) => {
    const newParticipants = [...formData.participants];
    newParticipants[index] = { ...newParticipants[index], replaceParticipant };
    setFormData({ ...formData, participants: newParticipants });
  };

  const handleSubmit = async () => {
    if (!teamDraftEvaluation.canSubmit || saving) return;

    const suspiciousIdentityChanges = formData.participants
      .map((participant, index) => ({
        participant,
        original: team.participants?.[index],
      }))
      .filter(({ participant, original }) => participant.replaceParticipant !== true && hasSuspiciousParticipantIdentityChange(participant, original));

    if (suspiciousIdentityChanges.length > 0) {
      const changedParticipants = suspiciousIdentityChanges
        .slice(0, 3)
        .map(({ participant, original }) => {
          const beforeName = original ? getParticipantDisplayName(original) : "Teilnehmer";
          const afterName = getParticipantDisplayName(participant);
          return `#${formatParticipantIdentityId(original?.id)} ${beforeName} -> ${afterName}`;
        })
        .join("\n");
      const additionalChanges =
        suspiciousIdentityChanges.length > 3 ? `\n... und ${suspiciousIdentityChanges.length - 3} weitere` : "";
      const confirmed = window.confirm(
        `Du änderst Identitätsfelder verankerter Teilnehmer:\n\n${changedParticipants}${additionalChanges}\n\nBeim Speichern bleiben dieselben Teilnehmer-IDs erhalten. Bitte nur fortfahren, wenn das Korrekturen sind und keine anderen Personen in die Slots sollen.`,
      );
      if (!confirmed) return;
    }

    const replacementParticipants = formData.participants
      .map((participant, index) => ({
        participant,
        original: team.participants?.[index],
      }))
      .filter(({ participant, original }) => participant.replaceParticipant === true && original?.id);

    if (replacementParticipants.length > 0) {
      const changedParticipants = replacementParticipants
        .slice(0, 3)
        .map(({ participant, original }) => {
          const beforeName = original ? getParticipantDisplayName(original) : "Teilnehmer";
          const afterName = getParticipantDisplayName(participant);
          return `#${formatParticipantIdentityId(original?.id)} ${beforeName} -> ${afterName}`;
        })
        .join("\n");
      const additionalChanges =
        replacementParticipants.length > 3 ? `\n... und ${replacementParticipants.length - 3} weitere` : "";
      const confirmed = window.confirm(
        `Du ersetzt Teilnehmer-Identitäten:\n\n${changedParticipants}${additionalChanges}\n\nDie alten Teilnehmer-IDs werden archiviert. Portal-Konto, Historie und Ergebnisse bleiben bei den alten IDs. Aktive Team-Manager-Rechte fuer dieses Team werden entzogen. Für die neuen Personen werden neue Teilnehmer-IDs angelegt.`,
      );
      if (!confirmed) return;
    }

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
        hasPlaceholderUser: data.participantClaimMail?.placeholderUser?.authentikSub === null,
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
              Geprüfte Teilnehmerdaten gehen zur Genehmigung. Team-Name, E-Mail, T-Shirt, Notiz und Veröffentlichung speichern direkt, solange der Wettkampf noch nicht begonnen hat.
            </StatusMessage>
          )}
          {showAdminInfo && showInfo && (
            <div className="space-y-1 rounded-md border border-border/60 bg-muted/30 p-2.5 text-xs">
              {showOwnerClaimInfo && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <OwnerClaimBadge team={team} canUseAdminLinks />
                  <span className="text-muted-foreground">{getOwnerClaimMeta(team).description}</span>
                </div>
              )}
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
                const canResendInvitationForMissingPlaceholder =
                  participant.emailInvitation?.status === "active" &&
                  !participant.linkedUserId &&
                  !participant.portalAccount &&
                  !participant.hasPlaceholderUser;
                const canSendInvitation =
                  Boolean(participant.id) &&
                  isValidEmail(participant.email || "") &&
                  (emailDiffersFromSaved ||
                    canResendInvitationForMissingPlaceholder ||
                    !["active", "claimed", "linked"].includes(participant.emailInvitation?.status || "none"));
                const inviteMessage = inviteMessages[index];
                const managerMessage = managerMessages[index];
                const originalParticipant = team.participants?.[index];
                const identityAnchored = isParticipantIdentityAnchored(originalParticipant);
                const linkedAccount = hasParticipantLinkedAccount(originalParticipant);
                const replacingParticipant = participant.replaceParticipant === true;
                const suspiciousIdentityChange =
                  !replacingParticipant && hasSuspiciousParticipantIdentityChange(participant, originalParticipant);

                return (
                <div key={index} className="space-y-2 rounded-md border border-border/50 p-2 shadow-sm">
                  {identityAnchored && originalParticipant ? (
                    <StatusMessage tone={suspiciousIdentityChange || replacingParticipant ? "warning" : "info"} className="px-2.5 py-2 text-xs">
                      <div className="font-medium">
                        {replacingParticipant
                          ? `Teilnehmer-ID #${formatParticipantIdentityId(originalParticipant.id)} wird archiviert`
                          : `Teilnehmer-ID #${formatParticipantIdentityId(originalParticipant.id)} bleibt beim Speichern erhalten`}
                      </div>
                      {replacingParticipant ? (
                        <>
                          <div>
                            <span className="font-medium">Andere Person:</span> Beim Speichern entsteht eine neue Teilnehmer-ID fuer diese Zeile.
                          </div>
                          <div>
                            Portal-Konto, Historie und Ergebnisse bleiben bei der alten ID. Aktive Team-Manager-Rechte fuer dieses Team werden entzogen.
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <span className="font-medium">Korrektur:</span> hier speichern, gleiche Teilnehmer-ID bleibt.
                            {linkedAccount ? " Das verknüpfte Portal-Konto bleibt zugeordnet." : ""}
                          </div>
                          <div>
                            <span className="font-medium">Andere Person:</span> unten &quot;Andere Person einsetzen&quot; aktivieren.
                          </div>
                        </>
                      )}
                      {suspiciousIdentityChange ? (
                        <div className="mt-1 opacity-90">
                          Die Änderung sieht nach Personenwechsel aus. Speichere nur, wenn es eine Korrektur ist.
                        </div>
                      ) : null}
                      {showAdminInfo ? (
                        <div className="mt-2 flex justify-end">
                          <Button
                            type="button"
                            size="sm"
                            variant={replacingParticipant ? "secondary" : "outline"}
                            onClick={() => handleParticipantReplacementToggle(index, !replacingParticipant)}
                            className="h-7 text-[11px]"
                          >
                            {replacingParticipant ? "Als Korrektur speichern" : "Andere Person einsetzen"}
                          </Button>
                        </div>
                      ) : null}
                    </StatusMessage>
                  ) : null}
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
                        placeholder="TT.MM.JJJJ oder JJJJ"
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
                          {DISCIPLINES.map((discipline) => {
                            const slotParticipantIndex = formData.participants.findIndex((teamParticipant, participantIndex) =>
                              participantIndex !== index &&
                              (teamParticipant.discipline || teamParticipant.disciplineCode || "TBD") === discipline.id,
                            );
                            const slotParticipant = slotParticipantIndex === -1 ? null : formData.participants[slotParticipantIndex];

                            return (
                              <SelectItem key={discipline.id} value={discipline.id}>
                                <span className="inline-flex min-w-0 items-center gap-1.5">
                                  <DisciplineBrandBadge code={discipline.id} label={discipline.label} />
                                  {slotParticipant && (
                                    <span className="text-muted-foreground">
                                      - tauschen mit {getParticipantDisplayName(slotParticipant, slotParticipantIndex)}
                                    </span>
                                  )}
                                </span>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      {disciplineSwapMessages[index] ? (
                        <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
                          {disciplineSwapMessages[index]}
                        </p>
                      ) : null}
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
                          {sendingInvitationIndex === index
                            ? "Sendet..."
                            : canResendInvitationForMissingPlaceholder
                              ? "Einladung erneut senden"
                              : "Einladung senden"}
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
                {saving
                  ? "Speichert..."
                  : replacementCount > 0
                    ? `${replacementCount} ersetzen & speichern`
                    : saveButtonLabel}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
