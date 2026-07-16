"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import { Download, RefreshCw, SlidersHorizontal, XCircle } from "lucide-react";
import { useCompetition } from "@/lib/competition-context";
import { usePermissions } from "@/lib/permissions-context";
import { openChangesDashboard, openTeamDashboard } from "@/lib/admin-routing";
import { DisciplineBrandBadge, DisciplineBrandIcon } from "./discipline-brand";
import ParticipantEditDialog from "./participant-edit-dialog";
import ParticipantPublicationPreferenceIcon from "./participant-publication-preference-icon";
import {
  DashboardControlsCard,
  DashboardPanel,
  DashboardSearchField,
  DashboardStatsRow,
  DashboardToolbar,
  DashboardToolbarButton,
} from "./dashboard-controls";

interface ParticipantEntry {
  id: string;
  firstName: string;
  lastName: string;
  birthYear: number;
  gender: string;
  disciplineCode: string;
  participantPublicationPreference?: "NAME_VERBERGEN" | "NAME_VEROEFFENTLICHEN" | null;
  shirtSize?: string | null;
  moderationNote?: string | null;
  email?: string | null;
  teamId: string;
  teamName: string;
  teamCategory: string;
  hasPendingChange: boolean;
}

const DISCIPLINE_LABELS: Record<string, { label: string }> = {
  RUN: { label: "Laufen" },
  BENCH: { label: "Bankdrücken" },
  STOCK: { label: "Stockschießen" },
  ROAD: { label: "Rennrad" },
  MTB: { label: "Mountainbike" },
  TBD: { label: "Offen" },
};

const GENDER_LABELS: Record<string, string> = {
  MALE: "♂️",
  FEMALE: "♀️",
  M: "♂️",
  W: "♀️",
};

type QuickFilter = "all" | "openDiscipline" | "pendingChange" | "moderationNote" | "missingEmail";

const QUICK_FILTER_LABELS: Record<QuickFilter, string> = {
  all: "Alle",
  openDiscipline: "Offene Disziplin",
  pendingChange: "mit Änderungsantrag",
  moderationNote: "mit Moderationshinweis",
  missingEmail: "ohne E-Mail",
};

export default function ParticipantList() {
  const [participants, setParticipants] = useState<ParticipantEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [disciplineFilter, setDisciplineFilter] = useState("all");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [participantFilterId, setParticipantFilterId] = useState<string | null>(null);
  const [teamFilterId, setTeamFilterId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { active: activeCompetition } = useCompetition();
  const { activeRole } = usePermissions();
  const [editingParticipant, setEditingParticipant] = useState<ParticipantEntry | null>(null);
  const canSeeAdminOnlyFields = activeRole === "ADMIN";

  const fetchParticipants = async () => {
    try {
      const params = new URLSearchParams();
      if (activeCompetition?.id) params.set('competitionId', activeCompetition.id);
      const res = await fetch(`/api/admin/participants?${params}`);
      if (res.ok) {
        const data = await res.json();
        setParticipants(data.participants || []);
      }
    } catch (err) {
      console.error("Fehler:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const participantId = params.get("participantId");
    const teamId = params.get("teamId");
    const query = params.get("q");
    if (query) setSearch(query);
    if (participantId) setParticipantFilterId(participantId);
    if (teamId) setTeamFilterId(teamId);
    fetchParticipants();
  }, [activeCompetition?.id]);

  const categories = useMemo(() => {
    const cats = [...new Set(participants.map((p) => p.teamCategory))].sort();
    return cats;
  }, [participants]);

  const quickFilterCounts = useMemo(() => {
    return {
      all: participants.length,
      openDiscipline: participants.filter((p) => p.disciplineCode === "TBD").length,
      pendingChange: participants.filter((p) => p.hasPendingChange).length,
      moderationNote: participants.filter((p) => Boolean(p.moderationNote?.trim())).length,
      missingEmail: participants.filter((p) => !p.email?.trim()).length,
    };
  }, [participants]);

  const filtered = useMemo(() => {
    return participants.filter((p) => {
      const matchesSearch =
        !search ||
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
        p.teamName.toLowerCase().includes(search.toLowerCase()) ||
        (canSeeAdminOnlyFields && p.email?.toLowerCase().includes(search.toLowerCase()));

      const matchesCategory = categoryFilter === "all" || p.teamCategory === categoryFilter;
      const matchesDiscipline = disciplineFilter === "all" || p.disciplineCode === disciplineFilter;
      const matchesQuickFilter =
        quickFilter === "all" ||
        (quickFilter === "openDiscipline" && p.disciplineCode === "TBD") ||
        (quickFilter === "pendingChange" && p.hasPendingChange) ||
        (quickFilter === "moderationNote" && Boolean(p.moderationNote?.trim())) ||
        (quickFilter === "missingEmail" && canSeeAdminOnlyFields && !p.email?.trim());
      const matchesParticipantFocus = !participantFilterId || p.id === participantFilterId;
      const matchesTeamFocus = !teamFilterId || p.teamId === teamFilterId;

      return matchesSearch && matchesCategory && matchesDiscipline && matchesQuickFilter && matchesParticipantFocus && matchesTeamFocus;
    });
  }, [participants, search, categoryFilter, disciplineFilter, quickFilter, canSeeAdminOnlyFields, participantFilterId, teamFilterId]);

  const resetFilters = () => {
    setSearch("");
    setCategoryFilter("all");
    setDisciplineFilter("all");
    setQuickFilter("all");
    setParticipantFilterId(null);
    setTeamFilterId(null);
    window.history.replaceState(null, "", "/teilnehmer");
  };

  const hasActiveFilters = Boolean(
    search.trim() ||
      categoryFilter !== "all" ||
      disciplineFilter !== "all" ||
      quickFilter !== "all" ||
      participantFilterId ||
      teamFilterId,
  );

  const activeFilterCount = [
    search.trim() !== "",
    categoryFilter !== "all",
    disciplineFilter !== "all",
    quickFilter !== "all",
    Boolean(participantFilterId),
    Boolean(teamFilterId),
  ].filter(Boolean).length;

  const statsItems = [
    {
      key: "all",
      label: "Teilnehmer",
      shortLabel: "Alle",
      value: filtered.length,
      total: participants.length,
      tone: "default" as const,
      active: quickFilter === "all",
      onClick: () => setQuickFilter("all"),
    },
    {
      key: "openDiscipline",
      label: "Offen",
      shortLabel: "Offen",
      value: filtered.filter((p) => p.disciplineCode === "TBD").length,
      total: quickFilterCounts.openDiscipline,
      tone: "secondary" as const,
      active: quickFilter === "openDiscipline",
      onClick: () => setQuickFilter((current) => (current === "openDiscipline" ? "all" : "openDiscipline")),
    },
    {
      key: "pendingChange",
      label: "Anträge",
      shortLabel: "Antr.",
      value: filtered.filter((p) => p.hasPendingChange).length,
      total: quickFilterCounts.pendingChange,
      tone: "outline" as const,
      active: quickFilter === "pendingChange",
      onClick: () => setQuickFilter((current) => (current === "pendingChange" ? "all" : "pendingChange")),
    },
    {
      key: "moderationNote",
      label: "Hinweise",
      shortLabel: "Hinw.",
      value: filtered.filter((p) => Boolean(p.moderationNote?.trim())).length,
      total: quickFilterCounts.moderationNote,
      tone: "outline" as const,
      active: quickFilter === "moderationNote",
      onClick: () => setQuickFilter((current) => (current === "moderationNote" ? "all" : "moderationNote")),
    },
    ...(canSeeAdminOnlyFields
      ? [
          {
            key: "missingEmail",
            label: "Ohne E-Mail",
            shortLabel: "E-Mail",
            value: filtered.filter((p) => !p.email?.trim()).length,
            total: quickFilterCounts.missingEmail,
            tone: "outline" as const,
            active: quickFilter === "missingEmail",
            onClick: () => setQuickFilter((current) => (current === "missingEmail" ? "all" : "missingEmail")),
          },
        ]
      : []),
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-3 participant-list">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">
          Teilnehmerübersicht ({filtered.length}/{participants.length})
        </h3>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            🖨️ Drucken
          </Button>
          <Button size="sm" variant="ghost" onClick={fetchParticipants}>
            🔄
          </Button>
        </div>
      </div>

      <DashboardControlsCard>
        <div className="space-y-2">
          <DashboardSearchField
            value={search}
            onChange={setSearch}
            placeholder={canSeeAdminOnlyFields ? "Suche Name, Team, E-Mail..." : "Suche Name oder Team..."}
          />

          <DashboardStatsRow items={statsItems} />

          <DashboardToolbar>
            <DashboardToolbarButton
              icon={<Download className="size-3.5" />}
              label="Drucken"
              onClick={() => window.print()}
              variant="outline"
            />
            <DashboardToolbarButton
              icon={<RefreshCw className="size-3.5" />}
              label="Aktualisieren"
              onClick={fetchParticipants}
              variant="outline"
            />
            <DashboardToolbarButton
              icon={<SlidersHorizontal className="size-3.5" />}
              label="Filter"
              open={filtersOpen}
              badge={activeFilterCount > 0 ? activeFilterCount : null}
              onClick={() => setFiltersOpen((open) => !open)}
            />
            <DashboardToolbarButton
              icon={<XCircle className="size-3.5" />}
              label="Filter zurücksetzen"
              onClick={resetFilters}
              variant={hasActiveFilters ? "default" : "outline"}
            />
          </DashboardToolbar>

          {filtersOpen && (
            <DashboardPanel className="mt-1">
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(QUICK_FILTER_LABELS) as QuickFilter[])
                    .filter((filter) => filter !== "missingEmail" || canSeeAdminOnlyFields)
                    .map((filter) => (
                      <Button
                        key={filter}
                        type="button"
                        size="sm"
                        variant={quickFilter === filter ? "default" : "outline"}
                        onClick={() => setQuickFilter(filter)}
                        className="justify-between gap-2"
                      >
                        <span>{QUICK_FILTER_LABELS[filter]}</span>
                        <span className="rounded bg-background/30 px-1 text-[10px]">
                          {quickFilterCounts[filter]}
                        </span>
                      </Button>
                    ))}
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Klasse" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle Klassen</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={disciplineFilter} onValueChange={setDisciplineFilter}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Disziplin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle Disziplinen</SelectItem>
                      {Object.entries(DISCIPLINE_LABELS).map(([code, d]) => (
                        <SelectItem key={code} value={code}>
                          <DisciplineBrandBadge code={code} label={d.label} />
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </DashboardPanel>
          )}
        </div>
      </DashboardControlsCard>

      {/* Participant Cards */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 py-8 text-center">
            <p className="text-muted-foreground">Keine Teilnehmer gefunden</p>
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              Filter zurücksetzen
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1">
          <AnimatePresence>
            {filtered.map((p) => {
              const disc = DISCIPLINE_LABELS[p.disciplineCode] || DISCIPLINE_LABELS.TBD;
              const gender = GENDER_LABELS[p.gender] || "⚧️";

              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  layout
                >
                  <div className="grid gap-2 rounded-lg border border-border/30 p-2.5 transition-colors hover:bg-accent/50 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                    <div className="flex min-w-0 items-start gap-3">
                      <DisciplineBrandIcon code={p.disciplineCode} label={disc.label} className="mt-0.5 size-9" />
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                          <span className="min-w-0 truncate text-sm font-medium">
                            {p.lastName}, {p.firstName}
                          </span>
                          <ParticipantPublicationPreferenceIcon preference={p.participantPublicationPreference} />
                          <span className="text-xs">{gender}</span>
                          {p.hasPendingChange && (
                            <Badge
                              variant="outline"
                              className={`text-amber-600 text-[10px] px-1 py-0 ${canSeeAdminOnlyFields ? "cursor-pointer" : ""}`}
                              onClick={(event: React.MouseEvent<HTMLSpanElement>) => {
                                event.stopPropagation();
                                if (canSeeAdminOnlyFields) {
                                  openChangesDashboard({ participantId: p.id, teamId: p.teamId, status: "PENDING" });
                                }
                              }}
                              role={canSeeAdminOnlyFields ? "link" : undefined}
                              title={canSeeAdminOnlyFields ? "Zum Änderungsdashboard" : undefined}
                            >
                              ⏳
                            </Badge>
                          )}
                        </div>
                        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                          <button
                            type="button"
                            className={canSeeAdminOnlyFields ? "truncate hover:text-primary" : "truncate"}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (canSeeAdminOnlyFields) {
                                openTeamDashboard({ teamId: p.teamId });
                              }
                            }}
                            disabled={!canSeeAdminOnlyFields}
                            title={canSeeAdminOnlyFields ? "Mannschaft öffnen" : undefined}
                          >
                            {p.teamName}
                          </button>
                          <span>·</span>
                          <span>{p.teamCategory}</span>
                          <span>·</span>
                          <span>Jg. {p.birthYear}</span>
                          {canSeeAdminOnlyFields && p.shirtSize && (
                            <>
                              <span>·</span>
                              <span>👕 {p.shirtSize}</span>
                            </>
                          )}
                        </div>
                        {p.moderationNote?.trim() && (
                          <p className="mt-1 line-clamp-2 text-xs text-foreground/80">
                            Hinweis: {p.moderationNote.trim()}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-1">
                      {p.moderationNote?.trim() && (
                        <Badge variant="secondary" className="h-7 shrink-0 text-[10px]">
                          Hinweis
                        </Badge>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingParticipant(p)}
                        className="h-7 shrink-0 px-2 text-[11px]"
                      >
                        Bearbeiten
                      </Button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <div className="print-only participant-print-sheet">
        <div className="mb-4">
          <h1>Moderationsliste</h1>
          <p>
            {activeCompetition?.name || "Wettkampf"} · {filtered.length} von {participants.length} Teilnehmer:innen
          </p>
        </div>
        <table>
          <thead>
            <tr>
              <th>Disziplin</th>
              <th>Name</th>
              <th>Team</th>
              <th>Klasse</th>
              <th>Jg.</th>
              <th>Hinweis</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const disc = DISCIPLINE_LABELS[p.disciplineCode] || DISCIPLINE_LABELS.TBD;
              return (
                <tr key={p.id}>
                  <td>{disc.label}</td>
                  <td>
                    <span className="inline-flex items-center gap-1.5">
                      {[p.lastName, p.firstName].filter(Boolean).join(", ")}
                      <ParticipantPublicationPreferenceIcon preference={p.participantPublicationPreference} />
                    </span>
                  </td>
                  <td>{p.teamName}</td>
                  <td>{p.teamCategory}</td>
                  <td>{p.birthYear}</td>
                  <td>{p.moderationNote?.trim() || ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Edit Dialog */}
      <ParticipantEditDialog
        participant={editingParticipant}
        open={!!editingParticipant}
        onOpenChange={(open) => { if (!open) setEditingParticipant(null); }}
        onSaved={() => { fetchParticipants(); }}
        directEdit={true}
        isAdminEdit={canSeeAdminOnlyFields}
        showModerationNote
        moderatorNoteOnly={!canSeeAdminOnlyFields}
        showAdminOnlyParticipantFields={canSeeAdminOnlyFields}
      />
    </div>
  );
}
