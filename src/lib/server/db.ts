import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const rawUrl = process.env.DATABASE_URL ?? process.env.DIRECT_URL;
if (!rawUrl) throw new Error("DATABASE_URL or DIRECT_URL is required.");
const url = new URL(rawUrl);
if (url.searchParams.get("sslmode") === "require") {
  url.searchParams.set("uselibpqcompat", "true");
}

const globalDb = globalThis as typeof globalThis & { circleDb?: PrismaClient };
export const db = globalDb.circleDb ?? new PrismaClient({ adapter: new PrismaPg(url.toString()) });
if (process.env.NODE_ENV !== "production") globalDb.circleDb = db;
