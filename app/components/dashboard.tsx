"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Team {
  id: string;
  name: string;
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
}

const generateTestData = (): Team[] => {
  const categories = ["herren", "damen", "mixed", "senioren", "jugend"];
  const teamNames = [
    "Die Bergziegen", "Alm-Stürmer", "Gipfelkraxler", "Tal-Helden", "Ausseer Adler",
    "Bayerische Löwen", "Werdenfelser", "Karwendel-Kämpfer", "Isar-Indianer", "Ammergau-Asse"
  ];
  const firstNames = [
    "Max", "Lisa", "Stefan", "Anna", "Michael", "Sarah", "Thomas", "Julia",
    "Andreas", "Petra", "Markus", "Sandra", "Christian", "Nicole", "Daniel"
  ];
  const lastNames = [
    "Müller", "Huber", "Wagner", "Bauer", "Mayer", "Weber", "Schmid", "Lehner",
    "Gruber", "Steiner", "Berger", "Hofmann", "Wimmer", "Brunner", "Egger"
  ];

  return teamNames.slice(0, 8).map((name, index) => ({
    id: `test-${index}`,
    name,
    category: categories[index % categories.length],
    contactName: `${firstNames[index]} ${lastNames[index]}`,
    contactEmail: `${firstNames[index].toLowerCase()}@${name.toLowerCase().replace(/[^a-z]/g, '')}.de`,
    participants: Array.from({ length: 5 }, (_, i) => ({
      firstName: firstNames[(index * 5 + i) % firstNames.length],
      lastName: lastNames[(index * 5 + i) % lastNames.length],
      gender: Math.random() > 0.5 ? "M" : "W",
      birthDate: `19${85 + Math.floor(Math.random() * 25)}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`
    }))
  }));
};

export default function Dashboard() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

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

  const handleGenerateTestData = () => {
    setGenerating(true);
    setTimeout(() => {
      const testTeams = generateTestData();
      setTeams(prev => [...prev, ...testTeams]);
      setGenerating(false);
    }, 1000);
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  // Filter and search logic
  const filteredTeams = useMemo(() => {
    return teams.filter(team => {
      // Category filter
      const matchesCategory = categoryFilter === "all" || team.category === categoryFilter;
      
      // Search filter (team name, contact name, participant names)
      const matchesSearch = searchQuery === "" || 
        team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        team.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (team.participants?.some(p => 
          `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
        ) ?? false);
      
      return matchesCategory && matchesSearch;
    });
  }, [teams, categoryFilter, searchQuery]);

  const categories = [...new Set(teams.map(t => t.category))];
  const categoryStats = categories.map(cat => ({
    category: cat,
    count: teams.filter(t => t.category === cat).length
  }));

  const categoryEmojis: { [key: string]: string } = {
    herren: "🏋️",
    damen: "🏋️‍♀️",
    mixed: "👫",
    senioren: "🎖️",
    jugend: "🌟"
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
        <div className="flex gap-2">
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
                ? "Noch keine Teams angemeldet. Erstelle Testdaten oder registriere dein erstes Team!"
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
                      {team.participants.map((p, i) => (
                        <div key={i} className="text-xs text-muted-foreground flex justify-between">
                          <span>{p.firstName} {p.lastName}</span>
                          <span>{p.gender === "M" ? "♂" : "♀"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}