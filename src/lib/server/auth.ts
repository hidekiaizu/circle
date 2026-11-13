import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { tokenHash } from "../credentials";
import { db } from "./db";

const COOKIE = "circle_session";
const SESSION_SECONDS = 60 * 60 * 24 * 30;

export async function currentPersonId(): Promise<string | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw || !/^[a-f0-9]{64}$/.test(raw)) return null;
  const session = await db.session.findUnique({ where: { tokenHash: tokenHash(raw) } });
  return session && session.expiresAt > new Date() ? session.personId : null;
}

export async function createSession(personId: string): Promise<void> {
  const raw = randomBytes(32).toString("hex");
  await db.session.create({
    data: {
      tokenHash: tokenHash(raw),
      personId,
      expiresAt: new Date(Date.now() + SESSION_SECONDS * 1000),
    },
  });
  (await cookies()).set(COOKIE, raw, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (raw) await db.session.deleteMany({ where: { tokenHash: tokenHash(raw) } });
  jar.delete(COOKIE);
}

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}
