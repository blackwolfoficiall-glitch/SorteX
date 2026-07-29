-- Reconcile the original prototype user model with the canonical SorteX model.
CREATE TYPE "public"."UserRole" AS ENUM ('BUYER', 'ORGANIZER', 'ADMIN');

ALTER TABLE "public"."User"
ADD COLUMN "cpf" TEXT,
ADD COLUMN "cnpj" TEXT,
ADD COLUMN "role" "public"."UserRole",
ADD COLUMN "city" TEXT,
ADD COLUMN "state" TEXT,
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "updatedAt" TIMESTAMP(3);

UPDATE "public"."User"
SET
  "cpf" = CASE WHEN "type" = 'BUYER' THEN "document" ELSE NULL END,
  "cnpj" = CASE WHEN "type" = 'ORGANIZER' THEN "document" ELSE NULL END,
  "role" = "type"::text::"public"."UserRole",
  "updatedAt" = "createdAt";

ALTER TABLE "public"."User"
ALTER COLUMN "role" SET NOT NULL,
ALTER COLUMN "role" SET DEFAULT 'BUYER',
ALTER COLUMN "updatedAt" SET NOT NULL;

ALTER TABLE "public"."User"
DROP COLUMN "document",
DROP COLUMN "type";

DROP TYPE "public"."UserType";

CREATE UNIQUE INDEX "User_cpf_key" ON "public"."User"("cpf");
CREATE UNIQUE INDEX "User_cnpj_key" ON "public"."User"("cnpj");
