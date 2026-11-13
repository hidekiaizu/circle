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
  const [people, relationships, policies, rls, grants] = await Promise.all([
    prisma.person.count(),
    prisma.relationship.count(),
    prisma.$queryRaw<Array<{ tablename: string; policy_count: number }>>`
      SELECT tablename, count(*)::int AS policy_count
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename IN ('people', 'relationships', 'accounts', 'sessions')
      GROUP BY tablename
      ORDER BY tablename
    `,
    prisma.$queryRaw<Array<{ tablename: string; enabled: boolean }>>`
      SELECT relname AS tablename, relrowsecurity AS enabled
      FROM pg_class
      WHERE relnamespace = 'public'::regnamespace
        AND relname IN ('people', 'relationships', 'accounts', 'sessions')
      ORDER BY relname
    `,
    prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT DISTINCT table_name
      FROM information_schema.role_table_grants
      WHERE table_schema = 'public'
        AND table_name IN ('people', 'relationships', 'accounts', 'sessions')
        AND grantee IN ('anon', 'authenticated')
    `,
  ]);

  if (
    expectedPeople !== null &&
    expectedRelationships !== null &&
    (people !== expectedPeople || relationships !== expectedRelationships)
  ) {
    throw new Error(
      `Unexpected counts: expected ${expectedPeople}/${expectedRelationships}, found ${people}/${relationships}.`,
    );
  }
  if (policies.length !== 0) {
    throw new Error("Direct client access policies must be removed.");
  }
  if (rls.length !== 4 || rls.some((row) => !row.enabled)) {
    throw new Error("RLS is not enabled on all private tables.");
  }
  if (grants.length !== 0) {
    throw new Error("Anonymous or authenticated client roles still have table grants.");
  }

  console.log(`Database verified: ${people} people, ${relationships} relationships.`);
  console.log("Private access verified: no direct client policies or grants.");
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error instanceof Error ? error.message : "Database verification failed.");
    await prisma.$disconnect();
    process.exit(1);
  });
