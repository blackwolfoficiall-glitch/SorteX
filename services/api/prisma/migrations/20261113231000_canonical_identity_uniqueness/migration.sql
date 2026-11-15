-- Additive uniqueness only: do not normalize or rewrite existing accounts.
-- Abort atomically if legacy canonical duplicates exist. Resolve them manually;
-- never merge users or change IDs/documents automatically.
BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "User" GROUP BY lower(btrim(email)) HAVING count(*) > 1)
     OR EXISTS (SELECT 1 FROM "User" WHERE cpf IS NOT NULL GROUP BY upper(regexp_replace(cpf, '[./[:space:]-]', '', 'g')) HAVING count(*) > 1)
     OR EXISTS (SELECT 1 FROM "User" WHERE cnpj IS NOT NULL GROUP BY upper(regexp_replace(cnpj, '[./[:space:]-]', '', 'g')) HAVING count(*) > 1)
  THEN
    RAISE EXCEPTION 'Canonical identity duplicates detected. Review legacy accounts before applying this migration; no data was changed.';
  END IF;
END $$;
CREATE UNIQUE INDEX "User_email_canonical_key" ON "User" (lower(btrim(email)));
CREATE UNIQUE INDEX "User_cpf_canonical_key" ON "User" (upper(regexp_replace(cpf, '[./[:space:]-]', '', 'g'))) WHERE cpf IS NOT NULL;
CREATE UNIQUE INDEX "User_cnpj_canonical_key" ON "User" (upper(regexp_replace(cnpj, '[./[:space:]-]', '', 'g'))) WHERE cnpj IS NOT NULL;
COMMIT;
