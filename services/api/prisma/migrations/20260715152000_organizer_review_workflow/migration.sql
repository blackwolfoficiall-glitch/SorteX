ALTER TABLE "Campaign"
ADD COLUMN "customPlatformFee" DECIMAL(6,3);

ALTER TABLE "OrganizerProfile"
ADD COLUMN "riskReasons" JSONB,
ADD COLUMN "riskAnalyzedAt" TIMESTAMP(3),
ADD COLUMN "reviewChecklist" JSONB,
ADD COLUMN "analysisStartedAt" TIMESTAMP(3),
ADD COLUMN "suspensionEndsAt" TIMESTAMP(3),
ADD COLUMN "readOnlyAccess" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "OrganizerDocument"
ADD COLUMN "reviewNote" TEXT,
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

DROP INDEX IF EXISTS "OrganizerDocument_organizerProfileId_type_key";
CREATE UNIQUE INDEX "OrganizerDocument_organizerProfileId_type_version_key"
ON "OrganizerDocument"("organizerProfileId", "type", "version");
