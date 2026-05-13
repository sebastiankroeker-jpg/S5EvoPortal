import { DISCIPLINES } from "@/lib/domain/team";
import { SHIRT_SIZES } from "@/lib/domain/shirts";

type MailParticipant = {
  firstName: string;
  lastName: string;
  birthYear?: number | null;
  gender?: string | null;
  disciplineCode?: string | null;
  shirtSize?: string | null;
};

type TemplateInput = {
  competitionName: string;
  competitionYear: number;
  teamName: string;
  classificationCode: string;
  contactName: string;
  contactEmail: string;
  tenantName: string;
  participants: MailParticipant[];
  claimUrl?: string;
};

const disciplineLabels = Object.fromEntries(
  DISCIPLINES.map((discipline) => [discipline.id, `${discipline.icon} ${discipline.label}`]),
);

const shirtLabels = Object.fromEntries(SHIRT_SIZES.map((size) => [size.id, size.label]));

function formatParticipant(participant: MailParticipant) {
  const discipline = disciplineLabels[participant.disciplineCode || "TBD"] || participant.disciplineCode || "Offen";
  const shirtSize = participant.shirtSize ? shirtLabels[participant.shirtSize] || participant.shirtSize : "Keine Angabe";
  const birthYear = participant.birthYear ? `Jg. ${participant.birthYear}` : "Jg. –";
  return `${participant.firstName} ${participant.lastName} (${birthYear}, ${discipline}, T-Shirt: ${shirtSize})`;
}

function participantListHtml(participants: MailParticipant[]) {
  return participants
    .map((participant) => `<li>${formatParticipant(participant)}</li>`)
    .join("");
}

function participantListText(participants: MailParticipant[]) {
  return participants.map((participant) => `- ${formatParticipant(participant)}`).join("\n");
}

export function buildRegistrantConfirmationMail(input: TemplateInput) {
  const subject = `Anmeldung erhalten: ${input.teamName} (${input.competitionYear})`;

  return {
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111;">
        <h2>Danke, deine Anmeldung ist eingegangen.</h2>
        <p>Hallo ${input.contactName || "Team"},</p>
        <p>wir haben die Anmeldung für <strong>${input.teamName}</strong> zum Wettkampf <strong>${input.competitionName}</strong> erhalten.</p>
        <p><strong>Klasse:</strong> ${input.classificationCode}</p>
        <p><strong>Kontakt:</strong> ${input.contactName} (${input.contactEmail})</p>
        <h3>Teilnehmer</h3>
        <ul>${participantListHtml(input.participants)}</ul>
        ${input.claimUrl ? `<div style="margin:20px 0;padding:16px;border:1px solid #e5e7eb;border-radius:12px;background:#f9fafb;"><p style="margin:0 0 10px 0;"><strong>So geht's weiter</strong></p><ol style="margin:0 0 14px 18px;padding:0;"><li>Öffne den Claim-Link.</li><li>Melde dich dort mit <strong>${input.contactEmail}</strong> über Authentik an.</li><li>Danach ist das Team deinem Account zugeordnet und du kannst Änderungen im Portal machen.</li></ol><p style="margin:0 0 14px 0;"><a href="${input.claimUrl}" style="display:inline-block;padding:10px 16px;background:#dc2626;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">Team mit Authentik-Konto übernehmen</a></p><p style="margin:0;font-size:14px;color:#555;">Falls die Anmeldung oder der Login nicht sofort klappt, prüfe bitte auch Spam/Werbung und nutze dieselbe E-Mail-Adresse wie bei dieser Anmeldung.</p></div>` : ""}
        <p>Viele Grüße<br />${input.tenantName}</p>
      </div>
    `.trim(),
    text: [
      `Hallo ${input.contactName || "Team"},`,
      "",
      `wir haben die Anmeldung für ${input.teamName} zum Wettkampf ${input.competitionName} erhalten.`,
      `Klasse: ${input.classificationCode}`,
      `Kontakt: ${input.contactName} (${input.contactEmail})`,
      "",
      "Teilnehmer:",
      participantListText(input.participants),
      ...(input.claimUrl
        ? [
            "",
            "So geht's weiter:",
            `1. Claim-Link öffnen: ${input.claimUrl}`,
            `2. Mit ${input.contactEmail} über Authentik anmelden`,
            "3. Danach ist das Team deinem Account zugeordnet und du kannst Änderungen im Portal machen.",
            "Wenn nichts ankommt oder etwas hakt, prüfe bitte auch Spam/Werbung und nutze dieselbe E-Mail-Adresse wie bei dieser Anmeldung.",
          ]
        : []),
      "",
      `Viele Grüße\n${input.tenantName}`,
    ].join("\n"),
  };
}

export function buildOrgNotificationMail(input: TemplateInput) {
  const subject = `Neue Anmeldung: ${input.teamName} (${input.competitionYear})`;

  return {
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111;">
        <h2>Neue Mannschaftsanmeldung</h2>
        <p><strong>Wettkampf:</strong> ${input.competitionName}</p>
        <p><strong>Team:</strong> ${input.teamName}</p>
        <p><strong>Klasse:</strong> ${input.classificationCode}</p>
        <p><strong>Kontakt:</strong> ${input.contactName} (${input.contactEmail})</p>
        <h3>Teilnehmer</h3>
        <ul>${participantListHtml(input.participants)}</ul>
      </div>
    `.trim(),
    text: [
      "Neue Mannschaftsanmeldung",
      "",
      `Wettkampf: ${input.competitionName}`,
      `Team: ${input.teamName}`,
      `Klasse: ${input.classificationCode}`,
      `Kontakt: ${input.contactName} (${input.contactEmail})`,
      "",
      "Teilnehmer:",
      participantListText(input.participants),
    ].join("\n"),
  };
}
