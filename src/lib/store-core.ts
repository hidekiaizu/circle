/**
 * Pure, framework-agnostic graph operations.
 *
 * These functions never mutate their input. Invalid operations and operations
 * that produce no change return the original GraphData reference.
 */

import type {
  Category,
  GraphData,
  Person,
  PersonAttributes,
  Relationship,
} from "./types";
export { computeStrength } from "./strength";

/** Generate a reasonably unique id. */
export function makeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}

/** Mint a per-node claim token for an invite link. */
export function makeClaimToken(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid.replaceAll("-", "");

  const random = `${Math.random().toString(36).slice(2)}${Math.random()
    .toString(36)
    .slice(2)}`;
  return `claim-${Date.now().toString(36)}-${random || "0"}`;
}

function makeUniqueClaimToken(data: GraphData): string {
  const existing = new Set(data.people.map((person) => person.claimToken));
  const base = makeClaimToken();
  if (!existing.has(base)) return base;

  let suffix = 2;
  while (existing.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

/** Normalize an undirected pair so (a,b) and (b,a) are treated the same. */
function sameUndirectedPair(
  relationship: Pick<Relationship, "personAId" | "personBId">,
  aId: string,
  bId: string,
): boolean {
  return (
    (relationship.personAId === aId && relationship.personBId === bId) ||
    (relationship.personAId === bId && relationship.personBId === aId)
  );
}

function sameStringArray(a: string[] | undefined, b: string[]): boolean {
  return (
    a !== undefined &&
    a.length === b.length &&
    a.every((value, index) => value === b[index])
  );
}

export const emptyGraph: GraphData = { people: [], relationships: [] };

export function addPerson(
  data: GraphData,
  name: string,
  id: string = makeId("p"),
): GraphData {
  const trimmed = name.trim();
  if (
    !trimmed ||
    !id.trim() ||
    data.people.some((person) => person.id === id)
  ) {
    return data;
  }

  const person: Person = {
    id,
    name: trimmed,
    createdAt: new Date().toISOString(),
    claimed: false,
    claimToken: makeUniqueClaimToken(data),
  };
  return { ...data, people: [...data.people, person] };
}

/** Add a person and their first connection as one in-memory graph change. */
export function addConnectedPerson(
  data: GraphData,
  ownerId: string,
  name: string,
  category: Category,
  personId: string = makeId("p"),
): GraphData {
  const withPerson = addPerson(data, name, personId);
  if (withPerson === data) return data;

  const connected = addRelationship(
    withPerson,
    ownerId,
    personId,
    category,
    ownerId,
  );
  return connected === withPerson ? data : connected;
}

export function renamePerson(
  data: GraphData,
  personId: string,
  name: string,
): GraphData {
  const trimmed = name.trim();
  const person = data.people.find((candidate) => candidate.id === personId);
  if (!trimmed || !person || person.name === trimmed) return data;

  return {
    ...data,
    people: data.people.map((candidate) =>
      candidate.id === personId ? { ...candidate, name: trimmed } : candidate,
    ),
  };
}

/**
 * Merge normalized profile attributes onto a person. Undefined fields are
 * ignored. Empty strings and arrays are retained as intentional clears.
 */
export function setAttributes(
  data: GraphData,
  personId: string,
  attributes: PersonAttributes,
): GraphData {
  const person = data.people.find((candidate) => candidate.id === personId);
  if (!person) return data;

  const nextAttributes: PersonAttributes = { ...person.attributes };
  let changed = false;
  const stringFields = [
    "major",
    "year",
    "residence",
    "hometown",
  ] as const;

  for (const field of stringFields) {
    const value = attributes[field];
    if (value === undefined) continue;

    const normalized = value.trim();
    if (nextAttributes[field] !== normalized) {
      nextAttributes[field] = normalized;
      changed = true;
    }
  }

  if (attributes.clubs !== undefined) {
    const seen = new Set<string>();
    const normalized = attributes.clubs
      .map((club) => club.trim())
      .filter((club) => {
        const key = club.toLowerCase();
        if (!club || seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    if (!sameStringArray(nextAttributes.clubs, normalized)) {
      nextAttributes.clubs = normalized;
      changed = true;
    }
  }

  if (!changed) return data;

  return {
    ...data,
    people: data.people.map((candidate) =>
      candidate.id === personId
        ? { ...candidate, attributes: nextAttributes }
        : candidate,
    ),
  };
}

/**
 * Claim an unclaimed profile. The supplied token must exactly match the
 * profile's nonempty claim token.
 */
export function claimPerson(
  data: GraphData,
  personId: string,
  claimToken: string,
): GraphData {
  const person = data.people.find((candidate) => candidate.id === personId);
  if (
    !person ||
    person.claimed ||
    !claimToken ||
    !person.claimToken ||
    person.claimToken !== claimToken
  ) {
    return data;
  }

  return {
    ...data,
    people: data.people.map((candidate) =>
      candidate.id === personId ? { ...candidate, claimed: true } : candidate,
    ),
  };
}

/** Remove a person and every relationship incident to them. */
export function removePerson(data: GraphData, personId: string): GraphData {
  if (!data.people.some((person) => person.id === personId)) return data;

  return {
    people: data.people.filter((person) => person.id !== personId),
    relationships: data.relationships.filter(
      (relationship) =>
        relationship.personAId !== personId &&
        relationship.personBId !== personId,
    ),
  };
}

/**
 * Add a proposed relationship between two existing people. Relationships are
 * undirected, but the proposer must be one of the two endpoints.
 */
export function addRelationship(
  data: GraphData,
  personAId: string,
  personBId: string,
  category: Category,
  proposedByPersonId: string = personAId,
): GraphData {
  if (personAId === personBId) return data;

  const ids = new Set(data.people.map((person) => person.id));
  if (!ids.has(personAId) || !ids.has(personBId)) return data;
  if (
    proposedByPersonId !== personAId &&
    proposedByPersonId !== personBId
  ) {
    return data;
  }
  if (
    data.relationships.some((relationship) =>
      sameUndirectedPair(relationship, personAId, personBId),
    )
  ) {
    return data;
  }

  const relationship: Relationship = {
    id: makeId("r"),
    personAId,
    personBId,
    category,
    createdAt: new Date().toISOString(),
    proposedByPersonId,
    confirmed: false,
  };
  return { ...data, relationships: [...data.relationships, relationship] };
}

export function updateRelationshipCategory(
  data: GraphData,
  relationshipId: string,
  category: Category,
): GraphData {
  const relationship = data.relationships.find(
    (candidate) => candidate.id === relationshipId,
  );
  if (!relationship || relationship.category === category) return data;

  return {
    ...data,
    relationships: data.relationships.map((candidate) =>
      candidate.id === relationshipId
        ? { ...candidate, category }
        : candidate,
    ),
  };
}

/**
 * Confirm a proposal as the endpoint opposite its proposer. Proposers,
 * unrelated people, and repeated confirmation attempts cannot change it.
 */
export function confirmRelationship(
  data: GraphData,
  relationshipId: string,
  confirmerPersonId: string,
): GraphData {
  const relationship = data.relationships.find(
    (candidate) => candidate.id === relationshipId,
  );
  if (!relationship || relationship.confirmed) return data;

  let expectedConfirmer: string;
  if (relationship.proposedByPersonId === relationship.personAId) {
    expectedConfirmer = relationship.personBId;
  } else if (relationship.proposedByPersonId === relationship.personBId) {
    expectedConfirmer = relationship.personAId;
  } else {
    return data;
  }
  if (confirmerPersonId !== expectedConfirmer) return data;

  return {
    ...data,
    relationships: data.relationships.map((candidate) =>
      candidate.id === relationshipId
        ? { ...candidate, confirmed: true }
        : candidate,
    ),
  };
}

/** Find the relationship between two people, regardless of endpoint order. */
export function findRelationship(
  data: GraphData,
  aId: string,
  bId: string,
): Relationship | undefined {
  return data.relationships.find((relationship) =>
    sameUndirectedPair(relationship, aId, bId),
  );
}

/**
 * Set the connection between two people in one call. A null category removes
 * an existing connection, an existing pair is updated, and a missing pair is
 * proposed.
 */
export function setRelationship(
  data: GraphData,
  aId: string,
  bId: string,
  category: Category | null,
  proposedByPersonId: string = aId,
): GraphData {
  if (aId === bId) return data;
  const existing = findRelationship(data, aId, bId);

  if (category === null) {
    return existing ? removeRelationship(data, existing.id) : data;
  }
  if (existing) {
    return updateRelationshipCategory(data, existing.id, category);
  }
  return addRelationship(data, aId, bId, category, proposedByPersonId);
}

export function removeRelationship(
  data: GraphData,
  relationshipId: string,
): GraphData {
  if (
    !data.relationships.some(
      (relationship) => relationship.id === relationshipId,
    )
  ) {
    return data;
  }

  return {
    ...data,
    relationships: data.relationships.filter(
      (relationship) => relationship.id !== relationshipId,
    ),
  };
}
