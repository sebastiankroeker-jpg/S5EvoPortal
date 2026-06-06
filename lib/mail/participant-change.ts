import { sendResendMail } from "@/lib/mail/resend";
import {
  buildParticipantChangeDecisionMail,
  buildParticipantDirectChangeMail,
  buildParticipantChangeSubmittedOrgBatchMail,
  buildParticipantChangeSubmittedOrgMail,
  buildParticipantChangeSubmittedTeamBatchMail,
  buildParticipantChangeSubmittedTeamMail,
} from "@/lib/mail/templates/participant-change";
import type { EditParticipantNotificationResult } from "@/lib/participant-edit-result";
import { resolveRegistrationNotificationEmail } from "@/lib/mail/team-registration";

type CompetitionMailConfig = {
  name: string;
  year: number;
  registrationNotificationEmail?: string | null;
  tenant?: {
    name: string;
    contactEmail?: string | null;
  } | null;
};

type ParticipantMailConfig = {
  name: string;
  email?: string | null;
  teamName: string;
  teamContactEmail?: string | null;
};

type RequesterConfig = {
  name: string;
  email: string;
};

type ChangeSummaryConfig = Array<{
  label: string;
  before: string;
  after: string;
}>;

function normalizeMailSettledResult(
  result: PromiseSettledResult<unknown>,
  recipient: string,
  template: string,
): EditParticipantNotificationResult {
  if (result.status === "rejected") {
    return {
      channel: "email",
      recipient,
      template,
      status: "failed",
      reason: result.reason instanceof Error ? result.reason.message : String(result.reason),
    };
  }

  const value = result.value as { status?: string; reason?: string; missing?: string[] } | null;
  if (value?.status === "skipped") {
    return {
      channel: "email",
      recipient,
      template,
      status: "skipped",
      reason: value.missing?.length ? `missing_env:${value.missing.join(",")}` : value.reason,
    };
  }

  return {
    channel: "email",
    recipient,
    template,
    status: "sent",
  };
}

export async function sendParticipantChangeSubmittedEmails({
  competition,
  participant,
  requester,
  changeSummary,
}: {
  competition: CompetitionMailConfig;
  participant: ParticipantMailConfig;
  requester: RequesterConfig;
  changeSummary?: ChangeSummaryConfig;
}) {
  const orgRecipients = resolveRegistrationNotificationEmail(competition);
  const teamRecipient = participant.teamContactEmail;
  const input = {
    competitionName: competition.name,
    competitionYear: competition.year,
    teamName: participant.teamName,
    participantName: participant.name,
    requestedByName: requester.name,
    requestedByEmail: requester.email,
    changeSummary,
  };

  const tasks: Array<{ recipient: string; template: string; promise: Promise<unknown> }> = [];

  if (teamRecipient) {
    const mail = buildParticipantChangeSubmittedTeamMail(input);
    tasks.push({ recipient: teamRecipient, template: "participant-change-submitted-team", promise: sendResendMail({
      to: teamRecipient,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      replyTo: process.env.MAIL_REPLY_TO || orgRecipients[0] || undefined,
    }) });
  }

  if (orgRecipients.length > 0) {
    const mail = buildParticipantChangeSubmittedOrgMail(input);
    tasks.push({ recipient: orgRecipients.join(","), template: "participant-change-submitted-org", promise: sendResendMail({
      to: orgRecipients,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      replyTo: requester.email,
    }) });
  }

  const results = await Promise.allSettled(tasks.map((task) => task.promise));
  return results.map((result, index) => normalizeMailSettledResult(result, tasks[index].recipient, tasks[index].template));
}

export async function sendParticipantChangeSubmittedBatchEmails({
  competition,
  teamName,
  teamContactEmail,
  requester,
  participants,
}: {
  competition: CompetitionMailConfig;
  teamName: string;
  teamContactEmail?: string | null;
  requester: RequesterConfig;
  participants: Array<{
    participantName: string;
    changeSummary?: ChangeSummaryConfig;
  }>;
}) {
  if (participants.length === 0) {
    return;
  }

  const orgRecipients = resolveRegistrationNotificationEmail(competition);
  const input = {
    competitionName: competition.name,
    competitionYear: competition.year,
    teamName,
    requestedByName: requester.name,
    requestedByEmail: requester.email,
    participants,
  };

  const tasks: Array<{ recipient: string; template: string; promise: Promise<unknown> }> = [];

  if (teamContactEmail) {
    const mail = buildParticipantChangeSubmittedTeamBatchMail(input);
    tasks.push({ recipient: teamContactEmail, template: "participant-change-submitted-team-batch", promise: sendResendMail({
      to: teamContactEmail,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      replyTo: process.env.MAIL_REPLY_TO || orgRecipients[0] || undefined,
    }) });
  }

  if (orgRecipients.length > 0) {
    const mail = buildParticipantChangeSubmittedOrgBatchMail(input);
    tasks.push({ recipient: orgRecipients.join(","), template: "participant-change-submitted-org-batch", promise: sendResendMail({
      to: orgRecipients,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      replyTo: requester.email,
    }) });
  }

  const results = await Promise.allSettled(tasks.map((task) => task.promise));
  return results.map((result, index) => normalizeMailSettledResult(result, tasks[index].recipient, tasks[index].template));
}

export async function sendParticipantChangeDecisionEmail({
  competition,
  participant,
  requester,
  approved,
  reviewComment,
  changeSummary,
}: {
  competition: CompetitionMailConfig;
  participant: ParticipantMailConfig;
  requester: RequesterConfig;
  approved: boolean;
  reviewComment?: string | null;
  changeSummary?: ChangeSummaryConfig;
}) {
  const decisionRecipient = participant.email || participant.teamContactEmail;
  if (!decisionRecipient) {
    return [{
      channel: "email" as const,
      recipient: "",
      template: "participant-change-decision",
      status: "skipped" as const,
      reason: "missing_recipient",
    }];
  }

  const input = {
    competitionName: competition.name,
    competitionYear: competition.year,
    teamName: participant.teamName,
    participantName: participant.name,
    requestedByName: requester.name,
    requestedByEmail: requester.email,
    approved,
    reviewComment,
    changeSummary,
  };
  const mail = buildParticipantChangeDecisionMail(input);
  const result = await Promise.allSettled([
    sendResendMail({
      to: decisionRecipient,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      replyTo: process.env.MAIL_REPLY_TO || competition.registrationNotificationEmail || undefined,
    }),
  ]);

  return [normalizeMailSettledResult(result[0], decisionRecipient, "participant-change-decision")];
}

export async function sendParticipantDirectChangeEmail({
  competition,
  participant,
  actor,
  changeSummary,
}: {
  competition: CompetitionMailConfig;
  participant: ParticipantMailConfig;
  actor: RequesterConfig;
  changeSummary?: ChangeSummaryConfig;
}) {
  const recipient = participant.email || participant.teamContactEmail;
  if (!recipient) {
    return [{
      channel: "email" as const,
      recipient: "",
      template: "participant-direct-change",
      status: "skipped" as const,
      reason: "missing_recipient",
    }];
  }

  const mail = buildParticipantDirectChangeMail({
    competitionName: competition.name,
    competitionYear: competition.year,
    teamName: participant.teamName,
    participantName: participant.name,
    requestedByName: actor.name,
    requestedByEmail: actor.email,
    changeSummary,
  });
  const result = await Promise.allSettled([
    sendResendMail({
      to: recipient,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      replyTo: process.env.MAIL_REPLY_TO || competition.registrationNotificationEmail || undefined,
    }),
  ]);

  return [normalizeMailSettledResult(result[0], recipient, "participant-direct-change")];
}
