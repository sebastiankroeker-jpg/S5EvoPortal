-- Add a persisted sender display mode so support messages can be shown as
-- organization mailbox messages while retaining the real senderId for audit.
CREATE TYPE "MessageSenderDisplayMode" AS ENUM ('PERSONAL', 'ORG');

ALTER TABLE "messages"
  ADD COLUMN "senderDisplayMode" "MessageSenderDisplayMode" NOT NULL DEFAULT 'PERSONAL';
