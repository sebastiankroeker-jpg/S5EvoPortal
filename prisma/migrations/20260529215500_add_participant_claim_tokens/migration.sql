CREATE TABLE "participant_claim_tokens" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "suggestedEmail" TEXT NOT NULL,
    "suggestedName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "claimedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "participantId" TEXT NOT NULL,
    "claimedByUserId" TEXT,

    CONSTRAINT "participant_claim_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "participant_claim_audit_events" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventType" TEXT NOT NULL,
    "outcome" TEXT,
    "reason" TEXT,
    "suspicious" BOOLEAN NOT NULL DEFAULT false,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "sessionEmail" TEXT,
    "tokenId" TEXT,
    "participantId" TEXT,
    "teamId" TEXT,
    "userId" TEXT,

    CONSTRAINT "participant_claim_audit_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "participant_claim_tokens_tokenHash_key" ON "participant_claim_tokens"("tokenHash");
CREATE INDEX "participant_claim_tokens_participantId_idx" ON "participant_claim_tokens"("participantId");
CREATE INDEX "participant_claim_tokens_suggestedEmail_idx" ON "participant_claim_tokens"("suggestedEmail");

CREATE INDEX "participant_claim_audit_events_createdAt_idx" ON "participant_claim_audit_events"("createdAt");
CREATE INDEX "participant_claim_audit_events_tokenId_idx" ON "participant_claim_audit_events"("tokenId");
CREATE INDEX "participant_claim_audit_events_participantId_idx" ON "participant_claim_audit_events"("participantId");
CREATE INDEX "participant_claim_audit_events_teamId_idx" ON "participant_claim_audit_events"("teamId");
CREATE INDEX "participant_claim_audit_events_ipAddress_idx" ON "participant_claim_audit_events"("ipAddress");
CREATE INDEX "participant_claim_audit_events_suspicious_idx" ON "participant_claim_audit_events"("suspicious");

ALTER TABLE "participant_claim_tokens"
ADD CONSTRAINT "participant_claim_tokens_participantId_fkey"
FOREIGN KEY ("participantId") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "participant_claim_tokens"
ADD CONSTRAINT "participant_claim_tokens_claimedByUserId_fkey"
FOREIGN KEY ("claimedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
