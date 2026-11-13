import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { createSession, sameOrigin } from "@/lib/server/auth";
import { hashPassword, normalizeUsername, tokenHash, validPassword, validUsername } from "@/lib/credentials";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  const body = await request.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : "";
  const username = typeof body?.username === "string" ? normalizeUsername(body.username) : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!/^[a-f0-9]{64}$/.test(token) || !validUsername(username) || !validPassword(password) || !name || name.length > 120) {
    return NextResponse.json({ error: "Check the name, username, and password." }, { status: 400 });
  }
  const passwordHash = await hashPassword(password);
  try {
    const personId = await db.$transaction(async (tx) => {
      const person = await tx.person.findUnique({ where: { claimToken: tokenHash(token) }, include: { account: true } });
      if (!person || !person.claimTokenExpiresAt || person.claimTokenExpiresAt <= new Date() || person.account) throw new Error("INVALID_INVITE");
      const updated = await tx.person.updateMany({ where: { id: person.id, claimToken: tokenHash(token), claimTokenExpiresAt: { gt: new Date() } }, data: {
        name, claimed: true, claimToken: tokenHash(crypto.randomUUID()), claimTokenExpiresAt: null,
      } });
      if (updated.count !== 1) throw new Error("INVALID_INVITE");
      await tx.account.create({ data: { personId: person.id, username, passwordHash } });
      return person.id;
    });
    await createSession(personId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error && error.message === "INVALID_INVITE"
      ? "This invitation is invalid, expired, or already used."
      : "That username may already be taken. Try another one.";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
