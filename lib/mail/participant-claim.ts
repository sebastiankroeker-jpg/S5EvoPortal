import { sendResendMail } from "@/lib/mail/resend";

type ParticipantClaimMailPayload = {
  participantName: string;
  participantEmail: string;
  teamName: string;
  competitionName: string;
  competitionYear: number;
  claimUrl: string;
  orgReplyTo?: string | null;
};

export async function sendParticipantClaimEmail(payload: ParticipantClaimMailPayload) {
  const subject = `Dein Teilnehmer-Zugang für ${payload.competitionName} ${payload.competitionYear}`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
      <p>Hallo ${payload.participantName || "Teilnehmer:in"},</p>
      <p>für <strong>${payload.competitionName} ${payload.competitionYear}</strong> wurde dir ein Teilnehmer-Zugang für das Team <strong>${payload.teamName}</strong> vorbereitet.</p>
      <p>Über diesen Link kannst du deinen Teilnehmer-Datensatz mit deinem Portal-Konto verknüpfen:</p>
      <p><a href="${payload.claimUrl}" style="display:inline-block;padding:10px 16px;background:#dc2626;color:#fff;text-decoration:none;border-radius:8px;">Teilnehmer im Portal verknüpfen</a></p>
      <p style="font-size:14px;color:#555">Wichtig: Bitte nutze dafür dieselbe E-Mail-Adresse wie diese Einladung an <strong>${payload.participantEmail}</strong>.</p>
      <p style="font-size:14px;color:#555">Falls du noch kein Konto hast, kannst du es auf der verlinkten Seite direkt anlegen.</p>
    </div>
  `;
  const text = [
    `Hallo ${payload.participantName || "Teilnehmer:in"},`,
    "",
    `für ${payload.competitionName} ${payload.competitionYear} wurde dir ein Teilnehmer-Zugang für das Team ${payload.teamName} vorbereitet.`,
    "",
    `Link: ${payload.claimUrl}`,
    "",
    `Bitte nutze dieselbe E-Mail-Adresse wie diese Einladung an ${payload.participantEmail}.`,
  ].join("\n");

  return sendResendMail({
    to: payload.participantEmail,
    subject,
    html,
    text,
    replyTo: payload.orgReplyTo || undefined,
  });
}
