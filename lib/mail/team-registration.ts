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
  participants: Array<{
    firstName: string;
    lastName: string;
    birthYear?: number | null;
    gender?: string | null;
    disciplineCode?: string | null;
    shirtSize?: string | null;
  }>;
};

export function resolveRegistrationNotificationEmail(competition: CompetitionMailConfig) {
  return competition.registrationNotificationEmail || competition.tenant?.contactEmail || null;
}

export async function sendTeamRegistrationEmails({
  competition,
  team,
}: {
  competition: CompetitionMailConfig;
  team: TeamMailPayload;
}) {
  if (!team.contactEmail) {
    console.warn("Mail skipped: team contact email missing");
    return;
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
  };

  const registrantMail = buildRegistrantConfirmationMail(input);
  const orgMail = buildOrgNotificationMail(input);
  const orgEmail = resolveRegistrationNotificationEmail(competition);

  const tasks = [
    sendResendMail({
      to: team.contactEmail,
      subject: registrantMail.subject,
      html: registrantMail.html,
      text: registrantMail.text,
      replyTo: process.env.MAIL_REPLY_TO || orgEmail || undefined,
    }),
  ];

  if (orgEmail) {
    tasks.push(
      sendResendMail({
        to: orgEmail,
        subject: orgMail.subject,
        html: orgMail.html,
        text: orgMail.text,
        replyTo: team.contactEmail,
      }),
    );
  }

  const results = await Promise.allSettled(tasks);
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(index === 0 ? "Registrant mail failed" : "Org mail failed", result.reason);
    }
  });
}
