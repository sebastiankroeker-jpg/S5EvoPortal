"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

interface UserRole {
  id: string;
  role: string;
  tenantId: string;
  tenantName: string;
}

interface UserEntry {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  roles: UserRole[];
  teamCount: number;
}

const ALL_ROLES = ["ADMIN", "MODERATOR", "TEAMCHEF", "TEILNEHMER"] as const;

const ROLE_INFO: Record<string, { icon: string; color: string; desc: string }> = {
  ADMIN: { icon: "👑", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300", desc: "Vollzugriff" },
  MODERATOR: { icon: "🛡️", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300", desc: "Ergebnisse & Teams" },
  TEAMCHEF: { icon: "📋", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300", desc: "Eigenes Team" },
  TEILNEHMER: { icon: "🏃", color: "bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-300", desc: "Eigene Daten" },
};

export default function UserManagement() {
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error("Fehler beim Laden:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const startEdit = (user: UserEntry) => {
    setEditingUser(user.id);
    setEditRoles(user.roles.map((r) => r.role));
  };

  const toggleRole = (role: string) => {
    setEditRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const saveRoles = async (userId: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/roles`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roles: editRoles }),
      });

      if (res.ok) {
        setEditingUser(null);
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || "Fehler beim Speichern");
      }
    } catch (err) {
      console.error("Fehler:", err);
    } finally {
      setSaving(false);
    }
  };

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
        <h3 className="font-semibold text-sm">👥 Benutzer & Rollen ({users.length})</h3>
      </div>

      {users.map((user) => (
        <motion.div key={user.id} layout>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{user.name || "Unbenannt"}</span>
                    {user.teamCount > 0 && (
                      <Badge variant="outline" className="text-xs shrink-0">
                        {user.teamCount} Team{user.teamCount > 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>

                  {/* Rollen-Anzeige */}
                  {editingUser !== user.id && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {user.roles.length > 0 ? (
                        user.roles.map((r) => {
                          const info = ROLE_INFO[r.role];
                          return (
                            <span
                              key={r.id}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${info?.color || ""}`}
                            >
                              {info?.icon} {r.role}
                            </span>
                          );
                        })
                      ) : (
                        <span className="text-xs text-muted-foreground">Keine Rollen</span>
                      )}
                    </div>
                  )}

                  {/* Rollen-Editor */}
                  {editingUser === user.id && (
                    <div className="mt-3 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        {ALL_ROLES.map((role) => {
                          const info = ROLE_INFO[role];
                          const active = editRoles.includes(role);
                          return (
                            <button
                              key={role}
                              onClick={() => toggleRole(role)}
                              className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs transition-all ${
                                active
                                  ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                                  : "border-border/40 hover:border-border hover:bg-accent/50"
                              }`}
                            >
                              <span>{info.icon}</span>
                              <div>
                                <span className="font-medium">{role}</span>
                                <p className="text-[10px] text-muted-foreground">{info.desc}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveRoles(user.id)} disabled={saving}>
                          {saving ? "..." : "💾 Speichern"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingUser(null)}>
                          Abbrechen
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Edit-Button */}
                {editingUser !== user.id && (
                  <Button size="sm" variant="ghost" onClick={() => startEdit(user)} className="shrink-0">
                    ✏️
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
