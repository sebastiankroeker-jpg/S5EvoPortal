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
}

const generateTestDataForCategory = (category: string, count: number = 2): Team[] => {
  const teamNamesByCategory: { [key: string]: string[] } = {
    "schueler-a": ["Kleine Helden", "Mini Warriors", "Young Stars"],
    "schueler-b": ["Nachwuchs Power", "Junior Force", "School Champions"],
    "jugend": ["Jugend Elite", "Young Eagles", "Future Stars"],
    "jungsters": ["Speed Demons", "Lightning Bolts", "Quick Silver"],
    "herren": ["Die Bergziegen", "Alm-Stürmer", "Karwendel-Kämpfer"],
    "masters": ["Old School", "Vintage Power", "Golden Eagles"],
    "damen-a": ["Lady Power", "Frauen Force", "Girl Gang"],
    "damen-b": ["Experienced Ladies", "Mature Angels", "Senior Women"]
  };

  const firstNamesByGender = {
    M: ["Max", "Stefan", "Michael", "Thomas", "Andreas", "Markus", "Christian", "Daniel"],
    W: ["Lisa", "Anna", "Sarah", "Julia", "Petra", "Sandra", "Nicole", "Stefanie"]
  };

  const lastNames = ["Müller", "Huber", "Wagner", "Bauer", "Mayer", "Weber", "Schmid"];

  const getBirthDateForCategory = (cat: string): string => {
    switch (cat) {
      case "schueler-a": return `${2016 + Math.floor(Math.random() * 3)}-06-15`;
      case "schueler-b": return `${2013 + Math.floor(Math.random() * 3)}-06-15`;
      case "jugend": return `${2009 + Math.floor(Math.random() * 4)}-06-15`;
      case "jungsters": return `${2001 + Math.floor(Math.random() * 4)}-06-15`; // ~20-25 Jahre
      case "herren": return `${1990 + Math.floor(Math.random() * 10)}-06-15`; // ~25-35 Jahre
      case "masters": return `${1970 + Math.floor(Math.random() * 10)}-06-15`; // ~45-55 Jahre
      case "damen-a": return `${1995 + Math.floor(Math.random() * 10)}-06-15`; // ~25-30 Jahre
      case "damen-b": return `${1975 + Math.floor(Math.random() * 10)}-06-15`; // ~40-50 Jahre
      default: return "1990-06-15";
    }
  };

  const getGenderForCategory = (cat: string): "M" | "W" => {
    if (cat.startsWith("damen")) return "W";
    return Math.random() > 0.3 ? "M" : "W"; // Überwiegend männlich für andere Kategorien
  };

  const teamNames = teamNamesByCategory[category] || ["Test Team"];
  
  return Array.from({ length: count }, (_, index) => ({
    id: `test-${category}-${index}`,
    name: `${teamNames[index % teamNames.length]} ${index + 1}`,
    category,
    contactName: `${firstNamesByGender["M"][index % 8]} ${lastNames[index % 7]}`,
    contactEmail: `contact${index}@${category}.de`,
    ownerEmail: `contact${index}@${category}.de`,
    ownerName: `${firstNamesByGender["M"][index % 8]} ${lastNames[index % 7]}`,
    createdAt: new Date().toISOString(),
    participants: Array.from({ length: 5 }, (_, i) => {
      const gender = getGenderForCategory(category);
      const names = firstNamesByGender[gender];
      return {
        firstName: names[(index * 5 + i) % names.length],
        lastName: lastNames[(index * 5 + i) % lastNames.length],
        gender,
        birthDate: getBirthDateForCategory(category)
      };
    })
  }));
};

const generateTestData = (): Team[] => {
  const categories = ["schueler-a", "jugend", "jungsters", "herren", "masters", "damen-a"];
  return categories.flatMap(cat => generateTestDataForCategory(cat, 1));
};

export default function Dashboard() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");

  const fetchTeams = async () => {
    try {
      const response = await fetch('/api/teams');
      const data = await response.json();
      setTeams(data.teams || []);
      if (typeof window !== "undefined" && data?.teams) {
        window.localStorage.setItem("s5evo-teams", JSON.stringify(data.teams));
      }
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
      setTeams(prev => {
        const updated = [...prev, ...testTeams];
        if (typeof window !== "undefined") {
          window.localStorage.setItem("s5evo-teams", JSON.stringify(updated));
        }
        return updated;
      });
      setGenerating(false);
    }, 1000);
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const cached = window.localStorage.getItem("s5evo-teams");
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length) {
            setTeams(parsed);
          }
        } catch (error) {
          console.warn("Failed to parse cached teams", error);
        }
      }
    }
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
  }, [teams, categoryFilter, searchQuery]);

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