"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { RefreshCw, SlidersHorizontal, XCircle } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AccountLinkStatusDialog, { AccountLinkStatusIcon } from "./account-link-status-dialog";
import {
  DashboardControlsCard,
  DashboardPanel,
  DashboardSearchField,
  DashboardStatsRow,
  DashboardToolbar,
  DashboardToolbarButton,
} from "./dashboard-controls";
import { openTeamDashboard } from "@/lib/admin-routing";
import {
  deriveAccountLinkStatus,
  type AccountLinkClaimStatus,
  type AccountLinkStatusMeta,
} from "@/lib/account-link-status";
import { useCompetition } from "@/lib/competition-context";
import { useNotifications } from "@/lib/notification-context";

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
  authentikSub?: string | null;
  lastSeenAt?: string | null;
  createdAt: string;
  roles: UserRole[];
  teamCount: number;
  teamScopes: Array<{
    id: string;
    name: string;
    classificationCode: string | null;
    registrationMode: string;
    marketplaceStatus: string | null;
    contactEmail: string | null;
    participantCount: number;
    relations: string[];
    isOwner: boolean;
    isLegacyTeamChief: boolean;
    isParticipant: boolean;
    isTeamManager: boolean;
    ownerClaim: {
      suggestedEmail: string;
      suggestedName: string | null;
      sentAt: string;
      expiresAt: string;
      claimedAt: string | null;
      revokedAt: string | null;
    } | null;
    participantLink: {
      participantId: string;
      email: string | null;
      linkedUserId: string | null;
      claim: {
        sentAt: string;
        expiresAt: string;
        claimedAt: string | null;
        revokedAt: string | null;
      } | null;
    } | null;
  }>;
}

interface UsersResponse {
  currentUserId: string;
  adminCount: number;
  users: UserEntry[];
}

type UserRoleFilter = "all" | "admin" | "moderator" | "teamManager";
type UserMailFilter = "all" | "hasEmail" | "missingEmail";
type UserLinkFilter = "all" | "linked" | "portal_account" | "invitation_open" | "placeholder_user" | "needs_attention";
type UserSortField = "nameAsc" | "lastSeenDesc" | "createdDesc" | "teamCountDesc";

const ALL_ROLES = ["ADMIN", "MODERATOR", "ZEITNAHME", "TEILNEHMER"] as const;
const ONLINE_WINDOW_MS = 3 * 60 * 1000;
const RECENT_ACTIVITY_WINDOW_MS = 24 * 60 * 60 * 1000;
const ROLE_INFO: Record<string, { icon: string; label: string; color: string; desc: string }> = {
  ADMIN: { icon: "👑", label: "Admin", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300", desc: "Vollzugriff" },
  MODERATOR: { icon: "🛡️", label: "Moderator:in", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300", desc: "Ergebnisse & Teams" },
  ZEITNAHME: { icon: "⏱️", label: "Zeitnahme", color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300", desc: "Stoppuhr & Rohzeiten" },
  TEAMCHEF: { icon: "📋", label: "Teamchef:in", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300", desc: "Eigene Teams" },
  TEILNEHMER: { icon: "🏃", label: "Teilnehmer:in", color: "bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-300", desc: "Eigene Daten" },
};
const TEAM_CLASS_BADGES: Record<string, { shortLabel: string; label: string; className: string }> = {
  "schueler-a": { shortLabel: "SA", label: "Schüler A", className: "border-sky-300 bg-sky-50 text-sky-800" },
  "schueler-b": { shortLabel: "SB", label: "Schüler B", className: "border-cyan-300 bg-cyan-50 text-cyan-800" },
  jugend: { shortLabel: "J", label: "Jugend", className: "border-violet-300 bg-violet-50 text-violet-800" },
  "damen-a": { shortLabel: "DA", label: "Damen A", className: "border-pink-300 bg-pink-50 text-pink-800" },
  "damen-b": { shortLabel: "DB", label: "Damen B", className: "border-rose-300 bg-rose-50 text-rose-800" },
  jungsters: { shortLabel: "HA", label: "Jungsters", className: "border-yellow-300 bg-yellow-50 text-yellow-800" },
  herren: { shortLabel: "HB", label: "Herren", className: "border-blue-300 bg-blue-50 text-blue-800" },
  masters: { shortLabel: "HC", label: "Masters", className: "border-amber-300 bg-amber-50 text-amber-800" },
};
const USER_LINK_ATTENTION_STATUSES = new Set<AccountLinkStatusMeta["status"]>(["missing_email", "no_invitation", "expired", "revoked"]);

function formatCreatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unbekannt";
  return date.toLocaleDateString("de-DE");
}

function formatDateTime(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatLastSeen(value?: string | null, now = Date.now()) {
  if (!value) return "noch nie aktiv";

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "unbekannt";

  const diffMs = Math.max(0, now - timestamp);
  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 1) return "gerade eben";
  if (diffMinutes < 60) return `vor ${diffMinutes} Min.`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `vor ${diffHours} Std.`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `vor ${diffDays} Tag${diffDays === 1 ? "" : "en"}`;

  return formatDateTime(value) || "unbekannt";
}

function getPresenceMeta(lastSeenAt?: string | null, now = Date.now()) {
  if (!lastSeenAt) {
    return {
      label: "nie aktiv",
      detail: "Keine Aktivität erfasst",
      state: "offline" as const,
      className: "border-muted text-muted-foreground",
      dotClassName: "bg-muted-foreground/40",
    };
  }

  const timestamp = new Date(lastSeenAt).getTime();
  if (Number.isNaN(timestamp)) {
    return {
      label: "unbekannt",
      detail: "Aktivität nicht lesbar",
      state: "offline" as const,
      className: "border-muted text-muted-foreground",
      dotClassName: "bg-muted-foreground/40",
    };
  }

  const diffMs = now - timestamp;
  if (diffMs <= ONLINE_WINDOW_MS) {
    return {
      label: "online",
      detail: `Aktiv ${formatLastSeen(lastSeenAt, now)}`,
      state: "online" as const,
      className: "border-emerald-300 bg-emerald-50 text-emerald-800",
      dotClassName: "bg-emerald-500",
    };
  }

  if (diffMs <= RECENT_ACTIVITY_WINDOW_MS) {
    return {
      label: "zuletzt aktiv",
      detail: formatLastSeen(lastSeenAt, now),
      state: "recent" as const,
      className: "border-amber-300 bg-amber-50 text-amber-800",
      dotClassName: "bg-amber-500",
    };
  }

  return {
    label: "offline",
    detail: formatLastSeen(lastSeenAt, now),
    state: "offline" as const,
    className: "border-muted text-muted-foreground",
    dotClassName: "bg-muted-foreground/40",
  };
}

function joinClasses(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function getClaimStatus(token?: {
  claimedAt?: string | null;
  revokedAt?: string | null;
  expiresAt?: string | null;
} | null): AccountLinkClaimStatus {
  if (!token) return "none";
  if (token.revokedAt) return "revoked";
  if (token.claimedAt) return "claimed";

  const expiresAt = token.expiresAt ? new Date(token.expiresAt).getTime() : Number.NaN;
  if (!Number.isNaN(expiresAt) && expiresAt < Date.now()) return "expired";

  return "active";
}

function isMtcScope(team: UserEntry["teamScopes"][number]) {
  return team.registrationMode === "MARKETPLACE";
}

function getTeamClassBadgeMeta(classificationCode?: string | null) {
  if (!classificationCode || classificationCode === "unclassified") return null;
  return TEAM_CLASS_BADGES[classificationCode] ?? {
    shortLabel: classificationCode,
    label: classificationCode,
    className: "border-muted text-muted-foreground",
  };
}

function getTeamScopeAccountMeta(user: UserEntry, team: UserEntry["teamScopes"][number]) {
  const isMtc = isMtcScope(team);
  const hasExplicitTeamRight = team.isLegacyTeamChief || (team.isTeamManager && !team.isOwner);
  const hasConfirmedPortalLogin = Boolean(user.authentikSub);

  if (team.participantLink) {
    const isLinkedParticipantUser = team.participantLink.linkedUserId === user.id;
    return deriveAccountLinkStatus({
      entityLabel: isMtc ? "MTC-Teilnehmer" : "Teilnehmer",
      hasEmail: Boolean(team.participantLink.email || user.email),
      hasEntityLink: isLinkedParticipantUser && hasConfirmedPortalLogin,
      hasPortalAccount: hasConfirmedPortalLogin,
      hasPlaceholderUser: isLinkedParticipantUser && !hasConfirmedPortalLogin,
      claimStatus: team.participantLink.claim ? getClaimStatus(team.participantLink.claim) : "none",
    });
  }

  return deriveAccountLinkStatus({
    entityLabel: isMtc ? "MTC-Kontakt" : "Team-Owner",
    hasEmail: Boolean(team.ownerClaim?.suggestedEmail || team.contactEmail || user.email),
    hasEntityLink: Boolean(team.ownerClaim?.claimedAt || (hasExplicitTeamRight && hasConfirmedPortalLogin)),
    hasPortalAccount: hasConfirmedPortalLogin,
    hasPlaceholderUser: Boolean((hasExplicitTeamRight || team.isOwner) && !hasConfirmedPortalLogin),
    claimStatus: team.ownerClaim ? getClaimStatus(team.ownerClaim) : "none",
  });
}

function getUserLinkStatusSet(user: UserEntry) {
  return new Set(user.teamScopes.map((team) => getTeamScopeAccountMeta(user, team).status));
}

function UserTeamScopeStatusDialog({ user, team }: { user: UserEntry; team: UserEntry["teamScopes"][number] }) {
  const meta = getTeamScopeAccountMeta(user, team);
  const isMtc = isMtcScope(team);
  const claim = team.participantLink?.claim ?? team.ownerClaim;

  return (
    <AccountLinkStatusDialog
      meta={meta}
      title={isMtc ? "MTC-Zugriff" : "Mannschafts-Zugriff"}
      rows={[
        { label: "Benutzer", value: user.name || user.email },
        { label: "User", value: user.email, targetType: "user" },
        { label: "Team", value: team.name, targetType: "team", onClick: () => openTeamDashboard({ teamId: team.id }) },
        { label: "Typ", value: isMtc ? `MTC/Börse (${team.participantCount}/5)` : "Mannschaft" },
        { label: "Relation", value: team.relations.join(" · ") },
        { label: "Kontakt-Mail", value: team.contactEmail },
        { label: "Claim-Mail", value: team.participantLink?.email || team.ownerClaim?.suggestedEmail },
        { label: "Portal-Konto", value: user.authentikSub ? "vorhanden" : "Login noch nicht aktiviert" },
        { label: "Claim", value: meta.label, targetType: "claim", onClick: () => { window.location.href = "/claim-links"; } },
        { label: "Versendet", value: formatDateTime(claim?.sentAt) },
        { label: "Gültig bis", value: claim?.expiresAt && !claim.claimedAt ? formatDateTime(claim.expiresAt) : null },
        { label: "Eingelöst", value: formatDateTime(claim?.claimedAt) },
      ]}
    />
  );
}

export default function UserManagement() {
  const notifications = useNotifications();
  const { active: activeCompetition, loading: competitionLoading } = useCompetition();
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
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [roleFilter, setRoleFilter] = useState<UserRoleFilter>("all");
  const [mailFilter, setMailFilter] = useState<UserMailFilter>("all");
  const [linkFilter, setLinkFilter] = useState<UserLinkFilter>("all");
  const [sortField, setSortField] = useState<UserSortField>("nameAsc");
  const [now, setNow] = useState(() => Date.now());
  const [filtersOpen, setFiltersOpen] = useState(false);

  const fetchUsers = useCallback(async (options?: { silent?: boolean }) => {
    if (competitionLoading) return;

    try {
      const params = new URLSearchParams();
      if (activeCompetition?.id) params.set("competitionId", activeCompetition.id);
      const res = await fetch("/api/admin/users" + (params.size ? `?${params}` : ""));
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (!options?.silent) {
          notifications.error(
            "Fehler beim Laden der Benutzer",
            data.error || "Bitte später erneut versuchen.",
          );
        }
        return;
      }

      const data = (await res.json()) as UsersResponse;
      setUsers(data.users || []);
      setCurrentUserId(data.currentUserId || null);
      setAdminCount(data.adminCount || 0);
    } catch (err) {
      console.error("Fehler beim Laden:", err);
      if (!options?.silent) {
        notifications.error(
          "Fehler beim Laden der Benutzer",
          err instanceof Error ? err.message : "Bitte später erneut versuchen.",
        );
      }
    } finally {
      setLoading(false);
    }
  }, [activeCompetition?.id, competitionLoading, notifications]);

  useEffect(() => {
    if (competitionLoading) return;

    const params = new URLSearchParams(window.location.search);
    setFocusedUserId(params.get("userId"));
    setFocusedTeamId(params.get("teamId"));
    const userQuery = params.get("userQuery");
    if (userQuery) {
      setSearchQuery(userQuery);
    }
    void fetchUsers();
  }, [competitionLoading, fetchUsers]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
      void fetchUsers({ silent: true });
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, [fetchUsers]);

  const startEdit = (user: UserEntry) => {
    setEditingUser(user.id);
    setEditRoles(user.roles.map((role) => role.role).filter((role) => role !== "TEAMCHEF"));
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

    try {
      const res = await fetch("/api/admin/users/" + userId + "/roles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roles: editRoles, competitionId: activeCompetition?.id }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        notifications.error("Fehler beim Speichern", data.error || "Rollen konnten nicht gespeichert werden.");
        return;
      }

      setEditingUser(null);
      notifications.success("Rollen gespeichert");
      await fetchUsers();
    } catch (err) {
      console.error("Fehler:", err);
      notifications.error(
        "Fehler beim Speichern",
        err instanceof Error ? err.message : "Rollen konnten nicht gespeichert werden.",
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = async (user: UserEntry) => {
    setDeletingUserId(user.id);

    try {
      const params = new URLSearchParams();
      if (activeCompetition?.id) params.set("competitionId", activeCompetition.id);
      const res = await fetch("/api/admin/users/" + user.id + (params.size ? `?${params}` : ""), {
        method: "DELETE",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notifications.error("Fehler beim Löschen", data.error || "Benutzer konnte nicht gelöscht werden.");
        return;
      }

      setEditingUser((current) => (current === user.id ? null : current));
      notifications.success(data.message || "Benutzer gelöscht");
      await fetchUsers();
    } catch (err) {
      console.error("Fehler beim Löschen:", err);
      notifications.error(
        "Fehler beim Löschen",
        err instanceof Error ? err.message : "Benutzer konnte nicht gelöscht werden.",
      );
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notifications.error(
          "Team-Rechte konnten nicht gespeichert werden",
          data.error || "Bitte später erneut versuchen.",
        );
        return;
      }

      notifications.success(
        team.isTeamManager ? "Team-Manager-Rechte entfernt" : "Team-Manager-Rechte vergeben",
        team.name,
      );
      await fetchUsers();
    } catch (err) {
      console.error("Fehler beim Speichern der Team-Rechte:", err);
      notifications.error(
        "Team-Rechte konnten nicht gespeichert werden",
        err instanceof Error ? err.message : "Bitte später erneut versuchen.",
      );
    } finally {
      setUpdatingTeamScopeKey(null);
    }
  };

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return users.filter((user) => {
      if (onlineOnly && getPresenceMeta(user.lastSeenAt, now).state !== "online") {
        return false;
      }

      if (roleFilter === "admin" && !user.roles.some((role) => role.role === "ADMIN")) {
        return false;
      }
      if (roleFilter === "moderator" && !user.roles.some((role) => role.role === "MODERATOR")) {
        return false;
      }
      if (roleFilter === "teamManager" && !(user.teamCount > 0 || user.roles.some((role) => role.role === "TEAMCHEF"))) {
        return false;
      }

      if (mailFilter === "hasEmail" && !user.email.trim()) {
        return false;
      }
      if (mailFilter === "missingEmail" && user.email.trim()) {
        return false;
      }

      const linkStatuses = getUserLinkStatusSet(user);
      if (linkFilter === "linked" && !linkStatuses.has("linked")) {
        return false;
      }
      if (linkFilter === "portal_account" && !linkStatuses.has("portal_account")) {
        return false;
      }
      if (linkFilter === "invitation_open" && !linkStatuses.has("invitation_open")) {
        return false;
      }
      if (linkFilter === "placeholder_user" && !linkStatuses.has("placeholder_user")) {
        return false;
      }
      if (linkFilter === "needs_attention" && !Array.from(linkStatuses).some((status) => USER_LINK_ATTENTION_STATUSES.has(status))) {
        return false;
      }

      if (!query) return true;

      const haystacks = [
        user.name || "",
        user.email,
        ...user.roles.map((role) => ROLE_INFO[role.role]?.label || role.role),
        ...(user.teamScopes || []).map((team) => team.name),
      ];
      return haystacks.some((value) => value.toLowerCase().includes(query));
    });
  }, [linkFilter, mailFilter, now, onlineOnly, roleFilter, searchQuery, users]);

  const visibleUsers = useMemo(() => {
    const collator = new Intl.Collator("de", { numeric: true, sensitivity: "base" });

    return [...filteredUsers].sort((left, right) => {
      if (sortField === "lastSeenDesc") {
        const leftTime = left.lastSeenAt ? new Date(left.lastSeenAt).getTime() : Number.NEGATIVE_INFINITY;
        const rightTime = right.lastSeenAt ? new Date(right.lastSeenAt).getTime() : Number.NEGATIVE_INFINITY;
        return rightTime - leftTime || collator.compare(left.name || left.email, right.name || right.email);
      }
      if (sortField === "createdDesc") {
        const leftTime = new Date(left.createdAt).getTime();
        const rightTime = new Date(right.createdAt).getTime();
        return rightTime - leftTime || collator.compare(left.name || left.email, right.name || right.email);
      }
      if (sortField === "teamCountDesc") {
        return right.teamCount - left.teamCount || collator.compare(left.name || left.email, right.name || right.email);
      }

      return collator.compare(left.name || left.email, right.name || right.email);
    });
  }, [filteredUsers, sortField]);

  const stats = useMemo(() => {
    const summarize = (entries: UserEntry[]) => ({
      users: entries.length,
      admins: entries.filter((user) => user.roles.some((role) => role.role === "ADMIN")).length,
      moderators: entries.filter((user) => user.roles.some((role) => role.role === "MODERATOR")).length,
      teamManagers: entries.filter((user) => user.teamCount > 0 || user.roles.some((role) => role.role === "TEAMCHEF")).length,
      online: entries.filter((user) => getPresenceMeta(user.lastSeenAt, now).state === "online").length,
    });

    return {
      total: summarize(users),
      filtered: summarize(filteredUsers),
    };
  }, [filteredUsers, now, users]);

  const hasActiveFilters = Boolean(searchQuery.trim() || onlineOnly || roleFilter !== "all" || mailFilter !== "all" || linkFilter !== "all" || sortField !== "nameAsc");
  const activeFilterCount = [searchQuery.trim() !== "", onlineOnly, roleFilter !== "all", mailFilter !== "all", linkFilter !== "all", sortField !== "nameAsc"].filter(Boolean).length;
  const resetFilters = () => {
    setSearchQuery("");
    setOnlineOnly(false);
    setRoleFilter("all");
    setMailFilter("all");
    setLinkFilter("all");
    setSortField("nameAsc");
  };
  const filterCounts = useMemo(() => ({
    admins: users.filter((user) => user.roles.some((role) => role.role === "ADMIN")).length,
    moderators: users.filter((user) => user.roles.some((role) => role.role === "MODERATOR")).length,
    teamManagers: users.filter((user) => user.teamCount > 0 || user.roles.some((role) => role.role === "TEAMCHEF")).length,
    hasEmail: users.filter((user) => user.email.trim()).length,
    missingEmail: users.filter((user) => !user.email.trim()).length,
    linked: users.filter((user) => getUserLinkStatusSet(user).has("linked")).length,
    portalAccount: users.filter((user) => getUserLinkStatusSet(user).has("portal_account")).length,
    invitationOpen: users.filter((user) => getUserLinkStatusSet(user).has("invitation_open")).length,
    placeholderUser: users.filter((user) => getUserLinkStatusSet(user).has("placeholder_user")).length,
    needsAttention: users.filter((user) => Array.from(getUserLinkStatusSet(user)).some((status) => USER_LINK_ATTENTION_STATUSES.has(status))).length,
  }), [users]);
  const statsItems = [
    {
      key: "users",
      label: "Benutzer",
      shortLabel: "User",
      value: stats.filtered.users,
      total: stats.total.users,
      tone: "default" as const,
    },
    {
      key: "online",
      label: "Online",
      shortLabel: "On",
      value: stats.filtered.online,
      total: stats.total.online,
      tone: "secondary" as const,
      active: onlineOnly,
      onClick: () => setOnlineOnly((current) => !current),
    },
    {
      key: "admins",
      label: "Admins",
      shortLabel: "Adm.",
      value: stats.filtered.admins,
      total: stats.total.admins,
      tone: "outline" as const,
      active: roleFilter === "admin",
      onClick: () => setRoleFilter((current) => (current === "admin" ? "all" : "admin")),
    },
    {
      key: "moderators",
      label: "Moderatoren",
      shortLabel: "Mod.",
      value: stats.filtered.moderators,
      total: stats.total.moderators,
      tone: "outline" as const,
      active: roleFilter === "moderator",
      onClick: () => setRoleFilter((current) => (current === "moderator" ? "all" : "moderator")),
    },
    {
      key: "teamManagers",
      label: "Teamchef:innen",
      shortLabel: "Teams",
      value: stats.filtered.teamManagers,
      total: stats.total.teamManagers,
      tone: "outline" as const,
      active: roleFilter === "teamManager",
      onClick: () => setRoleFilter((current) => (current === "teamManager" ? "all" : "teamManager")),
    },
  ];

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

          <DashboardControlsCard className="p-0 shadow-none">
            <div className="space-y-2">
              <DashboardSearchField
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Suche nach Name, Mail, Rolle oder Team"
              />

              <DashboardStatsRow items={statsItems} />

              <DashboardToolbar>
                <DashboardToolbarButton
                  icon={<RefreshCw className="size-3.5" />}
                  label="Aktualisieren"
                  onClick={() => void fetchUsers()}
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
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Rolle</p>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" variant={roleFilter === "all" ? "default" : "outline"} onClick={() => setRoleFilter("all")}>
                          Alle Rollen
                        </Button>
                        <Button type="button" size="sm" variant={roleFilter === "admin" ? "default" : "outline"} onClick={() => setRoleFilter("admin")}>
                          Admins <span className="rounded bg-background/30 px-1 text-[10px]">{filterCounts.admins}</span>
                        </Button>
                        <Button type="button" size="sm" variant={roleFilter === "moderator" ? "default" : "outline"} onClick={() => setRoleFilter("moderator")}>
                          Moderatoren <span className="rounded bg-background/30 px-1 text-[10px]">{filterCounts.moderators}</span>
                        </Button>
                        <Button type="button" size="sm" variant={roleFilter === "teamManager" ? "default" : "outline"} onClick={() => setRoleFilter("teamManager")}>
                          Teamchef:innen <span className="rounded bg-background/30 px-1 text-[10px]">{filterCounts.teamManagers}</span>
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Mail-Status</p>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" variant={mailFilter === "all" ? "default" : "outline"} onClick={() => setMailFilter("all")}>
                          Alle
                        </Button>
                        <Button type="button" size="sm" variant={mailFilter === "hasEmail" ? "default" : "outline"} onClick={() => setMailFilter("hasEmail")}>
                          mit E-Mail <span className="rounded bg-background/30 px-1 text-[10px]">{filterCounts.hasEmail}</span>
                        </Button>
                        <Button type="button" size="sm" variant={mailFilter === "missingEmail" ? "default" : "outline"} onClick={() => setMailFilter("missingEmail")}>
                          ohne E-Mail <span className="rounded bg-background/30 px-1 text-[10px]">{filterCounts.missingEmail}</span>
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Portal-Verknüpfung</p>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" variant={linkFilter === "all" ? "default" : "outline"} onClick={() => setLinkFilter("all")}>
                          Alle
                        </Button>
                        <Button type="button" size="sm" variant={linkFilter === "linked" ? "default" : "outline"} onClick={() => setLinkFilter("linked")}>
                          Verknüpft <span className="rounded bg-background/30 px-1 text-[10px]">{filterCounts.linked}</span>
                        </Button>
                        <Button type="button" size="sm" variant={linkFilter === "portal_account" ? "default" : "outline"} onClick={() => setLinkFilter("portal_account")}>
                          Konto ohne Link <span className="rounded bg-background/30 px-1 text-[10px]">{filterCounts.portalAccount}</span>
                        </Button>
                        <Button type="button" size="sm" variant={linkFilter === "invitation_open" ? "default" : "outline"} onClick={() => setLinkFilter("invitation_open")}>
                          Einladung offen <span className="rounded bg-background/30 px-1 text-[10px]">{filterCounts.invitationOpen}</span>
                        </Button>
                        <Button type="button" size="sm" variant={linkFilter === "placeholder_user" ? "default" : "outline"} onClick={() => setLinkFilter("placeholder_user")}>
                          Placeholder <span className="rounded bg-background/30 px-1 text-[10px]">{filterCounts.placeholderUser}</span>
                        </Button>
                        <Button type="button" size="sm" variant={linkFilter === "needs_attention" ? "default" : "outline"} onClick={() => setLinkFilter("needs_attention")}>
                          Klärfall <span className="rounded bg-background/30 px-1 text-[10px]">{filterCounts.needsAttention}</span>
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Sichtbarkeit</label>
                        <Button
                          type="button"
                          size="sm"
                          variant={onlineOnly ? "default" : "outline"}
                          className="h-8 w-full justify-start"
                          onClick={() => setOnlineOnly((value) => !value)}
                        >
                          Nur online
                        </Button>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Sortierung</label>
                        <Select value={sortField} onValueChange={(value) => setSortField(value as UserSortField)}>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="nameAsc">Name A-Z</SelectItem>
                            <SelectItem value="lastSeenDesc">Zuletzt aktiv zuerst</SelectItem>
                            <SelectItem value="createdDesc">Neueste Registrierung</SelectItem>
                            <SelectItem value="teamCountDesc">Meiste Teams zuerst</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </DashboardPanel>
              )}
            </div>
          </DashboardControlsCard>
        </CardHeader>
      </Card>

      {visibleUsers.map((user) => {
        const isCurrentUser = user.id === currentUserId;
        const isLastAdmin = adminCount === 1 && user.roles.some((role) => role.role === "ADMIN");
        const isDeleting = deletingUserId === user.id;
        const presence = getPresenceMeta(user.lastSeenAt, now);
        const statusSummary = user.teamScopes.reduce((acc, team) => {
          const meta = getTeamScopeAccountMeta(user, team);
          const existing = acc.get(meta.status);
          acc.set(meta.status, {
            meta,
            count: (existing?.count ?? 0) + 1,
          });
          return acc;
        }, new Map<AccountLinkStatusMeta["status"], { meta: AccountLinkStatusMeta; count: number }>());
        const statusSummaryItems = Array.from(statusSummary.values()).sort((left, right) => {
          const order: AccountLinkStatusMeta["status"][] = [
            "linked",
            "portal_account",
            "invitation_open",
            "placeholder_user",
            "expired",
            "revoked",
            "missing_email",
            "no_invitation",
          ];
          return order.indexOf(left.meta.status) - order.indexOf(right.meta.status);
        });

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
                      <Badge variant="outline" className={`shrink-0 gap-1 text-xs ${presence.className}`} title={presence.detail}>
                        <span className={`size-2 rounded-full ${presence.dotClassName}`} />
                        {presence.label}
                      </Badge>
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
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Zuletzt aktiv: {formatLastSeen(user.lastSeenAt, now)}
                    </p>
                    {statusSummaryItems.length > 0 && editingUser !== user.id && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {statusSummaryItems.map(({ meta, count }) => (
                          <Badge key={meta.status} variant="outline" className={`h-6 gap-1 px-1.5 text-[10px] ${meta.className}`}>
                            <AccountLinkStatusIcon status={meta.status} className="size-3" />
                            {meta.label}
                            <span className="rounded bg-background/70 px-1">{count}</span>
                          </Badge>
                        ))}
                      </div>
                    )}

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
                            const isMtcOwnerVorzustand = isMtcScope(team) && team.isOwner && !team.isTeamManager;
                            const isFixedManager = team.isOwner || team.isLegacyTeamChief;
                            const isUpdating = updatingTeamScopeKey === `${user.id}:${team.id}`;
                            const isMtc = isMtcScope(team);
                            const classBadge = isMtc ? null : getTeamClassBadgeMeta(team.classificationCode);

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
                                  <span className="flex min-w-0 items-center gap-1.5">
                                    {isMtc && (
                                      <Badge variant="outline" className="h-5 shrink-0 border-emerald-300 bg-emerald-50 px-1.5 text-[10px] text-emerald-800">
                                        MTC {team.participantCount}/5
                                      </Badge>
                                    )}
                                    {classBadge && (
                                      <Badge
                                        variant="outline"
                                        className={joinClasses("h-5 shrink-0 px-1.5 text-[10px] font-semibold", classBadge.className)}
                                        title={`Klasse: ${classBadge.label}`}
                                        aria-label={`Klasse: ${classBadge.label}`}
                                      >
                                        {classBadge.shortLabel}
                                      </Badge>
                                    )}
                                    <span className="block min-w-0 truncate font-medium">{team.name}</span>
                                  </span>
                                  <span className="block text-[11px] text-muted-foreground">
                                    {team.relations.join(" · ")}
                                  </span>
                                </button>
                                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                                  <UserTeamScopeStatusDialog user={user} team={team} />
                                  <Badge
                                    variant="outline"
                                    className={`shrink-0 ${team.isTeamManager ? "border-green-300 text-green-700" : isMtcOwnerVorzustand ? "border-sky-300 text-sky-700" : "border-muted text-muted-foreground"}`}
                                  >
                                    {team.isTeamManager ? "Team Manager:in" : isMtcOwnerVorzustand ? "MTC-Owner" : "Keine Managerrechte"}
                                  </Badge>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={team.isTeamManager ? "outline" : "secondary"}
                                    className="h-7 flex-1 px-2 text-[11px] sm:flex-none"
                                    onClick={() => toggleTeamManager(user, team)}
                                    disabled={saving || isUpdating || isFixedManager}
                                    title={isMtcOwnerVorzustand ? "MTC-Owner wird beim Überführen zur regulären Teamrolle" : isFixedManager ? "Owner/Teamchef-Rechte kommen aus der Team-Zuordnung" : undefined}
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

      {visibleUsers.length === 0 && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Keine Benutzer passend zur aktuellen Suche gefunden.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
