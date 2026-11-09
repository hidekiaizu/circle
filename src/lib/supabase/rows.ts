import { isCategory, type GraphData, type Person, type Relationship } from "../types";

export interface PersonRow {
  id: string;
  name: string;
  created_at: string;
  updated_at?: string;
  claimed: boolean;
  claim_token: string;
  major: string | null;
  year: string | null;
  residence: string | null;
  hometown: string | null;
  clubs: string[] | null;
}

export interface RelationshipRow {
  id: string;
  person_a_id: string;
  person_b_id: string;
  category: number;
  proposed_by_person_id: string;
  confirmed: boolean;
  created_at: string;
  updated_at?: string;
}

export function personFromRow(row: PersonRow): Person {
  const attributes = {
    ...(row.major ? { major: row.major } : {}),
    ...(row.year ? { year: row.year } : {}),
    ...(row.residence ? { residence: row.residence } : {}),
    ...(row.hometown ? { hometown: row.hometown } : {}),
    ...(row.clubs?.length ? { clubs: row.clubs } : {}),
  };
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    claimed: row.claimed,
    claimToken: row.claim_token,
    ...(Object.keys(attributes).length ? { attributes } : {}),
  };
}

export function relationshipFromRow(row: RelationshipRow): Relationship {
  if (!isCategory(row.category)) {
    throw new Error(`Invalid relationship category for ${row.id}.`);
  }
  return {
    id: row.id,
    personAId: row.person_a_id,
    personBId: row.person_b_id,
    category: row.category,
    proposedByPersonId: row.proposed_by_person_id,
    confirmed: row.confirmed,
    createdAt: row.created_at,
  };
}

export function personToRow(person: Person): Omit<PersonRow, "updated_at"> {
  return {
    id: person.id,
    name: person.name,
    created_at: person.createdAt,
    claimed: person.claimed,
    claim_token: person.claimToken,
    major: person.attributes?.major || null,
    year: person.attributes?.year || null,
    residence: person.attributes?.residence || null,
    hometown: person.attributes?.hometown || null,
    clubs: person.attributes?.clubs ?? [],
  };
}

export function relationshipToRow(
  relationship: Relationship,
): Omit<RelationshipRow, "updated_at"> {
  return {
    id: relationship.id,
    person_a_id: relationship.personAId,
    person_b_id: relationship.personBId,
    category: relationship.category,
    proposed_by_person_id: relationship.proposedByPersonId,
    confirmed: relationship.confirmed,
    created_at: relationship.createdAt,
  };
}

export function graphFromRows(
  people: PersonRow[],
  relationships: RelationshipRow[],
): GraphData {
  return {
    people: people.map(personFromRow),
    relationships: relationships.map(relationshipFromRow),
  };
}
