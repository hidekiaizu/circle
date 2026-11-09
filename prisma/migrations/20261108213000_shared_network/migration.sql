CREATE TABLE "people" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "claimed" BOOLEAN NOT NULL DEFAULT false,
  "claim_token" TEXT NOT NULL,
  "major" TEXT,
  "year" TEXT,
  "residence" TEXT,
  "hometown" TEXT,
  "clubs" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

  CONSTRAINT "people_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "people_name_nonempty" CHECK (length(btrim("name")) > 0),
  CONSTRAINT "people_claim_token_nonempty" CHECK (length(btrim("claim_token")) > 0)
);

CREATE UNIQUE INDEX "people_claim_token_key" ON "people"("claim_token");

CREATE TABLE "relationships" (
  "id" TEXT NOT NULL,
  "person_a_id" TEXT NOT NULL,
  "person_b_id" TEXT NOT NULL,
  "category" SMALLINT NOT NULL,
  "proposed_by_person_id" TEXT NOT NULL,
  "confirmed" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "relationships_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "relationships_category_range" CHECK ("category" BETWEEN 1 AND 5),
  CONSTRAINT "relationships_no_self_edge" CHECK ("person_a_id" <> "person_b_id"),
  CONSTRAINT "relationships_proposer_is_endpoint" CHECK (
    "proposed_by_person_id" = "person_a_id"
    OR "proposed_by_person_id" = "person_b_id"
  ),
  CONSTRAINT "relationships_person_a_id_fkey" FOREIGN KEY ("person_a_id")
    REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "relationships_person_b_id_fkey" FOREIGN KEY ("person_b_id")
    REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "relationships_proposed_by_person_id_fkey" FOREIGN KEY ("proposed_by_person_id")
    REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "relationships_person_a_id_idx" ON "relationships"("person_a_id");
CREATE INDEX "relationships_person_b_id_idx" ON "relationships"("person_b_id");
CREATE INDEX "relationships_proposed_by_person_id_idx" ON "relationships"("proposed_by_person_id");
CREATE UNIQUE INDEX "relationships_undirected_pair_key"
  ON "relationships" (LEAST("person_a_id", "person_b_id"), GREATEST("person_a_id", "person_b_id"));

-- This is intentionally an open, no-auth MVP. Possession of the project's
-- browser-safe key permits reads and writes. Replace these policies before
-- storing private or sensitive profile data.
ALTER TABLE "people" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "relationships" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "people" TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "relationships" TO anon, authenticated;

CREATE POLICY "MVP public read people" ON "people" FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "MVP public insert people" ON "people" FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "MVP public update people" ON "people" FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "MVP public delete people" ON "people" FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "MVP public read relationships" ON "relationships" FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "MVP public insert relationships" ON "relationships" FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "MVP public update relationships" ON "relationships" FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "MVP public delete relationships" ON "relationships" FOR DELETE TO anon, authenticated USING (true);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'people'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE "people";
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'relationships'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE "relationships";
    END IF;
  END IF;
END $$;
