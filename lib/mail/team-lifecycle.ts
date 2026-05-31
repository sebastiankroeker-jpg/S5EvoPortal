import { buildPortalHomeUrl } from "@/lib/registration-claim";
import { sendResendMail } from "@/lib/mail/resend";
import { resolveRegistrationNotificationEmail } from "@/lib/mail/team-registration";

type TeamLifecycleCompetition = {
  name: string;
  year: number;
  registrationNotificationEmail?: string | null;
  tenant?: {
    name: string;
    contactEmail?: string | null;
  } | null;
};

type TeamLifecycleActor = {
  name?: string | null;
  email?: string | null;
};

type TeamLifecyclePayload = {
  action: "deleted" | "restored";
  competition: TeamLifecycleCompetition;
  team: {
    name: string;
    ownerEmail?: string | null;
    contactEmail?: string | null;
    participantCount: number;
    linkedParticipantCount?: number;
  };
  actor: TeamLifecycleActor;
};

export type TeamLifecycleMailResult =
  | {
      status: "sent";
      recipients: string[];
      subject: string;
    }
  | {
      status: "skipped";
      recipients: string[];
      subject?: string;
      reason: string;
      missing?: string[];
    };

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatActor(actor: TeamLifecycleActor) {
  if (actor.name && actor.email) return `${actor.name} (${actor.email})`;
  return actor.name || actor.email || "Unbekannt";
}

function buildTeamLifecycleMail(input: TeamLifecyclePayload) {
  const isRestore = input.action === "restored";
  const actionLabel = isRestore ? "wiederhergestellt" : "in den Papierkorb verschoben";
  const subject = `[${input.competition.name}] Mannschaft ${actionLabel}: ${input.team.name}`;
  const portalUrl = `${buildPortalHomeUrl()}/admin?tab=restore`;
  const linkedText =
    typeof input.team.linkedParticipantCount === "number"
      ? `${input.team.linkedParticipantCount} verknuepfte Accounts`
      : "Verknuepfte Accounts nicht ermittelt";

  const rows = [
    ["Mannschaft", input.team.name],
    ["Wettkampf", `${input.competition.name} ${input.competition.year}`],
    ["Aktion", actionLabel],
    ["Ausgefuehrt von", formatActor(input.actor)],
    ["Teilnehmer:innen", `${input.team.participantCount}`],
    ["Accounts", linkedText],
    ["Kontakt", input.team.contactEmail || input.team.ownerEmail || "Nicht hinterlegt"],
  ];

  const rowsHtml = rows
    .map(([label, value]) => `<tr><td style="padding:6px 12px 6px 0;color:#555;">${escapeHtml(label)}</td><td style="padding:6px 0;"><strong>${escapeHtml(value)}</strong></td></tr>`)
    .join("");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111;">
      <h2 style="margin:0 0 12px 0;">Mannschaft ${escapeHtml(actionLabel)}</h2>
      <p style="margin:0 0 16px 0;">Eine Mannschaft wurde im Portal ${escapeHtml(actionLabel)}.</p>
      <table style="border-collapse:collapse;margin:0 0 18px 0;">${rowsHtml}</table>
      <p style="margin:0;"><a href="${escapeHtml(portalUrl)}" style="color:#166534;text-decoration:none;font-weight:bold;">Papierkorb im Portal oeffnen</a></p>
    </div>
  `;

  const text = [
    `Mannschaft ${actionLabel}`,
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    `Papierkorb: ${portalUrl}`,
  ].join("\n");

  return { subject, html, text };
}

export async function sendTeamLifecycleOrgEmail(input: TeamLifecyclePayload) {
  const recipients = resolveRegistrationNotificationEmail(input.competition);

  if (recipients.length === 0) {
    return { status: "skipped" as const, recipients, reason: "missing_org_recipient" };
  }

  const mail = buildTeamLifecycleMail(input);
  const result = await sendResendMail({
    to: recipients,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    replyTo: input.actor.email || process.env.MAIL_REPLY_TO || recipients[0],
  });

  if (result.status === "skipped") {
    return {
      status: "skipped" as const,
      recipients,
      subject: mail.subject,
      reason: result.reason,
      missing: result.missing,
    };
  }

  return {
    status: "sent" as const,
    recipients,
    subject: mail.subject,
  };
}
