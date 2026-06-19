import type { Prisma } from "@prisma/client";

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
  registrationMode?: "TEAM" | "MARKETPLACE";
  marketplaceVisibility?: string | null;
  marketplaceStatus?: string | null;
  marketplaceMessage?: string | null;
  classificationCode?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  claimUrl?: string;
  portalUrl?: string;
  alreadyLinked?: boolean;
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
      recipients: string[];
      subject: string;
    }
  | {
      target: "registrant" | "org";
      status: "skipped";
      reason: string;
      missing?: string[];
      recipients: string[];
      subject: string;
    }
  | {
      target: "registrant" | "org";
      status: "failed";
      reason: string;
      recipients: string[];
      subject: string;
    };

export type TeamRegistrationMailSummary = {
  ok: boolean;
  attempts: MailAttemptSummary[];
};

export type TeamRegistrationMailAuditInput = {
  tenantId: string;
  competitionId?: string | null;
  teamId: string;
  teamName: string;
  registrationMode?: string | null;
  actorId?: string | null;
  reason: string;
  mailSummary?: TeamRegistrationMailSummary | null;
};

export function buildTeamRegistrationMailAuditEvents(
  input: TeamRegistrationMailAuditInput,
): Prisma.AuditEventCreateManyInput[] {
  const attempts = input.mailSummary?.attempts || [];

  return attempts.map((attempt) => ({
    action: "TEAM_REGISTRATION_MAIL",
    scopeType: "TEAM",
    scopeId: input.teamId,
    entityType: "TEAM",
    entityId: input.teamId,
    reason: input.reason,
    afterData: {
      mailStatus: attempt.status,
      recipients: attempt.recipients,
      subject: attempt.subject || null,
      target: attempt.target,
      reason: "reason" in attempt ? attempt.reason : null,
      missing: "missing" in attempt ? attempt.missing || [] : [],
    },
    meta: {
      teamName: input.teamName,
      registrationMode: input.registrationMode || "TEAM",
    },
    tenantId: input.tenantId,
    competitionId: input.competitionId ?? null,
    actorId: input.actorId ?? null,
  }));
}

export async function recordTeamRegistrationMailAuditEvents(
  client: { auditEvent: { createMany(args: { data: Prisma.AuditEventCreateManyInput[] }): Promise<unknown> } },
  input: TeamRegistrationMailAuditInput,
) {
  const data = buildTeamRegistrationMailAuditEvents(input);
  if (data.length === 0) {
    return;
  }

  await client.auditEvent.createMany({ data });
}

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
      attempts: [{ target: "registrant", status: "skipped", reason: "missing_contact_email", recipients: [], subject: "" }],
    };
  }

  const input = {
    competitionName: competition.name,
    competitionYear: competition.year,
    teamName: team.name,
    registrationMode: team.registrationMode || "TEAM",
    marketplaceVisibility: team.marketplaceVisibility,
    marketplaceStatus: team.marketplaceStatus,
    marketplaceMessage: team.marketplaceMessage,
    classificationCode: team.classificationCode || "unclassified",
    contactName: team.contactName || "Team",
    contactEmail: team.contactEmail,
    tenantName: competition.tenant?.name || "S5Evo",
    participants: team.participants,
    claimUrl: team.claimUrl,
    portalUrl: team.portalUrl,
    alreadyLinked: team.alreadyLinked,
  };

  const registrantMail = buildRegistrantConfirmationMail(input);
  const orgMail = buildOrgNotificationMail(input);
  const orgRecipients = resolveRegistrationNotificationEmail(competition);

  const plannedAttempts: Array<{
    target: "registrant" | "org";
    recipients: string[];
    subject: string;
  }> = [
    {
      target: "registrant" as const,
      recipients: [team.contactEmail],
      subject: registrantMail.subject,
    },
  ];

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
    plannedAttempts.push({
      target: "org",
      recipients: orgRecipients,
      subject: orgMail.subject,
    });

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
    const plannedAttempt = plannedAttempts[index] || plannedAttempts[0];
    const target = plannedAttempt.target;

    if (result.status === "rejected") {
      const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
      console.error(target === "registrant" ? "Registrant mail failed" : "Org mail failed", result.reason);
      return { ...plannedAttempt, status: "failed", reason } satisfies MailAttemptSummary;
    }

    if (result.value.status === "skipped") {
      console.warn(target === "registrant" ? "Registrant mail skipped" : "Org mail skipped", result.value);
      return {
        ...plannedAttempt,
        status: "skipped",
        reason: result.value.reason,
        missing: result.value.missing,
      } satisfies MailAttemptSummary;
    }

    return { ...plannedAttempt, status: "sent" } satisfies MailAttemptSummary;
  });

  return {
    ok: attempts.every((attempt) => attempt.status === "sent"),
    attempts,
  };
}
