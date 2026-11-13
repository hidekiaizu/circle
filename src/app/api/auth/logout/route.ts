import { clearSession, sameOrigin } from "@/lib/server/auth";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  await clearSession();
  return Response.json({ ok: true });
}
