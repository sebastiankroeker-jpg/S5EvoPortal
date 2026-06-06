import assert from "node:assert/strict";

import { MarketplaceRegistrationSchema } from "@/lib/domain/team";
import { canViewerSeeMarketplaceTeam } from "@/lib/marketplace-visibility";
import {
  buildParticipantClaimNotificationResult,
  buildParticipantEditResult,
  buildParticipantReviewDecisionResult,
  resolveParticipantEditContext,
} from "@/lib/participant-edit-result";

const baseMarketplaceRegistration = {
  registrationMode: "MARKETPLACE",
  contactFirstName: "Mara",
  contactLastName: "Boerse",
  contactEmail: "mara.boerse@example.test",
  birthDate: "01.02.1990",
  gender: "W",
  discipline: "RUN",
  marketplaceVisibility: "ADMIN_MANAGEMENT_ONLY",
  participantPublicationPreference: "NAME_VERBERGEN",
};

const validMarketplaceRegistration = MarketplaceRegistrationSchema.safeParse(baseMarketplaceRegistration);
assert.equal(validMarketplaceRegistration.success, true);
if (validMarketplaceRegistration.success) {
  assert.equal(validMarketplaceRegistration.data.discipline, "RUN");
}

const missingMarketplaceDiscipline = MarketplaceRegistrationSchema.safeParse({
  ...baseMarketplaceRegistration,
  discipline: "TBD",
});
assert.equal(missingMarketplaceDiscipline.success, false);
if (!missingMarketplaceDiscipline.success) {
  assert.ok(missingMarketplaceDiscipline.error.issues.some((issue) => issue.message === "Disziplin fehlt"));
}

assert.equal(resolveParticipantEditContext("TEAM"), "TEAM");
assert.equal(resolveParticipantEditContext("MARKETPLACE"), "MARKETPLACE");
assert.equal(resolveParticipantEditContext(null), "TEAM");

const teamEditResult = buildParticipantEditResult({
  status: "saved",
  participantId: "participant-team",
  teamId: "team-1",
  context: resolveParticipantEditContext("TEAM"),
  fieldResults: [],
  notifications: [{ channel: "email", recipient: "team@example.test", template: "participant-direct-change", status: "sent" }],
});
assert.equal(teamEditResult.context, "TEAM");
assert.equal(teamEditResult.notifications[0].status, "sent");

const marketplaceDecision = buildParticipantReviewDecisionResult({
  status: "approved",
  scope: "single",
  message: "Aenderung genehmigt und angewendet",
  participantId: "participant-marketplace",
  teamId: "marketplace-team",
  context: resolveParticipantEditContext("MARKETPLACE"),
  diff: {
    firstName: { before: "Mara", after: "Maria" },
    disciplineCode: { before: "RUN", after: "MTB" },
  },
  fieldDecision: "saved",
  notifications: [{ channel: "email", recipient: "maria@example.test", template: "participant-change-decision", status: "sent" }],
});
assert.equal(marketplaceDecision.context, "MARKETPLACE");
assert.equal(marketplaceDecision.fieldResults.length, 2);
assert.ok(marketplaceDecision.fieldResults.every((field) => field.decision === "saved"));
assert.equal(marketplaceDecision.notifications[0].template, "participant-change-decision");

const rejectedBundle = buildParticipantReviewDecisionResult({
  status: "rejected",
  scope: "bundle",
  message: "Bundle wurde abgelehnt.",
  count: 2,
  context: "TEAM",
  fieldResults: [],
  notifications: [{ channel: "email", recipient: "", template: "participant-change-decision", status: "skipped", reason: "missing_recipient" }],
});
assert.equal(rejectedBundle.count, 2);
assert.equal(rejectedBundle.notifications[0].status, "skipped");

const claimNotification = buildParticipantClaimNotificationResult({
  status: "sent",
  email: "claim@example.test",
});
assert.deepEqual(claimNotification, {
  channel: "email",
  recipient: "claim@example.test",
  template: "participant-claim-invitation",
  status: "sent",
  reason: undefined,
});

assert.equal(
  canViewerSeeMarketplaceTeam({
    globalVisibility: "OFFLINE",
    teamVisibility: "PUBLIC",
    isPrivilegedViewer: false,
    isAuthenticated: true,
    ownsMarketplaceTeam: true,
    hasMarketplaceRegistration: true,
  }),
  false,
);
assert.equal(
  canViewerSeeMarketplaceTeam({
    globalVisibility: "OFFLINE",
    teamVisibility: "ADMIN_MANAGEMENT_ONLY",
    isPrivilegedViewer: true,
  }),
  true,
);
assert.equal(
  canViewerSeeMarketplaceTeam({
    globalVisibility: "SELECTIVE",
    teamVisibility: "MARKETPLACE_USERS",
    isPrivilegedViewer: false,
    hasMarketplaceRegistration: true,
  }),
  true,
);
assert.equal(
  canViewerSeeMarketplaceTeam({
    globalVisibility: "SELECTIVE",
    teamVisibility: "MARKETPLACE_USERS",
    isPrivilegedViewer: false,
    hasMarketplaceRegistration: false,
  }),
  false,
);

console.log("participant edit and marketplace verification ok");
