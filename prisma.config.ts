import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Next.js keeps local secrets in .env.local. Prisma does not load that file
// automatically, so load it explicitly without ever copying values into a
// tracked file. A conventional .env remains supported for deployment tooling.
config({ path: ".env.local" });
config();

const databaseUrl = process.env.DATABASE_URL ?? process.env.DIRECT_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL or DIRECT_URL is required for Prisma migrations and seeds.",
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: databaseUrl,
  },
});
