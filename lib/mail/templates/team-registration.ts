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
        ${input.claimUrl ? `<p><a href="${input.claimUrl}" style="display:inline-block;padding:10px 16px;background:#dc2626;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">Daten mit Login bearbeiten</a></p><p style="font-size:14px;color:#555;">Der Link öffnet den Bearbeitungsflow. Änderungen selbst erfordern eine Anmeldung über Authentik.</p>` : ""}
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
      ...(input.claimUrl ? ["", `Daten mit Login bearbeiten: ${input.claimUrl}`, "Der Link öffnet den Bearbeitungsflow. Änderungen selbst erfordern eine Anmeldung über Authentik."] : []),
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
