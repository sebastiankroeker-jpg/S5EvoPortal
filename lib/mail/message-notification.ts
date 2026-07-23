import { ConsentCategory } from "@prisma/client";

import { sendResendMail } from "@/lib/mail/resend";
import { prisma } from "@/lib/prisma";

type MessageNotificationPayload = {
  to: string[];
  subject: string;
  conversationSubject: string;
  actorName: string;
  messages?: MessageNotificationEntry[];
};

type MessageNotificationEntry = {
  id: string;
  body: string | null;
  bodyPreview?: string | null;
  createdAt: Date | string;
  senderDisplayName: string;
  isCurrent?: boolean;
};

const MAX_DIALOG_MESSAGES = 8;

function getPortalUrl() {
  const baseUrl =
    process.env.NEXTAUTH_URL ||
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  return baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`;
}

function escapeHtml(value: string) {
  const replacements: Record<string, string> = {
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    '"': "&quot;",
  };
  return value.replace(/[<>&"]/g, (char) => replacements[char] || char);
}

function formatMailDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function renderMessageBodyHtml(body: string) {
  return escapeHtml(body)
    .split("\n")
    .map((line) => line || "&nbsp;")
    .join("<br>");
}

function normalizeMailMessageBody(entry: MessageNotificationEntry) {
  return (entry.body || entry.bodyPreview || "").trim();
}

function getDialogMessages(messages: MessageNotificationEntry[] | undefined) {
  const normalized = (messages || [])
    .map((entry) => ({
      ...entry,
      body: normalizeMailMessageBody(entry),
      senderDisplayName: entry.senderDisplayName.trim() || "Kontakt",
    }))
    .filter((entry) => entry.body);

  return normalized.slice(-MAX_DIALOG_MESSAGES);
}

function renderDialogHtml(messages: ReturnType<typeof getDialogMessages>) {
  if (messages.length === 0) {
    return "";
  }

  return [
    "<div style=\"margin:28px 0 0\">",
    "<div style=\"font-size:13px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#64748b;margin:0 0 10px\">Bisheriger Dialog</div>",
    ...messages.map((message, index) => {
      const isCurrent = message.isCurrent || index === messages.length - 1;
      const accent = isCurrent ? "#0f766e" : "#cbd5e1";
      const background = isCurrent ? "#ecfdf5" : "#f8fafc";
      const border = isCurrent ? "#99f6e4" : "#e2e8f0";
      const label = isCurrent ? "Aktuelle Antwort" : escapeHtml(message.senderDisplayName);
      const date = formatMailDate(message.createdAt);

      return [
        `<div style="border:1px solid ${border};border-left:4px solid ${accent};background:${background};border-radius:14px;padding:14px 15px;margin:0 0 10px">`,
        "<div style=\"display:block;margin:0 0 8px;font-size:12px;color:#64748b\">",
        `<strong style="color:#0f172a">${label}</strong>`,
        date ? `<span style="float:right;color:#94a3b8">${escapeHtml(date)}</span>` : "",
        "</div>",
        `<div style="font-size:15px;line-height:1.55;color:#111827">${renderMessageBodyHtml(message.body || "")}</div>`,
        "</div>",
      ].join("");
    }),
    "</div>",
  ].join("");
}

function renderDialogText(messages: ReturnType<typeof getDialogMessages>) {
  if (messages.length === 0) return "";
  return [
    "Bisheriger Dialog:",
    ...messages.map((message, index) => {
      const isCurrent = message.isCurrent || index === messages.length - 1;
      const label = isCurrent ? "Aktuelle Antwort" : message.senderDisplayName;
      const date = formatMailDate(message.createdAt);
      return [`${label}${date ? ` (${date})` : ""}:`, message.body || ""].join("\n");
    }),
  ].join("\n\n");
}

export async function sendMessageNotificationEmail(payload: MessageNotificationPayload) {
  const recipients = [...new Set(payload.to.map((entry) => entry.trim()).filter(Boolean))];
  if (recipients.length === 0) {
    return { status: "skipped" as const, reason: "no_recipients" };
  }

  const consentedUsers = await prisma.user.findMany({
    where: {
      deletedAt: null,
      email: { in: recipients, mode: "insensitive" },
      consentPreferences: {
        some: {
          category: ConsentCategory.PORTAL_MESSAGE_EMAIL,
          granted: true,
        },
      },
    },
    select: { email: true },
  });
  const consentedEmails = new Set(consentedUsers.map((user) => user.email.trim().toLowerCase()));
  const optedInRecipients = recipients.filter((recipient) => consentedEmails.has(recipient.toLowerCase()));

  if (optedInRecipients.length === 0) {
    return { status: "skipped" as const, reason: "missing_portal_message_email_consent" };
  }

  const portalUrl = `${getPortalUrl()}/nachrichten`;
  const escapedSubject = escapeHtml(payload.conversationSubject);
  const escapedActor = escapeHtml(payload.actorName);
  const dialogMessages = getDialogMessages(payload.messages);
  const currentMessage = dialogMessages[dialogMessages.length - 1] ?? null;
  const previousMessages = currentMessage ? dialogMessages.slice(0, -1) : dialogMessages;
  const escapedPortalUrl = escapeHtml(portalUrl);

  await sendResendMail({
    to: optedInRecipients,
    subject: payload.subject,
    html: [
      "<div style=\"margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a\">",
      "<div style=\"max-width:680px;margin:0 auto;padding:24px 12px\">",
      "<div style=\"background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,.08)\">",
      "<div style=\"padding:22px 22px 18px;background:#0f172a;color:#ffffff\">",
      "<div style=\"font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#99f6e4;margin:0 0 8px\">S5Evo-Portal</div>",
      "<div style=\"font-size:22px;line-height:1.25;font-weight:700;margin:0\">Neue Nachricht</div>",
      "</div>",
      "<div style=\"padding:22px\">",
      "<p style=\"margin:0 0 14px;font-size:16px;line-height:1.55;color:#334155\">Im S5Evo-Portal gibt es eine neue Antwort in deinem Nachrichten-Thread.</p>",
      "<div style=\"border:1px solid #e2e8f0;background:#f8fafc;border-radius:14px;padding:14px 15px;margin:0 0 18px\">",
      `<div style="font-size:13px;color:#64748b;margin:0 0 6px">Thread</div><div style="font-size:17px;font-weight:700;color:#0f172a">${escapedSubject}</div>`,
      `<div style="font-size:13px;color:#64748b;margin:12px 0 4px">Von</div><div style="font-size:15px;font-weight:700;color:#0f172a">${escapedActor}</div>`,
      "</div>",
      currentMessage
        ? [
            "<div style=\"border:1px solid #99f6e4;background:#ecfdf5;border-radius:16px;padding:16px;margin:0 0 18px\">",
            "<div style=\"font-size:13px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#0f766e;margin:0 0 9px\">Aktuelle Antwort</div>",
            `<div style="font-size:16px;line-height:1.6;color:#0f172a">${renderMessageBodyHtml(currentMessage.body || "")}</div>`,
            "</div>",
          ].join("")
        : "",
      renderDialogHtml(previousMessages),
      `<div style="margin:24px 0 0"><a href="${escapedPortalUrl}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;font-weight:700;border-radius:999px;padding:12px 18px">Im Portal antworten</a></div>`,
      "<p style=\"margin:18px 0 0;font-size:12px;line-height:1.5;color:#64748b\">Diese E-Mail enthaelt nur den Dialogauszug dieses Threads. Vollstaendige Historie, Status und Antworten bleiben im Portal.</p>",
      "</div>",
      "</div>",
      "</div>",
      "</div>",
    ].join(""),
    text: [
      "Im S5Evo-Portal gibt es eine neue Nachricht.",
      `Thread: ${payload.conversationSubject}`,
      `Von: ${payload.actorName}`,
      "",
      currentMessage ? ["Aktuelle Antwort:", currentMessage.body || "", ""].join("\n") : "",
      renderDialogText(previousMessages),
      "",
      `Im Portal antworten: ${portalUrl}`,
      "",
      "Diese E-Mail enthaelt nur den Dialogauszug dieses Threads. Vollstaendige Historie, Status und Antworten bleiben im Portal.",
    ].join("\n"),
  });

  return { status: "sent" as const, recipients: optedInRecipients };
}
