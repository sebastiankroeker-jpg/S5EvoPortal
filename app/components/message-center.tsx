"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import {
  ArrowDownUp,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Inbox,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Send,
  SlidersHorizontal,
  UserRound,
  UsersRound,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  DashboardControlsCard,
  DashboardPanel,
  DashboardSearchField,
  DashboardStatsRow,
  DashboardToolbar,
  DashboardToolbarButton,
} from "./dashboard-controls";
import AccountLinkStatusDialog, { type AccountLinkDialogRow } from "./account-link-status-dialog";

type SupportContext = {
  type: "participant" | "team";
  id: string;
  label: string;
  detail: string;
};

type ConversationSummary = {
  id: string;
  type: string;
  status: "OPEN" | "WAITING_FOR_ADMIN" | "WAITING_FOR_USER" | "CLOSED";
  subject: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string | null;
  unreadCount: number;
  context: {
    team: { id: string; name: string } | null;
    participant: { id: string; firstName: string; lastName: string } | null;
    competition: { id: string; name: string; year: number } | null;
  };
  participants: Array<{
    id: string;
    role: string;
    lastReadAt: string | null;
    user: { id: string; name: string | null; email: string };
  }>;
  lastMessage: {
    id: string;
    bodyPreview: string;
    createdAt: string;
    senderDisplayMode: "PERSONAL" | "ORG";
    senderDisplayName: string;
    sender: { id: string; name: string | null; email: string };
  } | null;
  messages: Array<{
    id: string;
    body: string | null;
    bodyPreview: string | null;
    senderDisplayMode: "PERSONAL" | "ORG";
    senderDisplayName: string;
    createdAt: string;
    senderId: string;
    sender: { id: string; name: string | null; email: string };
    mine: boolean;
  }>;
};

type AdminComposeTarget = {
  userId: string;
  email: string | null;
  name: string | null;
  teamId: string | null;
  participantId: string | null;
};

type SortDirection = "asc" | "desc";
type MessageListColumnKey = "status" | "direction" | "person" | "subject" | "date";
type MessageSortMode = "latest" | "unread" | "subject" | "status" | "person";

const MESSAGE_LIST_COLUMNS_STORAGE_KEY = "s5evo.messages.visibleColumns.v1";
const DEFAULT_MESSAGE_LIST_VISIBLE_COLUMNS: MessageListColumnKey[] = ["status", "direction", "person", "subject", "date"];
const MESSAGE_LIST_COLUMNS: Array<{ key: MessageListColumnKey; label: string }> = [
  { key: "status", label: "Status" },
  { key: "direction", label: "Badge" },
  { key: "person", label: "Sender/Empfänger" },
  { key: "subject", label: "Betreff" },
  { key: "date", label: "Datum & Uhrzeit" },
];
const MESSAGE_SORT_OPTIONS: Array<{ value: MessageSortMode; label: string }> = [
  { value: "latest", label: "Letzte Aktivität" },
  { value: "unread", label: "Ungelesene zuerst" },
  { value: "status", label: "Status" },
  { value: "person", label: "Sender/Empfänger" },
  { value: "subject", label: "Betreff" },
];

function sanitizeMessageColumns(value: unknown): MessageListColumnKey[] {
  if (!Array.isArray(value)) return DEFAULT_MESSAGE_LIST_VISIBLE_COLUMNS;
  const allowed = new Set(MESSAGE_LIST_COLUMNS.map((column) => column.key));
  const columns = value.filter((entry): entry is MessageListColumnKey => typeof entry === "string" && allowed.has(entry as MessageListColumnKey));
  return columns.length > 0 ? columns : DEFAULT_MESSAGE_LIST_VISIBLE_COLUMNS;
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function statusLabel(status: ConversationSummary["status"]) {
  switch (status) {
    case "WAITING_FOR_ADMIN":
      return "wartet auf Admin";
    case "WAITING_FOR_USER":
      return "wartet auf Antwort";
    case "CLOSED":
      return "geschlossen";
    default:
      return "offen";
  }
}

function statusClassName(status: ConversationSummary["status"]) {
  switch (status) {
    case "WAITING_FOR_ADMIN":
      return "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200";
    case "WAITING_FOR_USER":
      return "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200";
    case "CLOSED":
      return "border-muted bg-muted/40 text-muted-foreground";
    default:
      return "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200";
  }
}

function senderLabel(message: { senderDisplayName?: string; sender: { name: string | null; email: string } }) {
  return message.senderDisplayName || message.sender.name || message.sender.email;
}

function conversationParticipantName(conversation: ConversationSummary) {
  return conversation.context.participant
    ? `${conversation.context.participant.firstName} ${conversation.context.participant.lastName}`
    : "";
}

function isOutgoingConversation(conversation: ConversationSummary, mode: "mine" | "admin", currentUserId: string | null) {
  const lastMessage = conversation.lastMessage;
  if (!lastMessage) return false;
  if (mode === "admin") return lastMessage.senderDisplayMode === "ORG";
  return Boolean(currentUserId && lastMessage.sender.id === currentUserId);
}

function conversationDirectionLabel(conversation: ConversationSummary, mode: "mine" | "admin", currentUserId: string | null) {
  return isOutgoingConversation(conversation, mode, currentUserId) ? "gesendet" : "empfangen";
}

function conversationPersonLabel(conversation: ConversationSummary, mode: "mine" | "admin", currentUserId: string | null) {
  const outgoing = isOutgoingConversation(conversation, mode, currentUserId);
  if (mode === "admin") {
    const owner = conversation.participants.find((participant) => ["OWNER", "MEMBER"].includes(participant.role));
    const ownerName = owner?.user.name || owner?.user.email;
    if (outgoing) return ownerName || conversationParticipantName(conversation) || conversation.context.team?.name || "Empfänger";
    return conversation.lastMessage ? senderLabel(conversation.lastMessage) : ownerName || "Sender";
  }

  if (outgoing) return "Orga-Team";
  return conversation.lastMessage ? senderLabel(conversation.lastMessage) : "Orga-Team";
}

function messageDirectionBadgeClass(direction: "gesendet" | "empfangen") {
  return direction === "gesendet"
    ? "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200"
    : "border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200";
}

function MessageMetaStrip({
  items,
}: {
  items: Array<{ key: string; label: string; value: ReactNode }>;
}) {
  return (
    <div className="grid gap-1 rounded-md border border-border/60 bg-muted/20 p-2 text-xs sm:grid-cols-2 xl:grid-cols-5">
      {items.map((item) => (
        <div key={item.key} className="min-w-0">
          <div className="text-[10px] uppercase text-muted-foreground">{item.label}</div>
          <div className="min-w-0 truncate font-medium text-foreground">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

function readReceiptLabel(conversation: ConversationSummary, message: ConversationSummary["messages"][number]) {
  const recipientReads = conversation.participants
    .filter((participant) => participant.user.id !== message.senderId && participant.lastReadAt)
    .map((participant) => new Date(participant.lastReadAt || "").getTime())
    .filter((timestamp) => Number.isFinite(timestamp));
  if (recipientReads.length === 0) return null;

  const messageTime = new Date(message.createdAt).getTime();
  const firstReadAt = Math.min(...recipientReads.filter((timestamp) => timestamp >= messageTime));
  if (!Number.isFinite(firstReadAt)) return null;
  return `Gelesen ${formatDateTime(new Date(firstReadAt).toISOString())}`;
}

function SenderModeSelector({
  value,
  onChange,
  disabled,
}: {
  value: "ORG" | "PERSONAL";
  onChange: (value: "ORG" | "PERSONAL") => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex rounded-md border border-border bg-muted/30 p-1">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("ORG")}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-xs font-medium transition-colors disabled:opacity-60",
          value === "ORG" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-background",
        )}
      >
        <UsersRound className="h-3.5 w-3.5" />
        Orga-Team
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("PERSONAL")}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-xs font-medium transition-colors disabled:opacity-60",
          value === "PERSONAL" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-background",
        )}
      >
        <UserRound className="h-3.5 w-3.5" />
        Persönlich
      </button>
    </div>
  );
}

export default function MessageCenter() {
  const [mode, setMode] = useState<"mine" | "admin">("mine");
  const [adminDefaultApplied, setAdminDefaultApplied] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [sortMode, setSortMode] = useState<MessageSortMode>("latest");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [listOptionsOpen, setListOptionsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const [threadDetailsOpen, setThreadDetailsOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<MessageListColumnKey[]>(DEFAULT_MESSAGE_LIST_VISIBLE_COLUMNS);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [contexts, setContexts] = useState<SupportContext[]>([]);
  const [canManageSupport, setCanManageSupport] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [contextId, setContextId] = useState("");
  const [reply, setReply] = useState("");
  const [adminComposeTarget, setAdminComposeTarget] = useState<AdminComposeTarget | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [adminSubject, setAdminSubject] = useState("Nachricht vom Orga-Team");
  const [adminBody, setAdminBody] = useState("");
  const [adminSenderDisplayMode, setAdminSenderDisplayMode] = useState<"ORG" | "PERSONAL">("ORG");
  const [replySenderDisplayMode, setReplySenderDisplayMode] = useState<"ORG" | "PERSONAL">("ORG");

  const adminTargetLabel = adminComposeTarget?.name || adminComposeTarget?.email || "Zielperson";
  const visibleColumnDefs = useMemo(
    () => visibleColumns.map((key) => MESSAGE_LIST_COLUMNS.find((column) => column.key === key)).filter(Boolean) as Array<{ key: MessageListColumnKey; label: string }>,
    [visibleColumns],
  );
  const visibleColumnKey = visibleColumns.join("|");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(MESSAGE_LIST_COLUMNS_STORAGE_KEY);
    if (!stored) return;
    try {
      setVisibleColumns(sanitizeMessageColumns(JSON.parse(stored)));
    } catch {
      setVisibleColumns(DEFAULT_MESSAGE_LIST_VISIBLE_COLUMNS);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(MESSAGE_LIST_COLUMNS_STORAGE_KEY, JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  const filteredConversations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return conversations
      .filter((conversation) => {
        if (statusFilter === "unread" && conversation.unreadCount <= 0) return false;
        if (statusFilter !== "all" && statusFilter !== "unread" && conversation.status !== statusFilter) return false;
        if (unreadOnly && conversation.unreadCount <= 0) return false;
        if (!query) return true;

        const participantName = conversation.context.participant
          ? `${conversation.context.participant.firstName} ${conversation.context.participant.lastName}`
          : "";
        const haystack = [
          conversation.subject,
          statusLabel(conversation.status),
          conversation.context.team?.name || "",
          participantName,
          conversation.context.competition ? `${conversation.context.competition.name} ${conversation.context.competition.year}` : "",
          conversation.lastMessage?.bodyPreview || "",
          conversation.lastMessage?.senderDisplayName || "",
          conversation.lastMessage?.sender.name || "",
          conversation.lastMessage?.sender.email || "",
        ].join(" ").toLowerCase();

        return haystack.includes(query);
      })
      .sort((a, b) => {
        const directionFactor = sortDirection === "asc" ? 1 : -1;
        if (sortMode === "unread") {
          return b.unreadCount - a.unreadCount || new Date(b.lastMessageAt || b.updatedAt).getTime() - new Date(a.lastMessageAt || a.updatedAt).getTime();
        }
        if (sortMode === "subject") {
          return a.subject.localeCompare(b.subject, "de") * directionFactor;
        }
        if (sortMode === "status") {
          return statusLabel(a.status).localeCompare(statusLabel(b.status), "de") * directionFactor || new Date(b.lastMessageAt || b.updatedAt).getTime() - new Date(a.lastMessageAt || a.updatedAt).getTime();
        }
        if (sortMode === "person") {
          return conversationPersonLabel(a, mode, currentUserId).localeCompare(conversationPersonLabel(b, mode, currentUserId), "de") * directionFactor;
        }
        const aTime = new Date(a.lastMessageAt || a.updatedAt).getTime();
        const bTime = new Date(b.lastMessageAt || b.updatedAt).getTime();
        return (aTime - bTime) * directionFactor;
      });
  }, [conversations, currentUserId, mode, searchQuery, sortDirection, sortMode, statusFilter, unreadOnly]);
  const selected = filteredConversations.find((conversation) => conversation.id === selectedId) ?? filteredConversations[0] ?? null;
  const selectedOwnerParticipant = selected?.participants.find((participant) => ["OWNER", "MEMBER"].includes(participant.role)) ?? null;
  const selectedViewerParticipant = currentUserId
    ? selected?.participants.find((participant) => participant.user.id === currentUserId) ?? null
    : null;
  const selectedDialogParticipant = mode === "admin"
    ? selectedOwnerParticipant
    : selected?.participants.find((participant) => participant.user.id !== currentUserId && ["ADMIN", "MODERATOR"].includes(participant.role)) ?? selectedViewerParticipant ?? null;
  const selectedDialogIsOrgTeam = selectedDialogParticipant ? ["ADMIN", "MODERATOR"].includes(selectedDialogParticipant.role) : false;
  const selectedDialogRows: AccountLinkDialogRow[] = selectedDialogParticipant
    ? [
        {
          label: "Person",
          value: selectedDialogIsOrgTeam
            ? "Orga-Team"
            : selectedDialogParticipant.user.name || selectedDialogParticipant.user.email,
          targetType: selectedDialogIsOrgTeam ? "message" : "user",
        },
        ...(!selectedDialogIsOrgTeam
          ? [
              { label: "E-Mail", value: selectedDialogParticipant.user.email, targetType: "user" as const },
              { label: "Team", value: selected?.context.team?.name, targetType: "team" as const },
            ]
          : []),
        { label: "Rolle", value: selectedDialogParticipant.role },
        {
          label: "Teilnehmer:in",
          value: selected?.context.participant
            ? `${selected.context.participant.firstName} ${selected.context.participant.lastName}`
            : null,
          targetType: "user",
        },
        {
          label: "Wettkampf",
          value: selected?.context.competition
            ? `${selected.context.competition.name} ${selected.context.competition.year}`
            : null,
        },
      ]
    : [];
  const activeFilterCount = [
    statusFilter !== "all",
    unreadOnly,
    searchQuery.trim() !== "",
    sortMode !== "latest",
    sortDirection !== "desc",
  ].filter(Boolean).length;
  const listOptionsBadge = visibleColumns.length !== DEFAULT_MESSAGE_LIST_VISIBLE_COLUMNS.length || visibleColumnKey !== DEFAULT_MESSAGE_LIST_VISIBLE_COLUMNS.join("|")
    ? visibleColumns.length
    : null;
  const messageStatsItems = [
    {
      key: "all",
      label: "Alle",
      shortLabel: "Alle",
      value: filteredConversations.length,
      total: conversations.length,
      tone: "outline" as const,
      active: statusFilter === "all" && !unreadOnly,
      onClick: () => {
        setStatusFilter("all");
        setUnreadOnly(false);
      },
    },
    {
      key: "unread",
      label: "Ungelesen",
      shortLabel: "Neu",
      value: filteredConversations.filter((conversation) => conversation.unreadCount > 0).length,
      total: conversations.filter((conversation) => conversation.unreadCount > 0).length,
      tone: "default" as const,
      active: statusFilter === "unread" || unreadOnly,
      onClick: () => {
        setStatusFilter("unread");
        setUnreadOnly(false);
      },
    },
    {
      key: "waiting-admin",
      label: "Admin",
      shortLabel: "Admin",
      value: filteredConversations.filter((conversation) => conversation.status === "WAITING_FOR_ADMIN").length,
      total: conversations.filter((conversation) => conversation.status === "WAITING_FOR_ADMIN").length,
      tone: "outline" as const,
      active: statusFilter === "WAITING_FOR_ADMIN",
      onClick: () => setStatusFilter("WAITING_FOR_ADMIN"),
    },
    {
      key: "waiting-user",
      label: "Antwort",
      shortLabel: "Antw.",
      value: filteredConversations.filter((conversation) => conversation.status === "WAITING_FOR_USER").length,
      total: conversations.filter((conversation) => conversation.status === "WAITING_FOR_USER").length,
      tone: "secondary" as const,
      active: statusFilter === "WAITING_FOR_USER",
      onClick: () => setStatusFilter("WAITING_FOR_USER"),
    },
  ];

  const loadConversations = useCallback(async (nextMode: "mine" | "admin" = mode) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ mode: nextMode });
      const response = await fetch(`/api/messages/conversations?${params.toString()}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Nachrichten konnten nicht geladen werden");
      const entries = Array.isArray(data.conversations) ? data.conversations.filter(Boolean) : [];
      setCanManageSupport(data.canManageSupport === true);
      setCurrentUserId(typeof data.viewerId === "string" ? data.viewerId : null);
      if (nextMode === "mine" && data.canManageSupport === true && !adminDefaultApplied) {
        setAdminDefaultApplied(true);
        setMode("admin");
        return;
      }
      setConversations(entries);
      setSelectedId((current) => (current && entries.some((entry: ConversationSummary) => entry.id === current) ? current : entries[0]?.id ?? null));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nachrichten konnten nicht geladen werden");
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [adminDefaultApplied, mode]);

  const loadContexts = useCallback(async () => {
    try {
      const response = await fetch("/api/messages/support-contexts");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return;
      const entries = Array.isArray(data.contexts) ? data.contexts : [];
      setContexts(entries);
      setContextId((current) => current || (entries[0] ? `${entries[0].type}:${entries[0].id}` : ""));
    } catch {}
  }, []);

  useEffect(() => {
    void loadConversations(mode);
    void loadContexts();
  }, [loadContexts, loadConversations, mode]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const targetUserId = params.get("targetUserId");
    if (!targetUserId) return;

    setAdminComposeTarget({
      userId: targetUserId,
      email: params.get("targetEmail"),
      name: params.get("targetName"),
      teamId: params.get("teamId"),
      participantId: params.get("participantId"),
    });
    setMode("admin");
    setSelectedId(null);
    void loadConversations("admin");
  }, [loadConversations]);

  useEffect(() => {
    if (!selected?.id) return;
    void fetch(`/api/messages/conversations/${selected.id}/read`, { method: "POST" })
      .then(() => loadConversations(mode))
      .catch(() => undefined);
  }, [loadConversations, mode, selected?.id]);

  const switchMode = (nextMode: "mine" | "admin") => {
    setAdminDefaultApplied(true);
    setMode(nextMode);
    setReplySenderDisplayMode(nextMode === "admin" ? "ORG" : "PERSONAL");
    setSelectedId(null);
    setMobileThreadOpen(false);
    setThreadDetailsOpen(false);
    void loadConversations(nextMode);
  };

  const createThread = async () => {
    setSending(true);
    setError("");
    try {
      const response = await fetch("/api/messages/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body, contextId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Nachricht konnte nicht gesendet werden");
      setSubject("");
      setBody("");
      setComposeOpen(false);
      setMode("mine");
      await loadConversations("mine");
      if (data.conversation?.id) {
        setSelectedId(data.conversation.id);
        setMobileThreadOpen(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nachricht konnte nicht gesendet werden");
    } finally {
      setSending(false);
    }
  };

  const createAdminThread = async () => {
    if (!adminComposeTarget) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch("/api/messages/admin-conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: adminComposeTarget.userId,
          teamId: adminComposeTarget.teamId,
          participantId: adminComposeTarget.participantId,
          subject: adminSubject,
          body: adminBody,
          senderDisplayMode: adminSenderDisplayMode,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Nachricht konnte nicht gesendet werden");
      setAdminBody("");
      setAdminSubject("Nachricht vom Orga-Team");
      setAdminSenderDisplayMode("ORG");
      setAdminComposeTarget(null);
      window.history.replaceState({}, "", "/nachrichten");
      setMode("admin");
      await loadConversations("admin");
      if (data.conversation?.id) {
        setSelectedId(data.conversation.id);
        setMobileThreadOpen(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nachricht konnte nicht gesendet werden");
    } finally {
      setSending(false);
    }
  };

  const cancelAdminCompose = () => {
    setAdminComposeTarget(null);
    setAdminBody("");
    setAdminSubject("Nachricht vom Orga-Team");
    setAdminSenderDisplayMode("ORG");
    window.history.replaceState({}, "", "/nachrichten");
  };

  const sendReply = async () => {
    if (!selected) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch(`/api/messages/conversations/${selected.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: reply,
          senderDisplayMode: mode === "admin" ? replySenderDisplayMode : "PERSONAL",
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Antwort konnte nicht gesendet werden");
      setReply("");
      await loadConversations(mode);
      setSelectedId(selected.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Antwort konnte nicht gesendet werden");
    } finally {
      setSending(false);
    }
  };

  const updateStatus = async (status: "OPEN" | "CLOSED") => {
    if (!selected) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch(`/api/messages/conversations/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Status konnte nicht geändert werden");
      await loadConversations(mode);
      setSelectedId(selected.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status konnte nicht geändert werden");
    } finally {
      setSending(false);
    }
  };

  const moveVisibleColumn = (columnKey: MessageListColumnKey, direction: "up" | "down") => {
    setVisibleColumns((current) => {
      const index = current.indexOf(columnKey);
      if (index < 0) return current;
      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  const handleHeaderSort = (field: MessageSortMode) => {
    if (sortMode === field) {
      setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
      return;
    }
    setSortMode(field);
    setSortDirection(field === "latest" || field === "unread" ? "desc" : "asc");
  };

  const getHeaderSortIcon = (field: MessageSortMode) => {
    if (sortMode !== field) return <ArrowDownUp className="size-3.5 text-muted-foreground" />;
    return sortDirection === "asc" ? <ChevronUp className="size-3.5 text-foreground" /> : <ChevronDown className="size-3.5 text-foreground" />;
  };

  const renderConversationCell = (conversation: ConversationSummary, columnKey: MessageListColumnKey): ReactNode => {
    const direction = conversationDirectionLabel(conversation, mode, currentUserId);
    switch (columnKey) {
      case "status":
        return (
          <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px]", statusClassName(conversation.status))}>
            {statusLabel(conversation.status)}
          </Badge>
        );
      case "direction":
        return (
          <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px]", messageDirectionBadgeClass(direction))}>
            {direction}
          </Badge>
        );
      case "person":
        return <span className="line-clamp-1">{conversationPersonLabel(conversation, mode, currentUserId)}</span>;
      case "subject":
        return (
          <span className="line-clamp-1 font-medium text-foreground">
            {conversation.subject}
            {conversation.unreadCount > 0 && <Badge className="ml-1 h-5 px-1.5 text-[10px]">{conversation.unreadCount}</Badge>}
          </span>
        );
      case "date":
        return <span className="tabular-nums">{formatDateTime(conversation.lastMessageAt || conversation.updatedAt)}</span>;
      default:
        return null;
    }
  };

  const selectedDirection = selected ? conversationDirectionLabel(selected, mode, currentUserId) : null;
  const selectedPerson = selected ? conversationPersonLabel(selected, mode, currentUserId) : null;
  const selectedTimestamp = selected ? formatDateTime(selected.lastMessageAt || selected.updatedAt) : "—";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/80 p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Nachrichten</h2>
          </div>
          <p className="text-sm text-muted-foreground">Support-Threads mit dem Orga-Team. Nachrichten bleiben im Portal nachvollziehbar.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => loadConversations(mode)} disabled={loading}>
            <RefreshCw className={cn("mr-1 h-3.5 w-3.5", loading && "animate-spin")} />
            Aktualisieren
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      {canManageSupport && adminComposeTarget && (
        <Card className="border-rose-500/30 bg-rose-500/5">
          <CardHeader className="space-y-3">
            <CardTitle className="text-base">Nachricht an {adminTargetLabel}</CardTitle>
            <CardDescription>
              Admin-Nachricht als Support-Thread. Der Nachrichtentext wird nicht per Mail weitergeleitet.
            </CardDescription>
            <MessageMetaStrip
              items={[
                { key: "status", label: "Status", value: "Entwurf" },
                {
                  key: "direction",
                  label: "Badge",
                  value: (
                    <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px]", messageDirectionBadgeClass("gesendet"))}>
                      gesendet
                    </Badge>
                  ),
                },
                { key: "person", label: "Empfänger", value: adminTargetLabel },
                { key: "subject", label: "Betreff", value: adminSubject || "—" },
                { key: "date", label: "Datum & Uhrzeit", value: formatDateTime(new Date().toISOString()) },
              ]}
            />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Zielperson</label>
                <div className="rounded-md border border-border/60 bg-background px-3 py-2 text-sm">
                  <div className="font-medium">{adminTargetLabel}</div>
                  {adminComposeTarget.email && <div className="text-xs text-muted-foreground">{adminComposeTarget.email}</div>}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Betreff</label>
                <Input value={adminSubject} onChange={(event) => setAdminSubject(event.target.value)} />
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-medium">Senden als</div>
                <div className="text-xs text-muted-foreground">Die echte Admin-Person bleibt intern nachvollziehbar.</div>
              </div>
              <SenderModeSelector value={adminSenderDisplayMode} onChange={setAdminSenderDisplayMode} disabled={sending} />
            </div>
            <Textarea
              value={adminBody}
              onChange={(event) => setAdminBody(event.target.value)}
              rows={4}
              placeholder="Nachricht schreiben..."
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" disabled={sending} onClick={cancelAdminCompose}>
                Abbrechen
              </Button>
              <Button type="button" disabled={sending || adminBody.trim().length < 2} onClick={createAdminThread}>
                <Send className="mr-2 h-4 w-4" />
                Nachricht senden
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <DashboardControlsCard>
        <div className="space-y-2">
          <DashboardSearchField
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Suche Betreff, Team, Person, Absender oder Nachricht"
          />
          <DashboardStatsRow items={messageStatsItems} />
          <DashboardToolbar>
            <DashboardToolbarButton
              icon={<RefreshCw className={cn("size-3.5", loading && "animate-spin")} />}
              label="Aktualisieren"
              onClick={() => loadConversations(mode)}
              disabled={loading}
              variant="outline"
            />
            <DashboardToolbarButton
              icon={<SlidersHorizontal className="size-3.5" />}
              label="Filter"
              open={filtersOpen}
              badge={activeFilterCount > 0 ? activeFilterCount : null}
              onClick={() => {
                setFiltersOpen((open) => !open);
                setListOptionsOpen(false);
              }}
            />
            <DashboardToolbarButton
              icon={<ArrowDownUp className="size-3.5" />}
              label="Spalten & Sortierung"
              open={listOptionsOpen}
              badge={listOptionsBadge}
              onClick={() => {
                setListOptionsOpen((open) => !open);
                setFiltersOpen(false);
              }}
            />
            <DashboardToolbarButton
              icon={<XCircle className="size-3.5" />}
              label="Filter zurücksetzen"
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("all");
                setUnreadOnly(false);
                setSortMode("latest");
                setSortDirection("desc");
              }}
              variant={activeFilterCount > 0 ? "default" : "outline"}
            />
          </DashboardToolbar>

          {filtersOpen && (
            <DashboardPanel>
              <div className="grid gap-2 sm:grid-cols-3">
                <label className="space-y-1 text-xs font-medium text-muted-foreground">
                  <span>Status</span>
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground"
                  >
                    <option value="all">Alle Status</option>
                    <option value="unread">Ungelesen</option>
                    <option value="WAITING_FOR_ADMIN">Wartet auf Admin</option>
                    <option value="WAITING_FOR_USER">Wartet auf Teilnehmer:in</option>
                    <option value="OPEN">Offen</option>
                    <option value="CLOSED">Geschlossen</option>
                  </select>
                </label>
                <label className="space-y-1 text-xs font-medium text-muted-foreground">
                  <span>Sortierung</span>
                  <select
                    value={sortMode}
                    onChange={(event) => setSortMode(event.target.value as typeof sortMode)}
                    className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground"
                  >
                    <option value="latest">Letzte Aktivität</option>
                    <option value="unread">Ungelesene zuerst</option>
                    <option value="status">Status</option>
                    <option value="subject">Betreff A-Z</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 rounded-md border border-border/60 bg-background px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={unreadOnly}
                    onChange={(event) => setUnreadOnly(event.target.checked)}
                  />
                  Nur ungelesene Threads
                </label>
              </div>
            </DashboardPanel>
          )}

          {listOptionsOpen && (
            <DashboardPanel className="space-y-3">
              <div className="space-y-0.5 px-1">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <ArrowDownUp className="size-4" />
                  Listenoptionen
                </div>
                <p className="text-xs text-muted-foreground">Sortierung festlegen und sichtbare Inbox-Spalten anpassen</p>
              </div>

              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px]">
                <label className="space-y-1 text-xs font-medium text-muted-foreground">
                  <span>Sortieren nach</span>
                  <select
                    value={sortMode}
                    onChange={(event) => {
                      const value = event.target.value as MessageSortMode;
                      setSortMode(value);
                      setSortDirection(value === "latest" || value === "unread" ? "desc" : "asc");
                    }}
                    className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground"
                  >
                    {MESSAGE_SORT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-xs font-medium text-muted-foreground">
                  <span>Reihenfolge</span>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 w-full justify-between"
                    onClick={() => setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"))}
                  >
                    {sortDirection === "asc" ? "Aufsteigend" : "Absteigend"}
                    <ArrowDownUp className="size-3.5" />
                  </Button>
                </label>
              </div>

              <div className="space-y-2">
                <p className="px-1 text-xs font-medium text-muted-foreground">Sichtbare Spalten & Reihenfolge</p>
                <div className="space-y-1.5">
                  {visibleColumnDefs.map((column, index) => {
                    const disableRemoval = visibleColumnDefs.length === 1;
                    return (
                      <div
                        key={column.key}
                        className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-primary/40 bg-primary/5 px-2 py-1.5 text-sm"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked
                          disabled={disableRemoval}
                          aria-label={`${column.label} ausblenden`}
                          onChange={() => {
                            if (disableRemoval) return;
                            setVisibleColumns((current) => current.filter((entry) => entry !== column.key));
                          }}
                        />
                        <span className="min-w-0 truncate">{column.label}</span>
                        <span className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            className="inline-flex size-7 items-center justify-center rounded border border-border/60 bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
                            title={`${column.label} nach links schieben`}
                            aria-label={`${column.label} nach links schieben`}
                            disabled={index === 0}
                            onClick={() => moveVisibleColumn(column.key, "up")}
                          >
                            <ChevronUp className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            className="inline-flex size-7 items-center justify-center rounded border border-border/60 bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
                            title={`${column.label} nach rechts schieben`}
                            aria-label={`${column.label} nach rechts schieben`}
                            disabled={index === visibleColumnDefs.length - 1}
                            onClick={() => moveVisibleColumn(column.key, "down")}
                          >
                            <ChevronDown className="size-3.5" />
                          </button>
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {MESSAGE_LIST_COLUMNS.filter((column) => !visibleColumns.includes(column.key)).map((column) => (
                    <button
                      key={column.key}
                      type="button"
                      className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-xs transition-colors hover:bg-muted/40"
                      onClick={() => setVisibleColumns((current) => [...current, column.key])}
                    >
                      <span className="inline-flex size-4 items-center justify-center rounded border border-border/70 text-[10px]">+</span>
                      <span>{column.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </DashboardPanel>
          )}
        </div>
      </DashboardControlsCard>

      <div className={cn("grid gap-4", sidebarOpen ? "lg:grid-cols-[minmax(280px,360px)_1fr]" : "lg:grid-cols-[72px_1fr]")}>
        <Card className={cn("overflow-hidden transition-all", mobileThreadOpen && "hidden lg:block", !sidebarOpen && "lg:min-h-[520px]")}>
          {sidebarOpen ? (
            <>
              <CardHeader className="space-y-3 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{mode === "admin" ? "Orga-Team" : "Mein Postfach"}</CardTitle>
                    <CardDescription>{filteredConversations.length} Threads</CardDescription>
                  </div>
                  <div className="flex items-center gap-1">
                    {mode === "mine" && contexts.length > 0 && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setComposeOpen((open) => !open);
                          setMobileThreadOpen(false);
                          window.setTimeout(() => document.getElementById("new-message-composer")?.scrollIntoView({ block: "start", behavior: "smooth" }), 0);
                        }}
                        aria-label="Neue Nachricht schreiben"
                        title="Neue Nachricht schreiben"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    )}
                    <Button type="button" size="icon" variant="ghost" onClick={() => setSidebarOpen(false)} aria-label="Threadliste zuklappen">
                      <PanelLeftClose className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {canManageSupport && (
                  <div className="grid grid-cols-2 gap-1 rounded-md border border-border bg-muted/30 p-1">
                    <button
                      type="button"
                      onClick={() => switchMode("admin")}
                      className={cn(
                        "inline-flex h-9 items-center justify-center gap-1.5 rounded text-xs font-medium transition-colors",
                        mode === "admin" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-background",
                      )}
                    >
                      <UsersRound className="h-3.5 w-3.5" />
                      Orga-Team
                    </button>
                    <button
                      type="button"
                      onClick={() => switchMode("mine")}
                      className={cn(
                        "inline-flex h-9 items-center justify-center gap-1.5 rounded text-xs font-medium transition-colors",
                        mode === "mine" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-background",
                      )}
                    >
                      <UserRound className="h-3.5 w-3.5" />
                      Persönlich
                    </button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="max-h-[620px] overflow-y-auto p-3 pt-0">
                {loading ? (
                  <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">Lade Nachrichten...</div>
                ) : filteredConversations.length === 0 ? (
                  <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">Keine passenden Threads vorhanden.</div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="hidden overflow-x-auto rounded-md border border-border/60 lg:block">
                      <table className="w-full min-w-[680px] text-xs">
                        <thead className="bg-muted/40 text-left text-[11px] text-muted-foreground">
                          <tr className="border-b border-border/60">
                            {visibleColumnDefs.map((column) => {
                              const sortableField: MessageSortMode | null =
                                column.key === "status" ? "status"
                                  : column.key === "person" ? "person"
                                    : column.key === "subject" ? "subject"
                                      : column.key === "date" ? "latest"
                                        : null;
                              return (
                                <th key={column.key} className="whitespace-nowrap px-2 py-2 font-medium">
                                  {sortableField ? (
                                    <button
                                      type="button"
                                      className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                                      onClick={() => handleHeaderSort(sortableField)}
                                    >
                                      <span>{column.label}</span>
                                      {getHeaderSortIcon(sortableField)}
                                    </button>
                                  ) : (
                                    column.label
                                  )}
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredConversations.map((conversation) => (
                            <tr
                              key={conversation.id}
                              className={cn(
                                "cursor-pointer border-b border-border/40 align-middle transition-colors last:border-0 hover:bg-accent/50",
                                selected?.id === conversation.id && "bg-primary/10",
                              )}
                              onClick={() => {
                                setSelectedId(conversation.id);
                                setMobileThreadOpen(true);
                              }}
                            >
                              {visibleColumnDefs.map((column) => (
                                <td key={column.key} className="max-w-[180px] px-2 py-2 text-muted-foreground">
                                  {renderConversationCell(conversation, column.key)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="space-y-1.5 lg:hidden">
                      {filteredConversations.map((conversation) => {
                        const direction = conversationDirectionLabel(conversation, mode, currentUserId);
                        return (
                          <button
                            key={conversation.id}
                            type="button"
                            onClick={() => {
                              setSelectedId(conversation.id);
                              setMobileThreadOpen(true);
                            }}
                            className={cn(
                              "w-full rounded-md border px-2.5 py-2 text-left transition-colors hover:bg-accent/60",
                              selected?.id === conversation.id ? "border-primary bg-primary/10" : "border-border/60 bg-background/60",
                            )}
                          >
                            <div className="flex min-w-0 items-center gap-1.5">
                              <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px]", statusClassName(conversation.status))}>
                                {statusLabel(conversation.status)}
                              </Badge>
                              <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px]", messageDirectionBadgeClass(direction))}>
                                {direction}
                              </Badge>
                              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                                {conversationPersonLabel(conversation, mode, currentUserId)}
                              </span>
                            </div>
                            <div className="mt-1 flex min-w-0 items-center justify-between gap-2">
                              <span className="min-w-0 truncate text-sm font-semibold">{conversation.subject}</span>
                              <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                                {formatDateTime(conversation.lastMessageAt || conversation.updatedAt)}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </>
          ) : (
            <CardContent className="flex min-h-0 items-center justify-between gap-3 p-3 lg:min-h-[520px] lg:flex-col lg:justify-start">
              <Button type="button" size="icon" variant="ghost" onClick={() => setSidebarOpen(true)} aria-label="Threadliste aufklappen">
                <PanelLeftOpen className="h-4 w-4" />
              </Button>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground">
                {mode === "admin" ? <UsersRound className="h-4 w-4" /> : <Inbox className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1 text-right text-xs font-medium text-muted-foreground lg:flex-none lg:text-center lg:[writing-mode:vertical-rl]">
                {filteredConversations.length} Threads
              </div>
            </CardContent>
          )}
        </Card>

        <Card className={cn("min-h-[520px] overflow-hidden", !mobileThreadOpen && "hidden lg:block")}>
          {!selected ? (
            <CardContent className="flex min-h-[420px] items-center justify-center text-center text-sm text-muted-foreground">
              Wähle einen Thread aus oder starte eine neue Nachricht.
            </CardContent>
          ) : (
            <div className="flex h-[calc(100dvh-140px)] min-h-[520px] flex-col lg:h-[720px]">
              <div className="sticky top-0 z-10 border-b border-border/60 bg-card/95 px-3 py-2 backdrop-blur">
                <div className="flex items-center gap-2">
                  <div className="lg:hidden">
                    <Button type="button" size="icon" variant="ghost" onClick={() => setMobileThreadOpen(false)} aria-label="Zurück zur Übersicht">
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <h3 className="min-w-0 truncate text-sm font-semibold sm:text-base">{selected.subject}</h3>
                      <Badge variant="outline" className={cn("hidden h-5 shrink-0 px-1.5 text-[10px] sm:inline-flex", statusClassName(selected.status))}>
                        {statusLabel(selected.status)}
                      </Badge>
                    </div>
                    <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="min-w-0 truncate">{selectedPerson || "Orga-Team"}</span>
                      <span className="shrink-0">·</span>
                      <span className="shrink-0 tabular-nums">{selectedTimestamp}</span>
                    </div>
                  </div>
                  {selectedDialogParticipant && (
                    <AccountLinkStatusDialog
                      compact
                      meta={{
                        status: selectedDialogIsOrgTeam ? "portal_account" : "linked",
                        label: selectedDialogIsOrgTeam ? "Orga-Team" : selectedDialogParticipant.user.name || "Kontakt",
                        className:
                          selectedDialogIsOrgTeam
                            ? "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-200"
                            : "border-green-300 bg-green-50 text-green-800",
                        description:
                          selectedDialogIsOrgTeam
                            ? "Dieser Thread wird vom Orga-Team als Gruppenpostfach bearbeitet."
                            : "Fachliche Zielperson dieses Nachrichtenthreads.",
                      }}
                      title={selectedDialogIsOrgTeam ? "Orga-Team" : "Thread-Kontakt"}
                      rows={selectedDialogRows}
                    />
                  )}
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => setThreadDetailsOpen((open) => !open)}
                    aria-label={threadDetailsOpen ? "Thread-Details ausblenden" : "Thread-Details anzeigen"}
                    title={threadDetailsOpen ? "Thread-Details ausblenden" : "Thread-Details anzeigen"}
                  >
                    {threadDetailsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>
                {threadDetailsOpen && (
                  <div className="mt-2 space-y-2">
                    <div className="text-xs text-muted-foreground">
                      {selected.context.participant
                        ? `${selected.context.participant.firstName} ${selected.context.participant.lastName}`
                        : mode === "admin" ? "Support-Thread im Orga-Team" : "Support-Thread"}
                      {selected.context.team ? ` · ${selected.context.team.name}` : ""}
                      {selected.context.competition ? ` · ${selected.context.competition.name} ${selected.context.competition.year}` : ""}
                    </div>
                    <MessageMetaStrip
                      items={[
                        {
                          key: "status",
                          label: "Status",
                          value: (
                            <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px]", statusClassName(selected.status))}>
                              {statusLabel(selected.status)}
                            </Badge>
                          ),
                        },
                        {
                          key: "direction",
                          label: "Badge",
                          value: selectedDirection ? (
                            <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px]", messageDirectionBadgeClass(selectedDirection))}>
                              {selectedDirection}
                            </Badge>
                          ) : "—",
                        },
                        { key: "person", label: selectedDirection === "gesendet" ? "Empfänger" : "Sender", value: selectedPerson || "—" },
                        { key: "subject", label: "Betreff", value: selected.subject },
                        { key: "date", label: "Datum & Uhrzeit", value: selectedTimestamp },
                      ]}
                    />
                    {mode === "admin" && (
                      <div className="flex justify-end gap-2">
                        {selected.status !== "CLOSED" ? (
                          <Button type="button" size="sm" variant="outline" disabled={sending} onClick={() => updateStatus("CLOSED")}>
                            Schließen
                          </Button>
                        ) : (
                          <Button type="button" size="sm" variant="outline" disabled={sending} onClick={() => updateStatus("OPEN")}>
                            Wieder öffnen
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <CardContent className="min-h-0 flex-1 overflow-y-auto bg-muted/20 p-3">
                <div className="space-y-3">
                  {selected.messages.length === 0 ? (
                    <div className="rounded-md border border-dashed bg-background p-3 text-sm text-muted-foreground">Noch keine Nachrichten vorhanden.</div>
                  ) : (
                    selected.messages.map((message) => {
                      const receipt =
                        message.mine || (mode === "admin" && message.senderDisplayMode === "ORG")
                          ? readReceiptLabel(selected, message)
                          : null;
                      return (
                        <motion.div
                          key={message.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={cn("flex", message.mine ? "justify-end" : "justify-start")}
                        >
                          <div className={cn("flex max-w-[86%] flex-col", message.mine ? "items-end" : "items-start")}>
                            <div
                              className={cn(
                                "rounded-2xl px-3 py-2 shadow-sm",
                                message.mine
                                  ? "rounded-br-md bg-primary text-primary-foreground"
                                  : "rounded-bl-md border border-border/60 bg-background text-foreground",
                              )}
                            >
                              <div className={cn("mb-1 text-[11px]", message.mine ? "text-primary-foreground/75" : "text-muted-foreground")}>
                                {senderLabel(message)} · {formatDateTime(message.createdAt)}
                              </div>
                              <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.body}</p>
                            </div>
                            {receipt && <div className="mt-1 px-1 text-[11px] text-muted-foreground">{receipt}</div>}
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </div>
              </CardContent>

              <div className="sticky bottom-0 z-10 border-t border-border/60 bg-card/95 p-3 backdrop-blur">
                {selected.status === "CLOSED" && mode !== "admin" ? (
                  <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    Dieser Thread ist geschlossen. Das Orga-Team kann ihn bei Bedarf wieder öffnen.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {mode === "admin" && canManageSupport && (
                      <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-muted/20 p-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="text-sm font-medium">Antwort senden als</div>
                          <div className="text-xs text-muted-foreground">Orga-Postfach ist der Standard für Support-Antworten.</div>
                        </div>
                        <SenderModeSelector value={replySenderDisplayMode} onChange={setReplySenderDisplayMode} disabled={sending} />
                      </div>
                    )}
                    <Textarea
                      value={reply}
                      onChange={(event) => setReply(event.target.value)}
                      rows={2}
                      placeholder="Antwort schreiben..."
                      className="min-h-20 resize-none"
                    />
                    <div className="flex justify-end">
                      <Button type="button" disabled={sending || reply.trim().length < 2} onClick={sendReply}>
                        <Send className="mr-2 h-4 w-4" />
                        Antwort senden
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>

      {contexts.length > 0 && composeOpen && (
        <Card id="new-message-composer">
          <CardHeader className="space-y-3">
            <CardTitle className="text-base">Neue Nachricht an das Orga-Team</CardTitle>
            <CardDescription>Der Nachrichtentext wird nicht per Mail weitergeleitet, sondern bleibt im Portal.</CardDescription>
            <MessageMetaStrip
              items={[
                { key: "status", label: "Status", value: "Entwurf" },
                {
                  key: "direction",
                  label: "Badge",
                  value: (
                    <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px]", messageDirectionBadgeClass("gesendet"))}>
                      gesendet
                    </Badge>
                  ),
                },
                { key: "person", label: "Empfänger", value: "Orga-Team" },
                { key: "subject", label: "Betreff", value: subject || "—" },
                { key: "date", label: "Datum & Uhrzeit", value: formatDateTime(new Date().toISOString()) },
              ]}
            />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Kontext</label>
                <select
                  value={contextId}
                  onChange={(event) => setContextId(event.target.value)}
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                >
                  {contexts.map((context) => (
                    <option key={`${context.type}:${context.id}`} value={`${context.type}:${context.id}`}>
                      {context.label} · {context.type === "team" ? "Mannschaft" : "Teilnehmer:in"}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  {contexts.find((context) => `${context.type}:${context.id}` === contextId)?.detail || "Wähle einen Kontext."}
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Betreff</label>
                <Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="z. B. Frage zur Anmeldung" />
              </div>
            </div>
            <Textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={4}
              placeholder="Nachricht an das Orga-Team..."
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" disabled={sending} onClick={() => setComposeOpen(false)}>
                Abbrechen
              </Button>
              <Button type="button" disabled={sending || body.trim().length < 2} onClick={createThread}>
                <Send className="mr-2 h-4 w-4" />
                Nachricht senden
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
