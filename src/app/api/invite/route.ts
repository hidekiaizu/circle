import { randomBytes } from "node:crypto";
import { db } from "@/lib/server/db";
import { currentPersonId, sameOrigin } from "@/lib/server/auth";
import { tokenHash } from "@/lib/credentials";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  const owner = await currentPersonId();
  if (!owner) return new Response(null, { status: 403 });
  const body = await request.json().catch(() => null);
  const id = body?.personId;
  if (typeof id !== "string" || id === owner) return new Response(null, { status: 400 });
  const person = await db.person.findUnique({ where: { id }, include: { account: true } });
  if (!person || person.account) return new Response(null, { status: 404 });
  const relationship = await db.relationship.findFirst({ where: { OR: [
    { personAId: owner, personBId: id }, { personAId: id, personBId: owner },
  ] } });
  if (!relationship) return new Response(null, { status: 403 });
  const token = randomBytes(32).toString("hex");
  await db.person.update({ where: { id }, data: {
    claimToken: tokenHash(token), claimTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60_000),
  } });
  return Response.json({ url: `${new URL(request.url).origin}/claim/${token}` }, { headers: { "Cache-Control": "no-store" } });
}
