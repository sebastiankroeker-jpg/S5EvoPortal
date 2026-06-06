type ParticipantChangeMailInput = {
  competitionName: string;
  competitionYear: number;
  teamName: string;
  participantName: string;
  requestedByName: string;
  requestedByEmail: string;
  reviewComment?: string | null;
  changeSummary?: Array<{
    label: string;
    before: string;
    after: string;
  }>;
};

type ParticipantChangeBatchMailInput = {
  competitionName: string;
  competitionYear: number;
  teamName: string;
  requestedByName: string;
  requestedByEmail: string;
  participants: Array<{
    participantName: string;
    changeSummary?: Array<{
      label: string;
      before: string;
      after: string;
    }>;
  }>;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildChangeSummaryHtml(changeSummary?: ParticipantChangeMailInput["changeSummary"]) {
  if (!changeSummary || changeSummary.length === 0) {
    return "";
  }

  const items = changeSummary
    .map(
      (change) =>
        "<li><strong>" +
        escapeHtml(change.label) +
        ":</strong> " +
        escapeHtml(change.before) +
        " -&gt; " +
        escapeHtml(change.after) +
        "</li>",
    )
    .join("");

  return "<p><strong>Geaenderte Daten:</strong></p><ul>" + items + "</ul>";
}

function buildChangeSummaryText(changeSummary?: ParticipantChangeMailInput["changeSummary"]) {
  if (!changeSummary || changeSummary.length === 0) {
    return [];
  }

  return [
    "",
    "Geaenderte Daten:",
    ...changeSummary.map((change) => "- " + change.label + ": " + change.before + " -> " + change.after),
  ];
}

function buildBatchSummaryHtml(participants: ParticipantChangeBatchMailInput["participants"]) {
  return participants
    .map((participant) => {
      const changeSummaryHtml = buildChangeSummaryHtml(participant.changeSummary);

      return (
        '<li style="margin-bottom:12px;">' +
        "<strong>" + escapeHtml(participant.participantName) + "</strong>" +
        changeSummaryHtml +
        "</li>"
      );
    })
    .join("");
}

function buildBatchSummaryText(participants: ParticipantChangeBatchMailInput["participants"]) {
  return participants.flatMap((participant) => [
    "",
    participant.participantName,
    ...(participant.changeSummary && participant.changeSummary.length > 0
      ? participant.changeSummary.map((change) => "- " + change.label + ": " + change.before + " -> " + change.after)
      : ["- Keine Feldliste verfuegbar"]),
  ]);
}

export function buildParticipantChangeSubmittedTeamMail(input: ParticipantChangeMailInput) {
  const subject = "Aenderungsanfrage eingegangen: " + input.participantName;
  const changeSummaryHtml = buildChangeSummaryHtml(input.changeSummary);
  const changeSummaryText = buildChangeSummaryText(input.changeSummary);
  return {
    subject,
    html:
      '<div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111;">' +
      "<h2>Aenderungsanfrage eingegangen</h2>" +
      "<p>Hallo Team,</p>" +
      "<p>fuer <strong>" + input.participantName + "</strong> wurde eine Aenderungsanfrage zur Mannschaft <strong>" + input.teamName + "</strong> eingereicht.</p>" +
      "<p>Wettkampf: <strong>" + input.competitionName + " " + input.competitionYear + "</strong></p>" +
      "<p>Beantragt von: <strong>" + input.requestedByName + "</strong> (" + input.requestedByEmail + ")</p>" +
      changeSummaryHtml +
      "<p>Die Anfrage liegt jetzt bei der Orga zur Pruefung vor.</p>" +
      "</div>",
    text: [
      "Aenderungsanfrage eingegangen",
      "",
      "fuer " + input.participantName + " wurde eine Aenderungsanfrage zur Mannschaft " + input.teamName + " eingereicht.",
      "Wettkampf: " + input.competitionName + " " + input.competitionYear,
      "Beantragt von: " + input.requestedByName + " (" + input.requestedByEmail + ")",
      ...changeSummaryText,
      "Die Anfrage liegt jetzt bei der Orga zur Pruefung vor.",
    ].join("\\n"),
  };
}

export function buildParticipantChangeSubmittedOrgMail(input: ParticipantChangeMailInput) {
  const subject = "Neue Aenderungsanfrage: " + input.teamName + " - " + input.participantName;
  const changeSummaryHtml = buildChangeSummaryHtml(input.changeSummary);
  const changeSummaryText = buildChangeSummaryText(input.changeSummary);
  return {
    subject,
    html:
      '<div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111;">' +
      "<h2>Neue Aenderungsanfrage</h2>" +
      "<p>Teilnehmer: <strong>" + input.participantName + "</strong></p>" +
      "<p>Mannschaft: <strong>" + input.teamName + "</strong></p>" +
      "<p>Wettkampf: <strong>" + input.competitionName + " " + input.competitionYear + "</strong></p>" +
      "<p>Beantragt von: <strong>" + input.requestedByName + "</strong> (" + input.requestedByEmail + ")</p>" +
      changeSummaryHtml +
      "<p>Bitte im Orga-Bereich pruefen und entscheiden.</p>" +
      "</div>",
    text: [
      "Neue Aenderungsanfrage",
      "",
      "Teilnehmer: " + input.participantName,
      "Mannschaft: " + input.teamName,
      "Wettkampf: " + input.competitionName + " " + input.competitionYear,
      "Beantragt von: " + input.requestedByName + " (" + input.requestedByEmail + ")",
      ...changeSummaryText,
      "Bitte im Orga-Bereich pruefen und entscheiden.",
    ].join("\\n"),
  };
}

export function buildParticipantChangeSubmittedTeamBatchMail(input: ParticipantChangeBatchMailInput) {
  const subject =
    "Aenderungsanfrage eingegangen: " +
    input.teamName +
    " (" +
    input.participants.length +
    " Teilnehmer)";
  const batchSummaryHtml = buildBatchSummaryHtml(input.participants);
  const batchSummaryText = buildBatchSummaryText(input.participants);

  return {
    subject,
    html:
      '<div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111;">' +
      "<h2>Aenderungsanfrage eingegangen</h2>" +
      "<p>Hallo Team,</p>" +
      "<p>fuer die Mannschaft <strong>" + input.teamName + "</strong> wurden mehrere Aenderungen eingereicht.</p>" +
      "<p>Wettkampf: <strong>" + input.competitionName + " " + input.competitionYear + "</strong></p>" +
      "<p>Beantragt von: <strong>" + input.requestedByName + "</strong> (" + input.requestedByEmail + ")</p>" +
      "<p><strong>Geaenderte Teilnehmer:</strong></p><ul>" + batchSummaryHtml + "</ul>" +
      "<p>Die Anfrage liegt jetzt bei der Orga zur Pruefung vor.</p>" +
      "</div>",
    text: [
      "Aenderungsanfrage eingegangen",
      "",
      "fuer die Mannschaft " + input.teamName + " wurden mehrere Aenderungen eingereicht.",
      "Wettkampf: " + input.competitionName + " " + input.competitionYear,
      "Beantragt von: " + input.requestedByName + " (" + input.requestedByEmail + ")",
      "",
      "Geaenderte Teilnehmer:",
      ...batchSummaryText,
      "Die Anfrage liegt jetzt bei der Orga zur Pruefung vor.",
    ].join("\\n"),
  };
}

export function buildParticipantChangeSubmittedOrgBatchMail(input: ParticipantChangeBatchMailInput) {
  const subject =
    "Neue Aenderungsanfrage: " +
    input.teamName +
    " (" +
    input.participants.length +
    " Teilnehmer)";
  const batchSummaryHtml = buildBatchSummaryHtml(input.participants);
  const batchSummaryText = buildBatchSummaryText(input.participants);

  return {
    subject,
    html:
      '<div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111;">' +
      "<h2>Neue Aenderungsanfrage</h2>" +
      "<p>Mannschaft: <strong>" + input.teamName + "</strong></p>" +
      "<p>Wettkampf: <strong>" + input.competitionName + " " + input.competitionYear + "</strong></p>" +
      "<p>Beantragt von: <strong>" + input.requestedByName + "</strong> (" + input.requestedByEmail + ")</p>" +
      "<p><strong>Geaenderte Teilnehmer:</strong></p><ul>" + batchSummaryHtml + "</ul>" +
      "<p>Bitte im Orga-Bereich pruefen und entscheiden.</p>" +
      "</div>",
    text: [
      "Neue Aenderungsanfrage",
      "",
      "Mannschaft: " + input.teamName,
      "Wettkampf: " + input.competitionName + " " + input.competitionYear,
      "Beantragt von: " + input.requestedByName + " (" + input.requestedByEmail + ")",
      "",
      "Geaenderte Teilnehmer:",
      ...batchSummaryText,
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
  const changeSummaryHtml = buildChangeSummaryHtml(input.changeSummary);
  const changeSummaryText = buildChangeSummaryText(input.changeSummary);

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
      changeSummaryHtml +
      commentBlock +
      "</div>",
    text: [
      input.approved ? "Aenderung genehmigt" : "Aenderung abgelehnt",
      "",
      decisionText,
      "Teilnehmer: " + input.participantName,
      "Mannschaft: " + input.teamName,
      "Wettkampf: " + input.competitionName + " " + input.competitionYear,
      ...changeSummaryText,
      ...commentText,
    ].join("\\n"),
  };
}

export function buildParticipantDirectChangeMail(input: ParticipantChangeMailInput) {
  const subject = "Teilnehmerdaten aktualisiert: " + input.participantName;
  const changeSummaryHtml = buildChangeSummaryHtml(input.changeSummary);
  const changeSummaryText = buildChangeSummaryText(input.changeSummary);

  return {
    subject,
    html:
      '<div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111;">' +
      "<h2>Teilnehmerdaten aktualisiert</h2>" +
      "<p>Hallo,</p>" +
      "<p>die Orga hat Teilnehmerdaten direkt aktualisiert.</p>" +
      "<p>Teilnehmer: <strong>" + escapeHtml(input.participantName) + "</strong></p>" +
      "<p>Mannschaft: <strong>" + escapeHtml(input.teamName) + "</strong></p>" +
      "<p>Wettkampf: <strong>" + escapeHtml(input.competitionName) + " " + input.competitionYear + "</strong></p>" +
      "<p>Geaendert von: <strong>" + escapeHtml(input.requestedByName) + "</strong> (" + escapeHtml(input.requestedByEmail) + ")</p>" +
      changeSummaryHtml +
      "</div>",
    text: [
      "Teilnehmerdaten aktualisiert",
      "",
      "die Orga hat Teilnehmerdaten direkt aktualisiert.",
      "Teilnehmer: " + input.participantName,
      "Mannschaft: " + input.teamName,
      "Wettkampf: " + input.competitionName + " " + input.competitionYear,
      "Geaendert von: " + input.requestedByName + " (" + input.requestedByEmail + ")",
      ...changeSummaryText,
    ].join("\\n"),
  };
}
