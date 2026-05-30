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
  const subject = "Dein Teilnehmer-Zugang zum S5Evo Portal";
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
      <p>Hallo ${payload.participantName || "Teilnehmer:in"},</p>
      <p>Du bist zum <strong>${payload.competitionName} ${payload.competitionYear}</strong> im Team <strong>${payload.teamName}</strong> angemeldet worden.</p>
      <p>Über diesen Link verknüpfst du deinen Teilnehmer-Eintrag mit deinem S5Evo Portal-Konto:</p>
      <p><a href="${payload.claimUrl}" style="display:inline-block;padding:10px 16px;background:#bbf7d0;color:#166534;text-decoration:none;border-radius:8px;font-weight:bold;border:1px solid #86efac;">Zugang öffnen</a></p>
      <p style="font-size:14px;color:#555">Melde dich dort mit <strong>${payload.participantEmail}</strong> an. Wenn du mit dieser E-Mail schon ein Konto hast, nutze einfach dieses Konto. Falls nicht, kannst du im selben Schritt ein neues Konto anlegen.</p>
    </div>
  `;
  const text = [
    `Hallo ${payload.participantName || "Teilnehmer:in"},`,
    "",
    `Du bist zum ${payload.competitionName} ${payload.competitionYear} im Team ${payload.teamName} angemeldet worden.`,
    "",
    "Über diesen Link verknüpfst du deinen Teilnehmer-Eintrag mit deinem S5Evo Portal-Konto:",
    payload.claimUrl,
    "",
    `Melde dich dort mit ${payload.participantEmail} an. Wenn du mit dieser E-Mail schon ein Konto hast, nutze einfach dieses Konto. Falls nicht, kannst du im selben Schritt ein neues Konto anlegen.`,
  ].join("\n");

  return sendResendMail({
    to: payload.participantEmail,
    subject,
    html,
    text,
    replyTo: payload.orgReplyTo || undefined,
  });
}
