type ParticipantChangeMailInput = {
  competitionName: string;
  competitionYear: number;
  teamName: string;
  participantName: string;
  requestedByName: string;
  requestedByEmail: string;
  reviewComment?: string | null;
};

export function buildParticipantChangeSubmittedTeamMail(input: ParticipantChangeMailInput) {
  const subject = "Aenderungsanfrage eingegangen: " + input.participantName;
  return {
    subject,
    html:
      '<div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111;">' +
      "<h2>Aenderungsanfrage eingegangen</h2>" +
      "<p>Hallo Team,</p>" +
      "<p>fuer <strong>" + input.participantName + "</strong> wurde eine Aenderungsanfrage zur Mannschaft <strong>" + input.teamName + "</strong> eingereicht.</p>" +
      "<p>Wettkampf: <strong>" + input.competitionName + " " + input.competitionYear + "</strong></p>" +
      "<p>Beantragt von: <strong>" + input.requestedByName + "</strong> (" + input.requestedByEmail + ")</p>" +
      "<p>Die Anfrage liegt jetzt bei der Orga zur Pruefung vor.</p>" +
      "</div>",
    text: [
      "Aenderungsanfrage eingegangen",
      "",
      "fuer " + input.participantName + " wurde eine Aenderungsanfrage zur Mannschaft " + input.teamName + " eingereicht.",
      "Wettkampf: " + input.competitionName + " " + input.competitionYear,
      "Beantragt von: " + input.requestedByName + " (" + input.requestedByEmail + ")",
      "Die Anfrage liegt jetzt bei der Orga zur Pruefung vor.",
    ].join("\\n"),
  };
}

export function buildParticipantChangeSubmittedOrgMail(input: ParticipantChangeMailInput) {
  const subject = "Neue Aenderungsanfrage: " + input.teamName + " / " + input.participantName;
  return {
    subject,
    html:
      '<div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111;">' +
      "<h2>Neue Aenderungsanfrage</h2>" +
      "<p>Teilnehmer: <strong>" + input.participantName + "</strong></p>" +
      "<p>Mannschaft: <strong>" + input.teamName + "</strong></p>" +
      "<p>Wettkampf: <strong>" + input.competitionName + " " + input.competitionYear + "</strong></p>" +
      "<p>Beantragt von: <strong>" + input.requestedByName + "</strong> (" + input.requestedByEmail + ")</p>" +
      "<p>Bitte im Orga-Bereich pruefen und entscheiden.</p>" +
      "</div>",
    text: [
      "Neue Aenderungsanfrage",
      "",
      "Teilnehmer: " + input.participantName,
      "Mannschaft: " + input.teamName,
      "Wettkampf: " + input.competitionName + " " + input.competitionYear,
      "Beantragt von: " + input.requestedByName + " (" + input.requestedByEmail + ")",
      "Bitte im Orga-Bereich pruefen und entscheiden.",
    ].join("\\n"),
  };
}

export function buildParticipantChangeDecisionMail(
  input: ParticipantChangeMailInput & { approved: boolean },
) {
  const subject = input.approved
    ? "Aenderung genehmigt: " + input.participantName
    : "Aenderung abgelehnt: " + input.participantName;

  const decisionText = input.approved
    ? "Die beantragte Aenderung wurde genehmigt."
    : "Die beantragte Aenderung wurde abgelehnt.";

  const commentBlock = input.reviewComment
    ? "<p><strong>Kommentar der Orga:</strong><br />" + input.reviewComment + "</p>"
    : "";

  const commentText = input.reviewComment
    ? ["", "Kommentar der Orga: " + input.reviewComment]
    : [];

  return {
    subject,
    html:
      '<div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111;">' +
      "<h2>" + (input.approved ? "Aenderung genehmigt" : "Aenderung abgelehnt") + "</h2>" +
      "<p>Hallo,</p>" +
      "<p>" + decisionText + "</p>" +
      "<p>Teilnehmer: <strong>" + input.participantName + "</strong></p>" +
      "<p>Mannschaft: <strong>" + input.teamName + "</strong></p>" +
      "<p>Wettkampf: <strong>" + input.competitionName + " " + input.competitionYear + "</strong></p>" +
      commentBlock +
      "</div>",
    text: [
      input.approved ? "Aenderung genehmigt" : "Aenderung abgelehnt",
      "",
      decisionText,
      "Teilnehmer: " + input.participantName,
      "Mannschaft: " + input.teamName,
      "Wettkampf: " + input.competitionName + " " + input.competitionYear,
      ...commentText,
    ].join("\\n"),
  };
}
