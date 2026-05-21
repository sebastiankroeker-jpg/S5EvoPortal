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
const paymentDetailsLines = [
  "Bitte überweisen Sie die Startgebühr auf folgendes Konto:",
  "ESV Bad Bayersoien e. V.",
  "IBAN: DE76 7035 1030 0000 1022 77",
  "Verwendungszweck: Mannschaftsnamen angeben",
];
const registrantCompetitionLabel = "33. Bayersoier Fünfkampf für Mannschaften am 24. & 25. Juli 2026";

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

function shirtSizeLine(participant: MailParticipant) {
  const shirtSize = participant.shirtSize ? shirtLabels[participant.shirtSize] || participant.shirtSize : "Keine Angabe";
  return `${participant.firstName} ${participant.lastName}: ${shirtSize}`;
}

function participantRow(participant: MailParticipant) {
  const discipline = disciplineLabels[participant.disciplineCode || "TBD"] || participant.disciplineCode || "Offen";
  const shirtSize = participant.shirtSize ? shirtLabels[participant.shirtSize] || participant.shirtSize : "Keine Angabe";
  const birthYear = participant.birthYear ? `Jg. ${participant.birthYear}` : "Jg. –";

  return `
    <tr>
      <td style="padding:8px;border:1px solid #e5e7eb;vertical-align:top;">${participant.firstName} ${participant.lastName}</td>
      <td style="padding:8px;border:1px solid #e5e7eb;vertical-align:top;">${birthYear}</td>
      <td style="padding:8px;border:1px solid #e5e7eb;vertical-align:top;">${discipline}</td>
      <td style="padding:8px;border:1px solid #e5e7eb;vertical-align:top;"><strong>${shirtSize}</strong></td>
    </tr>
  `.trim();
}

function participantTableHtml(participants: MailParticipant[]) {
  return `
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <thead>
        <tr style="background:#f9fafb;">
          <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">Name</th>
          <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">Jahrgang</th>
          <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">Disziplin</th>
          <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">T-Shirt</th>
        </tr>
      </thead>
      <tbody>
        ${participants.map((participant) => participantRow(participant)).join("")}
      </tbody>
    </table>
  `.trim();
}

function shirtSizeListHtml(participants: MailParticipant[]) {
  return participants
    .map((participant) => `<li>${shirtSizeLine(participant)}</li>`)
    .join("");
}

function shirtSizeListText(participants: MailParticipant[]) {
  return participants.map((participant) => `- ${shirtSizeLine(participant)}`).join("\n");
}

function paymentDetailsHtml() {
  return `
    <div style="margin:20px 0;padding:16px;border:1px solid #e5e7eb;border-radius:12px;background:#f9fafb;">
      <p style="margin:0 0 10px 0;"><strong>Startgebühr überweisen</strong></p>
      <p style="margin:0 0 6px 0;">Bitte überweisen Sie die Startgebühr auf folgendes Konto:</p>
      <p style="margin:0 0 6px 0;"><strong>ESV Bad Bayersoien e. V.</strong></p>
      <p style="margin:0 0 6px 0;"><strong>IBAN:</strong> DE76 7035 1030 0000 1022 77</p>
      <p style="margin:0;"><strong>Verwendungszweck:</strong> Mannschaftsnamen angeben</p>
    </div>
  `.trim();
}

function paymentDetailsText() {
  return paymentDetailsLines.join("\n");
}

export function buildRegistrantConfirmationMail(input: TemplateInput) {
  const subject = `Soier 5kampf Anmeldung erhalten: ${input.teamName}`;

  return {
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111;">
        <h2>Danke, deine Anmeldung ist eingegangen.</h2>
        <p>Hallo ${input.contactName || "Team"},</p>
        <p>wir haben die Anmeldung für <strong>${input.teamName}</strong> zum <strong>${registrantCompetitionLabel}</strong> erhalten.</p>
        <p><strong>Klasse:</strong> ${input.classificationCode}</p>
        <p><strong>Kontakt:</strong> ${input.contactName} (${input.contactEmail})</p>
        <h3>Teilnehmer</h3>
        ${participantTableHtml(input.participants)}
        <p><strong>Wichtig:</strong> Die Anmeldung ist erst mit Überweisung der Teilnahmegebühr gültig.</p>
        ${paymentDetailsHtml()}
        ${input.claimUrl ? `<div style="margin:20px 0;padding:16px;border:1px solid #e5e7eb;border-radius:12px;background:#f9fafb;"><p style="margin:0 0 10px 0;"><strong>Bei Änderungen zur Mannschaft</strong></p><ol style="margin:0 0 14px 18px;padding:0;"><li>Öffne den Link. Dieser ist vertraulich und kann nur mit der E-Mail-Adresse aus Punkt 2 verwendet werden.</li><li>Erstelle mit <strong>${input.contactEmail}</strong> ein Konto im Portal und melde dich dort mit dieser an.</li><li>Danach ist das Team deinem Konto zugeordnet.</li><li>Änderungen innerhalb der Mannschaft können dort bis zum Anmeldeschluss vorgenommen werden.</li></ol><p style="margin:0 0 14px 0;"><a href="${input.claimUrl}" style="display:inline-block;padding:10px 16px;background:#bbf7d0;color:#166534;text-decoration:none;border-radius:8px;font-weight:bold;border:1px solid #86efac;">Mannschaft im Portal bearbeiten</a></p><p style="margin:0 0 10px 0;font-size:14px;color:#555;">Wichtig: Alle Portal-Funktionen sind aktuell noch Beta. Einige Bereiche werden noch weiterentwickelt und sind noch nicht komplett abgeschlossen.</p><p style="margin:0;font-size:14px;color:#555;">Wenn etwas nicht sofort klappt, prüfe bitte auch Spam/Werbung und nutze dieselbe E-Mail-Adresse wie bei dieser Anmeldung. Falls du Unterstützung brauchst, melde dich einfach bei uns.</p></div>` : ""}
        <p>Viele Grüße<br />${input.tenantName}</p>
      </div>
    `.trim(),
    text: [
      `Hallo ${input.contactName || "Team"},`,
      "",
      `wir haben die Anmeldung für ${input.teamName} zum ${registrantCompetitionLabel} erhalten.`,
      `Klasse: ${input.classificationCode}`,
      `Kontakt: ${input.contactName} (${input.contactEmail})`,
      "",
      "Teilnehmer:",
      participantListText(input.participants),
      "",
      "Wichtig: Die Anmeldung ist erst mit Überweisung der Teilnahmegebühr gültig.",
      paymentDetailsText(),
      ...(input.claimUrl
        ? [
            "",
            "Bei Änderungen zur Mannschaft:",
            `1. Öffne den Link. Dieser ist vertraulich und kann nur mit der E-Mail-Adresse aus Punkt 2 verwendet werden: ${input.claimUrl}`,
            `2. Erstelle mit ${input.contactEmail} ein Konto im Portal und melde dich dort mit dieser an.`,
            "3. Danach ist das Team deinem Konto zugeordnet.",
            "4. Änderungen innerhalb der Mannschaft können dort bis zum Anmeldeschluss vorgenommen werden.",
            "Wichtig: Alle Portal-Funktionen sind aktuell noch Beta. Einige Bereiche werden noch weiterentwickelt und sind noch nicht komplett abgeschlossen.",
            "Wenn etwas nicht sofort klappt, prüfe bitte auch Spam/Werbung und nutze dieselbe E-Mail-Adresse wie bei dieser Anmeldung. Falls du Unterstützung brauchst, melde dich einfach bei uns.",
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
        ${participantTableHtml(input.participants)}
        <h3>T-Shirt-Größen</h3>
        <ul>${shirtSizeListHtml(input.participants)}</ul>
        ${input.claimUrl ? `<div style="margin:20px 0;padding:16px;border:1px solid #e5e7eb;border-radius:12px;background:#f9fafb;"><p style="margin:0 0 10px 0;"><strong>Claim-Link für Supportfälle</strong></p><p style="margin:0 0 8px 0;">Der Link ordnet die bestehende Anmeldung dem Portal-Konto mit <strong>${input.contactEmail}</strong> zu.</p><p style="margin:0;word-break:break-all;"><a href="${input.claimUrl}" style="color:#dc2626;text-decoration:none;">${input.claimUrl}</a></p></div>` : ""}
        <p><strong>Hinweis:</strong> Die Anmeldung ist erst mit Überweisung der Teilnahmegebühr gültig.</p>
        ${paymentDetailsHtml()}
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
      "",
      "T-Shirt-Größen:",
      shirtSizeListText(input.participants),
      ...(input.claimUrl
        ? [
            "",
            "Claim-Link für Supportfälle:",
            `- Vorgesehene E-Mail: ${input.contactEmail}`,
            `- Link: ${input.claimUrl}`,
          ]
        : []),
      "",
      "Hinweis: Die Anmeldung ist erst mit Überweisung der Teilnahmegebühr gültig.",
      paymentDetailsText(),
    ].join("\n"),
  };
}
