"use client";

import { useState, useEffect, useMemo } from "react";
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
import { canRoleViewAllTeams, isOwnerFilterVisibleForRole } from "@/lib/team-access-config";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDownUp, ChevronDown, ChevronUp, Info, RotateCcw, Send, SlidersHorizontal } from "lucide-react";
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
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [incompleteOnly, setIncompleteOnly] = useState(false);
  const [viewMode, setViewMode] = useState<DashboardViewMode>("cards");
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [editingParticipant, setEditingParticipant] = useState<EditableParticipant | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
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
  const userEmail = session?.user?.email;
  const { active: activeCompetition } = useCompetition();
  const showOwnerFilter = isOwnerFilterVisibleForRole(activeRole, activeCompetition);
  const canBrowseAllTeams = canViewAll || canRoleViewAllTeams(activeRole, activeCompetition);

  const fetchTeams = async () => {
    try {
      const params = new URLSearchParams();
      if (activeCompetition?.id) params.set('competitionId', activeCompetition.id);
      if (canBrowseAllTeams) params.set('scope', 'all');
      params.set("roleContext", activeRole);
      const response = await fetch(`/api/teams?${params}`);
      const data = await response.json();
      setTeams(data.teams || []);
    } catch (error) {
      console.error('Failed to fetch teams:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    setDeleting(teamId);
    try {
      const response = await fetch(`/api/teams/${teamId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        await fetchTeams(); // Refresh list
      } else {
        const error = await response.json();
        alert(`Fehler beim Löschen: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to delete team:', error);
      alert('Fehler beim Löschen des Teams');
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
        if (notices.length > 0) {
          alert(notices.join("\n"));
        }
      } else {
        const error = await response.json();
        alert(`Fehler beim Speichern: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to edit team:', error);
      alert('Fehler beim Speichern des Teams');
    }
  };

  // Pending owner filter (set before teams are loaded)
  const [pendingOwnerFilter, setPendingOwnerFilter] = useState<string | null>(null);

  useEffect(() => {
    fetchTeams();
  }, [activeCompetition?.id, canBrowseAllTeams, activeRole]);

  useEffect(() => {
    if (!showOwnerFilter) {
      setOwnerFilter("all");
    }
  }, [showOwnerFilter]);

  useEffect(() => {
    if (viewMode === "list") {
      setExpandedTeam(null);
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

  // Filter and search logic
  const filteredTeams = useMemo(() => {
    return teams.filter(team => {
      // Category filter
      const matchesCategory = categoryFilter === "all" || team.category === categoryFilter;
      const matchesOwner =
        !showOwnerFilter ||
        ownerFilter === "all" ||
        normalizeEmail(team.ownerEmail || team.contactEmail) === normalizeEmail(ownerFilter);
      const matchesCompleteness = !incompleteOnly || isTeamIncomplete(team);
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
      
      return matchesCategory && matchesOwner && matchesCompleteness && matchesCreatedAt && matchesSearch;
    });
  }, [teams, categoryFilter, searchQuery, ownerFilter, incompleteOnly, createdFrom, createdTo, showOwnerFilter]);

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
  const incompleteTeams = teams.filter((team) => isTeamIncomplete(team)).length;
  const hasActiveFilters =
    searchQuery !== "" ||
    categoryFilter !== "all" ||
    (showOwnerFilter && ownerFilter !== "all") ||
    incompleteOnly ||
    createdFrom !== "" ||
    createdTo !== "";
  const activeFilterCount = [
    searchQuery !== "",
    categoryFilter !== "all",
    showOwnerFilter && ownerFilter !== "all",
    incompleteOnly,
    createdFrom !== "",
    createdTo !== "",
  ].filter(Boolean).length;
  const canEditOwn = can("team.edit.own");

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
    <div className="space-y-6">
      {/* Kompakte Stats-Leiste */}
      <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-2">
        <span><span className="font-semibold text-primary">{filteredTeams.length}</span> Teams</span>
        <span>·</span>
        <span><span className="font-semibold text-primary">{totalParticipants}</span> Teilnehmer:innen</span>
        <span>·</span>
        <span><span className="font-semibold text-primary">{categories.length}</span> Klassen</span>
        <span>·</span>
        <span><span className="font-semibold text-primary">{incompleteTeams}</span> unvollständig</span>
      </div>

      {/* Kategorien-Badges (flache Zeile) */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {categoryStats.map((cat) => (
            <Badge key={cat.category} variant="outline" className="flex items-center gap-1">
              <span>{categoryEmojis[cat.category] || "🏆"}</span>
              {cat.category} ({cat.count})
            </Badge>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          variant={viewMode === "cards" ? "default" : "outline"}
          onClick={() => setViewMode("cards")}
        >
          Kacheln
        </Button>
        <Button
          variant={viewMode === "list" ? "default" : "outline"}
          onClick={() => setViewMode("list")}
        >
          Liste
        </Button>
      </div>

      <Card size="sm">
        <CardHeader className="border-b">
          <button
            type="button"
            onClick={() => setFiltersOpen((open) => !open)}
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-sm">
                <SlidersHorizontal className="size-4" />
                Filter & Suche
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {showOwnerFilter
                  ? "Suche, Klasse, Anleger:in, Vollständigkeit und Zeitraum eingrenzen"
                  : "Suche, Klasse, Vollständigkeit und Zeitraum eingrenzen"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={hasActiveFilters ? "default" : "outline"}>
                {activeFilterCount} aktiv
              </Badge>
              {filtersOpen ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
            </div>
          </button>
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
                  onClick={() => {
                    setSearchQuery("");
                    setCategoryFilter("all");
                    setOwnerFilter(showOwnerFilter ? (initialOwnerFilter || "all") : "all");
                    setIncompleteOnly(false);
                    setCreatedFrom("");
                    setCreatedTo("");
                  }}
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

      <div className="text-sm text-muted-foreground">
        {filteredTeams.length} von {teams.length} Teams gefunden
        {hasActiveFilters ? " für die aktuellen Filter" : ""}
      </div>

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
                                <AlertDialog>
                                  <AlertDialogTrigger>
                                    <button
                                      className="inline-flex items-center justify-center whitespace-nowrap rounded-md bg-destructive px-3 py-1 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:pointer-events-none disabled:opacity-50"
                                      disabled={deleting === team.id}
                                    >
                                      {deleting === team.id ? "..." : "🗑️ Löschen"}
                                    </button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Team löschen?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Möchtest du das Team &quot;{team.name}&quot; wirklich löschen?
                                        Diese Aktion kann nicht rückgängig gemacht werden.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDeleteTeam(team.id)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Löschen
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
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
            {sortedTeams.map((team) => (
              <div key={team.id} className="space-y-2">
                {/* Team-Kachel mit Teilnehmern */}
                <Card 
                  className={`cursor-pointer transition-colors hover:bg-muted/50 ${expandedTeam === team.id ? "ring-2 ring-primary" : ""}`}
                  onClick={() => setExpandedTeam(expandedTeam === team.id ? null : team.id)}
                >
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-sm truncate">{team.name}</h3>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {categoryEmojis[team.category] || "🏆"} {team.category}
                      </Badge>
                    </div>
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
                        <CardContent className="space-y-3 p-3">
                          {/* Team Details */}
                          <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                                <span className="min-w-0 truncate font-semibold">{team.name}</span>
                                <span className="shrink-0 text-muted-foreground">{categoryEmojis[team.category] || "🏆"} {team.category}</span>
                                <span className="shrink-0 text-muted-foreground">{team.participants?.length || 0}/5 Teilnehmer</span>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedTeam(null);
                                }}
                                className="h-6 w-6 shrink-0 p-0"
                              >
                                ✕
                              </Button>
                            </div>
                          </div>

                          <details className="rounded-md border border-border/60 bg-muted/10 p-2 text-xs">
                            <summary className="cursor-pointer font-medium">Metadaten & Kontakt Team Manager:in</summary>
                            <div className="mt-2 grid gap-x-3 gap-y-1 text-muted-foreground sm:grid-cols-2">
                              {hasVisibleContactInfo(team) ? (
                                <>
                                  {team.contactName && <div><strong className="text-foreground">Team Manager:in:</strong> ⭐ {team.contactName}</div>}
                                  {team.contactEmail && <div><strong className="text-foreground">E-Mail:</strong> {team.contactEmail}</div>}
                                </>
                              ) : (
                                <div>Kontaktdaten sind in dieser Ansicht nicht sichtbar.</div>
                              )}
                              <div><strong className="text-foreground">Anlagedatum:</strong> {formatDatePart(team.createdAt)}</div>
                              <div><strong className="text-foreground">Anlageuhrzeit:</strong> {formatTimePart(team.createdAt)}</div>
                              <div><strong className="text-foreground">Anlage-User:</strong> {team.ownerName || team.ownerEmail || "Nicht sichtbar"}</div>
                              <div><strong className="text-foreground">Letzte Änderung:</strong> {team.updatedAt ? new Date(team.updatedAt).toLocaleString("de-DE") : "Unbekannt"}</div>
                            </div>
                          </details>

                          {/* Participants */}
                          {team.participants && team.participants.length > 0 && (
                            <div className="space-y-1.5">
                              <div className="space-y-1">
                                {team.participants.map((p, i) => {
                                  const disciplineDisplay = getDisciplineDisplay(p.discipline);
                                  const birthYear = p.birthDate ? extractBirthYearFromInput(p.birthDate) : null;
                                  const emailInviteMeta = getEmailInvitationMeta(p.emailInvitation?.status || (p.email ? "none" : "missing_email"));
                                  const canManageModerationNote = canEditAll || team.canCurrentUserEdit === true;
                                  return (
                                    <div key={i} className="rounded-md border border-border/40 bg-background px-2 py-1.5 text-xs">
                                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="min-w-0">
                                          <div className="flex min-w-0 items-center gap-1.5">
                                            <span className="shrink-0" title={disciplineDisplay.label}>{disciplineDisplay.icon}</span>
                                            <span className="break-words font-medium leading-snug">{getParticipantDisplayName(p, i)}</span>
                                          </div>
                                          <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-muted-foreground">
                                            <span>{disciplineDisplay.label}</span>
                                            <span>{p.gender === "M" ? "♂" : p.gender === "W" ? "♀" : "⚥"}</span>
                                            {birthYear && <span>Jg. {birthYear}</span>}
                                            {p.shirtSize && <span>👕 {p.shirtSize}</span>}
                                            {(canEditAll || canManageModerationNote) && <span className="break-all">{p.email || "Keine E-Mail hinterlegt"}</span>}
                                          </div>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-1 sm:shrink-0 sm:justify-end">
                                          {getLatestChangeMeta(p.latestChange?.status) && (
                                            <Badge
                                              variant="outline"
                                              className={`h-6 px-1.5 text-[10px] ${getLatestChangeMeta(p.latestChange?.status)?.className}`}
                                            >
                                              {getLatestChangeMeta(p.latestChange?.status)?.label}
                                            </Badge>
                                          )}
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
                                              className={`rounded border px-1.5 py-0.5 text-[10px] transition-colors ${p.moderationNote?.trim() ? "border-primary/40 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground hover:text-primary"}`}
                                              title="Moderationshinweis bearbeiten"
                                            >
                                              {p.moderationNote?.trim() ? "📝" : "📝+"}
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
                                              className="text-xs text-muted-foreground hover:text-primary transition-colors"
                                              title="Teilnehmer bearbeiten"
                                            >
                                              ✏️
                                            </button>
                                          )}
                                          <Badge variant="outline" className={`h-6 px-1.5 text-[10px] ${emailInviteMeta.className}`}>
                                            {emailInviteMeta.label}
                                          </Badge>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Actions */}
                          {team.canCurrentUserEdit && (
                            <div className="flex gap-2 pt-2">
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
                              <AlertDialog>
                                <AlertDialogTrigger>
                                  <button 
                                    className="flex-1 inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 h-8 px-3 py-1"
                                    disabled={deleting === team.id}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {deleting === team.id ? "..." : "🗑️ Löschen"}
                                  </button>
                                </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Team löschen?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Möchtest du das Team &quot;{team.name}&quot; wirklich löschen? 
                                    Diese Aktion kann nicht rückgängig gemacht werden.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => handleDeleteTeam(team.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Löschen
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
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
