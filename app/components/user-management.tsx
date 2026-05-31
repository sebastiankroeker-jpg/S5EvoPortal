"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { openTeamDashboard } from "@/lib/admin-routing";

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
  teamScopes: Array<{
    id: string;
    name: string;
    relations: string[];
    isOwner: boolean;
    isLegacyTeamChief: boolean;
    isParticipant: boolean;
    isTeamManager: boolean;
  }>;
}

interface UsersResponse {
  currentUserId: string;
  adminCount: number;
  users: UserEntry[];
}

const ALL_ROLES = ["ADMIN", "MODERATOR", "TEILNEHMER"] as const;
const ROLE_INFO: Record<string, { icon: string; label: string; color: string; desc: string }> = {
  ADMIN: { icon: "👑", label: "Admin", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300", desc: "Vollzugriff" },
  MODERATOR: { icon: "🛡️", label: "Moderator:in", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300", desc: "Ergebnisse & Teams" },
  TEAMCHEF: { icon: "📋", label: "Teamchef:in", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300", desc: "Eigene Teams" },
  TEILNEHMER: { icon: "🏃", label: "Teilnehmer:in", color: "bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-300", desc: "Eigene Daten" },
};

function formatCreatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unbekannt";
  return date.toLocaleDateString("de-DE");
}

function joinClasses(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function UserManagement() {
  const [focusedUserId, setFocusedUserId] = useState<string | null>(null);
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [adminCount, setAdminCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [updatingTeamScopeKey, setUpdatingTeamScopeKey] = useState<string | null>(null);
  const [focusedTeamId, setFocusedTeamId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) {
        const data = await res.json();
        setErrorMessage(data.error || "Fehler beim Laden der Benutzer");
        return;
      }

      const data = (await res.json()) as UsersResponse;
      setUsers(data.users || []);
      setCurrentUserId(data.currentUserId || null);
      setAdminCount(data.adminCount || 0);
      setErrorMessage(null);
    } catch (err) {
      console.error("Fehler beim Laden:", err);
      setErrorMessage("Fehler beim Laden der Benutzer");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setFocusedUserId(params.get("userId"));
    setFocusedTeamId(params.get("teamId"));
    const userQuery = params.get("userQuery");
    if (userQuery) {
      setSearchQuery(userQuery);
    }
    fetchUsers();
  }, []);

  const startEdit = (user: UserEntry) => {
    setEditingUser(user.id);
    setEditRoles(user.roles.map((role) => role.role).filter((role) => role !== "TEAMCHEF"));
    setStatusMessage(null);
    setErrorMessage(null);
  };

  useEffect(() => {
    if (!focusedUserId || users.length === 0) return;
    const focusedUser = users.find((user) => user.id === focusedUserId);
    if (!focusedUser) return;
    setSearchQuery(focusedUser.email);
    startEdit(focusedUser);
  }, [focusedUserId, users]);

  const toggleRole = (role: string) => {
    setEditRoles((prev) => (
      prev.includes(role) ? prev.filter((entry) => entry !== role) : [...prev, role]
    ));
  };

  const saveRoles = async (userId: string) => {
    setSaving(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/admin/users/" + userId + "/roles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roles: editRoles }),
      });

      if (!res.ok) {
        const data = await res.json();
        setErrorMessage(data.error || "Fehler beim Speichern");
        return;
      }

      setEditingUser(null);
      setStatusMessage("Rollen gespeichert");
      await fetchUsers();
    } catch (err) {
      console.error("Fehler:", err);
      setErrorMessage("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = async (user: UserEntry) => {
    setDeletingUserId(user.id);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/admin/users/" + user.id, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || "Fehler beim Löschen");
        return;
      }

      setEditingUser((current) => (current === user.id ? null : current));
      setStatusMessage(data.message || "Benutzer gelöscht");
      await fetchUsers();
    } catch (err) {
      console.error("Fehler beim Löschen:", err);
      setErrorMessage("Fehler beim Löschen");
    } finally {
      setDeletingUserId(null);
    }
  };

  const openTeam = (teamId: string) => {
    openTeamDashboard({ teamId });
  };

  const toggleTeamManager = async (user: UserEntry, team: UserEntry["teamScopes"][number]) => {
    const scopeKey = `${user.id}:${team.id}`;
    setUpdatingTeamScopeKey(scopeKey);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const res = await fetch(
        team.isTeamManager
          ? `/api/teams/${team.id}/managers?userId=${encodeURIComponent(user.id)}`
          : `/api/teams/${team.id}/managers`,
        {
          method: team.isTeamManager ? "DELETE" : "POST",
          headers: team.isTeamManager ? undefined : { "Content-Type": "application/json" },
          body: team.isTeamManager ? undefined : JSON.stringify({ userId: user.id }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || "Team-Rechte konnten nicht gespeichert werden");
        return;
      }

      setStatusMessage(team.isTeamManager ? "Team-Manager-Rechte entfernt" : "Team-Manager-Rechte vergeben");
      await fetchUsers();
    } catch (err) {
      console.error("Fehler beim Speichern der Team-Rechte:", err);
      setErrorMessage("Team-Rechte konnten nicht gespeichert werden");
    } finally {
      setUpdatingTeamScopeKey(null);
    }
  };

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return users;

    return users.filter((user) => {
      const haystacks = [
        user.name || "",
        user.email,
        ...user.roles.map((role) => ROLE_INFO[role.role]?.label || role.role),
        ...(user.teamScopes || []).map((team) => team.name),
      ];
      return haystacks.some((value) => value.toLowerCase().includes(query));
    });
  }, [searchQuery, users]);

  const stats = useMemo(() => {
    const summarize = (entries: UserEntry[]) => ({
      users: entries.length,
      admins: entries.filter((user) => user.roles.some((role) => role.role === "ADMIN")).length,
      moderators: entries.filter((user) => user.roles.some((role) => role.role === "MODERATOR")).length,
      teamManagers: entries.filter((user) => user.teamCount > 0 || user.roles.some((role) => role.role === "TEAMCHEF")).length,
    });

    return {
      total: summarize(users),
      filtered: summarize(filteredUsers),
    };
  }, [filteredUsers, users]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-2">
            <div className="space-y-1">
              <CardTitle>👥 Benutzer-Dashboard</CardTitle>
              <CardDescription>
                Portal-Rollen für Admins verwalten. Fachliche Rollen bleiben in der App, nicht in Authentik.
              </CardDescription>
            </div>
          </div>

          <div className="rounded-lg border border-border/50 bg-muted/30 p-3 text-xs text-muted-foreground">
            Letzter Schutzmechanismus aktiv: Der letzte Admin kann serverseitig nicht entfernt werden.
          </div>

          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Suche nach Name, Mail, Rolle oder Team"
          />

          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {[
              ["Benutzer", stats.filtered.users, stats.total.users],
              ["Admins", stats.filtered.admins, stats.total.admins],
              ["Moderatoren", stats.filtered.moderators, stats.total.moderators],
              ["Teamchef:innen", stats.filtered.teamManagers, stats.total.teamManagers],
            ].map(([label, filtered, total]) => (
              <div key={label} className="rounded-md border border-border/50 bg-muted/25 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">{label}</p>
                <p className="text-sm font-semibold">
                  {filtered}<span className="text-xs font-normal text-muted-foreground"> / {total}</span>
                </p>
              </div>
            ))}
          </div>

          {statusMessage && (
            <div className="rounded-lg border border-green-200 bg-green-100 p-3 text-sm text-green-800">
              ✓ {statusMessage}
            </div>
          )}
          {errorMessage && (
            <div className="rounded-lg border border-red-200 bg-red-100 p-3 text-sm text-red-800">
              ✗ {errorMessage}
            </div>
          )}
        </CardHeader>
      </Card>

      {filteredUsers.map((user) => {
        const isCurrentUser = user.id === currentUserId;
        const isLastAdmin = adminCount === 1 && user.roles.some((role) => role.role === "ADMIN");
        const isDeleting = deletingUserId === user.id;

        return (
          <motion.div key={user.id} layout>
            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <span className="min-w-0 max-w-full truncate text-sm font-medium">{user.name || "Unbenannt"}</span>
                      {isCurrentUser && (
                        <Badge variant="secondary" className="shrink-0 text-xs">Du</Badge>
                      )}
                      {user.teamCount > 0 && (
                        <Badge variant="outline" className="shrink-0 text-xs">
                          {user.teamCount} Team{user.teamCount > 1 ? "s" : ""}
                        </Badge>
                      )}
                      {isLastAdmin && (
                        <Badge className="shrink-0 text-xs">letzter Admin</Badge>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground" title={user.email}>{user.email}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Registriert seit {formatCreatedAt(user.createdAt)}
                    </p>

                    {editingUser !== user.id && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {user.roles.length > 0 ? (
                          user.roles.map((role) => {
                            const info = ROLE_INFO[role.role];
                            return (
                              <span
                                key={role.id}
                                className={joinClasses(
                                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                                  info?.color
                                )}
                              >
                                {info?.icon} {info?.label || role.role}
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-xs text-muted-foreground">Keine Rollen</span>
                        )}
                      </div>
                    )}

                    {editingUser === user.id && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs text-muted-foreground">
                          Wähle die globalen Portal-Rollen für diesen Benutzer. Teamchef- und Managerrechte werden pro Mannschaft in den Team-Zeilen darunter vergeben.
                        </p>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {ALL_ROLES.map((role) => {
                            const info = ROLE_INFO[role];
                            const active = editRoles.includes(role);
                            const disableAdminRemoval = role === "ADMIN" && isLastAdmin && active;

                            return (
                              <button
                                key={role}
                                onClick={() => toggleRole(role)}
                                disabled={disableAdminRemoval || saving}
                                className={joinClasses(
                                  "flex items-center gap-2 rounded-lg border p-2 text-left text-xs transition-all",
                                  active
                                    ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                                    : "border-border/40 hover:border-border hover:bg-accent/50",
                                  (disableAdminRemoval || saving) && "opacity-60"
                                )}
                              >
                                <span>{info.icon}</span>
                                <div>
                                  <span className="font-medium">{info.label}</span>
                                  <p className="text-[10px] text-muted-foreground">{info.desc}</p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                        {isLastAdmin && (
                          <p className="text-xs text-muted-foreground">
                            Dieser Benutzer ist aktuell der letzte Admin und kann diese Rolle deshalb nicht verlieren.
                          </p>
                        )}
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Button size="sm" onClick={() => saveRoles(user.id)} disabled={saving}>
                            {saving ? "..." : "💾 Speichern"}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingUser(null)}>
                            Abbrechen
                          </Button>
                        </div>
                      </div>
                    )}

                    {user.teamScopes?.length > 0 && (
                      <div className="mt-3 rounded-md border border-border/40 bg-muted/20 p-2 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium text-muted-foreground">Verbundene Teams</p>
                          <span className="text-[11px] text-muted-foreground">Rechte gelten je Mannschaft</span>
                        </div>
                        <div className="mt-2 divide-y divide-border/50 overflow-hidden rounded-md border border-border/40 bg-background/60">
                          {user.teamScopes.map((team) => {
                            const isFixedManager = team.isOwner || team.isLegacyTeamChief;
                            const isUpdating = updatingTeamScopeKey === `${user.id}:${team.id}`;

                            return (
                              <div
                                key={team.id}
                                className={joinClasses(
                                  "grid gap-2 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center",
                                  focusedTeamId === team.id && "bg-primary/5 ring-1 ring-inset ring-primary/20"
                                )}
                              >
                                <button
                                  type="button"
                                  className="min-w-0 text-left transition-colors hover:text-primary"
                                  onClick={() => openTeam(team.id)}
                                  title="Mannschaft öffnen"
                                >
                                  <span className="block truncate font-medium">{team.name}</span>
                                  <span className="block text-[11px] text-muted-foreground">
                                    {team.relations.join(" · ")}
                                  </span>
                                </button>
                                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                                  <Badge
                                    variant="outline"
                                    className={`shrink-0 ${team.isTeamManager ? "border-green-300 text-green-700" : "border-muted text-muted-foreground"}`}
                                  >
                                    {team.isTeamManager ? "Team Manager:in" : "Keine Managerrechte"}
                                  </Badge>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={team.isTeamManager ? "outline" : "secondary"}
                                    className="h-7 flex-1 px-2 text-[11px] sm:flex-none"
                                    onClick={() => toggleTeamManager(user, team)}
                                    disabled={saving || isUpdating || isFixedManager}
                                    title={isFixedManager ? "Owner/Teamchef-Rechte kommen aus der Team-Zuordnung" : undefined}
                                  >
                                    {isUpdating
                                      ? "..."
                                      : team.isTeamManager
                                        ? "Entziehen"
                                        : "Vergeben"}
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex sm:flex-col">
                    {editingUser !== user.id && (
                      <Button size="sm" variant="outline" onClick={() => startEdit(user)}>
                        Rollen
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger
                        render={(
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-700 hover:text-red-800"
                            disabled={isCurrentUser || isLastAdmin || isDeleting || saving}
                          />
                        )}
                      >
                        {isDeleting ? "Löscht..." : "Löschen"}
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Benutzer wirklich löschen?</AlertDialogTitle>
                          <AlertDialogDescription>
                            {user.name || user.email} wird im Portal deaktiviert. Eigene Teams und Teilnehmer werden
                            dabei ebenfalls ausgeblendet.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteUser(user)}>
                            Benutzer löschen
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                {(isCurrentUser || isLastAdmin) && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    {isCurrentUser
                      ? "Dein eigener Benutzer kann hier nicht gelöscht werden."
                      : "Der letzte Admin kann nicht gelöscht werden."}
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        );
      })}

      {filteredUsers.length === 0 && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Keine Benutzer passend zur aktuellen Suche gefunden.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
