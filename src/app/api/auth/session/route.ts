import { currentPersonId } from "@/lib/server/auth";

export async function GET() {
  const personId = await currentPersonId();
  return Response.json({ personId }, { headers: { "Cache-Control": "no-store" } });
}
