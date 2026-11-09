import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

config({ path: ".env.local" });
config();

const rawConnectionString = process.env.DATABASE_URL ?? process.env.DIRECT_URL;
if (!rawConnectionString) {
  throw new Error("DATABASE_URL or DIRECT_URL is required to seed Circle.");
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
  const people = await prisma.person.count();
  if (people > 0) {
    const noun = people === 1 ? "person" : "people";
    console.log(`Circle already has ${people} ${noun}; seed made no changes.`);
    return;
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
  console.log("Created the single unclaimed originator profile for Hideki Aizu.");
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error instanceof Error ? error.message : "Seed failed.");
    await prisma.$disconnect();
    process.exit(1);
  });
