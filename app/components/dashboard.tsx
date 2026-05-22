"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
  extractBirthYearFromInput,
  formatBirthDateInput,
  resolveBirthDateInputKey,
} from "@/lib/domain/team";
import { classifyTeam, validateDisciplineAssignment } from "@/lib/domain/classification";
import { SHIRT_SIZES } from "@/lib/domain/shirts";
import { usePermissions } from "@/lib/permissions-context";
import { useCompetition } from "@/lib/competition-context";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDownUp, ChevronDown, ChevronUp, RotateCcw, SlidersHorizontal } from "lucide-react";
import ParticipantEditDialog from "./participant-edit-dialog";

interface Team {
  id: string;
  name: string;
  category: string;
  contactName: string;
  contactEmail: string;
  ownerEmail?: string;
  ownerName?: string;
  createdAt?: string;
  updatedAt?: string;
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
  phone?: string | null;
  pendingChanges?: { id: string; status: string }[];
  latestChange?: {
    id: string;
    status: string;
    updatedAt?: string | null;
    reviewedAt?: string | null;
    reviewComment?: string | null;
  } | null;
  teamOwnerEmail?: string;
}

type TeamEditPayload = {
  teamName: string;
  participants: Participant[];
};

type EditableParticipant = Omit<Participant, "id"> & { id: string };

interface DashboardProps {
  ownerFilter?: string;
}

type DashboardViewMode = "cards" | "list";
type TeamSortField = "name" | "category" | "contactName" | "ownerEmail" | "participantCount" | "createdAt" | "updatedAt";
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

const SORT_OPTIONS: Array<{ value: TeamSortField; label: string }> = [
  { value: "updatedAt", label: "Zuletzt geändert" },
  { value: "createdAt", label: "Angelegt" },
  { value: "name", label: "Mannschaftsname" },
  { value: "category", label: "Klasse" },
  { value: "contactName", label: "Teamchef:in" },
  { value: "ownerEmail", label: "Angelegt von" },
  { value: "participantCount", label: "Teilnehmerzahl" },
];

const LIST_OPTIONAL_COLUMNS: Array<{ key: TeamOptionalColumnKey; label: string }> = [
  { key: "category", label: "Klasse" },
  { key: "contactName", label: "Teamchef:in" },
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

function escapeCsvValue(value: string | number | null | undefined) {
  const normalized = value == null ? "" : String(value);
  return '"' + normalized.replace(/"/g, '""') + '"';
}

function normalizeEmail(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function getParticipantCount(team: Team) {
  return team.participants?.length || 0;
}

function getParticipantsSummary(team: Team) {
  return (team.participants ?? [])
    .map((participant) => `${participant.firstName} ${participant.lastName}`.trim())
    .filter(Boolean)
    .join(", ");
}

function getLatestChangeMeta(status?: string | null) {
  if (status === "PENDING") return { label: "In Prüfung", className: "border-amber-300 text-amber-700" };
  if (status === "APPROVED") return { label: "Genehmigt", className: "border-green-300 text-green-700" };
  if (status === "REJECTED") return { label: "Abgelehnt", className: "border-red-300 text-red-700" };
  return null;
}

function compareDates(a?: string, b?: string) {
  const aTime = a ? new Date(a).getTime() : 0;
  const bTime = b ? new Date(b).getTime() : 0;
  return aTime - bTime;
}

function exportTeamsCsv(teams: Team[]) {
  const headers = [
    "Team",
    "Klasse",
    "Teamchef",
    "Kontakt E-Mail",
    "Owner E-Mail",
    "Angelegt",
    "Zuletzt geaendert",
    "Teilnehmeranzahl",
    "Teilnehmer",
    "Disziplinen",
  ];

  const rows = teams.map((team) => {
    const participantNames = (team.participants ?? [])
      .map((participant) => (participant.firstName + " " + participant.lastName).trim())
      .filter(Boolean)
      .join(" | ");
    const disciplines = (team.participants ?? [])
      .map((participant) => participant.discipline || participant.disciplineCode || "TBD")
      .join(" | ");

    return [
      team.name,
      team.category,
      team.contactName,
      team.contactEmail,
      team.ownerEmail || "",
      team.createdAt ? new Date(team.createdAt).toLocaleString("de-DE") : "",
      team.updatedAt ? new Date(team.updatedAt).toLocaleString("de-DE") : "",
      team.participants?.length || 0,
      participantNames,
      disciplines,
    ];
  });

  const csv = [headers, ...rows]
    .map((row) => row.map((value) => escapeCsvValue(value)).join(";"))
    .join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "teams-export-" + new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-") + ".csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function Dashboard({ ownerFilter: initialOwnerFilter }: DashboardProps = {}) {
  const { data: session } = useSession();
  const { can } = usePermissions();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<string>(initialOwnerFilter || "all");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [viewMode, setViewMode] = useState<DashboardViewMode>("cards");
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [editingParticipant, setEditingParticipant] = useState<EditableParticipant | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(true);
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

  const fetchTeams = async () => {
    try {
      const params = new URLSearchParams();
      if (activeCompetition?.id) params.set('competitionId', activeCompetition.id);
      if (canViewAll) params.set('scope', 'all');
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
  }, [activeCompetition?.id, canViewAll]);

  useEffect(() => {
    if (viewMode === "list") {
      setExpandedTeam(null);
    }
  }, [viewMode]);

  useEffect(() => {
    // Listen for switchTab events to handle owner filter
    const handleSwitchTab = (e: CustomEvent) => {
      if (e.detail.ownerFilter && e.detail.tabId === "dashboard") {
        setOwnerFilter(e.detail.ownerFilter);
        setPendingOwnerFilter(e.detail.ownerFilter);
      }
    };
    
    const listener: EventListener = (event) => handleSwitchTab(event as CustomEvent);
    window.addEventListener("switchTab", listener);
    return () => window.removeEventListener("switchTab", listener);
  }, []);

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
        ownerFilter === "all" ||
        normalizeEmail(team.ownerEmail || team.contactEmail) === normalizeEmail(ownerFilter);
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
        team.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (team.participants?.some(p => 
          `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
        ) ?? false);
      
      return matchesCategory && matchesOwner && matchesCreatedAt && matchesSearch;
    });
  }, [teams, categoryFilter, searchQuery, ownerFilter, createdFrom, createdTo]);

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
  const incompleteTeams = teams.filter(t => !t.participants || t.participants.some(p => !p.firstName || !p.lastName)).length;
  const hasActiveFilters =
    searchQuery !== "" ||
    categoryFilter !== "all" ||
    ownerFilter !== "all" ||
    createdFrom !== "" ||
    createdTo !== "";
  const activeFilterCount = [searchQuery !== "", categoryFilter !== "all", ownerFilter !== "all", createdFrom !== "", createdTo !== ""].filter(Boolean).length;
  const canEditOwn = can("team.edit.own");

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
                Suche, Klasse, Anleger:in und Zeitraum eingrenzen
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
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <div className="space-y-1 xl:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Suche</label>
                <Input
                  placeholder="Teamname, Teamchef:in oder Teilnehmer:in"
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
                    setOwnerFilter(initialOwnerFilter || "all");
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

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
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

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => exportTeamsCsv(sortedTeams)}
            disabled={sortedTeams.length === 0}
          >
            CSV Export
          </Button>
        </div>
      </div>

      {viewMode === "list" && (
        <Card size="sm">
          <CardHeader className="border-b">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-sm">
                <ArrowDownUp className="size-4" />
                Listenoptionen
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Sortierung festlegen und sichtbare Spalten anpassen
              </p>
            </div>
          </CardHeader>
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
                  <th className="px-4 py-3 font-medium">Mannschaftsname</th>
                  {visibleColumnDefs.map((column) => (
                    <th key={column.key} className="px-4 py-3 font-medium whitespace-nowrap">
                      {column.label}
                    </th>
                  ))}
                  {(canEditAll || canEditOwn) && (
                    <th className="px-4 py-3 font-medium text-right">Aktionen</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {sortedTeams.map((team) => {
                  const isEditable = canEditAll || (normalizeEmail(team.ownerEmail) === normalizeEmail(userEmail) && canEditOwn);

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
                            content = team.contactName || "—";
                            break;
                          case "contactEmail":
                            content = team.contactEmail || "—";
                            break;
                          case "ownerEmail":
                            content = team.ownerEmail || team.contactEmail || "—";
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
                          const isChief = p.firstName === team.contactName?.split(" ")[0];
                          return (
                            <div key={i} className="text-xs text-muted-foreground flex items-center justify-between">
                              <span>{p.firstName} {p.lastName} {isChief ? "⭐" : ""}</span>
                              <span title={disc.label}>{disc.icon} {p.gender === "M" ? "♂" : "♀"}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                    {/* Teamchef:in extra Zeile wenn nicht Teilnehmer */}
                    {team.contactName && (!team.participants || !team.participants.some(p => 
                      team.contactName?.includes(p.firstName) || team.contactName?.includes(p.lastName)
                    )) && (
                      <div className="text-xs text-muted-foreground border-t pt-1 mt-1">
                        ⭐ {team.contactName} <span className="text-muted-foreground/60">(Teamchef:in)</span>
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
                        <CardContent className="p-4 space-y-4">
                          {/* Team Details */}
                          <div className="space-y-2">
                            <h3 className="font-semibold flex items-center gap-2">
                              {team.name}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedTeam(null);
                                }}
                                className="h-6 w-6 p-0"
                              >
                                ✕
                              </Button>
                            </h3>
                            <div className="text-sm space-y-1">
                              <div><strong>Teamchef:in:</strong> ⭐ {team.contactName}</div>
                              <div><strong>E-Mail:</strong> {team.contactEmail}</div>
                              <div><strong>Klasse:</strong> {categoryEmojis[team.category] || "🏆"} {team.category}</div>
                            </div>
                          </div>

                          <div className="rounded-md border border-border/60 bg-muted/30 p-3">
                            <div className="grid gap-2 text-xs sm:grid-cols-2">
                              <div><strong>Anlagedatum:</strong> {formatDatePart(team.createdAt)}</div>
                              <div><strong>Anlageuhrzeit:</strong> {formatTimePart(team.createdAt)}</div>
                              <div><strong>Anlage-User:</strong> {team.ownerName || team.ownerEmail || team.contactName || "Unbekannt"}</div>
                              <div><strong>Letzte Änderung:</strong> {team.updatedAt ? new Date(team.updatedAt).toLocaleString("de-DE") : "Unbekannt"}</div>
                            </div>
                          </div>

                          {/* Participants */}
                          {team.participants && team.participants.length > 0 && (
                            <div className="space-y-2">
                              <h4 className="font-medium text-sm">Teilnehmer ({team.participants.length}/5):</h4>
                              <div className="space-y-2">
                                {team.participants.map((p, i) => {
                                  const disciplineDisplay = getDisciplineDisplay(p.discipline);
                                  const birthYear = p.birthDate ? extractBirthYearFromInput(p.birthDate) : null;
                                  const canManageModerationNote =
                                    canEditAll ||
                                    (normalizeEmail(team.ownerEmail || team.contactEmail) === normalizeEmail(userEmail) && can("team.edit.own"));
                                  return (
                                    <div key={i} className="text-sm border border-border/40 shadow-sm rounded p-2 space-y-1">
                                      <div className="flex items-center justify-between">
                                        <span className="font-medium">{p.firstName} {p.lastName}</span>
                                <div className="flex items-center gap-2">
                                          {getLatestChangeMeta(p.latestChange?.status) && (
                                            <Badge
                                              variant="outline"
                                              className={getLatestChangeMeta(p.latestChange?.status)?.className}
                                            >
                                              {getLatestChangeMeta(p.latestChange?.status)?.label}
                                            </Badge>
                                          )}
                                          {canManageModerationNote && (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                if (!p.id) return;
                                                setEditingParticipant({ ...p, id: p.id, teamOwnerEmail: team.ownerEmail || team.contactEmail });
                                              }}
                                              className={`rounded border px-2 py-0.5 text-[11px] transition-colors ${p.moderationNote?.trim() ? "border-primary/40 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground hover:text-primary"}`}
                                              title="Moderationshinweis bearbeiten"
                                            >
                                              {p.moderationNote?.trim() ? "📝 Hinweis" : "📝 Hinzufuegen"}
                                            </button>
                                          )}
                                          {(canEditAll || (team.ownerEmail === userEmail && can("team.edit.own")) || (p.email === userEmail && can("participant.edit.self"))) && (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                if (!p.id) return;
                                                setEditingParticipant({ ...p, id: p.id, teamOwnerEmail: team.ownerEmail });
                                              }}
                                              className="text-xs text-muted-foreground hover:text-primary transition-colors"
                                              title="Teilnehmer bearbeiten"
                                            >
                                              ✏️
                                            </button>
                                          )}
                                          <span title={disciplineDisplay.label}>{disciplineDisplay.icon}</span>
                                          <span>{p.gender === "M" ? "♂" : p.gender === "W" ? "♀" : "⚥"}</span>
                                        </div>
                                      </div>
                                      <div className="text-xs text-muted-foreground flex justify-between">
                                        <span>{disciplineDisplay.label}</span>
                                        <div className="flex items-center gap-2">
                                          {p.shirtSize && <span>👕 {p.shirtSize}</span>}
                                          {birthYear && <span>Jg. {birthYear}</span>}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Actions */}
                          {(canEditAll || (team.ownerEmail === userEmail && can("team.edit.own"))) && (
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
        showModerationNote={canEditAll || normalizeEmail(editingParticipant?.teamOwnerEmail) === normalizeEmail(userEmail)}
      />
    </div>
  );
}

// Edit Team Modal Component
function EditTeamModal({ team, onSave, onCancel, showAdminInfo = false }: {
  team: Team;
  onSave: (data: TeamEditPayload) => void;
  onCancel: () => void;
  showAdminInfo?: boolean;
}) {
  const [showInfo, setShowInfo] = useState(false);
  const [openModerationNotes, setOpenModerationNotes] = useState<Record<number, boolean>>({});
  const [formData, setFormData] = useState({
    teamName: team.name,
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

  const handleParticipantChange = (index: number, field: string, value: string) => {
    const newParticipants = [...formData.participants];
    newParticipants[index] = { ...newParticipants[index], [field]: value };
    setFormData({ ...formData, participants: newParticipants });
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
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
              Aenderungen durch Teamchefs werden jetzt zur Genehmigung eingereicht. Teamname bleibt in diesem Schritt schreibgeschuetzt.
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
            <label className="text-sm font-medium">Teilnehmer</label>
            <div className="space-y-3 mt-2">
              {formData.participants.map((participant, index) => (
                <div key={index} className="border border-border/50 shadow-sm rounded-md p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground">Vorname</label>
                      <Input
                        value={participant.firstName}
                        onChange={(e) => handleParticipantChange(index, 'firstName', e.target.value)}
                        className="h-8"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Nachname</label>
                      <Input
                        value={participant.lastName}
                        onChange={(e) => handleParticipantChange(index, 'lastName', e.target.value)}
                        className="h-8"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground">Geschlecht</label>
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
                      <label className="text-xs text-muted-foreground">T-Shirt</label>
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
                      <label className="text-xs text-muted-foreground">Geburtsdatum</label>
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
                      <label className="text-xs text-muted-foreground">Disziplin</label>
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
                      <label className="text-xs text-muted-foreground">Hinweis für Moderation (intern)</label>
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
              ))}
            </div>
          </div>

        </CardContent>
        <div className="flex justify-end gap-3 border-t bg-background/95 px-6 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] backdrop-blur supports-[backdrop-filter]:bg-background/85">
          <Button variant="outline" onClick={onCancel}>
            Abbrechen
          </Button>
          <Button onClick={handleSubmit}>
            {showAdminInfo ? "💾 Speichern" : "📨 Zur Genehmigung einreichen"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
