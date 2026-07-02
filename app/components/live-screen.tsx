"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useCompetition } from "@/lib/competition-context";
import { usePermissions } from "@/lib/permissions-context";
import { canRoleViewAllTeams } from "@/lib/team-access-config";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DISCIPLINES } from "@/lib/domain/team";
import { compareClassificationCodes } from "@/lib/domain/classification";
import ResultsView from "./results-view";
import ParticipantPublicationPreferenceIcon from "./participant-publication-preference-icon";

const SEGMENTS = ["teams", "start", "ergebnis"] as const;
type Segment = typeof SEGMENTS[number];

interface Team {
  id: string;
  name: string;
  teamPublicationLevel?: "TEAM_ANONYM" | "TEAMNAME_OEFFENTLICH" | "ALLES_OEFFENTLICH";
  category: string;
  contactName: string;
  contactEmail: string;
  participants?: Participant[];
}

interface Participant {
  firstName: string;
  lastName: string;
  gender: string;
  birthDate: string;
  discipline?: string;
  participantPublicationPreference?: "NAME_VERBERGEN" | "NAME_VEROEFFENTLICHEN" | null;
}

const categoryEmojis: Record<string, string> = {
  "schueler-a": "SA",
  "schueler-b": "SB",
  "jugend": "J",
  "jungsters": "⚡",
  "herren": "🏋️",
  "masters": "🎖️",
  "damen-a": "🏋️‍♀️",
  "damen-b": "👩‍🦳",
};

const categoryLabels: Record<string, string> = {
  "schueler-a": "Schüler A",
  "schueler-b": "Schüler B",
  jugend: "Jugend",
  jungsters: "Jungsters",
  herren: "Herren",
  masters: "Masters",
  "damen-a": "Damen A",
  "damen-b": "Damen B",
};

// Helper function to get discipline display
const getDisciplineDisplay = (disciplineCode?: string) => {
  if (!disciplineCode || disciplineCode === "TBD") {
    return { label: "Noch offen", icon: "❓" };
  }
  const discipline = DISCIPLINES.find(d => d.id === disciplineCode);
  return discipline ? { label: discipline.label, icon: discipline.icon } : { label: disciplineCode, icon: "🏃" };
};

export default function LiveScreen() {
  const [activeSegment, setActiveSegment] = useState<Segment>("teams");
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const { active: activeCompetition } = useCompetition();
  const { activeRole } = usePermissions();
  const canViewTeamLists = canRoleViewAllTeams(activeRole, activeCompetition);
  const availableSegments = useMemo<Segment[]>(
    () => canViewTeamLists ? [...SEGMENTS] : ["ergebnis"],
    [canViewTeamLists],
  );

  // Fetch teams data
  const fetchTeams = useCallback(async () => {
    if (!canViewTeamLists) {
      setTeams([]);
      setLoading(false);
      return;
    }

    try {
      // Fetch all teams for live view
      const params = new URLSearchParams({ scope: 'all', roleContext: activeRole });
      if (activeCompetition?.id) params.set('competitionId', activeCompetition.id);
      const response = await fetch(`/api/teams?${params}`);
      const data = await response.json();
      setTeams(data.teams || []);
    } catch (error) {
      console.error('Failed to fetch teams:', error);
    } finally {
      setLoading(false);
    }
  }, [activeCompetition?.id, activeRole, canViewTeamLists]);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  useEffect(() => {
    if (!availableSegments.includes(activeSegment)) {
      setActiveSegment(availableSegments[0]);
    }
  }, [activeSegment, availableSegments]);

  // Toggle section expansion
  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Segment content rendering
  const renderTeamsSegment = () => {
    // Group teams by category
    const groupedTeams = teams.reduce((groups, team) => {
      const category = team.category;
      if (!groups[category]) groups[category] = [];
      groups[category].push(team);
      return groups;
    }, {} as Record<string, Team[]>);

    // Apply search filter
    const filteredGroupedTeams = Object.entries(groupedTeams).reduce((filtered, [category, categoryTeams]) => {
      const matchingTeams = categoryTeams.filter(team => {
        const matchesSearch = searchQuery === "" || 
          team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (team.contactName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
          (team.participants?.some(p => 
            `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
          ) ?? false);
        return matchesSearch;
      });
      
      if (matchingTeams.length > 0) {
        filtered[category] = matchingTeams;
      }
      return filtered;
    }, {} as Record<string, Team[]>);

    return (
      <div className="space-y-4">
        {/* Search */}
        <Input
          placeholder="Teams und Teilnehmer:innen durchsuchen..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
        />

        {/* Team Groups */}
        {Object.entries(filteredGroupedTeams).sort(([a], [b]) => compareClassificationCodes(a, b)).map(([category, categoryTeams]) => {
          const isExpanded = expandedSections[`teams-${category}`];
          
          return (
            <Card key={category}>
              <CardHeader 
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => toggleSection(`teams-${category}`)}
              >
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    {isExpanded ? "▼" : "▶"} {categoryEmojis[category] || "🏆"} {categoryLabels[category] || category}
                  </span>
                  <Badge variant="outline">
                    {categoryTeams.length} Team{categoryTeams.length !== 1 ? 's' : ''}
                  </Badge>
                </CardTitle>
              </CardHeader>
              
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <CardContent className="space-y-3">
                      {categoryTeams.map(team => (
                        <div key={team.id} className="border border-border/40 rounded p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">{team.name}</h4>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">
                                {team.participants?.length || 0}/5
                              </span>
                              {(team.participants?.length || 0) === 5 ? "✅" : "⏳"}
                            </div>
                          </div>
                          
                          {team.participants && team.participants.length > 0 && (
                            <div className="space-y-1">
                              {team.participants.map((p, i) => {
                                const disc = getDisciplineDisplay(p.discipline);
                                return (
                                  <div key={i} className="text-sm text-muted-foreground flex items-center justify-between">
                                    <span className="inline-flex min-w-0 items-center gap-1.5">
                                      <span className="truncate">{p.firstName} {p.lastName}</span>
                                      <ParticipantPublicationPreferenceIcon
                                        preference={p.participantPublicationPreference}
                                        teamPublicationLevel={team.teamPublicationLevel}
                                      />
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <span title={disc.label}>{disc.icon}</span>
                                      <span>{p.gender === "M" ? "♂" : "♀"}</span>
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          
                          {team.contactName ? (
                            <div className="text-xs text-muted-foreground border-t pt-2">
                              ⭐ {team.contactName} (Team Manager:in)
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </CardContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          );
        })}

        {Object.keys(filteredGroupedTeams).length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">
                {searchQuery ? "Keine Teams gefunden." : "Noch keine Teams angemeldet."}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const renderStartSegment = () => {
    // Group participants by discipline, then by class
    const disciplineGroups = DISCIPLINES.reduce((groups, discipline) => {
      groups[discipline.id] = {};
      return groups;
    }, {} as Record<string, Record<string, Array<{ participant: Participant; teamName: string }>>>);

    // Populate groups
    teams.forEach(team => {
      team.participants?.forEach(participant => {
        const disciplineCode = participant.discipline || "TBD";
        if (!disciplineGroups[disciplineCode]) disciplineGroups[disciplineCode] = {};
        if (!disciplineGroups[disciplineCode][team.category]) {
          disciplineGroups[disciplineCode][team.category] = [];
        }
        disciplineGroups[disciplineCode][team.category].push({
          participant,
          teamName: team.name
        });
      });
    });

    return (
      <div className="space-y-4">
        {DISCIPLINES.map(discipline => {
          const disciplineData = disciplineGroups[discipline.id] || {};
          const totalParticipants = Object.values(disciplineData).reduce((sum, participants) => sum + participants.length, 0);
          
          if (totalParticipants === 0) return null;

          const isDisciplineExpanded = expandedSections[`start-${discipline.id}`];

          return (
            <Card key={discipline.id}>
              <CardHeader 
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => toggleSection(`start-${discipline.id}`)}
              >
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    {isDisciplineExpanded ? "▼" : "▶"} {discipline.icon} {discipline.label}
                  </span>
                  <Badge variant="outline">
                    {totalParticipants} Starter:innen
                  </Badge>
                </CardTitle>
              </CardHeader>

              <AnimatePresence>
                {isDisciplineExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <CardContent className="space-y-4">
                      {Object.entries(disciplineData).sort(([a], [b]) => compareClassificationCodes(a, b)).map(([category, participants]) => {
                        if (participants.length === 0) return null;

                        const isClassExpanded = expandedSections[`start-${discipline.id}-${category}`];

                        return (
                          <div key={category} className="border border-border/40 rounded">
                            <div 
                              className="p-3 cursor-pointer hover:bg-muted/30 transition-colors flex items-center justify-between"
                              onClick={() => toggleSection(`start-${discipline.id}-${category}`)}
                            >
                              <span className="flex items-center gap-2">
                                {isClassExpanded ? "▼" : "▶"} {categoryEmojis[category] || "🏆"} {categoryLabels[category] || category}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {participants.length} Starter:innen
                              </Badge>
                            </div>

                            <AnimatePresence>
                              {isClassExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.15 }}
                                >
                                  <div className="px-3 pb-3 space-y-1 border-t border-border/40 pt-2">
                                    {participants.map(({ participant, teamName }, i) => (
                                      <div key={i} className="text-sm flex items-center justify-between py-1">
                                        <span className="inline-flex min-w-0 items-center gap-1.5">
                                          <span className="font-medium">{i + 1}.</span>
                                          <span className="truncate">{participant.firstName} {participant.lastName}</span>
                                          <ParticipantPublicationPreferenceIcon
                                            preference={participant.participantPublicationPreference}
                                          />
                                        </span>
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                          <span>—</span>
                                          <span className="text-xs">{teamName}</span>
                                          <span>{participant.gender === "M" ? "♂" : "♀"}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </CardContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          <p className="mt-4 text-muted-foreground">Lade Live-Daten...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Segment Tabs */}
      <div className="flex space-x-1 bg-muted/50 p-1 rounded-lg">
        {availableSegments.map((segment) => {
          const isActive = activeSegment === segment;
          const labels = { teams: "📋 Teams", start: "🏁 Start", ergebnis: "🏆 Ergebnis" };
          
          return (
            <button
              key={segment}
              onClick={() => setActiveSegment(segment)}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all ${
                isActive 
                  ? "bg-background text-primary shadow-sm" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
              }`}
            >
              {labels[segment]}
            </button>
          );
        })}
      </div>

      {/* Segment Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSegment}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
        >
          {activeSegment === "teams" && renderTeamsSegment()}
          {activeSegment === "start" && renderStartSegment()}
          {activeSegment === "ergebnis" && <ResultsView />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
