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
  firstName: string;
  lastName: string;
  gender: string;
  birthDate: string;
  discipline?: string;
}

export default function Dashboard() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

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

  useEffect(() => {
    fetchTeams();
  }, []);

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

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-primary">{filteredTeams.length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Teams {searchQuery || categoryFilter !== "all" ? "gefunden" : "angemeldet"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-primary">
              {filteredTeams.reduce((sum, team) => sum + (team.participants?.length || 0), 0)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Teilnehmer</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-primary">{categories.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Klassen aktiv</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-primary">
              {teams.filter(t => !t.participants || t.participants.some(p => !p.firstName || !p.lastName)).length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Teams unvollständig</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
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

      {/* Categories */}
      {categories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Kategorien</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {categoryStats.map((cat) => (
                <Badge key={cat.category} variant="outline" className="flex items-center gap-1">
                  <span>{categoryEmojis[cat.category] || "🏆"}</span>
                  {cat.category} ({cat.count})
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Teams List */}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTeams.map((team) => (
            <Card key={team.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  {team.name}
                  <Badge variant="outline" className="ml-2">
                    {categoryEmojis[team.category] || "🏆"} {team.category}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm">
                  <div className="font-medium">Teamchef:</div>
                  <div className="text-muted-foreground">{team.contactName}</div>
                  <div className="text-muted-foreground text-xs">{team.contactEmail}</div>
                </div>
                
                {team.participants && team.participants.length > 0 && (
                  <div className="text-sm">
                    <div className="font-medium mb-1">Teilnehmer ({team.participants.length}/5):</div>
                    <div className="space-y-1">
                      {team.participants.map((p, i) => {
                        const disciplineDisplay = getDisciplineDisplay(p.discipline);
                        return (
                          <div key={i} className="text-xs text-muted-foreground flex justify-between">
                            <span>{p.firstName} {p.lastName}</span>
                            <div className="flex items-center gap-2">
                              <span title={disciplineDisplay.label}>
                                {disciplineDisplay.icon}
                              </span>
                              <span>{p.gender === "M" ? "♂" : "♀"}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Team Actions */}
                <div className="flex gap-2 pt-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => setEditingTeam(team)}
                    className="flex-1"
                  >
                    ✏️ Bearbeiten
                  </Button>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        size="sm" 
                        variant="destructive" 
                        disabled={deleting === team.id}
                        className="flex-1"
                      >
                        {deleting === team.id ? "..." : "🗑️ Löschen"}
                      </Button>
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
              </CardContent>
            </Card>
          ))}
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
                <div key={index} className="border rounded-lg p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground">Vorname</label>
                      <Input
                        value={participant.firstName}
                        onChange={(e) => handleParticipantChange(index, 'firstName', e.target.value)}
                        size="sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Nachname</label>
                      <Input
                        value={participant.lastName}
                        onChange={(e) => handleParticipantChange(index, 'lastName', e.target.value)}
                        size="sm"
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
                        size="sm"
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