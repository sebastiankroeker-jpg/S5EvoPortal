import { prisma } from "@/lib/prisma";
import { getTenantRoleFlagsForUserId } from "@/lib/server-permissions";

const MAX_MESSAGE_LENGTH = 4000;
const MAX_SUBJECT_LENGTH = 120;

export type SupportContext =
  | {
      type: "participant";
      id: string;
      label: string;
      detail: string;
      participantId: string;
      teamId: string;
      competitionId: string;
      tenantId: string;
    }
  | {
      type: "team";
      id: string;
      label: string;
      detail: string;
      teamId: string;
      competitionId: string;
      tenantId: string;
    };

export function normalizeMessageBody(value: unknown) {
  if (typeof value !== "string") return "";
  return value.replace(/\r\n/g, "\n").trim().slice(0, MAX_MESSAGE_LENGTH);
}

export function normalizeMessageSubject(value: unknown, fallback = "Nachricht an das Admin-Team") {
  if (typeof value !== "string") return fallback;
  const subject = value.trim().replace(/\s+/g, " ").slice(0, MAX_SUBJECT_LENGTH);
  return subject || fallback;
}

export function buildMessagePreview(body: string) {
  const compact = body.replace(/\s+/g, " ").trim();
  return compact.length > 180 ? `${compact.slice(0, 177)}...` : compact;
}

export async function getSupportContextsForUser(userId: string): Promise<SupportContext[]> {
  const [participants, teams] = await Promise.all([
    prisma.participant.findMany({
      where: {
        deletedAt: null,
        userId,
        team: { deletedAt: null },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        disciplineCode: true,
        team: {
          select: {
            id: true,
            name: true,
            competitionId: true,
            competition: { select: { tenantId: true, name: true, year: true } },
          },
        },
      },
      orderBy: [{ team: { name: "asc" } }, { lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.team.findMany({
      where: {
        deletedAt: null,
        OR: [
          { ownerId: userId },
          { teamChiefId: userId },
          { memberRoles: { some: { userId, role: "TEAM_MANAGER", revokedAt: null } } },
        ],
      },
      select: {
        id: true,
        name: true,
        competitionId: true,
        competition: { select: { tenantId: true, name: true, year: true } },
      },
      orderBy: [{ name: "asc" }],
    }),
  ]);

  const contexts = new Map<string, SupportContext>();

  for (const participant of participants) {
    contexts.set(`participant:${participant.id}`, {
      type: "participant",
      id: participant.id,
      participantId: participant.id,
      teamId: participant.team.id,
      competitionId: participant.team.competitionId,
      tenantId: participant.team.competition.tenantId,
      label: `${participant.firstName} ${participant.lastName}`,
      detail: `${participant.team.name} · ${participant.disciplineCode ?? "Disziplin offen"} · ${participant.team.competition.name} ${participant.team.competition.year}`,
    });
  }

  for (const team of teams) {
    contexts.set(`team:${team.id}`, {
      type: "team",
      id: team.id,
      teamId: team.id,
      competitionId: team.competitionId,
      tenantId: team.competition.tenantId,
      label: team.name,
      detail: `Mannschaft · ${team.competition.name} ${team.competition.year}`,
    });
  }

  return Array.from(contexts.values());
}

export async function getDefaultMessagingTenantId(userId: string) {
  const tenantRole = await prisma.tenantRole.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { tenantId: true },
  });
  if (tenantRole?.tenantId) return tenantRole.tenantId;

  const context = (await getSupportContextsForUser(userId))[0];
  return context?.tenantId ?? null;
}

export async function canManageSupportConversations(userId: string, tenantId: string) {
  const roles = await getTenantRoleFlagsForUserId(userId, tenantId);
  return roles.isAdmin || roles.isModerator;
}

export async function ensureConversationAccess(conversationId: string, userId: string) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, deletedAt: null },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      closedBy: { select: { id: true, name: true, email: true } },
      tenant: { select: { id: true, name: true } },
      competition: { select: { id: true, name: true, year: true } },
      team: { select: { id: true, name: true } },
      participant: { select: { id: true, firstName: true, lastName: true } },
      participants: {
        where: { leftAt: null },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { joinedAt: "asc" },
      },
      messages: {
        where: { deletedAt: null },
        include: { sender: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!conversation) {
    return { conversation: null, access: false, canManage: false, participant: null };
  }

  const participant = conversation.participants.find((entry) => entry.userId === userId && !entry.leftAt) ?? null;
  const canManage = await canManageSupportConversations(userId, conversation.tenantId);
  return {
    conversation,
    access: Boolean(participant || (conversation.type === "SUPPORT" && canManage)),
    canManage,
    participant,
  };
}

export async function upsertConversationParticipant(input: {
  conversationId: string;
  userId: string;
  role: "OWNER" | "MEMBER" | "ADMIN" | "MODERATOR" | "READ_ONLY";
  lastReadAt?: Date | null;
}) {
  return prisma.conversationParticipant.upsert({
    where: {
      conversationId_userId: {
        conversationId: input.conversationId,
        userId: input.userId,
      },
    },
    create: {
      conversationId: input.conversationId,
      userId: input.userId,
      role: input.role,
      lastReadAt: input.lastReadAt ?? null,
    },
    update: {
      role: input.role,
      leftAt: null,
      ...(input.lastReadAt !== undefined ? { lastReadAt: input.lastReadAt } : {}),
    },
  });
}

export function serializeConversation(conversation: Awaited<ReturnType<typeof ensureConversationAccess>>["conversation"], viewerId: string) {
  if (!conversation) return null;
  const viewerParticipant = conversation.participants.find((entry) => entry.userId === viewerId) ?? null;
  const lastReadAt = viewerParticipant?.lastReadAt ?? null;
  const unreadCount = lastReadAt
    ? conversation.messages.filter((message) => message.senderId !== viewerId && message.createdAt > lastReadAt).length
    : conversation.messages.filter((message) => message.senderId !== viewerId).length;
  const lastMessage = conversation.messages[conversation.messages.length - 1] ?? null;

  return {
    id: conversation.id,
    type: conversation.type,
    status: conversation.status,
    subject: conversation.subject,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
    lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
    closedAt: conversation.closedAt?.toISOString() ?? null,
    context: {
      tenant: conversation.tenant,
      competition: conversation.competition,
      team: conversation.team,
      participant: conversation.participant,
    },
    participants: conversation.participants.map((entry) => ({
      id: entry.id,
      role: entry.role,
      lastReadAt: entry.lastReadAt?.toISOString() ?? null,
      user: entry.user,
    })),
    unreadCount,
    lastMessage: lastMessage
      ? {
          id: lastMessage.id,
          bodyPreview: lastMessage.bodyPreview || buildMessagePreview(lastMessage.body || ""),
          createdAt: lastMessage.createdAt.toISOString(),
          sender: lastMessage.sender,
        }
      : null,
    messages: conversation.messages.map((message) => ({
      id: message.id,
      contentFormat: message.contentFormat,
      body: message.body,
      bodyPreview: message.bodyPreview,
      createdAt: message.createdAt.toISOString(),
      senderId: message.senderId,
      sender: message.sender,
      mine: message.senderId === viewerId,
    })),
  };
}
