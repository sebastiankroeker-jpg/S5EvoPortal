-- CreateTable
CREATE TABLE "registration_claim_audit_events" (
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
    "teamId" TEXT,
    "userId" TEXT,

    CONSTRAINT "registration_claim_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "registration_claim_audit_events_createdAt_idx" ON "registration_claim_audit_events"("createdAt");

-- CreateIndex
CREATE INDEX "registration_claim_audit_events_tokenId_idx" ON "registration_claim_audit_events"("tokenId");

-- CreateIndex
CREATE INDEX "registration_claim_audit_events_teamId_idx" ON "registration_claim_audit_events"("teamId");

-- CreateIndex
CREATE INDEX "registration_claim_audit_events_ipAddress_idx" ON "registration_claim_audit_events"("ipAddress");

-- CreateIndex
CREATE INDEX "registration_claim_audit_events_suspicious_idx" ON "registration_claim_audit_events"("suspicious");
