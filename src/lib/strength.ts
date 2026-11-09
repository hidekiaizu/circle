import { CATEGORY, type GraphData, type Person, type Relationship } from "./types";

/** Context can influence an edge, but never outweigh its reported category. */
const CONTEXT_WEIGHT = 0.3;
const MUTUALS_FOR_FULL_SIGNAL = 3;

function clampStrength(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Map the reported 1..5 category to a clamped 0..1 baseline. */
export function strengthFromCategory(
  category: Relationship["category"],
): number {
  return clampStrength((category - 1) / 4);
}

/** Familiarity is useful context, but does not form the default graph shape. */
export function isStructuralEdge(relationship: Relationship): boolean {
  return relationship.category > CATEGORY.Familiar;
}

function normalized(value: string | undefined): string | null {
  const result = value?.trim().toLowerCase();
  return result ? result : null;
}

function sharesValue(
  a: string | undefined,
  b: string | undefined,
): boolean {
  const normalizedA = normalized(a);
  return normalizedA !== null && normalizedA === normalized(b);
}

function sharesClub(a: Person, b: Person): boolean {
  const aClubs = new Set(
    (a.attributes?.clubs ?? [])
      .map(normalized)
      .filter((club): club is string => club !== null),
  );
  return (b.attributes?.clubs ?? []).some((club) => {
    const value = normalized(club);
    return value !== null && aClubs.has(value);
  });
}

function mutualCount(
  personAId: string,
  personBId: string,
  data: GraphData,
): number {
  const neighborsA = new Set<string>();
  const neighborsB = new Set<string>();

  for (const relationship of data.relationships) {
    if (relationship.personAId === personAId) {
      neighborsA.add(relationship.personBId);
    } else if (relationship.personBId === personAId) {
      neighborsA.add(relationship.personAId);
    }

    if (relationship.personAId === personBId) {
      neighborsB.add(relationship.personBId);
    } else if (relationship.personBId === personBId) {
      neighborsB.add(relationship.personAId);
    }
  }

  let count = 0;
  for (const id of neighborsA) {
    if (neighborsB.has(id)) count += 1;
  }
  return count;
}

/**
 * Compute visual relationship strength in the range 0..1.
 *
 * The reported category is the baseline. Shared profile context and mutual
 * friends can add a modest boost, but they cannot turn similarity into a
 * strong friendship by themselves. The five profile signals (major, year,
 * residence, hometown, clubs) and mutual-friend signal receive equal weight.
 * Missing attributes add no boost.
 *
 * Calling without graph data preserves the original category-only behavior.
 */
export function computeStrength(
  relationship: Relationship,
  data?: GraphData,
): number {
  const baseline = strengthFromCategory(relationship.category);
  if (!data) return baseline;

  const personA = data.people.find(
    (person) => person.id === relationship.personAId,
  );
  const personB = data.people.find(
    (person) => person.id === relationship.personBId,
  );
  if (!personA || !personB) return baseline;

  const profileSignals = [
    sharesValue(personA.attributes?.major, personB.attributes?.major),
    sharesValue(personA.attributes?.year, personB.attributes?.year),
    sharesValue(personA.attributes?.residence, personB.attributes?.residence),
    sharesValue(personA.attributes?.hometown, personB.attributes?.hometown),
    sharesClub(personA, personB),
  ];
  const profileScore = profileSignals.filter(Boolean).length;
  const mutualScore = Math.min(
    mutualCount(personA.id, personB.id, data) / MUTUALS_FOR_FULL_SIGNAL,
    1,
  );
  const contextScore = (profileScore + mutualScore) / 6;

  const boosted =
    baseline + (1 - baseline) * CONTEXT_WEIGHT * contextScore;
  return clampStrength(boosted);
}
