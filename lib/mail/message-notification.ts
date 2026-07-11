import { sendResendMail } from "@/lib/mail/resend";

type MessageNotificationPayload = {
  to: string[];
  subject: string;
  conversationSubject: string;
  actorName: string;
};

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

export async function sendMessageNotificationEmail(payload: MessageNotificationPayload) {
  const recipients = [...new Set(payload.to.map((entry) => entry.trim()).filter(Boolean))];
  if (recipients.length === 0) {
    return { status: "skipped" as const, reason: "no_recipients" };
  }

  const portalUrl = `${getPortalUrl()}/nachrichten`;
  const escapedSubject = escapeHtml(payload.conversationSubject);
  const escapedActor = escapeHtml(payload.actorName);

  await sendResendMail({
    to: recipients,
    subject: payload.subject,
    html: [
      "<p>Im S5Evo-Portal gibt es eine neue Nachricht.</p>",
      `<p><strong>Thread:</strong> ${escapedSubject}</p>`,
      `<p><strong>Von:</strong> ${escapedActor}</p>`,
      `<p><a href="${portalUrl}">Nachrichten im Portal öffnen</a></p>`,
      "<p style=\"font-size:13px;color:#666\">Der Nachrichtentext wird aus Datenschutzgründen nicht per E-Mail versendet.</p>",
    ].join(""),
    text: [
      "Im S5Evo-Portal gibt es eine neue Nachricht.",
      `Thread: ${payload.conversationSubject}`,
      `Von: ${payload.actorName}`,
      `Nachrichten öffnen: ${portalUrl}`,
      "",
      "Der Nachrichtentext wird aus Datenschutzgründen nicht per E-Mail versendet.",
    ].join("\n"),
  });

  return { status: "sent" as const, recipients };
}
