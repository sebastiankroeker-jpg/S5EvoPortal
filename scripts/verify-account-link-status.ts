import assert from "node:assert/strict";

import { deriveAccountLinkStatus } from "@/lib/account-link-status";

const linkedStatus = deriveAccountLinkStatus({
  hasEmail: true,
  hasEntityLink: true,
  hasPortalAccount: true,
  entityLabel: "Mannschaft",
});
assert.equal(linkedStatus.status, "linked");
assert.equal(linkedStatus.label, "Verknüpft");
assert.equal(linkedStatus.description, "Mannschaft ist mit einem Portal-Konto verknüpft.");

const linkedViaClaimStatus = deriveAccountLinkStatus({
  hasEmail: true,
  claimStatus: "claimed",
});
assert.equal(linkedViaClaimStatus.status, "linked");

const missingEmailStatus = deriveAccountLinkStatus({
  hasEmail: false,
  hasPortalAccount: true,
  hasPlaceholderUser: true,
  claimStatus: "active",
});
assert.equal(missingEmailStatus.status, "missing_email");
assert.equal(missingEmailStatus.label, "Keine E-Mail hinterlegt");

const portalAccountStatus = deriveAccountLinkStatus({
  hasEmail: true,
  hasPortalAccount: true,
  entityLabel: "Teilnehmer",
});
assert.equal(portalAccountStatus.status, "portal_account");
assert.equal(portalAccountStatus.label, "Portal-Konto vorhanden");

const placeholderWithActiveClaimStatus = deriveAccountLinkStatus({
  hasEmail: true,
  hasPlaceholderUser: true,
  claimStatus: "active",
});
assert.equal(placeholderWithActiveClaimStatus.status, "placeholder_user");
assert.equal(placeholderWithActiveClaimStatus.label, "Login noch nicht aktiviert");
assert.match(placeholderWithActiveClaimStatus.description, /Claim-Link ist noch offen/);

const placeholderWithoutClaimStatus = deriveAccountLinkStatus({
  hasEmail: true,
  hasPlaceholderUser: true,
  claimStatus: "none",
});
assert.equal(placeholderWithoutClaimStatus.status, "placeholder_user");
assert.doesNotMatch(placeholderWithoutClaimStatus.description, /Claim-Link ist noch offen/);

const invitationOpenStatus = deriveAccountLinkStatus({
  hasEmail: true,
  claimStatus: "active",
});
assert.equal(invitationOpenStatus.status, "invitation_open");
assert.equal(invitationOpenStatus.label, "Einladung ausstehend");

const expiredStatus = deriveAccountLinkStatus({
  hasEmail: true,
  claimStatus: "expired",
});
assert.equal(expiredStatus.status, "expired");
assert.equal(expiredStatus.label, "Einladung abgelaufen");

const revokedStatus = deriveAccountLinkStatus({
  hasEmail: true,
  claimStatus: "revoked",
});
assert.equal(revokedStatus.status, "revoked");
assert.equal(revokedStatus.label, "Einladung gesperrt");

const noInvitationStatus = deriveAccountLinkStatus({
  hasEmail: true,
  entityLabel: "Teilnehmer",
});
assert.equal(noInvitationStatus.status, "no_invitation");
assert.equal(noInvitationStatus.description, "Für diesen Teilnehmer wurde bisher kein Claim-Link versendet.");

console.log("account link status verification ok");
