import { sendResendMail } from "@/lib/mail/resend";
import {
  buildCompetitionTeamsCsvAttachment,
  loadTeamStartNumbersForCompetition,
  resolveCompetitionExportRecipients,
} from "@/lib/team-csv-export";

type DailyExportCompetition = Parameters<typeof buildCompetitionTeamsCsvAttachment>[0];

export async function sendDailyCompetitionExportEmail(competition: DailyExportCompetition) {
  const recipients = resolveCompetitionExportRecipients(competition);
  if (recipients.length === 0) {
    return {
      status: "skipped" as const,
      reason: "missing_recipients",
    };
  }

  const startNumberByTeamId = await loadTeamStartNumbersForCompetition(competition.id);
  const attachment = buildCompetitionTeamsCsvAttachment(competition, startNumberByTeamId);
  const subject = `S5Evo Tagesexport ${competition.year}: ${competition.name}`;
  const text =
    `Anbei der aktuelle Tagesexport fuer ${competition.name} (${competition.year}).\n\n` +
    `Enthalten sind alle aktuell gespeicherten Mannschafts- und Teilnehmerdaten des offenen Wettkampfs.\n\n` +
    `Teamanzahl: ${competition.teams.length}\n` +
    `Exportzeitpunkt: ${new Date().toISOString()}\n`;
  const html =
    `<p>Anbei der aktuelle Tagesexport fuer <strong>${competition.name} (${competition.year})</strong>.</p>` +
    `<p>Enthalten sind alle aktuell gespeicherten Mannschafts- und Teilnehmerdaten des offenen Wettkampfs.</p>` +
    `<p>Teamanzahl: <strong>${competition.teams.length}</strong><br />` +
    `Exportzeitpunkt: <code>${new Date().toISOString()}</code></p>`;

  const result = await sendResendMail({
    to: recipients,
    subject,
    html,
    text,
    replyTo: process.env.MAIL_REPLY_TO || recipients[0] || undefined,
    attachments: [attachment],
  });

  return {
    status: result.status === "sent" ? ("sent" as const) : ("skipped" as const),
    reason: result.status === "sent" ? undefined : result.reason,
    recipients,
    filename: attachment.filename,
  };
}
