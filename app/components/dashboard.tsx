"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  PARTICIPANT_PUBLICATION_OPTIONS,
  TEAM_PUBLICATION_OPTIONS,
  extractBirthYearFromInput,
  formatBirthDateInput,
  resolveBirthDateInputKey,
} from "@/lib/domain/team";
import { classifyTeam, validateDisciplineAssignment } from "@/lib/domain/classification";
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
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  ArrowDownUp,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Info,
  Mail,
  RotateCcw,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import ParticipantEditDialog from "./participant-edit-dialog";

interface Team {
  id: string;
  name: string;
  teamPublicationLevel?: "TEAM_ANONYM" | "TEAMNAME_OEFFENTLICH" | "ALLES_OEFFENTLICH";
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

type EditableParticipant = Omit<Participant, "id"> & { id: string };

interface DashboardProps {
  ownerFilter?: string;
}

type DashboardViewMode = "cards" | "list";
type TeamSortField = "name" | "category" | "contactName" | "contactEmail" | "ownerEmail" | "participantCount" | "createdAt" | "updatedAt";
type SortDirection = "asc" | "desc";
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
const SORT_OPTIONS: Array<{ value: TeamSortField; label: string }> = [
  { value: "updatedAt", label: "Zuletzt geändert" },
  { value: "createdAt", label: "Angelegt" },
  { value: "name", label: "Mannschaftsname" },
  { value: "category", label: "Klasse" },
  { value: "contactName", label: "Team Manager:in" },
  { value: "contactEmail", label: "Kontakt E-Mail" },
  { value: "ownerEmail", label: "Angelegt von" },
  { value: "participantCount", label: "Teilnehmerzahl" },
];

const LIST_OPTIONAL_COLUMNS: Array<{ key: TeamOptionalColumnKey; label: string }> = [
  { key: "category", label: "Klasse" },
  { key: "contactName", label: "Team Manager:in" },
  { key: "contactEmail", label: "Kontakt E-Mail" },
  { key: "ownerEmail", label: "Angelegt von" },
  { key: "participantCount", label: "Teilnehmer" },
  { key: "participants", label: "Mitglieder" },
  { key: "createdAt", label: "Angelegt am" },
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
  const missingNames = (team.participants ?? []).filter(
    (participant) => !participant.firstName?.trim() || !participant.lastName?.trim(),
  ).length;

  if (participantCount < 5) {
    return {
      label: `${participantCount}/5 besetzt`,
      toneClass: "border-amber-300 bg-amber-50 text-amber-800",
      icon: AlertTriangle,
      isImportant: true,
    };
  }

  if (missingNames > 0) {
    return {
      label: `${missingNames} Name(n) offen`,
      toneClass: "border-amber-300 bg-amber-50 text-amber-800",
      icon: AlertTriangle,
      isImportant: true,
    };
  }

  return {
    label: "Vollständig",
    toneClass: "border-green-300 bg-green-50 text-green-800",
    icon: CheckCircle2,
    isImportant: false,
  };
}

function getTeamDisciplineMeta(team: Team) {
  const participants = team.participants ?? [];
  const missingDisciplines = participants.filter(
    (participant) => !(participant.discipline || participant.disciplineCode) || (participant.discipline || participant.disciplineCode) === "TBD",
  ).length;
  const disciplineCheck = validateDisciplineAssignment(
    participants.map((participant) => participant.discipline || participant.disciplineCode || "TBD"),
  );

  if (missingDisciplines > 0) {
    return {
      label: `${missingDisciplines} Disziplin(en) offen`,
      toneClass: "border-amber-300 bg-amber-50 text-amber-800",
      icon: AlertTriangle,
      isImportant: true,
    };
  }

  if (!disciplineCheck.valid || disciplineCheck.warnings.length > 0) {
    return {
      label: "Disziplinen prüfen",
      toneClass: "border-amber-300 bg-amber-50 text-amber-800",
      icon: AlertTriangle,
      isImportant: true,
    };
  }

  return {
    label: "Disziplinen ok",
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

function getTeamLinkedAccountCount(team: Team) {
  return (team.participants ?? []).filter((participant) =>
    participant.emailInvitation?.status === "linked" ||
    participant.emailInvitation?.status === "claimed" ||
    participant.canBeTeamManager,
  ).length;
}

function getTeamPublicationLabel(team: Team) {
  return TEAM_PUBLICATION_OPTIONS.find((option) => option.id === team.teamPublicationLevel)?.label || "Nicht festgelegt";
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

function getGenderLabel(gender?: string | null) {
  if (gender === "M" || gender === "MALE") return "Männlich";
  if (gender === "W" || gender === "FEMALE") return "Weiblich";
  return "Divers";
}

function getShirtSizeLabel(shirtSize?: string | null) {
  if (!shirtSize) return null;
  return SHIRT_SIZES.find((size) => size.id === shirtSize)?.label || shirtSize;
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
        {deleting === team.id ? "..." : "🗑️ Löschen"}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Mannschaft archivieren?</AlertDialogTitle>
          <AlertDialogDescription>
            „{team.name}“ wird aus Dashboards, Ergebnislisten und Exporten ausgeblendet. {participantCount} Teilnehmer:innen
            werden mit ausgeblendet, Benutzerkonten bleiben erhalten. Admins können die Mannschaft später im Archiv wiederherstellen.
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

export default function Dashboard({ ownerFilter: initialOwnerFilter }: DashboardProps = {}) {
  const { data: session } = useSession();
  const { can, activeRole } = usePermissions();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<string>(initialOwnerFilter || "all");
  const [ownTeamsOnly, setOwnTeamsOnly] = useState(false);
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [incompleteOnly, setIncompleteOnly] = useState(false);
  const [viewMode, setViewMode] = useState<DashboardViewMode>("cards");
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [editingParticipant, setEditingParticipant] = useState<EditableParticipant | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [expandedTeamMeta, setExpandedTeamMeta] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [listOptionsOpen, setListOptionsOpen] = useState(false);
  const [sortField, setSortField] = useState<TeamSortField>("updatedAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [visibleColumns, setVisibleColumns] = useState<TeamOptionalColumnKey[]>([
    "category",
    "ownerEmail",
    "createdAt",
  ]);

  const canEditAll = can("team.edit.all");
  const canViewAll = can("team.view.all");
  const canUseAdminLinks = activeRole === "ADMIN";
  const showAdminDashboardInfo = activeRole === "ADMIN";
  const userEmail = session?.user?.email;
  const { active: activeCompetition } = useCompetition();
  const notifications = useNotifications();
  const showOwnerFilter = isOwnerFilterVisibleForRole(activeRole, activeCompetition);
  const canBrowseAllTeams = canViewAll || canRoleViewAllTeams(activeRole, activeCompetition);

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
    try {
      const response = await fetch(`/api/teams/${editingTeam!.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(teamData),
      });
      
      if (response.ok) {
        const data = await response.json();
        setEditingTeam(null);
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

  // Pending owner filter (set before teams are loaded)
  const [pendingOwnerFilter, setPendingOwnerFilter] = useState<string | null>(null);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  useEffect(() => {
    if (!showOwnerFilter) {
      setOwnerFilter("all");
    }
  }, [showOwnerFilter]);

  useEffect(() => {
    if (viewMode === "list") {
      setExpandedTeam(null);
      setExpandedTeamMeta(null);
    }
  }, [viewMode]);

  useEffect(() => {
    const storedColumns = getStoredVisibleColumns();
    if (storedColumns) {
      setVisibleColumns(storedColumns);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(TEAM_LIST_VISIBLE_COLUMNS_STORAGE_KEY, JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  useEffect(() => {
    // Listen for switchTab events to handle owner filter
    const handleSwitchTab = (e: CustomEvent) => {
      if (showOwnerFilter && e.detail.ownerFilter && e.detail.tabId === "dashboard") {
        setOwnerFilter(e.detail.ownerFilter);
        setPendingOwnerFilter(e.detail.ownerFilter);
      }
    };
    
    const listener: EventListener = (event) => handleSwitchTab(event as CustomEvent);
    window.addEventListener("switchTab", listener);
    return () => window.removeEventListener("switchTab", listener);
  }, [showOwnerFilter]);

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
    setExpandedTeamMeta(null);
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

  // Filter and search logic
  const filteredTeams = useMemo(() => {
    return teams.filter(team => {
      // Category filter
      const matchesCategory = categoryFilter === "all" || team.category === categoryFilter;
      const matchesOwner =
        !showOwnerFilter ||
        ownerFilter === "all" ||
        normalizeEmail(team.ownerEmail || team.contactEmail) === normalizeEmail(ownerFilter);
      const matchesOwnTeam = !ownTeamsOnly || team.isCurrentUserTeam === true;
      const matchesCompleteness =
        !incompleteOnly || (canShowTeamActionStatus(team, showAdminDashboardInfo) && isTeamIncomplete(team));
      const createdAtMs = team.createdAt ? new Date(team.createdAt).getTime() : Number.NaN;
      const createdFromMs = createdFrom ? new Date(createdFrom).getTime() : null;
      const createdToMs = createdTo ? new Date(createdTo).getTime() : null;
      const matchesCreatedAt = Number.isNaN(createdAtMs)
        ? createdFrom === "" && createdTo === ""
        : (createdFromMs === null || createdAtMs >= createdFromMs) &&
          (createdToMs === null || createdAtMs <= createdToMs);
      
      // Search filter (team name, contact name, participant names)
      const matchesSearch = searchQuery === "" || 
        team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (team.contactName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (team.participants?.some(p => 
          `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
        ) ?? false);
      
      return matchesCategory && matchesOwner && matchesOwnTeam && matchesCompleteness && matchesCreatedAt && matchesSearch;
    });
  }, [teams, categoryFilter, searchQuery, ownerFilter, ownTeamsOnly, incompleteOnly, createdFrom, createdTo, showOwnerFilter, showAdminDashboardInfo]);

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
        result = collator.compare(left.name, right.name);
      }

      return sortDirection === "asc" ? result : -result;
    });
  }, [filteredTeams, sortField, sortDirection]);

  const visibleColumnDefs = LIST_OPTIONAL_COLUMNS.filter((column) => visibleColumns.includes(column.key));

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

  // Helper function to get discipline label and icon
  const getDisciplineDisplay = (disciplineCode?: string) => {
    if (!disciplineCode || disciplineCode === "TBD") {
      return { label: "Noch offen", icon: "❓" };
    }
    const discipline = DISCIPLINES.find(d => d.id === disciplineCode);
    return discipline ? { label: discipline.label, icon: discipline.icon } : { label: disciplineCode, icon: "🏃" };
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

  const totalParticipants = filteredTeams.reduce((sum, team) => sum + (team.participants?.length || 0), 0);
  const incompleteTeams = teams.filter((team) => canShowTeamActionStatus(team, showAdminDashboardInfo) && isTeamIncomplete(team)).length;
  const hasActiveFilters =
    searchQuery !== "" ||
    categoryFilter !== "all" ||
    (showOwnerFilter && ownerFilter !== "all") ||
    ownTeamsOnly ||
    incompleteOnly ||
    createdFrom !== "" ||
    createdTo !== "";
  const activeFilterCount = [
    searchQuery !== "",
    categoryFilter !== "all",
    showOwnerFilter && ownerFilter !== "all",
    ownTeamsOnly,
    incompleteOnly,
    createdFrom !== "",
    createdTo !== "",
  ].filter(Boolean).length;
  const canEditOwn = can("team.edit.own");

  const resetFilters = () => {
    setSearchQuery("");
    setCategoryFilter("all");
    setOwnerFilter(showOwnerFilter ? (initialOwnerFilter || "all") : "all");
    setOwnTeamsOnly(false);
    setIncompleteOnly(false);
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

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border/60 bg-card/70 p-2.5 shadow-sm">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span><span className="font-semibold text-primary">{filteredTeams.length}</span>/{teams.length} Teams</span>
          <span>·</span>
          <span><span className="font-semibold text-primary">{totalParticipants}</span> Teilnehmer:innen</span>
          <span>·</span>
          <span><span className="font-semibold text-primary">{categories.length}</span> Klassen</span>
          <span>·</span>
          <span><span className="font-semibold text-primary">{incompleteTeams}</span> unvollständig</span>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          {categories.length > 0 && (
            <div className="flex min-w-0 flex-wrap gap-1.5">
              {categoryStats.map((cat) => (
                <Badge key={cat.category} variant="outline" className="h-6 gap-1">
                  <span>{categoryEmojis[cat.category] || "🏆"}</span>
                  {cat.category} ({cat.count})
                </Badge>
              ))}
            </div>
          )}

          <div className="flex shrink-0 gap-1.5">
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
          </div>
        </div>
      </div>

      <Card size="sm">
        <CardHeader className="border-b pb-3">
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setFiltersOpen((open) => !open)}
              className="min-w-0 flex-1 text-left"
            >
              <div className="space-y-0.5">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <SlidersHorizontal className="size-4" />
                  Filter & Suche
                </CardTitle>
                <p className="hidden text-xs text-muted-foreground sm:block">
                  {showOwnerFilter
                    ? "Suche, Klasse, Anleger:in, Vollständigkeit und Zeitraum eingrenzen"
                    : "Suche, Klasse, Vollständigkeit und Zeitraum eingrenzen"}
                </p>
              </div>
            </button>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                type="button"
                size="xs"
                variant={ownTeamsOnly ? "default" : "outline"}
                onClick={() => setOwnTeamsOnly((current) => !current)}
                title="Eigene Mannschaften anzeigen"
              >
                <Star className="size-3" />
                Meine
              </Button>
              <Badge variant={hasActiveFilters ? "default" : "outline"}>
                {activeFilterCount} aktiv
              </Badge>
              {hasActiveFilters && (
                <Button size="xs" variant="outline" onClick={resetFilters}>
                  <X className="size-3" />
                  Filter löschen
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
        </CardHeader>

        {filtersOpen && (
          <CardContent className="space-y-4 pt-4">
            <div className={`grid gap-4 md:grid-cols-2 ${showOwnerFilter ? "xl:grid-cols-6" : "xl:grid-cols-5"}`}>
              <div className="space-y-1 xl:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Suche</label>
                <Input
                  placeholder="Teamname, Team Manager:in oder Teilnehmer:in"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="space-y-1">
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
                <div className="space-y-1">
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

              <div className="space-y-1">
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

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Angelegt ab</label>
                <Input
                  type="datetime-local"
                  value={createdFrom}
                  onChange={(e) => setCreatedFrom(e.target.value)}
                  aria-label="Angelegt ab"
                />
              </div>

              <div className="space-y-1 md:col-span-2 xl:col-span-1">
                <label className="text-xs font-medium text-muted-foreground">Angelegt bis</label>
                <Input
                  type="datetime-local"
                  value={createdTo}
                  onChange={(e) => setCreatedTo(e.target.value)}
                  aria-label="Angelegt bis"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                {hasActiveFilters ? "Aktive Filter können hier gesammelt zurückgesetzt werden." : "Noch keine zusätzlichen Filter aktiv."}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  onClick={resetFilters}
                  disabled={!hasActiveFilters}
                >
                  Filter zurücksetzen
                </Button>
                <Button onClick={fetchTeams} variant="outline">
                  <RotateCcw className="size-4" />
                  Aktualisieren
                </Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {viewMode === "list" && (
        <Card size="sm">
          <CardHeader className="border-b">
            <button
              type="button"
              onClick={() => setListOptionsOpen((open) => !open)}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <ArrowDownUp className="size-4" />
                  Listenoptionen
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Sortierung festlegen, per Tabellenkopf umschalten und sichtbare Spalten anpassen
                </p>
              </div>
              {listOptionsOpen ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
            </button>
          </CardHeader>
          {listOptionsOpen && (
            <CardContent className="space-y-4 pt-4">
              <div className="grid gap-4 md:grid-cols-[minmax(0,260px)_200px]">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Sortieren nach</label>
                  <Select value={sortField} onValueChange={(value) => setSortField(value as TeamSortField)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sortierfeld wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {SORT_OPTIONS.map((option) => (
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
                  {LIST_OPTIONAL_COLUMNS.map((column) => {
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
            </CardContent>
          )}
        </Card>
      )}

      {/* Team-Kacheln (kompakt) */}
      {filteredTeams.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">
              {teams.length === 0 
                ? "Noch keine Teams angemeldet."
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
                  const isEditable = team.canCurrentUserEdit === true;

                  return (
                    <tr key={team.id} className="border-b border-border/50 align-top transition-colors hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <div className="font-medium">{team.name}</div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
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
                          {isEditable ? (
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
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sortedTeams.map((team) => {
              const completionMeta = getTeamCompletionMeta(team);
              const disciplineMeta = getTeamDisciplineMeta(team);
              const pendingChangeCount = getTeamPendingChangeCount(team);
              const linkedAccountCount = getTeamLinkedAccountCount(team);
              const CompletionIcon = completionMeta.icon;
              const DisciplineIcon = disciplineMeta.icon;
              const showActionStatus = canShowTeamActionStatus(team, showAdminDashboardInfo);
              const isMetaOpen = expandedTeamMeta === team.id;
              const showCompactStatusRow =
                (showActionStatus && (completionMeta.isImportant || disciplineMeta.isImportant)) ||
                (showAdminDashboardInfo && pendingChangeCount > 0);

              return (
              <div key={team.id} className={`space-y-2 ${expandedTeam === team.id ? "md:col-span-2 lg:col-span-3 xl:col-span-4" : ""}`}>
                {/* Team-Kachel mit Teilnehmern */}
                {expandedTeam !== team.id && (
                  <Card
                    className="cursor-pointer transition-colors hover:bg-muted/50"
                    onClick={() => {
                      setExpandedTeam(team.id);
                      setExpandedTeamMeta(null);
                    }}
                  >
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-sm truncate">{team.name}</h3>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {categoryEmojis[team.category] || "🏆"} {team.category}
                        </Badge>
                      </div>
                      {showCompactStatusRow && (
                        <div className="flex flex-wrap gap-1.5">
                          {showActionStatus && completionMeta.isImportant && (
                            <Badge variant="outline" className={`h-6 gap-1 px-1.5 text-[10px] ${completionMeta.toneClass}`}>
                              <CompletionIcon className="size-3" />
                              {completionMeta.label}
                            </Badge>
                          )}
                          {showActionStatus && disciplineMeta.isImportant && (
                            <Badge variant="outline" className={`h-6 gap-1 px-1.5 text-[10px] ${disciplineMeta.toneClass}`}>
                              <DisciplineIcon className="size-3" />
                              {disciplineMeta.label}
                            </Badge>
                          )}
                          {showAdminDashboardInfo && pendingChangeCount > 0 && (
                            <Badge variant="outline" className="h-6 gap-1 border-amber-300 bg-amber-50 px-1.5 text-[10px] text-amber-800">
                              <ClipboardList className="size-3" />
                              {pendingChangeCount} Änderung(en)
                            </Badge>
                          )}
                        </div>
                      )}
                      {/* Teilnehmer-Liste */}
                      {team.participants && team.participants.length > 0 ? (
                        <div className="space-y-0.5">
                          {team.participants.map((p, i) => {
                            const disc = getDisciplineDisplay(p.discipline);
                            return (
                              <div key={i} className="flex items-start justify-between gap-2 text-xs text-muted-foreground">
                                <span className="min-w-0 break-words pr-2">{getParticipantDisplayName(p, i)}</span>
                                <span className="shrink-0" title={disc.label}>{disc.icon} {p.gender === "M" ? "♂" : "♀"}</span>
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                      {/* Team Manager:in extra Zeile wenn nicht Teilnehmer */}
                      {team.contactName && (!team.participants || !team.participants.some(p =>
                        team.contactName?.includes(p.firstName) || team.contactName?.includes(p.lastName)
                      )) && (
                        <div className="text-xs text-muted-foreground border-t pt-1 mt-1">
                          ⭐ {team.contactName} <span className="text-muted-foreground/60">(Team Manager:in)</span>
                        </div>
                      )}
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
                        <CardContent className="space-y-4 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                              <h3 className="min-w-0 truncate text-lg font-semibold">{team.name}</h3>
                              <Badge variant="outline" className="shrink-0 gap-1">
                                <span>{categoryEmojis[team.category] || "🏆"}</span>
                                {team.category}
                              </Badge>
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                              <Button
                                type="button"
                                size="xs"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedTeamMeta(isMetaOpen ? null : team.id);
                                }}
                              >
                                {isMetaOpen ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                                Infos
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedTeam(null);
                                  setExpandedTeamMeta(null);
                                }}
                                className="h-8 w-8 shrink-0 p-0"
                                aria-label="Details schließen"
                              >
                                <X className="size-4" />
                              </Button>
                            </div>
                          </div>

                          {isMetaOpen && (
                            <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-3">
                              {((showActionStatus && (completionMeta.isImportant || disciplineMeta.isImportant)) ||
                                (showAdminDashboardInfo && pendingChangeCount > 0) ||
                                team.isCurrentUserTeam) && (
                                <div className="flex flex-wrap gap-1.5">
                                  {showActionStatus && completionMeta.isImportant && (
                                    <Badge variant="outline" className={`h-6 gap-1 px-1.5 text-[10px] ${completionMeta.toneClass}`}>
                                      <CompletionIcon className="size-3" />
                                      {completionMeta.label}
                                    </Badge>
                                  )}
                                  {showActionStatus && disciplineMeta.isImportant && (
                                    <Badge variant="outline" className={`h-6 gap-1 px-1.5 text-[10px] ${disciplineMeta.toneClass}`}>
                                      <DisciplineIcon className="size-3" />
                                      {disciplineMeta.label}
                                    </Badge>
                                  )}
                                  {showAdminDashboardInfo && pendingChangeCount > 0 && (
                                    <Badge variant="outline" className="h-6 gap-1 border-amber-300 bg-amber-50 px-1.5 text-[10px] text-amber-800">
                                      <ClipboardList className="size-3" />
                                      {pendingChangeCount} Änderung(en)
                                    </Badge>
                                  )}
                                  {team.isCurrentUserTeam && (
                                    <Badge variant="secondary" className="h-6 gap-1 px-1.5 text-[10px]">
                                      <Star className="size-3" />
                                      Eigenes Team
                                    </Badge>
                                  )}
                                </div>
                              )}

                              <div className={`grid gap-2 sm:grid-cols-2 ${showAdminDashboardInfo ? "xl:grid-cols-4" : "xl:grid-cols-2"}`}>
                                <div className="rounded-md border border-border/60 bg-background p-3">
                                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                                    <UsersRound className="size-4" />
                                    Mannschaft
                                  </div>
                                  <div className="mt-2 space-y-1 text-sm">
                                    <div className="flex justify-between gap-3">
                                      <span className="text-muted-foreground">Teilnehmer</span>
                                      <span className="font-medium">{getParticipantCount(team)}/5</span>
                                    </div>
                                    {showAdminDashboardInfo && (
                                      <div className="flex justify-between gap-3">
                                        <span className="text-muted-foreground">Portal-Konten</span>
                                        <span className="font-medium">{linkedAccountCount}</span>
                                      </div>
                                    )}
                                    <div className="flex justify-between gap-3">
                                      <span className="text-muted-foreground">Sichtbarkeit</span>
                                      <span className="max-w-[9rem] truncate text-right font-medium" title={getTeamPublicationLabel(team)}>
                                        {getTeamPublicationLabel(team)}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="rounded-md border border-border/60 bg-background p-3">
                                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                                    <UserRound className="size-4" />
                                    Team Manager:in
                                  </div>
                                  <div className="mt-2 space-y-1 text-sm">
                                    <p className="truncate font-medium" title={team.contactName || getContactFallbackLabel(team)}>
                                      {team.contactName || getContactFallbackLabel(team)}
                                    </p>
                                    <p className="truncate text-muted-foreground" title={team.contactEmail || getContactFallbackLabel(team)}>
                                      {team.contactEmail || getContactFallbackLabel(team)}
                                    </p>
                                  </div>
                                </div>

                                {showAdminDashboardInfo && (
                                  <div className="rounded-md border border-border/60 bg-background p-3">
                                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                                      <ShieldCheck className="size-4" />
                                      Verwaltung
                                    </div>
                                    <div className="mt-2 space-y-1 text-sm">
                                      <p className="truncate font-medium" title={team.ownerName || team.ownerEmail || "Nicht sichtbar"}>
                                        {team.ownerName || team.ownerEmail || "Nicht sichtbar"}
                                      </p>
                                      <p className="truncate text-muted-foreground" title={team.ownerEmail || "Keine Owner-Mail sichtbar"}>
                                        {team.ownerEmail || "Keine Owner-Mail sichtbar"}
                                      </p>
                                    </div>
                                  </div>
                                )}

                                {showAdminDashboardInfo && (
                                  <div className="rounded-md border border-border/60 bg-background p-3">
                                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                                      <CalendarClock className="size-4" />
                                      Zeitstempel
                                    </div>
                                    <div className="mt-2 space-y-1 text-sm">
                                      <div className="flex justify-between gap-3">
                                        <span className="text-muted-foreground">Angelegt</span>
                                        <span className="font-medium">{formatDatePart(team.createdAt)}, {formatTimePart(team.createdAt)}</span>
                                      </div>
                                      <div className="flex justify-between gap-3">
                                        <span className="text-muted-foreground">Geändert</span>
                                        <span className="font-medium">{team.updatedAt ? new Date(team.updatedAt).toLocaleDateString("de-DE") : "Unbekannt"}</span>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {team.participants && team.participants.length > 0 && (
                            <div className="space-y-2">
                              <div className="overflow-hidden rounded-md border border-border/60">
                                {team.participants.map((p, i) => {
                                  const disciplineDisplay = getDisciplineDisplay(p.discipline || p.disciplineCode);
                                  const birthYear = p.birthDate ? extractBirthYearFromInput(p.birthDate) : null;
                                  const canManageModerationNote = canEditAll || team.canCurrentUserEdit === true;
                                  const emailInviteMeta = canEditAll
                                    ? getEmailInvitationMeta(p.emailInvitation?.status || (p.email ? "none" : "missing_email"))
                                    : null;
                                  const latestChangeMeta = getLatestChangeMeta(p.latestChange?.status);
                                  const shirtSizeLabel = canEditAll ? getShirtSizeLabel(p.shirtSize) : null;
                                  const participantMeta = [
                                    disciplineDisplay.label,
                                    getGenderLabel(p.gender),
                                    birthYear ? `Jg. ${birthYear}` : null,
                                    shirtSizeLabel ? `Shirt ${shirtSizeLabel}` : null,
                                  ].filter(Boolean).join(" · ");
                                  const showRights = p.isTeamManager || p.canBeTeamManager || canEditAll;

                                  return (
                                    <div key={i} className="grid gap-3 border-b border-border/40 bg-background px-3 py-3 text-xs last:border-b-0 lg:grid-cols-[minmax(0,1.35fr)_minmax(13rem,0.9fr)_auto] lg:items-start">
                                      <div className="min-w-0">
                                        <div className="flex min-w-0 items-start gap-3">
                                          <span
                                            className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/30 text-sm"
                                            title={disciplineDisplay.label}
                                          >
                                            {disciplineDisplay.icon}
                                          </span>
                                          <div className="min-w-0 flex-1 space-y-1">
                                            <p className="truncate text-sm font-medium" title={getParticipantDisplayName(p, i)}>
                                              {getParticipantDisplayName(p, i)}
                                            </p>
                                            <p className="truncate text-muted-foreground" title={participantMeta}>
                                              {participantMeta}
                                            </p>
                                          </div>
                                        </div>
                                      </div>

                                      <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-1">
                                        <div className="space-y-1">
                                          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Status</p>
                                          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                                            {latestChangeMeta && (
                                              <Badge
                                                variant="outline"
                                                className={`h-6 px-1.5 text-[10px] ${latestChangeMeta.className} ${canUseAdminLinks ? "cursor-pointer" : ""}`}
                                                onClick={(event) => {
                                                  event.stopPropagation();
                                                  if (canUseAdminLinks) {
                                                    openChangesDashboard({
                                                      participantId: p.id,
                                                      teamId: team.id,
                                                      status: p.latestChange?.status as "PENDING" | "APPROVED" | "REJECTED" | undefined,
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
                                                className={`h-6 gap-1 px-1.5 text-[10px] ${emailInviteMeta.className} ${canUseAdminLinks && (p.linkedUserId || p.email) ? "cursor-pointer" : ""}`}
                                                onClick={(event) => {
                                                  event.stopPropagation();
                                                  if (canUseAdminLinks && (p.linkedUserId || p.email)) {
                                                    openUserDashboard({ userId: p.linkedUserId, email: p.email, teamId: team.id });
                                                  }
                                                }}
                                                role={canUseAdminLinks && (p.linkedUserId || p.email) ? "link" : undefined}
                                                title={canUseAdminLinks && (p.linkedUserId || p.email) ? "Benutzerverwaltung öffnen" : undefined}
                                              >
                                                <Mail className="size-3" />
                                                {emailInviteMeta.label}
                                              </Badge>
                                            )}
                                            {!latestChangeMeta && !emailInviteMeta && (
                                              <span className="text-[11px] text-muted-foreground">Keine offenen Punkte</span>
                                            )}
                                          </div>
                                        </div>

                                        {showRights && (
                                          <div className="space-y-1">
                                            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Rechte</p>
                                            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                                              <Badge
                                                variant="outline"
                                                className={
                                                  p.isTeamManager
                                                    ? `h-6 border-green-300 px-1.5 text-[10px] text-green-700 ${canUseAdminLinks && p.linkedUserId ? "cursor-pointer" : ""}`
                                                    : "h-6 border-muted px-1.5 text-[10px] text-muted-foreground"
                                                }
                                                onClick={(event) => {
                                                  event.stopPropagation();
                                                  if (canUseAdminLinks && p.isTeamManager && p.linkedUserId) {
                                                    openUserDashboard({ userId: p.linkedUserId, teamId: team.id });
                                                  }
                                                }}
                                                role={canUseAdminLinks && p.isTeamManager && p.linkedUserId ? "link" : undefined}
                                                title={canUseAdminLinks && p.isTeamManager && p.linkedUserId ? "Benutzerverwaltung öffnen" : undefined}
                                              >
                                                {p.isTeamManager ? "Team Manager:in" : p.canBeTeamManager ? "Teilnehmer:in" : "Kein Portal-Konto"}
                                              </Badge>
                                            </div>
                                          </div>
                                        )}
                                      </div>

                                      <div className="flex flex-wrap items-center gap-1 lg:justify-end">
                                        {canManageModerationNote && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (!p.id) return;
                                              setEditingParticipant({
                                                ...p,
                                                id: p.id,
                                                teamOwnerEmail: team.ownerEmail || team.contactEmail,
                                                teamCanEdit: team.canCurrentUserEdit,
                                              });
                                            }}
                                            className={`rounded border px-2 py-1 text-[10px] transition-colors ${p.moderationNote?.trim() ? "border-primary/40 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground hover:text-primary"}`}
                                            title="Moderationshinweis bearbeiten"
                                          >
                                            {p.moderationNote?.trim() ? "Notiz" : "Notiz +"}
                                          </button>
                                        )}
                                        {(team.canCurrentUserEdit || (p.isCurrentUserParticipant && can("participant.edit.self"))) && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (!p.id) return;
                                              setEditingParticipant({
                                                ...p,
                                                id: p.id,
                                                teamOwnerEmail: team.ownerEmail || team.contactEmail,
                                                teamCanEdit: team.canCurrentUserEdit,
                                              });
                                            }}
                                            className="rounded border border-border/60 px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:text-primary"
                                            title="Teilnehmer bearbeiten"
                                          >
                                            Bearbeiten
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {team.canCurrentUserEdit && (
                            <div className="flex flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-end">
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
                            </div>
                          )}
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

// Edit Team Modal Component
function EditTeamModal({ team, onSave, onCancel, showAdminInfo = false, canManageTeamManagers = false }: {
  team: Team;
  onSave: (data: TeamEditPayload) => void;
  onCancel: () => void;
  showAdminInfo?: boolean;
  canManageTeamManagers?: boolean;
}) {
  const [showInfo, setShowInfo] = useState(false);
  const [openModerationNotes, setOpenModerationNotes] = useState<Record<number, boolean>>({});
  const [sendingInvitationIndex, setSendingInvitationIndex] = useState<number | null>(null);
  const [updatingManagerIndex, setUpdatingManagerIndex] = useState<number | null>(null);
  const [inviteMessages, setInviteMessages] = useState<Record<number, { type: "success" | "error"; text: string }>>({});
  const [managerMessages, setManagerMessages] = useState<Record<number, { type: "success" | "error"; text: string }>>({});
  const [savedInvitationEmails, setSavedInvitationEmails] = useState<Record<number, string>>(() =>
    Object.fromEntries((team.participants || []).map((participant, index) => [index, participant.email || ""])),
  );
  const [formData, setFormData] = useState({
    teamName: team.name,
    teamPublicationLevel: team.teamPublicationLevel || "TEAM_ANONYM",
    participants: team.participants || []
  });
  const liveClassification = useMemo(() => {
    const inputs = formData.participants
      .map((participant) => ({
        birthYear: extractBirthYearFromInput(participant.birthDate),
        gender: participant.gender as "M" | "W",
      }))
      .filter((participant) => participant.birthYear !== null) as Array<{ birthYear: number; gender: "M" | "W" }>;
    return classifyTeam(inputs);
  }, [formData.participants]);
  const disciplineCheck = useMemo(
    () => validateDisciplineAssignment(formData.participants.map((participant) => participant.discipline || participant.disciplineCode || "TBD")),
    [formData.participants],
  );
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

  const handleSubmit = () => {
    onSave(formData);
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-50 p-4">
      <Card className="flex w-full max-w-2xl max-h-[calc(100dvh-2rem)] flex-col overflow-hidden">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Team bearbeiten: {team.name}</CardTitle>
            {showAdminInfo && (
              <Button variant="ghost" size="sm" onClick={() => setShowInfo((value) => !value)}>
                ℹ️ Info
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex-1 space-y-4 overflow-y-auto pb-6">
          {!showAdminInfo && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Mit Prüfung markierte Teilnehmerdaten werden zur Genehmigung eingereicht. Direkt markierte Felder wie E-Mail, T-Shirt, Moderationshinweis und Veröffentlichung werden direkt gespeichert.
            </div>
          )}
          {(liveClassification.warnings.length > 0 || disciplineCheck.warnings.length > 0) && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {[...liveClassification.warnings, ...disciplineCheck.warnings].map((warning, index) => (
                <div key={index}>⚠️ {warning}</div>
              ))}
            </div>
          )}
          {showAdminInfo && showInfo && (
            <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-sm space-y-1">
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
              className="mt-1"
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
              <SelectTrigger className="mt-1">
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
            <p className="mt-1 text-xs text-muted-foreground">
              Steuert, wie das Team später für andere Rollen oder öffentlich erscheinen darf.
            </p>
          </div>

          <div>
            <label className="text-sm font-medium">Teilnehmer</label>
            <div className="space-y-3 mt-2">
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
                <div key={index} className="border border-border/50 shadow-sm rounded-md p-3 space-y-2">
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
        <div className="flex flex-col-reverse gap-3 border-t bg-background/95 px-6 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] backdrop-blur supports-[backdrop-filter]:bg-background/85 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onCancel} className="sm:w-auto">
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} className="min-h-10 whitespace-normal text-center leading-tight sm:w-auto">
            {saveButtonLabel}
          </Button>
        </div>
      </Card>
    </div>
  );
}
