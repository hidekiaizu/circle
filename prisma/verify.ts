import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

config({ path: ".env.local" });
config();

const rawConnectionString = process.env.DATABASE_URL ?? process.env.DIRECT_URL;
if (!rawConnectionString) {
  throw new Error("DATABASE_URL or DIRECT_URL is required to verify Circle.");
}

const connectionUrl = new URL(rawConnectionString);
if (
  connectionUrl.searchParams.get("sslmode") === "require" &&
  !connectionUrl.searchParams.has("uselibpqcompat")
) {
  connectionUrl.searchParams.set("uselibpqcompat", "true");
}

const prisma = new PrismaClient({ adapter: new PrismaPg(connectionUrl.toString()) });

function readExpectedCount(name: "EXPECTED_PEOPLE" | "EXPECTED_RELATIONSHIPS"): number | null {
  const rawValue = process.env[name];
  if (rawValue === undefined) return null;

  const value = Number(rawValue);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer.`);
  }
  return value;
}

const expectedPeople = readExpectedCount("EXPECTED_PEOPLE");
const expectedRelationships = readExpectedCount("EXPECTED_RELATIONSHIPS");

if ((expectedPeople === null) !== (expectedRelationships === null)) {
  throw new Error(
    "EXPECTED_PEOPLE and EXPECTED_RELATIONSHIPS must be provided together.",
  );
}

async function main() {
  const [people, relationships, publications, policies, rls] = await Promise.all([
    prisma.person.count(),
    prisma.relationship.count(),
    prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename IN ('people', 'relationships')
      ORDER BY tablename
    `,
    prisma.$queryRaw<Array<{ tablename: string; policy_count: number }>>`
      SELECT tablename, count(*)::int AS policy_count
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename IN ('people', 'relationships')
      GROUP BY tablename
      ORDER BY tablename
    `,
    prisma.$queryRaw<Array<{ tablename: string; enabled: boolean }>>`
      SELECT relname AS tablename, relrowsecurity AS enabled
      FROM pg_class
      WHERE relnamespace = 'public'::regnamespace
        AND relname IN ('people', 'relationships')
      ORDER BY relname
    `,
  ]);

  const publicationNames = publications.map((row) => row.tablename);
  const expectedTables = ["people", "relationships"];
  if (
    expectedPeople !== null &&
    expectedRelationships !== null &&
    (people !== expectedPeople || relationships !== expectedRelationships)
  ) {
    throw new Error(
      `Unexpected counts: expected ${expectedPeople}/${expectedRelationships}, found ${people}/${relationships}.`,
    );
  }
  if (JSON.stringify(publicationNames) !== JSON.stringify(expectedTables)) {
    throw new Error(`Realtime publication is incomplete: ${publicationNames.join(", ")}.`);
  }
  if (policies.length !== 2 || policies.some((row) => row.policy_count !== 4)) {
    throw new Error("Expected four MVP policies on each graph table.");
  }
  if (rls.length !== 2 || rls.some((row) => !row.enabled)) {
    throw new Error("RLS is not enabled on both graph tables.");
  }

  console.log(`Database verified: ${people} people, ${relationships} relationships.`);
  console.log("Realtime verified: people, relationships.");
  console.log("RLS verified: 4 policies on each table.");
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error instanceof Error ? error.message : "Database verification failed.");
    await prisma.$disconnect();
    process.exit(1);
  });
