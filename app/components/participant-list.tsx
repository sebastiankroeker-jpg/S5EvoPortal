"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import { useCompetition } from "@/lib/competition-context";
import ParticipantEditDialog from "./participant-edit-dialog";

interface ParticipantEntry {
  id: string;
  firstName: string;
  lastName: string;
  birthYear: number;
  gender: string;
  disciplineCode: string;
  shirtSize?: string | null;
  email?: string | null;
  phone?: string | null;
  teamId: string;
  teamName: string;
  teamCategory: string;
  hasPendingChange: boolean;
}

const DISCIPLINE_LABELS: Record<string, { icon: string; label: string }> = {
  RUN: { icon: "🏃", label: "Laufen" },
  BENCH: { icon: "🏋️", label: "Bankdrücken" },
  STOCK: { icon: "🎯", label: "Stockschießen" },
  ROAD: { icon: "🚴", label: "Rennrad" },
  MTB: { icon: "🚵", label: "Mountainbike" },
  TBD: { icon: "❓", label: "Offen" },
};

const GENDER_LABELS: Record<string, string> = {
  MALE: "♂️",
  FEMALE: "♀️",
  DIVERSE: "⚧️",
  M: "♂️",
  W: "♀️",
};

export default function ParticipantList() {
  const [participants, setParticipants] = useState<ParticipantEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [disciplineFilter, setDisciplineFilter] = useState("all");
  const { active: activeCompetition } = useCompetition();
  const [editingParticipant, setEditingParticipant] = useState<ParticipantEntry | null>(null);

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
    fetchParticipants();
  }, [activeCompetition?.id]);

  const categories = useMemo(() => {
    const cats = [...new Set(participants.map((p) => p.teamCategory))].sort();
    return cats;
  }, [participants]);

  const filtered = useMemo(() => {
    return participants.filter((p) => {
      const matchesSearch =
        !search ||
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
        p.teamName.toLowerCase().includes(search.toLowerCase()) ||
        p.email?.toLowerCase().includes(search.toLowerCase());

      const matchesCategory = categoryFilter === "all" || p.teamCategory === categoryFilter;
      const matchesDiscipline = disciplineFilter === "all" || p.disciplineCode === disciplineFilter;

      return matchesSearch && matchesCategory && matchesDiscipline;
    });
  }, [participants, search, categoryFilter, disciplineFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">
          🏃 Teilnehmerübersicht ({filtered.length}/{participants.length})
        </h3>
        <Button size="sm" variant="ghost" onClick={fetchParticipants}>
          🔄
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          placeholder="Suche Name, Team, E-Mail..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1"
        />
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
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
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Disziplin" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Disziplinen</SelectItem>
            {Object.entries(DISCIPLINE_LABELS).map(([code, d]) => (
              <SelectItem key={code} value={code}>{d.icon} {d.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Participant Cards */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">Keine Teilnehmer gefunden</p>
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
                  <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/30 hover:bg-accent/50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="text-lg shrink-0">{disc.icon}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">
                            {p.lastName}, {p.firstName}
                          </span>
                          <span className="text-xs">{gender}</span>
                          {p.hasPendingChange && (
                            <Badge variant="outline" className="text-amber-600 text-[10px] px-1 py-0">
                              ⏳
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{p.teamName}</span>
                          <span>·</span>
                          <span>{p.teamCategory}</span>
                          <span>·</span>
                          <span>Jg. {p.birthYear}</span>
                          {p.shirtSize && (
                            <>
                              <span>·</span>
                              <span>👕 {p.shirtSize}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingParticipant(p)}
                      className="shrink-0"
                    >
                      ✏️
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Edit Dialog */}
      <ParticipantEditDialog
        participant={editingParticipant}
        open={!!editingParticipant}
        onOpenChange={(open) => { if (!open) setEditingParticipant(null); }}
        onSaved={() => { setEditingParticipant(null); fetchParticipants(); }}
        directEdit={true}
        isAdminEdit={true}
      />
    </div>
  );
}
