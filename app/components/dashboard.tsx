"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { DISCIPLINES } from "@/lib/domain/team";
import { usePermissions } from "@/lib/permissions-context";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
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
  email?: string | null;
  phone?: string | null;
  pendingChanges?: { id: string; status: string }[];
}

interface DashboardProps {
  ownerFilter?: string;
}

export default function Dashboard({ ownerFilter: initialOwnerFilter }: DashboardProps = {}) {
  const { data: session } = useSession();
  const { can } = usePermissions();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<string>(initialOwnerFilter || "all");
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [editingParticipant, setEditingParticipant] = useState<any | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);

  const canEditAll = can("team.edit.all");
  const canViewAll = can("team.view.all");
  const userEmail = session?.user?.email;

  const fetchTeams = async () => {
    try {
      const response = await fetch('/api/teams');
      const data = await response.json();
      setTeams(data.teams || []);
    } catch (error) {
      console.error('Failed to fetch teams:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTeam = async (teamId: string, teamName: string) => {
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

  const handleEditTeam = async (teamData: any) => {
    try {
      const response = await fetch(`/api/teams/${editingTeam!.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(teamData),
      });
      
      if (response.ok) {
        setEditingTeam(null);
        await fetchTeams(); // Refresh list
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
    
    // Listen for switchTab events to handle owner filter
    const handleSwitchTab = (e: CustomEvent) => {
      if (e.detail.ownerFilter && e.detail.tabId === "dashboard") {
        setOwnerFilter(e.detail.ownerFilter);
        setPendingOwnerFilter(e.detail.ownerFilter);
      }
    };
    
    window.addEventListener("switchTab" as any, handleSwitchTab);
    return () => window.removeEventListener("switchTab" as any, handleSwitchTab);
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
      const matchesOwner = ownerFilter === "all" || team.ownerEmail === ownerFilter;
      
      // Search filter (team name, contact name, participant names)
      const matchesSearch = searchQuery === "" || 
        team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        team.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (team.participants?.some(p => 
          `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
        ) ?? false);
      
      return matchesCategory && matchesOwner && matchesSearch;
    });
  }, [teams, categoryFilter, searchQuery, ownerFilter]);

  const categories = [...new Set(teams.map(t => t.category))];
  const ownerOptions = [...new Set(teams.map((t) => t.ownerEmail || t.contactEmail).filter(Boolean))] as string[];
  const categoryStats = categories.map(cat => ({
    category: cat,
    count: teams.filter(t => t.category === cat).length
  }));

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

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
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

      {/* Suche & Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Suche in Teams und Teilnehmern..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-md"
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]">
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
          <Select value={ownerFilter} onValueChange={setOwnerFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Anleger" />
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
          <Button onClick={fetchTeams} variant="outline">
            🔄
          </Button>
        </div>
      </div>

      {/* Search Results Info */}
      {(searchQuery || categoryFilter !== "all") && (
        <div className="text-sm text-muted-foreground">
          {filteredTeams.length} von {teams.length} Teams gefunden
          {searchQuery && ` für "${searchQuery}"`}
          {categoryFilter !== "all" && ` in Klasse "${categoryFilter}"`}
        </div>
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
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredTeams.map((team) => (
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
                              {team.createdAt && (
                                <div><strong>Erstellt:</strong> {new Date(team.createdAt).toLocaleDateString('de-DE')}</div>
                              )}
                            </div>
                          </div>

                          {/* Participants */}
                          {team.participants && team.participants.length > 0 && (
                            <div className="space-y-2">
                              <h4 className="font-medium text-sm">Teilnehmer ({team.participants.length}/5):</h4>
                              <div className="space-y-2">
                                {team.participants.map((p, i) => {
                                  const disciplineDisplay = getDisciplineDisplay(p.discipline);
                                  const birthYear = p.birthDate ? new Date(p.birthDate).getFullYear() : null;
                                  return (
                                    <div key={i} className="text-sm border border-border/40 shadow-sm rounded p-2 space-y-1">
                                      <div className="flex items-center justify-between">
                                        <span className="font-medium">{p.firstName} {p.lastName}</span>
                                        <div className="flex items-center gap-2">
                                          {(canEditAll || (team.ownerEmail === userEmail && can("team.edit.own")) || (p.email === userEmail && can("participant.edit.self"))) && (
                                            <button
                                              onClick={(e) => { e.stopPropagation(); setEditingParticipant({ ...p, teamOwnerEmail: team.ownerEmail }); }}
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
                                        {birthYear && <span>Jg. {birthYear}</span>}
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
                                    Möchtest du das Team "{team.name}" wirklich löschen? 
                                    Diese Aktion kann nicht rückgängig gemacht werden.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => handleDeleteTeam(team.id, team.name)}
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
        />
      )}

      {/* Participant Edit Dialog */}
      <ParticipantEditDialog
        participant={editingParticipant}
        open={!!editingParticipant}
        onOpenChange={(open) => { if (!open) setEditingParticipant(null); }}
        onSaved={() => { setEditingParticipant(null); fetchTeams(); }}
        directEdit={canEditAll || (editingParticipant?.teamOwnerEmail === userEmail)}
      />
    </div>
  );
}

// Edit Team Modal Component
function EditTeamModal({ team, onSave, onCancel }: {
  team: Team;
  onSave: (data: any) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    teamName: team.name,
    participants: team.participants || []
  });

  const handleParticipantChange = (index: number, field: string, value: string) => {
    const newParticipants = [...formData.participants];
    newParticipants[index] = { ...newParticipants[index], [field]: value };
    setFormData({ ...formData, participants: newParticipants });
  };

  const handleSubmit = () => {
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle>Team bearbeiten: {team.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Team-Name</label>
            <Input
              value={formData.teamName}
              onChange={(e) => setFormData({ ...formData, teamName: e.target.value })}
              className="mt-1"
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
                  <div className="grid grid-cols-3 gap-2">
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
                      <label className="text-xs text-muted-foreground">Geburtsdatum</label>
                      <Input
                        type="date"
                        value={participant.birthDate}
                        onChange={(e) => handleParticipantChange(index, 'birthDate', e.target.value)}
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
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={onCancel}>
              Abbrechen
            </Button>
            <Button onClick={handleSubmit}>
              💾 Speichern
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}