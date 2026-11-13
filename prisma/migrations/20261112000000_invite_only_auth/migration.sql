ALTER TABLE "people" ADD COLUMN "claim_token_expires_at" TIMESTAMPTZ(3);

CREATE TABLE "accounts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "person_id" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "failed_logins" INTEGER NOT NULL DEFAULT 0,
  "locked_until" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "accounts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "accounts_person_id_key" UNIQUE ("person_id"),
  CONSTRAINT "accounts_username_key" UNIQUE ("username"),
  CONSTRAINT "accounts_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE CASCADE
);

CREATE TABLE "sessions" (
  "token_hash" TEXT NOT NULL,
  "person_id" TEXT NOT NULL,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sessions_pkey" PRIMARY KEY ("token_hash"),
  CONSTRAINT "sessions_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE CASCADE
);
CREATE INDEX "sessions_person_id_idx" ON "sessions"("person_id");

-- Previous tokens were exposed by the public graph API. Rotate every one.
UPDATE "people" SET "claim_token" = replace(gen_random_uuid()::text, '-', '');

DROP POLICY IF EXISTS "MVP public read people" ON "people";
DROP POLICY IF EXISTS "MVP public insert people" ON "people";
DROP POLICY IF EXISTS "MVP public update people" ON "people";
DROP POLICY IF EXISTS "MVP public delete people" ON "people";
DROP POLICY IF EXISTS "MVP public read relationships" ON "relationships";
DROP POLICY IF EXISTS "MVP public insert relationships" ON "relationships";
DROP POLICY IF EXISTS "MVP public update relationships" ON "relationships";
DROP POLICY IF EXISTS "MVP public delete relationships" ON "relationships";

REVOKE ALL ON "people", "relationships", "accounts", "sessions" FROM anon, authenticated;
ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;

-- All reads and writes now pass through authenticated Next.js route handlers.
