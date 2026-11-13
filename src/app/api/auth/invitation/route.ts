import { db } from "@/lib/server/db";
import { tokenHash } from "@/lib/credentials";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!/^[a-f0-9]{64}$/.test(token)) return new Response(null, { status: 404 });
  const person = await db.person.findUnique({ where: { claimToken: tokenHash(token) }, include: { account: true } });
  if (!person || person.account || !person.claimTokenExpiresAt || person.claimTokenExpiresAt <= new Date()) {
    return new Response(null, { status: 404 });
  }
  return Response.json({ name: person.name }, { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
