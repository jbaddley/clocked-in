BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE public."Organization" ADD COLUMN IF NOT EXISTS "slug" public.citext;
CREATE UNIQUE INDEX IF NOT EXISTS "IX_Organization_slug"
  ON public."Organization" ("slug") WHERE "slug" IS NOT NULL;

COMMIT;