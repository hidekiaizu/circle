import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { createSession, sameOrigin } from "@/lib/server/auth";
import { normalizeUsername, verifyPassword } from "@/lib/credentials";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  const body = await request.json().catch(() => null);
  const username = typeof body?.username === "string" ? normalizeUsername(body.username) : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!username || !password || password.length > 128) return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  const account = await db.account.findUnique({ where: { username } });
  if (!account || (account.lockedUntil && account.lockedUntil > new Date())) {
    return NextResponse.json({ error: "Invalid username or password. Try again later if needed." }, { status: 401 });
  }
  if (!(await verifyPassword(password, account.passwordHash))) {
    const attempts = account.failedLogins + 1;
    await db.account.update({ where: { id: account.id }, data: {
      failedLogins: attempts >= 5 ? 0 : attempts,
      lockedUntil: attempts >= 5 ? new Date(Date.now() + 15 * 60_000) : null,
    } });
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }
  await db.account.update({ where: { id: account.id }, data: { failedLogins: 0, lockedUntil: null } });
  await createSession(account.personId);
  return NextResponse.json({ ok: true });
}
