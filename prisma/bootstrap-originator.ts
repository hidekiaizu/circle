import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

config({ path: ".env.local" });
config();

const rawConnectionString = process.env.DATABASE_URL ?? process.env.DIRECT_URL;
if (!rawConnectionString) {
  throw new Error("DATABASE_URL or DIRECT_URL is required to create the originator.");
}

const connectionUrl = new URL(rawConnectionString);
if (
  connectionUrl.searchParams.get("sslmode") === "require" &&
  !connectionUrl.searchParams.has("uselibpqcompat")
) {
  connectionUrl.searchParams.set("uselibpqcompat", "true");
}

const prisma = new PrismaClient({ adapter: new PrismaPg(connectionUrl.toString()) });
const ORIGINATOR_ID = "p-originator-hideki";

async function main() {
  const existing = await prisma.person.findUnique({ where: { id: ORIGINATOR_ID } });
  if (!existing) {
    const people = await prisma.person.count();
    if (people !== 0) {
      throw new Error(
        `Originator bootstrap requires an empty people table; found ${people} existing people.`,
      );
    }
    await prisma.person.create({
      data: {
        id: ORIGINATOR_ID,
        name: "Hideki Aizu",
        claimed: false,
        claimToken: randomUUID().replaceAll("-", ""),
        clubs: [],
      },
    });
    console.log("Created the unclaimed originator profile for Hideki Aizu.");
  } else {
    console.log("The Hideki Aizu originator profile already exists; no change made.");
  }

  const [people, relationships] = await Promise.all([
    prisma.person.count(),
    prisma.relationship.count(),
  ]);
  console.log(`Database now contains: ${people} person, ${relationships} relationships.`);
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error instanceof Error ? error.message : "Originator bootstrap failed.");
    await prisma.$disconnect();
    process.exit(1);
  });
