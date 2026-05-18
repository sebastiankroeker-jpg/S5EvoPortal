import { buildOrgNotificationMail, buildRegistrantConfirmationMail } from "@/lib/mail/templates/team-registration";
import { sendResendMail } from "@/lib/mail/resend";

type CompetitionMailConfig = {
  name: string;
  year: number;
  registrationNotificationEmail?: string | null;
  tenant?: {
    name: string;
    contactEmail?: string | null;
  } | null;
};

type TeamMailPayload = {
  name: string;
  classificationCode?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  claimUrl?: string;
  participants: Array<{
    firstName: string;
    lastName: string;
    birthYear?: number | null;
    gender?: string | null;
    disciplineCode?: string | null;
    shirtSize?: string | null;
  }>;
};

type MailAttemptSummary =
  | {
      target: "registrant" | "org";
      status: "sent";
    }
  | {
      target: "registrant" | "org";
      status: "skipped";
      reason: string;
      missing?: string[];
    }
  | {
      target: "registrant" | "org";
      status: "failed";
      reason: string;
    };

export type TeamRegistrationMailSummary = {
  ok: boolean;
  attempts: MailAttemptSummary[];
};

function normalizeRecipientList(value?: string | null): string[] {
  if (!value) {
    return [];
  }

  return [...new Set(
    value
      .split(/[;,]/)
      .map((recipient) => recipient.trim())
      .filter(Boolean),
  )];
}

export function resolveRegistrationNotificationEmail(competition: CompetitionMailConfig) {
  const recipients = normalizeRecipientList(competition.registrationNotificationEmail);

  if (recipients.length > 0) {
    return recipients;
  }

  return normalizeRecipientList(competition.tenant?.contactEmail);
}

export async function sendTeamRegistrationEmails({
  competition,
  team,
}: {
  competition: CompetitionMailConfig;
  team: TeamMailPayload;
}): Promise<TeamRegistrationMailSummary> {
  if (!team.contactEmail) {
    console.warn("Mail skipped: team contact email missing");
    return {
      ok: false,
      attempts: [{ target: "registrant", status: "skipped", reason: "missing_contact_email" }],
    };
  }

  const input = {
    competitionName: competition.name,
    competitionYear: competition.year,
    teamName: team.name,
    classificationCode: team.classificationCode || "unclassified",
    contactName: team.contactName || "Team",
    contactEmail: team.contactEmail,
    tenantName: competition.tenant?.name || "S5Evo",
    participants: team.participants,
    claimUrl: team.claimUrl,
  };

  const registrantMail = buildRegistrantConfirmationMail(input);
  const orgMail = buildOrgNotificationMail(input);
  const orgRecipients = resolveRegistrationNotificationEmail(competition);

  const tasks = [
    sendResendMail({
      to: team.contactEmail,
      subject: registrantMail.subject,
      html: registrantMail.html,
      text: registrantMail.text,
      replyTo: process.env.MAIL_REPLY_TO || orgRecipients[0] || undefined,
    }),
  ];

  if (orgRecipients.length > 0) {
    tasks.push(
      sendResendMail({
        to: orgRecipients,
        subject: orgMail.subject,
        html: orgMail.html,
        text: orgMail.text,
        replyTo: team.contactEmail,
      }),
    );
  }

  const results = await Promise.allSettled(tasks);
  const attempts = results.map((result, index) => {
    const target = index === 0 ? "registrant" : "org";

    if (result.status === "rejected") {
      const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
      console.error(target === "registrant" ? "Registrant mail failed" : "Org mail failed", result.reason);
      return { target, status: "failed", reason } satisfies MailAttemptSummary;
    }

    if (result.value.status === "skipped") {
      console.warn(target === "registrant" ? "Registrant mail skipped" : "Org mail skipped", result.value);
      return {
        target,
        status: "skipped",
        reason: result.value.reason,
        missing: result.value.missing,
      } satisfies MailAttemptSummary;
    }

    return { target, status: "sent" } satisfies MailAttemptSummary;
  });

  return {
    ok: attempts.every((attempt) => attempt.status === "sent"),
    attempts,
  };
}
