"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { MessageCircle, RefreshCw, Send } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

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
    user: { id: string; name: string | null; email: string };
  }>;
  lastMessage: {
    id: string;
    bodyPreview: string;
    createdAt: string;
    sender: { id: string; name: string | null; email: string };
  } | null;
  messages: Array<{
    id: string;
    body: string | null;
    bodyPreview: string | null;
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

function senderLabel(sender: { name: string | null; email: string }) {
  return sender.name || sender.email;
}

export default function MessageCenter() {
  const [mode, setMode] = useState<"mine" | "admin">("mine");
  const [statusFilter, setStatusFilter] = useState("all");
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [contexts, setContexts] = useState<SupportContext[]>([]);
  const [canManageSupport, setCanManageSupport] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [contextId, setContextId] = useState("");
  const [reply, setReply] = useState("");
  const [adminComposeTarget, setAdminComposeTarget] = useState<AdminComposeTarget | null>(null);
  const [adminSubject, setAdminSubject] = useState("Nachricht vom Admin-Team");
  const [adminBody, setAdminBody] = useState("");

  const selected = conversations.find((conversation) => conversation.id === selectedId) ?? conversations[0] ?? null;
  const adminTargetLabel = adminComposeTarget?.name || adminComposeTarget?.email || "Zielperson";

  const filteredConversations = useMemo(() => {
    return conversations.filter((conversation) => statusFilter === "all" || conversation.status === statusFilter);
  }, [conversations, statusFilter]);

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
      setConversations(entries);
      setSelectedId((current) => (current && entries.some((entry: ConversationSummary) => entry.id === current) ? current : entries[0]?.id ?? null));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nachrichten konnten nicht geladen werden");
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [mode]);

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
    setMode(nextMode);
    setSelectedId(null);
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
      setMode("mine");
      await loadConversations("mine");
      if (data.conversation?.id) setSelectedId(data.conversation.id);
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
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Nachricht konnte nicht gesendet werden");
      setAdminBody("");
      setAdminSubject("Nachricht vom Admin-Team");
      setAdminComposeTarget(null);
      window.history.replaceState({}, "", "/nachrichten");
      setMode("admin");
      await loadConversations("admin");
      if (data.conversation?.id) setSelectedId(data.conversation.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nachricht konnte nicht gesendet werden");
    } finally {
      setSending(false);
    }
  };

  const cancelAdminCompose = () => {
    setAdminComposeTarget(null);
    setAdminBody("");
    setAdminSubject("Nachricht vom Admin-Team");
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
        body: JSON.stringify({ body: reply }),
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/80 p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Nachrichten</h2>
          </div>
          <p className="text-sm text-muted-foreground">Support-Threads mit dem Admin-Team. Nachrichten bleiben im Portal nachvollziehbar.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant={mode === "mine" ? "default" : "outline"} onClick={() => switchMode("mine")}>
            Meine Threads
          </Button>
          {canManageSupport && (
            <Button type="button" size="sm" variant={mode === "admin" ? "default" : "outline"} onClick={() => switchMode("admin")}>
              Admin-Inbox
            </Button>
          )}
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
          <CardHeader>
            <CardTitle className="text-base">Nachricht an {adminTargetLabel}</CardTitle>
            <CardDescription>
              Admin-Nachricht als Support-Thread. Der Nachrichtentext wird nicht per Mail weitergeleitet.
            </CardDescription>
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

      <div className="grid gap-4 lg:grid-cols-[minmax(260px,340px)_1fr]">
        <Card className="overflow-hidden">
          <CardHeader className="space-y-3">
            <div>
              <CardTitle className="text-base">{mode === "admin" ? "Admin-Inbox" : "Meine Unterhaltungen"}</CardTitle>
              <CardDescription>{filteredConversations.length} Threads</CardDescription>
            </div>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-9 rounded-md border border-border bg-background px-2 text-sm"
            >
              <option value="all">Alle Status</option>
              <option value="WAITING_FOR_ADMIN">Wartet auf Admin</option>
              <option value="WAITING_FOR_USER">Wartet auf Teilnehmer:in</option>
              <option value="OPEN">Offen</option>
              <option value="CLOSED">Geschlossen</option>
            </select>
          </CardHeader>
          <CardContent className="space-y-2 p-3 pt-0">
            {loading ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">Lade Nachrichten...</div>
            ) : filteredConversations.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">Keine passenden Threads vorhanden.</div>
            ) : (
              filteredConversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => setSelectedId(conversation.id)}
                  className={cn(
                    "w-full rounded-lg border p-3 text-left transition-colors hover:bg-accent/60",
                    selected?.id === conversation.id ? "border-primary bg-primary/10" : "border-border/60 bg-background/60",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-1 text-sm font-semibold">{conversation.subject}</p>
                    {conversation.unreadCount > 0 && <Badge className="shrink-0">{conversation.unreadCount}</Badge>}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className={statusClassName(conversation.status)}>
                      {statusLabel(conversation.status)}
                    </Badge>
                    {conversation.context.team && <Badge variant="secondary">{conversation.context.team.name}</Badge>}
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                    {conversation.lastMessage?.bodyPreview || "Noch keine Nachricht"}
                  </p>
                  <p className="mt-2 text-[11px] text-muted-foreground">{formatDateTime(conversation.lastMessageAt || conversation.updatedAt)}</p>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="min-h-[520px]">
          {!selected ? (
            <CardContent className="flex min-h-[420px] items-center justify-center text-center text-sm text-muted-foreground">
              Wähle einen Thread aus oder starte eine neue Nachricht.
            </CardContent>
          ) : (
            <>
              <CardHeader className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle className="text-lg">{selected.subject}</CardTitle>
                    <CardDescription>
                      {selected.context.participant
                        ? `${selected.context.participant.firstName} ${selected.context.participant.lastName}`
                        : "Support-Thread"}
                      {selected.context.team ? ` · ${selected.context.team.name}` : ""}
                      {selected.context.competition ? ` · ${selected.context.competition.name} ${selected.context.competition.year}` : ""}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className={statusClassName(selected.status)}>
                      {statusLabel(selected.status)}
                    </Badge>
                    {mode === "admin" && selected.status !== "CLOSED" && (
                      <Button type="button" size="sm" variant="outline" disabled={sending} onClick={() => updateStatus("CLOSED")}>
                        Schließen
                      </Button>
                    )}
                    {mode === "admin" && selected.status === "CLOSED" && (
                      <Button type="button" size="sm" variant="outline" disabled={sending} onClick={() => updateStatus("OPEN")}>
                        Wieder öffnen
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="max-h-[420px] space-y-3 overflow-y-auto rounded-xl border border-border/50 bg-muted/20 p-3">
                  {selected.messages.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Noch keine Nachrichten vorhanden.</div>
                  ) : (
                    selected.messages.map((message) => (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn("flex", message.mine ? "justify-end" : "justify-start")}
                      >
                        <div
                          className={cn(
                            "max-w-[82%] rounded-2xl px-3 py-2 shadow-sm",
                            message.mine
                              ? "bg-primary text-primary-foreground"
                              : "border border-border/60 bg-background text-foreground",
                          )}
                        >
                          <div className={cn("mb-1 text-[11px]", message.mine ? "text-primary-foreground/75" : "text-muted-foreground")}>
                            {senderLabel(message.sender)} · {formatDateTime(message.createdAt)}
                          </div>
                          <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.body}</p>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>

                {selected.status === "CLOSED" && mode !== "admin" ? (
                  <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    Dieser Thread ist geschlossen. Das Admin-Team kann ihn bei Bedarf wieder öffnen.
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Textarea
                      value={reply}
                      onChange={(event) => setReply(event.target.value)}
                      rows={4}
                      placeholder="Antwort schreiben..."
                    />
                    <div className="flex justify-end">
                      <Button type="button" disabled={sending || reply.trim().length < 2} onClick={sendReply}>
                        <Send className="mr-2 h-4 w-4" />
                        Antwort senden
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </>
          )}
        </Card>
      </div>

      {contexts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Neue Nachricht an das Admin-Team</CardTitle>
            <CardDescription>Der Nachrichtentext wird nicht per Mail weitergeleitet, sondern bleibt im Portal.</CardDescription>
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
              placeholder="Nachricht an das Admin-Team..."
            />
            <div className="flex justify-end">
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
