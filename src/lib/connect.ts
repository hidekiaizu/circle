import { rankCandidatesFor } from "./graph";
import type { Category, GraphData, Person } from "./types";

/** One row in the add-connection search results. */
export interface ConnectCandidate {
  person: Person;
  /** The existing relationship category between me and this person, or null. */
  category: Category | null;
  /** How many people this person shares with me. */
  mutualCount: number;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * How well a name matches a normalized query: 0 exact, 1 prefix of the full
 * name, 2 prefix of a later word (for example a last name), 3 substring, or
 * null for no match.
 */
function matchTier(name: string, query: string): number | null {
  const normalized = normalize(name);
  if (normalized === query) return 0;
  if (normalized.startsWith(query)) return 1;
  if (normalized.split(/\s+/).some((word) => word.startsWith(query))) return 2;
  if (normalized.includes(query)) return 3;
  return null;
}

/**
 * Search existing Circle profiles to connect with. Excludes `meId`, matches
 * names case-insensitively by substring, and orders exact and prefix matches
 * before plain substring matches, then by mutual connections, then by name.
 * An empty query returns the top-ranked people I am not yet connected to.
 */
export function searchConnectCandidates(
  meId: string,
  query: string,
  data: GraphData,
  limit = 8,
): ConnectCandidate[] {
  const ranked = rankCandidatesFor(meId, data).map(
    ({ person, category, mutualCount }) => ({ person, category, mutualCount }),
  );
  const q = normalize(query);

  if (!q) {
    return ranked.filter((candidate) => candidate.category == null).slice(0, limit);
  }

  return ranked
    .map((candidate) => ({ candidate, tier: matchTier(candidate.person.name, q) }))
    .filter(
      (entry): entry is { candidate: ConnectCandidate; tier: number } =>
        entry.tier !== null,
    )
    .sort(
      (a, b) =>
        a.tier - b.tier ||
        b.candidate.mutualCount - a.candidate.mutualCount ||
        a.candidate.person.name.localeCompare(b.candidate.person.name),
    )
    .slice(0, limit)
    .map((entry) => entry.candidate);
}

/** Whether any result's name equals the query (trimmed, case-insensitive). */
export function hasExactNameMatch(
  query: string,
  candidates: ConnectCandidate[],
): boolean {
  const q = normalize(query);
  return q !== "" && candidates.some((c) => normalize(c.person.name) === q);
}
