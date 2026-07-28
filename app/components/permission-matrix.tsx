"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCompetition } from "@/lib/competition-context";
import { useNotifications } from "@/lib/notification-context";

const ROLES = ["ADMIN", "MODERATOR", "ZEITNAHME", "TEAMCHEF", "TEILNEHMER", "FRIENDS"] as const;
type Role = (typeof ROLES)[number];
type Permission = { key: string; label: string; category: string; description: string | null; riskLevel: string };

export default function PermissionMatrix() {
  const { active } = useCompetition();
  const notifications = useNotifications();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [assignments, setAssignments] = useState<Record<Role, string[]>>({ ADMIN: [], MODERATOR: [], ZEITNAHME: [], TEAMCHEF: [], TEILNEHMER: [], FRIENDS: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const params = active?.id ? `?competitionId=${encodeURIComponent(active.id)}` : "";
    setLoading(true);
    fetch(`/api/admin/role-permissions${params}`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => {
        setPermissions(data.permissions ?? []);
        setAssignments((current) => ({ ...current, ...data.assignments }));
      })
      .catch(() => notifications.error("Berechtigungsmatrix konnte nicht geladen werden"))
      .finally(() => setLoading(false));
  }, [active?.id, notifications]);

  const toggle = (role: Role, key: string) => setAssignments((current) => ({
    ...current,
    [role]: current[role].includes(key) ? current[role].filter((entry) => entry !== key) : [...current[role], key],
  }));

  const save = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/role-permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competitionId: active?.id, assignments }),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error);
      notifications.success("Berechtigungsmatrix gespeichert");
    } catch (error) {
      notifications.error("Berechtigungen konnten nicht gespeichert werden", error instanceof Error ? error.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  return <Card>
    <CardHeader><CardTitle>🔐 Rollen & Berechtigungen</CardTitle><CardDescription>Systemrollen sind fest; ihre Berechtigungsobjekte sind je Tenant editierbar. ADMIN behält zwingend die Rollenverwaltung.</CardDescription></CardHeader>
    <CardContent className="space-y-4">
      {loading ? <div className="text-sm text-muted-foreground">Lade Berechtigungsmatrix…</div> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-left">Berechtigung</th>{ROLES.map((role) => <th key={role} className="p-2 text-center">{role}</th>)}</tr></thead><tbody>{permissions.map((permission) => <tr key={permission.key} className="border-t"><td className="p-2"><div>{permission.label}</div><div className="text-xs text-muted-foreground">{permission.key}</div></td>{ROLES.map((role) => <td key={role} className="p-2 text-center"><input aria-label={`${role} ${permission.key}`} type="checkbox" checked={assignments[role]?.includes(permission.key) ?? false} disabled={role === "ADMIN" && permission.key === "admin.roles.manage"} onChange={() => toggle(role, permission.key)} /></td>)}</tr>)}</tbody></table></div>}
      <Button onClick={() => void save()} disabled={loading || saving}>{saving ? "Speichert…" : "Berechtigungen speichern"}</Button>
    </CardContent>
  </Card>;
}
