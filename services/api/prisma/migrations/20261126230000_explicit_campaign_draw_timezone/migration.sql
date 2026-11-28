-- Absence means the legacy column remains an absolute instant. Do not infer
-- a zone from midnight UTC: an old explicit timestamp can have that value too.
ALTER TABLE "Campaign" ADD COLUMN "drawTimeZone" TEXT;
