import { sendResendMail } from "@/lib/mail/resend";
import {
  buildParticipantChangeDecisionMail,
  buildParticipantChangeSubmittedOrgBatchMail,
  buildParticipantChangeSubmittedOrgMail,
  buildParticipantChangeSubmittedTeamBatchMail,
  buildParticipantChangeSubmittedTeamMail,
} from "@/lib/mail/templates/participant-change";
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

  const tasks: Promise<unknown>[] = [];

  if (teamRecipient) {
    const mail = buildParticipantChangeSubmittedTeamMail(input);
    tasks.push(sendResendMail({
      to: teamRecipient,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      replyTo: process.env.MAIL_REPLY_TO || orgRecipients[0] || undefined,
    }));
  }

  if (orgRecipients.length > 0) {
    const mail = buildParticipantChangeSubmittedOrgMail(input);
    tasks.push(sendResendMail({
      to: orgRecipients,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      replyTo: requester.email,
    }));
  }

  await Promise.allSettled(tasks);
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

  const tasks: Promise<unknown>[] = [];

  if (teamContactEmail) {
    const mail = buildParticipantChangeSubmittedTeamBatchMail(input);
    tasks.push(sendResendMail({
      to: teamContactEmail,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      replyTo: process.env.MAIL_REPLY_TO || orgRecipients[0] || undefined,
    }));
  }

  if (orgRecipients.length > 0) {
    const mail = buildParticipantChangeSubmittedOrgBatchMail(input);
    tasks.push(sendResendMail({
      to: orgRecipients,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      replyTo: requester.email,
    }));
  }

  await Promise.allSettled(tasks);
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
    return;
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
  await sendResendMail({
    to: decisionRecipient,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    replyTo: process.env.MAIL_REPLY_TO || competition.registrationNotificationEmail || undefined,
  });
}
