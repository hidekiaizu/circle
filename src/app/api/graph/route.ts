import { randomBytes } from "node:crypto";
import { db } from "@/lib/server/db";
import { currentPersonId, sameOrigin } from "@/lib/server/auth";
import { tokenHash } from "@/lib/credentials";
import { isCategory } from "@/lib/types";

function deny() { return Response.json({ error: "Not authorized." }, { status: 403 }); }
function bad() { return Response.json({ error: "Invalid graph change." }, { status: 400 }); }
function textId(value: unknown): value is string { return typeof value === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(value); }
function validName(value: unknown): value is string { return typeof value === "string" && !!value.trim() && value.trim().length <= 120; }
function validCategory(value: unknown): value is number { return typeof value === "number" && isCategory(value); }

export async function GET() {
  const owner = await currentPersonId();
  if (!owner) return deny();
  const [people, relationships] = await Promise.all([
    db.person.findMany({ orderBy: { createdAt: "asc" } }),
    db.relationship.findMany({ orderBy: { createdAt: "asc" } }),
  ]);
  return Response.json({
    people: people.map(p => ({
      id: p.id, name: p.name, createdAt: p.createdAt.toISOString(), claimed: p.claimed,
      claimToken: "", attributes: { major: p.major ?? "", year: p.year ?? "", residence: p.residence ?? "", hometown: p.hometown ?? "", clubs: p.clubs },
    })),
    relationships: relationships.map(r => ({
      id: r.id, personAId: r.personAId, personBId: r.personBId, category: r.category,
      proposedByPersonId: r.proposedByPersonId, confirmed: r.confirmed, createdAt: r.createdAt.toISOString(),
    })),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return deny();
  const owner = await currentPersonId();
  if (!owner) return deny();
  const body = await request.json().catch(() => null);
  const action = body?.action;
  try {
    if (action === "addConnectedPerson") {
      const { person, relationship } = body;
      if (!textId(person?.id) || !validName(person?.name) || !textId(relationship?.id) ||
          !validCategory(relationship?.category) ||
          !((relationship.personAId === owner && relationship.personBId === person.id) ||
            (relationship.personBId === owner && relationship.personAId === person.id))) return bad();
      await db.$transaction(async tx => {
        await tx.person.create({ data: { id: person.id, name: person.name.trim(), claimed: false, claimToken: tokenHash(randomBytes(32).toString("hex")) } });
        await tx.relationship.create({ data: { id: relationship.id, personAId: relationship.personAId, personBId: relationship.personBId, category: relationship.category, proposedByPersonId: owner, confirmed: false } });
      });
    } else if (action === "addPerson") {
      return deny();
    } else if (action === "updatePerson") {
      if (body.id !== owner || typeof body.patch !== "object" || !body.patch) return deny();
      const patch = body.patch;
      if (patch.name !== undefined && !validName(patch.name)) return bad();
      const fields = ["major", "year", "residence", "hometown"] as const;
      for (const field of fields) if (patch[field] !== undefined && (typeof patch[field] !== "string" || patch[field].length > 120)) return bad();
      if (patch.clubs !== undefined && (!Array.isArray(patch.clubs) || patch.clubs.length > 30 || patch.clubs.some((v: unknown) => typeof v !== "string" || v.length > 120))) return bad();
      await db.person.update({ where: { id: owner }, data: {
        ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
        ...(patch.major !== undefined ? { major: patch.major || null } : {}),
        ...(patch.year !== undefined ? { year: patch.year || null } : {}),
        ...(patch.residence !== undefined ? { residence: patch.residence || null } : {}),
        ...(patch.hometown !== undefined ? { hometown: patch.hometown || null } : {}),
        ...(patch.clubs !== undefined ? { clubs: patch.clubs } : {}),
      } });
    } else if (action === "deletePerson") {
      if (body.id !== owner) return deny();
      await db.person.delete({ where: { id: owner } });
    } else if (action === "insertRelationship") {
      const r = body.relationship;
      if (!textId(r?.id) || !textId(r?.personAId) || !textId(r?.personBId) || r.personAId === r.personBId ||
        !validCategory(r?.category) || (r.personAId !== owner && r.personBId !== owner)) return bad();
      await db.relationship.create({ data: { id: r.id, personAId: r.personAId, personBId: r.personBId, category: r.category, proposedByPersonId: owner, confirmed: false } });
    } else if (action === "updateRelationship") {
      const r = await db.relationship.findUnique({ where: { id: body.id } });
      if (!r || (r.personAId !== owner && r.personBId !== owner)) return deny();
      if (body.patch?.category !== undefined && !validCategory(body.patch.category)) return bad();
      if (body.patch?.confirmed !== undefined && (body.patch.confirmed !== true || r.confirmed || r.proposedByPersonId === owner)) return deny();
      await db.relationship.update({ where: { id: r.id }, data: {
        ...(body.patch?.category !== undefined ? { category: body.patch.category } : {}),
        ...(body.patch?.confirmed === true ? { confirmed: true } : {}),
      } });
    } else if (action === "deleteRelationship") {
      const r = await db.relationship.findUnique({ where: { id: body.id } });
      if (!r || (r.personAId !== owner && r.personBId !== owner)) return deny();
      await db.relationship.delete({ where: { id: r.id } });
    } else return bad();
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Could not save this change." }, { status: 409 });
  }
}
