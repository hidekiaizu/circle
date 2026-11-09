import type { Relationship } from "./types";

/** A person may only edit the profile they claimed in this browser. */
export function canEditProfile(
  claimedPersonId: string | null,
  personId: string,
): boolean {
  return claimedPersonId !== null && claimedPersonId === personId;
}

/** Relationship edits are limited to connections involving the current user. */
export function canEditRelationship(
  claimedPersonId: string | null,
  relationship: Pick<Relationship, "personAId" | "personBId">,
): boolean {
  return (
    claimedPersonId !== null &&
    (relationship.personAId === claimedPersonId ||
      relationship.personBId === claimedPersonId)
  );
}

/** New connections must have the current user as one endpoint. */
export function canConnectPair(
  claimedPersonId: string | null,
  personAId: string,
  personBId: string,
): boolean {
  return (
    claimedPersonId !== null &&
    personAId !== personBId &&
    (personAId === claimedPersonId || personBId === claimedPersonId)
  );
}
