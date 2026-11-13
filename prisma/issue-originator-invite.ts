import { randomBytes, createHash } from "node:crypto";
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

config({ path: ".env.local" });
config();

const raw = process.env.DATABASE_URL ?? process.env.DIRECT_URL;
if (!raw) throw new Error("Database URL is required.");
const personId = process.argv[2];
if (!personId) throw new Error("Pass the exact originator person ID.");
const url = new URL(raw);
if (url.searchParams.get("sslmode") === "require") url.searchParams.set("uselibpqcompat", "true");
const db = new PrismaClient({ adapter: new PrismaPg(url.toString()) });

async function main() {
  const person = await db.person.findUnique({ where: { id: personId }, include: { account: true } });
  if (!person) throw new Error("Person not found.");
  if (person.account) throw new Error("This person already has an account.");
  const token = randomBytes(32).toString("hex");
  await db.person.update({ where: { id: personId }, data: {
    claimToken: createHash("sha256").update(token).digest("hex"),
    claimTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60_000),
  } });
  const base = process.env.CIRCLE_BASE_URL ?? "http://localhost:3000";
  console.log(`Private invitation for ${person.name}: ${base}/claim/${token}`);
  console.log("This link expires in seven days. Keep it private; issuing another link invalidates it.");
}

main()
  .then(async () => db.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error instanceof Error ? error.message : "Issuing the originator invitation failed.");
    await db.$disconnect();
    process.exit(1);
  });
