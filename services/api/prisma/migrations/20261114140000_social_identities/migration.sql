-- Additive only. Existing users, passwords, sessions and documents are untouched.
CREATE TABLE "SocialIdentity" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL CHECK ("provider" IN ('google', 'apple')),
  "subject" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "providerEmail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialIdentity_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SocialIdentity_provider_subject_key" ON "SocialIdentity"("provider", "subject");
CREATE UNIQUE INDEX "SocialIdentity_userId_provider_key" ON "SocialIdentity"("userId", "provider");
ALTER TABLE "SocialIdentity" ADD CONSTRAINT "SocialIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "SocialAuthAttempt" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL CHECK ("provider" IN ('google', 'apple')),
  "browserHash" TEXT NOT NULL,
  "nonce" TEXT NOT NULL,
  "verifier" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "claimedAt" TIMESTAMP(3),
  "ticketHash" TEXT,
  "subject" TEXT,
  "email" TEXT,
  "name" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialAuthAttempt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SocialAuthAttempt_ticketHash_key" ON "SocialAuthAttempt"("ticketHash");
CREATE INDEX "SocialAuthAttempt_expiresAt_idx" ON "SocialAuthAttempt"("expiresAt");
CREATE INDEX "SocialAuthAttempt_browserHash_expiresAt_idx" ON "SocialAuthAttempt"("browserHash", "expiresAt");
