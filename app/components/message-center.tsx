"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Search,
  Send,
  SlidersHorizontal,
  Sparkles,
  UserRound,
  UsersRound,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { openUserDashboard } from "@/lib/admin-routing";
import { useTheme } from "@/lib/theme-context";
import { cn } from "@/lib/utils";
import {
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
type AdminMessageTarget = AdminComposeTarget & {
  label: string;
  description: string;
  searchText?: string;
};

type SortDirection = "asc" | "desc";
type MessageSenderDisplayMode = "PERSONAL" | "ORG";
type MessageStatusFilter = ConversationSummary["status"];
type MessageListColumnKey = "status" | "direction" | "person" | "subject" | "date";
type MessageSortMode = "latest" | "unread" | "subject" | "status" | "person";
type NavigationBurstTarget = "list" | "thread" | "composer";
type MessageFilterState = {
  statuses?: unknown;
  searchQuery?: unknown;
  unreadOnly?: unknown;
  sortMode?: unknown;
  sortDirection?: unknown;
};
type PersonalComposeDraft = {
  subject?: unknown;
  body?: unknown;
  contextId?: unknown;
};
type AdminComposeDraft = {
  subject?: unknown;
  body?: unknown;
};

const MESSAGE_LIST_COLUMNS_STORAGE_KEY = "s5evo.messages.visibleColumns.v1";
const MESSAGE_FILTERS_STORAGE_KEY = "s5evo.messages.filters.v1";
const MESSAGE_COMPOSE_DRAFT_STORAGE_KEY = "s5evo.messages.composeDraft.v1";
const MESSAGE_ADMIN_COMPOSE_DRAFT_STORAGE_KEY = "s5evo.messages.adminComposeDrafts.v1";
const MESSAGE_STATUS_FILTERS: Array<{ value: MessageStatusFilter; label: string }> = [
  { value: "OPEN", label: "Offen" },
  { value: "WAITING_FOR_ADMIN", label: "Wartet auf Admin" },
  { value: "WAITING_FOR_USER", label: "Wartet auf Teilnehmer:in" },
  { value: "CLOSED", label: "Geschlossen" },
];
const DEFAULT_MESSAGE_STATUS_FILTERS: MessageStatusFilter[] = ["OPEN", "WAITING_FOR_ADMIN", "WAITING_FOR_USER"];
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

function sanitizeMessageStatusFilters(value: unknown): MessageStatusFilter[] {
  if (!Array.isArray(value)) return DEFAULT_MESSAGE_STATUS_FILTERS;
  const allowed = new Set(MESSAGE_STATUS_FILTERS.map((status) => status.value));
  const statuses = value.filter((entry): entry is MessageStatusFilter => typeof entry === "string" && allowed.has(entry as MessageStatusFilter));
  return statuses.length > 0 ? Array.from(new Set(statuses)) : DEFAULT_MESSAGE_STATUS_FILTERS;
}

function sanitizeMessageFilterState(value: MessageFilterState): {
  statuses: MessageStatusFilter[];
  searchQuery: string;
  unreadOnly: boolean;
  sortMode: MessageSortMode;
  sortDirection: SortDirection;
} {
  return {
    statuses: sanitizeMessageStatusFilters(value.statuses),
    searchQuery: typeof value.searchQuery === "string" ? value.searchQuery : "",
    unreadOnly: typeof value.unreadOnly === "boolean" ? value.unreadOnly : false,
    sortMode: MESSAGE_SORT_OPTIONS.some((option) => option.value === value.sortMode) ? value.sortMode as MessageSortMode : "latest",
    sortDirection: value.sortDirection === "asc" || value.sortDirection === "desc" ? value.sortDirection : "desc",
  };
}

function areStatusFiltersDefault(statuses: MessageStatusFilter[]) {
  return statuses.length === DEFAULT_MESSAGE_STATUS_FILTERS.length
    && DEFAULT_MESSAGE_STATUS_FILTERS.every((status) => statuses.includes(status));
}

function readJsonRecord(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function sanitizePersonalComposeDraft(value: PersonalComposeDraft) {
  return {
    subject: typeof value.subject === "string" ? value.subject : "",
    body: typeof value.body === "string" ? value.body : "",
    contextId: typeof value.contextId === "string" ? value.contextId : "",
  };
}

function sanitizeAdminComposeDraft(value: AdminComposeDraft, fallbackSubject = "Nachricht vom Orga-Team") {
  return {
    subject: typeof value.subject === "string" ? value.subject : fallbackSubject,
    body: typeof value.body === "string" ? value.body : "",
  };
}

function adminComposeDraftKey(target: Pick<AdminComposeTarget, "userId" | "teamId" | "participantId">, senderMode: MessageSenderDisplayMode = "ORG") {
  return [
    senderMode,
    target.userId,
    target.teamId || "no-team",
    target.participantId || "no-participant",
  ].join(":");
}

function adminTargetToComposeTarget(target: AdminMessageTarget): AdminComposeTarget {
  return {
    userId: target.userId,
    email: target.email,
    name: target.name || target.label,
    teamId: target.teamId,
    participantId: target.participantId,
  };
}

function formatPersonWithEmail(person: { name?: string | null; email?: string | null }) {
  const name = person.name?.trim();
  const email = person.email?.trim();
  if (name && email) return `${name} · ${email}`;
  return name || email || "Portal-Konto";
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
      return "offen";
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

  if (outgoing) {
    const viewer = currentUserId ? conversation.participants.find((participant) => participant.user.id === currentUserId) : null;
    const personalRecipient = viewer?.role === "MEMBER"
      ? conversation.participants.find((participant) => participant.user.id !== currentUserId && ["OWNER", "MEMBER"].includes(participant.role))
      : null;
    return personalRecipient ? formatPersonWithEmail(personalRecipient.user) : "Orga-Team";
  }
  return conversation.lastMessage ? senderLabel(conversation.lastMessage) : "Orga-Team";
}

function conversationContactParticipant(conversation: ConversationSummary, mode: "mine" | "admin", currentUserId: string | null) {
  if (mode === "admin") {
    return conversation.participants.find((participant) => ["OWNER", "MEMBER"].includes(participant.role)) ?? null;
  }

  const outgoing = isOutgoingConversation(conversation, mode, currentUserId);
  if (outgoing) {
    const viewer = currentUserId ? conversation.participants.find((participant) => participant.user.id === currentUserId) : null;
    if (viewer?.role !== "MEMBER") return null;
    return conversation.participants.find((participant) => participant.user.id !== currentUserId && ["OWNER", "MEMBER"].includes(participant.role)) ?? null;
  }

  return conversation.participants.find((participant) => ["ADMIN", "MODERATOR"].includes(participant.role)) ?? null;
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
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border/60 bg-muted/20 px-2 py-1.5 text-xs">
      {items.map((item) => (
        <div key={item.key} className="inline-flex min-w-0 items-center gap-1.5">
          <span className="shrink-0 text-[10px] uppercase text-muted-foreground">{item.label}</span>
          <span className="min-w-0 max-w-[11rem] truncate font-medium text-foreground sm:max-w-[14rem]">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function NavigationSparkleBurst({
  active,
  burstId,
  label,
}: {
  active: boolean;
  burstId?: number;
  label: string;
}) {
  if (!active) return null;

  return (
    <motion.div
      key={`${label}-${burstId ?? 0}`}
      className="pointer-events-none absolute right-3 top-3 z-30 flex items-center gap-1 rounded-full border border-amber-300/70 bg-amber-50/95 px-2.5 py-1 text-[11px] font-medium text-amber-900 shadow-lg dark:border-amber-700/70 dark:bg-amber-950/95 dark:text-amber-100"
      initial={{ opacity: 0, scale: 0.75, y: 8 }}
      animate={{ opacity: [0, 1, 1, 0], scale: [0.75, 1.04, 1, 0.96], y: [8, 0, 0, -8] }}
      transition={{ duration: 1.15, ease: "easeOut" }}
    >
      <Sparkles className="size-3.5" />
      <span>{label}</span>
      <span className="absolute -left-2 top-1 size-1.5 rounded-full bg-sky-400" />
      <span className="absolute -right-1 -top-1 size-1.5 rounded-full bg-fuchsia-400" />
      <span className="absolute bottom-0 left-5 size-1 rounded-full bg-emerald-400" />
    </motion.div>
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

export default function MessageCenter() {
  const { sparkleEnabled } = useTheme();
  const [mode, setMode] = useState<"mine" | "admin">("mine");
  const [adminDefaultApplied, setAdminDefaultApplied] = useState(false);
  const [statusFilters, setStatusFilters] = useState<MessageStatusFilter[]>(DEFAULT_MESSAGE_STATUS_FILTERS);
  const [searchQuery, setSearchQuery] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [sortMode, setSortMode] = useState<MessageSortMode>("latest");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [listOptionsOpen, setListOptionsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const [threadDetailsOpen, setThreadDetailsOpen] = useState(false);
  const [navigationBurst, setNavigationBurst] = useState<{ id: number; target: NavigationBurstTarget } | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<MessageListColumnKey[]>(DEFAULT_MESSAGE_LIST_VISIBLE_COLUMNS);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [contexts, setContexts] = useState<SupportContext[]>([]);
  const [adminTargets, setAdminTargets] = useState<AdminMessageTarget[]>([]);
  const [adminTargetsLoading, setAdminTargetsLoading] = useState(false);
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
  const [adminComposeSenderMode, setAdminComposeSenderMode] = useState<MessageSenderDisplayMode>("ORG");
  const [composeOpen, setComposeOpen] = useState(false);
  const [adminSubject, setAdminSubject] = useState("Nachricht vom Orga-Team");
  const [adminBody, setAdminBody] = useState("");
  const [adminTargetSearch, setAdminTargetSearch] = useState("");
  const skipNextFilterPersistRef = useRef(false);
  const skipNextPersonalDraftPersistRef = useRef(false);
  const skipNextAdminDraftPersistRef = useRef(false);

  const adminTargetLabel = adminComposeTarget ? formatPersonWithEmail(adminComposeTarget) : "Zielperson";
  const adminComposeChannelLabel = adminComposeSenderMode === "ORG" ? "Orga-Team" : "Persönlich";
  const visibleColumnDefs = useMemo(
    () => visibleColumns.map((key) => MESSAGE_LIST_COLUMNS.find((column) => column.key === key)).filter(Boolean) as Array<{ key: MessageListColumnKey; label: string }>,
    [visibleColumns],
  );
  const visibleColumnKey = visibleColumns.join("|");

  const triggerNavigationBurst = (target: NavigationBurstTarget) => {
    if (!sparkleEnabled) return;
    setNavigationBurst({ id: Date.now(), target });
  };

  const resetFilters = () => {
    setSearchQuery("");
    setStatusFilters(DEFAULT_MESSAGE_STATUS_FILTERS);
    setUnreadOnly(false);
    setSortMode("latest");
    setSortDirection("desc");
  };

  const toggleStatusFilter = (status: MessageStatusFilter) => {
    setStatusFilters((current) => {
      const next = current.includes(status)
        ? current.filter((entry) => entry !== status)
        : [...current, status];
      return next.length > 0 ? next : current;
    });
  };

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(MESSAGE_FILTERS_STORAGE_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      const modeState = parsed && typeof parsed === "object" ? (parsed as Record<string, MessageFilterState>)[mode] : null;
      if (!modeState) return;
      const next = sanitizeMessageFilterState(modeState);
      skipNextFilterPersistRef.current = true;
      setStatusFilters(next.statuses);
      setSearchQuery(next.searchQuery);
      setUnreadOnly(next.unreadOnly);
      setSortMode(next.sortMode);
      setSortDirection(next.sortDirection);
    } catch {}
  }, [mode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (skipNextFilterPersistRef.current) {
      skipNextFilterPersistRef.current = false;
      return;
    }
    let current: Record<string, MessageFilterState> = {};
    try {
      const stored = window.localStorage.getItem(MESSAGE_FILTERS_STORAGE_KEY);
      current = stored ? JSON.parse(stored) : {};
    } catch {
      current = {};
    }
    window.localStorage.setItem(
      MESSAGE_FILTERS_STORAGE_KEY,
      JSON.stringify({
        ...current,
        [mode]: { statuses: statusFilters, searchQuery, unreadOnly, sortMode, sortDirection },
      }),
    );
  }, [mode, searchQuery, sortDirection, sortMode, statusFilters, unreadOnly]);

  useEffect(() => {
    if (typeof window === "undefined" || contexts.length === 0) return;
    const draft = sanitizePersonalComposeDraft(readJsonRecord(window.localStorage.getItem(MESSAGE_COMPOSE_DRAFT_STORAGE_KEY)));
    const validContextId = draft.contextId && contexts.some((context) => `${context.type}:${context.id}` === draft.contextId)
      ? draft.contextId
      : `${contexts[0].type}:${contexts[0].id}`;
    skipNextPersonalDraftPersistRef.current = true;
    setSubject(draft.subject);
    setBody(draft.body);
    setContextId((current) => draft.contextId ? validContextId : current || validContextId);
  }, [contexts]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (skipNextPersonalDraftPersistRef.current) {
      skipNextPersonalDraftPersistRef.current = false;
      return;
    }
    const hasDraft = subject.trim() || body.trim();
    if (!hasDraft) {
      window.localStorage.removeItem(MESSAGE_COMPOSE_DRAFT_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(
      MESSAGE_COMPOSE_DRAFT_STORAGE_KEY,
      JSON.stringify({ subject, body, contextId }),
    );
  }, [body, contextId, subject]);

  useEffect(() => {
    if (typeof window === "undefined" || !adminComposeTarget) return;
    const drafts = readJsonRecord(window.localStorage.getItem(MESSAGE_ADMIN_COMPOSE_DRAFT_STORAGE_KEY));
    const fallbackSubject = adminComposeSenderMode === "ORG" ? "Nachricht vom Orga-Team" : "Persönliche Nachricht";
    const draft = sanitizeAdminComposeDraft((drafts[adminComposeDraftKey(adminComposeTarget, adminComposeSenderMode)] ?? {}) as AdminComposeDraft, fallbackSubject);
    skipNextAdminDraftPersistRef.current = true;
    setAdminSubject(draft.subject);
    setAdminBody(draft.body);
  }, [adminComposeSenderMode, adminComposeTarget]);

  useEffect(() => {
    if (typeof window === "undefined" || !adminComposeTarget) return;
    if (skipNextAdminDraftPersistRef.current) {
      skipNextAdminDraftPersistRef.current = false;
      return;
    }
    const drafts = readJsonRecord(window.localStorage.getItem(MESSAGE_ADMIN_COMPOSE_DRAFT_STORAGE_KEY));
    const key = adminComposeDraftKey(adminComposeTarget, adminComposeSenderMode);
    if (!adminSubject.trim() && !adminBody.trim()) {
      delete drafts[key];
    } else {
      drafts[key] = { subject: adminSubject, body: adminBody };
    }
    if (Object.keys(drafts).length === 0) {
      window.localStorage.removeItem(MESSAGE_ADMIN_COMPOSE_DRAFT_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(MESSAGE_ADMIN_COMPOSE_DRAFT_STORAGE_KEY, JSON.stringify(drafts));
  }, [adminBody, adminComposeSenderMode, adminComposeTarget, adminSubject]);

  useEffect(() => {
    if (!navigationBurst) return;
    const timeout = window.setTimeout(() => setNavigationBurst(null), 1300);
    return () => window.clearTimeout(timeout);
  }, [navigationBurst]);

  const filteredConversations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return conversations
      .filter((conversation) => {
        if (!statusFilters.includes(conversation.status)) return false;
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
  }, [conversations, currentUserId, mode, searchQuery, sortDirection, sortMode, statusFilters, unreadOnly]);
  const selected = filteredConversations.find((conversation) => conversation.id === selectedId) ?? filteredConversations[0] ?? null;
  const selectedOwnerParticipant = selected?.participants.find((participant) => ["OWNER", "MEMBER"].includes(participant.role)) ?? null;
  const selectedViewerParticipant = currentUserId
    ? selected?.participants.find((participant) => participant.user.id === currentUserId) ?? null
    : null;
  const selectedDialogParticipant = mode === "admin"
    ? selectedOwnerParticipant
    : selected?.participants.find((participant) => participant.user.id !== currentUserId) ?? selectedViewerParticipant ?? null;
  const selectedDialogIsOrgTeam = selectedDialogParticipant ? ["ADMIN", "MODERATOR"].includes(selectedDialogParticipant.role) : false;
  const selectedAdminComposeTarget: AdminComposeTarget | null = selectedOwnerParticipant && selected
    ? {
        userId: selectedOwnerParticipant.user.id,
        email: selectedOwnerParticipant.user.email,
        name: selectedOwnerParticipant.user.name,
        teamId: selected.context.team?.id ?? null,
        participantId: selected.context.participant?.id ?? null,
      }
    : null;
  const adminTargetOptions = useMemo(() => {
    const options = new Map<string, AdminMessageTarget>();
    for (const target of adminTargets) {
      options.set(adminComposeDraftKey(target, adminComposeSenderMode), target);
    }
    if (adminComposeTarget && !options.has(adminComposeDraftKey(adminComposeTarget, adminComposeSenderMode))) {
      options.set(adminComposeDraftKey(adminComposeTarget, adminComposeSenderMode), {
        ...adminComposeTarget,
        label: adminTargetLabel,
        description: selected?.context.team?.name || "Aktueller Nachrichtenkontext",
      });
    }
    return Array.from(options.values());
  }, [adminComposeSenderMode, adminComposeTarget, adminTargetLabel, adminTargets, selected?.context.team?.name]);
  const filteredAdminTargetOptions = useMemo(() => {
    const query = adminTargetSearch.trim().toLowerCase();
    if (!query) return adminTargetOptions;
    return adminTargetOptions.filter((target) => {
      const haystack = [
        target.label,
        target.email || "",
        target.description,
        target.name || "",
        target.searchText || "",
      ].join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }, [adminTargetOptions, adminTargetSearch]);
  const selectedDialogRows: AccountLinkDialogRow[] = selectedDialogParticipant
    ? [
        {
          label: "Person",
          value: selectedDialogIsOrgTeam
            ? "Orga-Team"
            : formatPersonWithEmail(selectedDialogParticipant.user),
          targetType: selectedDialogIsOrgTeam ? "message" : "user",
          onClick: !selectedDialogIsOrgTeam
            ? () => openUserDashboard({
                userId: selectedDialogParticipant.user.id,
                email: selectedDialogParticipant.user.email,
                teamId: selected?.context.team?.id,
              })
            : undefined,
        },
        !selectedDialogIsOrgTeam
          ? {
              label: "E-Mail",
              value: selectedDialogParticipant.user.email,
              targetType: "user" as const,
              onClick: () => openUserDashboard({
                userId: selectedDialogParticipant.user.id,
                email: selectedDialogParticipant.user.email,
                teamId: selected?.context.team?.id,
              }),
            }
          : null,
        { label: "Rolle", value: selectedDialogParticipant.role },
        {
          label: "Teilnehmer:in",
          value: selected?.context.participant
            ? `${selected.context.participant.firstName} ${selected.context.participant.lastName}`
            : null,
          targetType: "user",
          onClick: !selectedDialogIsOrgTeam
            ? () => openUserDashboard({
                userId: selectedDialogParticipant.user.id,
                email: selectedDialogParticipant.user.email,
                teamId: selected?.context.team?.id,
              })
            : undefined,
        },
        {
          label: "Wettkampf",
          value: selected?.context.competition
            ? `${selected.context.competition.name} ${selected.context.competition.year}`
            : null,
        },
      ].filter(Boolean) as AccountLinkDialogRow[]
    : [];
  const activeFilterCount = [
    !areStatusFiltersDefault(statusFilters),
    unreadOnly,
    searchQuery.trim() !== "",
    sortMode !== "latest",
    sortDirection !== "desc",
  ].filter(Boolean).length;
  const listOptionsBadge = visibleColumns.length !== DEFAULT_MESSAGE_LIST_VISIBLE_COLUMNS.length || visibleColumnKey !== DEFAULT_MESSAGE_LIST_VISIBLE_COLUMNS.join("|")
    ? visibleColumns.length
    : null;

  const openPersonalCompose = () => {
    setComposeOpen(true);
    setMobileThreadOpen(false);
    triggerNavigationBurst("composer");
  };

  const openAdminCompose = async (senderMode: MessageSenderDisplayMode = "ORG") => {
    const targets = adminTargets.length > 0 ? adminTargets : await loadAdminTargets();
    const selectedTarget = selectedAdminComposeTarget
      ? targets.find((target) => target.userId === selectedAdminComposeTarget.userId)
      : null;
    const initialTarget = selectedTarget
      ? adminTargetToComposeTarget(selectedTarget)
      : (targets[0] ? adminTargetToComposeTarget(targets[0]) : null);
    if (!initialTarget) {
      setError("Keine verknüpften Empfänger gefunden");
      return;
    }
    setAdminComposeSenderMode(senderMode);
    setAdminComposeTarget(initialTarget);
    setAdminTargetSearch("");
    setMobileThreadOpen(false);
    triggerNavigationBurst("composer");
  };

  const messageStatsItems = [
    {
      key: "all",
      label: "Alle",
      shortLabel: "Alle",
      value: filteredConversations.length,
      total: conversations.length,
      tone: "outline" as const,
      active: areStatusFiltersDefault(statusFilters) && !unreadOnly,
      onClick: () => {
        setStatusFilters(DEFAULT_MESSAGE_STATUS_FILTERS);
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
      active: unreadOnly,
      onClick: () => {
        setUnreadOnly((current) => !current);
      },
    },
    {
      key: "waiting-admin",
      label: "Admin",
      shortLabel: "Admin",
      value: filteredConversations.filter((conversation) => conversation.status === "WAITING_FOR_ADMIN").length,
      total: conversations.filter((conversation) => conversation.status === "WAITING_FOR_ADMIN").length,
      tone: "outline" as const,
      active: statusFilters.length === 1 && statusFilters.includes("WAITING_FOR_ADMIN"),
      onClick: () => setStatusFilters(["WAITING_FOR_ADMIN"]),
    },
    {
      key: "waiting-user",
      label: "Antwort",
      shortLabel: "Antw.",
      value: filteredConversations.filter((conversation) => conversation.status === "WAITING_FOR_USER").length,
      total: conversations.filter((conversation) => conversation.status === "WAITING_FOR_USER").length,
      tone: "secondary" as const,
      active: statusFilters.length === 1 && statusFilters.includes("WAITING_FOR_USER"),
      onClick: () => setStatusFilters(["WAITING_FOR_USER"]),
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

  const loadAdminTargets = useCallback(async () => {
    setAdminTargetsLoading(true);
    try {
      const response = await fetch("/api/messages/admin-targets");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Empfänger konnten nicht geladen werden");
      const entries = Array.isArray(data.targets) ? data.targets.filter(Boolean) as AdminMessageTarget[] : [];
      setAdminTargets(entries);
      return entries;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Empfänger konnten nicht geladen werden");
      setAdminTargets([]);
      return [];
    } finally {
      setAdminTargetsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConversations(mode);
    void loadContexts();
  }, [loadContexts, loadConversations, mode]);

  useEffect(() => {
    if (!canManageSupport) return;
    void loadAdminTargets();
  }, [canManageSupport, loadAdminTargets]);

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
    setSelectedId(null);
    setMobileThreadOpen(false);
    setThreadDetailsOpen(false);
    triggerNavigationBurst("list");
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
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(MESSAGE_COMPOSE_DRAFT_STORAGE_KEY);
      }
      setMode("mine");
      await loadConversations("mine");
      if (data.conversation?.id) {
        setSelectedId(data.conversation.id);
        setMobileThreadOpen(true);
        triggerNavigationBurst("thread");
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
          senderDisplayMode: adminComposeSenderMode,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Nachricht konnte nicht gesendet werden");
      if (typeof window !== "undefined") {
        const drafts = readJsonRecord(window.localStorage.getItem(MESSAGE_ADMIN_COMPOSE_DRAFT_STORAGE_KEY));
        delete drafts[adminComposeDraftKey(adminComposeTarget, adminComposeSenderMode)];
        if (Object.keys(drafts).length === 0) {
          window.localStorage.removeItem(MESSAGE_ADMIN_COMPOSE_DRAFT_STORAGE_KEY);
        } else {
          window.localStorage.setItem(MESSAGE_ADMIN_COMPOSE_DRAFT_STORAGE_KEY, JSON.stringify(drafts));
        }
      }
      setAdminBody("");
      setAdminSubject(adminComposeSenderMode === "ORG" ? "Nachricht vom Orga-Team" : "Persönliche Nachricht");
      setAdminComposeTarget(null);
      setAdminTargetSearch("");
      window.history.replaceState({}, "", "/nachrichten");
      const nextMode = adminComposeSenderMode === "ORG" ? "admin" : "mine";
      setMode(nextMode);
      await loadConversations(nextMode);
      if (data.conversation?.id) {
        setSelectedId(data.conversation.id);
        setMobileThreadOpen(true);
        triggerNavigationBurst("thread");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nachricht konnte nicht gesendet werden");
    } finally {
      setSending(false);
    }
  };

  const cancelAdminCompose = () => {
    setAdminComposeTarget(null);
    setAdminTargetSearch("");
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
          senderDisplayMode: mode === "admin" ? "ORG" : "PERSONAL",
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

  const renderAdminTargetPortalBadge = () => {
    if (!adminComposeTarget) return null;
    const displayName = adminComposeTarget.name || adminComposeTarget.email || "Portal-Konto";
    const openTarget = () => openUserDashboard({
      userId: adminComposeTarget.userId,
      email: adminComposeTarget.email,
      teamId: adminComposeTarget.teamId,
    });

    return (
      <AccountLinkStatusDialog
        compact
        meta={{
          status: "linked",
          label: displayName,
          className: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-200",
          description: "Portal-Konto des Nachrichten-Adressaten.",
        }}
        title="Portal-Kontakt"
        rows={[
          { label: "Person", value: displayName, targetType: "user", onClick: openTarget, title: "Im Benutzer-Dashboard öffnen" },
          { label: "E-Mail", value: adminComposeTarget.email, targetType: "user", onClick: openTarget, title: "Im Benutzer-Dashboard öffnen" },
          { label: "Rolle", value: "Adressat" },
        ]}
      />
    );
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

  const renderPortalContactBadge = (conversation: ConversationSummary, compact = true) => {
    const contact = conversationContactParticipant(conversation, mode, currentUserId);
    if (!contact) {
      return (
        <AccountLinkStatusDialog
          compact={compact}
          meta={{
            status: "portal_account",
            label: "Orga-Team",
            className: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-200",
            description: "Gruppenpostfach des Orga-Teams.",
          }}
          title="Orga-Team"
          rows={[
            { label: "Kontakt", value: "Orga-Team", targetType: "message" },
            { label: "Rolle", value: "Gruppenpostfach" },
          ]}
        />
      );
    }

    const displayName = contact.user.name || contact.user.email || "Portal-Konto";
    const openContact = () => openUserDashboard({ userId: contact.user.id, email: contact.user.email, teamId: conversation.context.team?.id });

    return (
      <AccountLinkStatusDialog
        compact={compact}
        meta={{
          status: "linked",
          label: displayName,
          className: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-200",
          description: "Portal-Konto des fachlichen Kontakts.",
        }}
        title="Portal-Kontakt"
        rows={[
          { label: "Person", value: displayName, targetType: "user", onClick: openContact, title: "Im Benutzer-Dashboard öffnen" },
          { label: "E-Mail", value: contact.user.email, targetType: "user", onClick: openContact, title: "Im Benutzer-Dashboard öffnen" },
          { label: "Rolle", value: contact.role },
          {
            label: "Teilnehmer:in",
            value: conversation.context.participant
              ? `${conversation.context.participant.firstName} ${conversation.context.participant.lastName}`
              : null,
            targetType: "user",
            onClick: openContact,
            title: "Im Benutzer-Dashboard öffnen",
          },
        ]}
      />
    );
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
        return (
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="min-w-0 truncate">{conversationPersonLabel(conversation, mode, currentUserId)}</span>
            <span className="shrink-0">{renderPortalContactBadge(conversation)}</span>
          </span>
        );
      case "subject":
        return (
          <span className={cn("line-clamp-1 text-foreground", conversation.unreadCount > 0 ? "font-semibold" : "font-normal")}>
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
  const selectedIsOrgThread = selected
    ? selected.participants.some((participant) => ["ADMIN", "MODERATOR"].includes(participant.role))
    : false;
  const selectedChannelLabel = selectedIsOrgThread ? "Orga-Team" : "Persönlich";
  const replySenderLabel = mode === "admin" ? "Orga-Team" : "Persönlich";

  return (
    <div className="space-y-4">
      <div className={cn("flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-card/80 px-3 py-2 shadow-sm", mobileThreadOpen && "max-lg:hidden")}>
        <div className="flex min-w-0 items-center gap-2">
          <MessageCircle className="h-4 w-4 shrink-0 text-primary" />
          <h2 className="truncate text-base font-semibold">Nachrichten</h2>
        </div>
        {canManageSupport && (
          <div className="grid shrink-0 grid-cols-2 gap-1 rounded-md border border-border bg-muted/30 p-1">
            <button
              type="button"
              onClick={() => switchMode("admin")}
              className={cn(
                "inline-flex h-8 items-center justify-center gap-1.5 rounded px-2.5 text-xs font-medium transition-colors",
                mode === "admin" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-background",
              )}
            >
              <UsersRound className="h-3.5 w-3.5" />
              <span className="hidden min-[390px]:inline">Orga-Team</span>
              <span className="min-[390px]:hidden">Orga</span>
            </button>
            <button
              type="button"
              onClick={() => switchMode("mine")}
              className={cn(
                "inline-flex h-8 items-center justify-center gap-1.5 rounded px-2.5 text-xs font-medium transition-colors",
                mode === "mine" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-background",
              )}
            >
              <UserRound className="h-3.5 w-3.5" />
              <span>Persönlich</span>
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      <Dialog open={canManageSupport && Boolean(adminComposeTarget)} onOpenChange={(open) => { if (!open) cancelAdminCompose(); }}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader className="space-y-2 pr-8">
            <div className="flex flex-wrap items-center gap-2">
              <DialogTitle>{adminComposeChannelLabel}: Nachricht an {adminTargetLabel}</DialogTitle>
              {renderAdminTargetPortalBadge()}
            </div>
            <DialogDescription>
              {adminComposeSenderMode === "ORG"
                ? "Nachricht aus dem Orga-Postfach. Das Orga-Team bleibt als Gruppenpostfach beteiligt."
                : "Persönliche 1:1-Nachricht. Sichtbar und bearbeitbar nur für dich und die Zielperson."}
            </DialogDescription>
            <MessageMetaStrip
              items={[
                { key: "status", label: "Status", value: "Entwurf" },
                { key: "channel", label: "Kanal", value: adminComposeChannelLabel },
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
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Zielperson</label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={adminTargetSearch}
                    onChange={(event) => setAdminTargetSearch(event.target.value)}
                    disabled={adminTargetsLoading || adminTargetOptions.length === 0}
                    placeholder="Registrierten Benutzer suchen"
                    className="pl-9"
                  />
                </div>
                <div className="max-h-44 overflow-y-auto rounded-md border border-border bg-background p-1">
                  {adminTargetsLoading ? (
                    <div className="px-2 py-2 text-sm text-muted-foreground">Empfänger werden geladen...</div>
                  ) : adminTargetOptions.length === 0 ? (
                    <div className="px-2 py-2 text-sm text-muted-foreground">Keine registrierten Empfänger gefunden</div>
                  ) : filteredAdminTargetOptions.length === 0 ? (
                    <div className="px-2 py-2 text-sm text-muted-foreground">Keine Treffer für diese Suche</div>
                  ) : (
                    filteredAdminTargetOptions.map((target) => {
                      const key = adminComposeDraftKey(target, adminComposeSenderMode);
                      const active = adminComposeTarget ? adminComposeDraftKey(adminComposeTarget, adminComposeSenderMode) === key : false;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setAdminComposeTarget(adminTargetToComposeTarget(target))}
                          className={cn(
                            "flex w-full min-w-0 flex-col rounded px-2 py-1.5 text-left text-sm transition-colors",
                            active ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                          )}
                        >
                          <span className="truncate font-medium">{formatPersonWithEmail(target)}</span>
                          <span className={cn("truncate text-xs", active ? "text-primary-foreground/80" : "text-muted-foreground")}>
                            {target.description}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {renderAdminTargetPortalBadge()}
                  <span className="truncate">Nur registrierte Portal-User im aktuellen Mandanten.</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Betreff</label>
                <Input value={adminSubject} onChange={(event) => setAdminSubject(event.target.value)} />
              </div>
            </div>
            <Textarea
              value={adminBody}
              onChange={(event) => setAdminBody(event.target.value)}
              rows={4}
              placeholder="Nachricht schreiben..."
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={sending} onClick={cancelAdminCompose}>
              Abbrechen
            </Button>
            <Button type="button" disabled={sending || adminBody.trim().length < 2} onClick={createAdminThread}>
              <Send className="mr-2 h-4 w-4" />
              Nachricht senden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className={cn("grid gap-4", sidebarOpen ? "lg:grid-cols-[minmax(280px,360px)_1fr]" : "lg:grid-cols-[72px_1fr]")}>
        <Card className={cn("relative overflow-hidden transition-all", mobileThreadOpen && "hidden lg:block", !sidebarOpen && "lg:min-h-[520px]")}>
          <NavigationSparkleBurst active={sparkleEnabled && navigationBurst?.target === "list"} burstId={navigationBurst?.id} label="Postfach" />
          {sidebarOpen ? (
            <>
              <CardHeader className="space-y-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <CardTitle className="text-base">{mode === "admin" ? "Orga-Team" : "Mein Postfach"}</CardTitle>
                    <CardDescription className="text-xs">{filteredConversations.length} Threads</CardDescription>
                  </div>
                  <div className="flex items-center gap-1">
                    {mode === "mine" && !canManageSupport && contexts.length > 0 && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={openPersonalCompose}
                        aria-label="Neue Nachricht schreiben"
                        title="Neue Nachricht schreiben"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    )}
                    {mode === "mine" && canManageSupport && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => openAdminCompose("PERSONAL")}
                        disabled={adminTargetsLoading}
                        aria-label="Neue persönliche Nachricht schreiben"
                        title="Neue persönliche Nachricht schreiben"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    )}
                    {mode === "admin" && canManageSupport && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => openAdminCompose("ORG")}
                        disabled={adminTargetsLoading}
                        aria-label="Neue Orga-Nachricht schreiben"
                        title="Neue Orga-Nachricht schreiben"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    )}
                    <Button type="button" size="icon" variant="ghost" onClick={() => setSidebarOpen(false)} aria-label="Threadliste zuklappen">
                      <PanelLeftClose className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2 rounded-md border border-border/60 bg-muted/15 p-2">
                  <DashboardSearchField
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Suche Betreff, Person, Absender oder Nachricht"
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
                      onClick={resetFilters}
                      variant={activeFilterCount > 0 ? "default" : "outline"}
                    />
                  </DashboardToolbar>

                  {filtersOpen && (
                    <DashboardPanel>
                      <div className="grid gap-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                        <div className="space-y-1.5">
                          <span>Status</span>
                          <div className="grid grid-cols-2 gap-1.5">
                            {MESSAGE_STATUS_FILTERS.map((option) => {
                              const active = statusFilters.includes(option.value);
                              return (
                                <button
                                  key={option.value}
                                  type="button"
                                  className={cn(
                                    "inline-flex min-h-9 items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs font-medium transition-colors",
                                    active
                                      ? "border-primary bg-primary/10 text-foreground"
                                      : "border-border/60 bg-background text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                                  )}
                                  onClick={() => toggleStatusFilter(option.value)}
                                  aria-pressed={active}
                                >
                                  <span className="min-w-0 truncate">{option.label}</span>
                                  <span className={cn("size-2 rounded-full", active ? "bg-primary" : "bg-muted-foreground/30")} />
                                </button>
                              );
                            })}
                          </div>
                        </div>
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
                                triggerNavigationBurst("thread");
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
                              triggerNavigationBurst("thread");
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
                              <span className="shrink-0">{renderPortalContactBadge(conversation)}</span>
                            </div>
                            <div className="mt-1 flex min-w-0 items-center justify-between gap-2">
                              <span className={cn("min-w-0 truncate text-sm", conversation.unreadCount > 0 ? "font-semibold" : "font-normal")}>{conversation.subject}</span>
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

        <Card className={cn("relative min-h-[520px] overflow-hidden", !mobileThreadOpen && "hidden lg:block")}>
          <NavigationSparkleBurst active={sparkleEnabled && navigationBurst?.target === "thread"} burstId={navigationBurst?.id} label="Thread" />
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
                      <span className="shrink-0 font-medium text-foreground">Kanal: {selectedChannelLabel}</span>
                      <span className="shrink-0">·</span>
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
                        label: selectedDialogIsOrgTeam ? "Orga-Team" : selectedDialogParticipant.user.name || selectedDialogParticipant.user.email,
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
                        { key: "channel", label: "Kanal", value: selectedChannelLabel },
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
                <div className="space-y-2">
                  {selected.status === "CLOSED" && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                      Eine Antwort öffnet diesen Thread automatisch wieder.
                    </div>
                  )}
                  <Textarea
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    rows={2}
                    placeholder="Antwort schreiben..."
                    className="min-h-20 resize-none"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-xs text-muted-foreground">Antwortet als {replySenderLabel}</span>
                    <Button type="button" disabled={sending || reply.trim().length < 2} onClick={sendReply}>
                      <Send className="mr-2 h-4 w-4" />
                      Antwort senden
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>

      <Dialog open={contexts.length > 0 && composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent id="new-message-composer" className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
          <NavigationSparkleBurst active={sparkleEnabled && navigationBurst?.target === "composer"} burstId={navigationBurst?.id} label="Composer" />
          <DialogHeader className="space-y-2 pr-8">
            <DialogTitle>Neue Nachricht an das Orga-Team</DialogTitle>
            <DialogDescription>Der Nachrichtentext wird nicht per Mail weitergeleitet, sondern bleibt im Portal.</DialogDescription>
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
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Betreff</label>
              <Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="z. B. Frage zur Anmeldung" />
            </div>
            <Textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={4}
              placeholder="Nachricht an das Orga-Team..."
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={sending} onClick={() => setComposeOpen(false)}>
              Abbrechen
            </Button>
            <Button type="button" disabled={sending || body.trim().length < 2} onClick={createThread}>
              <Send className="mr-2 h-4 w-4" />
              Nachricht senden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
