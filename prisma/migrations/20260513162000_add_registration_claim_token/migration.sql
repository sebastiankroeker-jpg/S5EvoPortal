-- CreateTable
CREATE TABLE "registration_claim_tokens" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "suggestedEmail" TEXT NOT NULL,
    "suggestedName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "claimedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "teamId" TEXT NOT NULL,
    "claimedByUserId" TEXT,

    CONSTRAINT "registration_claim_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "registration_claim_tokens_tokenHash_key" ON "registration_claim_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "registration_claim_tokens_teamId_idx" ON "registration_claim_tokens"("teamId");

-- CreateIndex
CREATE INDEX "registration_claim_tokens_suggestedEmail_idx" ON "registration_claim_tokens"("suggestedEmail");

-- AddForeignKey
ALTER TABLE "registration_claim_tokens"
ADD CONSTRAINT "registration_claim_tokens_teamId_fkey"
FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_claim_tokens"
ADD CONSTRAINT "registration_claim_tokens_claimedByUserId_fkey"
FOREIGN KEY ("claimedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
