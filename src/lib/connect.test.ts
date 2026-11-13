import { describe, expect, it } from "vitest";
import { hasExactNameMatch, searchConnectCandidates } from "./connect";
import type { Category, GraphData, Person, Relationship } from "./types";

function person(id: string, name: string): Person {
  return {
    id,
    name,
    createdAt: "2026-01-01T00:00:00.000Z",
    claimed: true,
    claimToken: `token-${id}`,
  };
}

function relationship(
  id: string,
  personAId: string,
  personBId: string,
  category: Category,
): Relationship {
  return {
    id,
    personAId,
    personBId,
    category,
    createdAt: "x",
    proposedByPersonId: personAId,
    confirmed: true,
  };
}

// "me" knows Ann (Friend) and Mia; Annabel shares two mutuals with me,
// Joanna shares one, Anne shares none.
const data: GraphData = {
  people: [
    person("me", "Ann Me"),
    person("ann", "Ann"),
    person("mia", "Mia"),
    person("annabel", "Annabel"),
    person("joanna", "Joanna"),
    person("anne", "Anne"),
    person("bo", "Bo Annex"),
  ],
  relationships: [
    relationship("r1", "me", "ann", 3),
    relationship("r2", "me", "mia", 2),
    relationship("r3", "annabel", "ann", 3),
    relationship("r4", "annabel", "mia", 3),
    relationship("r5", "joanna", "ann", 3),
  ],
};

const ids = (results: { person: Person }[]) => results.map((r) => r.person.id);

describe("searchConnectCandidates", () => {
  it("never returns the current user", () => {
    expect(ids(searchConnectCandidates("me", "ann", data))).not.toContain("me");
    expect(ids(searchConnectCandidates("me", "", data))).not.toContain("me");
  });

  it("matches names case-insensitively by substring after trimming", () => {
    expect(ids(searchConnectCandidates("me", "  ANNA ", data)).sort()).toEqual([
      "annabel",
      "joanna",
    ]);
    expect(searchConnectCandidates("me", "zzz", data)).toEqual([]);
  });

  it("orders exact, then prefix, then word prefix, then substring matches", () => {
    expect(ids(searchConnectCandidates("me", "ann", data))).toEqual([
      "ann", // exact
      "annabel", // prefix, 2 mutual
      "anne", // prefix, 0 mutual
      "bo", // word prefix ("Annex")
      "joanna", // substring, despite 1 mutual
    ]);
  });

  it("breaks ties within a tier by mutual count, then name", () => {
    expect(ids(searchConnectCandidates("me", "an", data)).slice(0, 3)).toEqual([
      "annabel",
      "ann",
      "anne",
    ]);
  });

  it("reports the existing category with me", () => {
    const results = searchConnectCandidates("me", "ann", data);
    expect(results.find((r) => r.person.id === "ann")?.category).toBe(3);
    expect(results.find((r) => r.person.id === "annabel")?.category).toBeNull();
    expect(results.find((r) => r.person.id === "annabel")?.mutualCount).toBe(2);
  });

  it("suggests only unconnected people for an empty query, best first", () => {
    const results = searchConnectCandidates("me", "   ", data);
    expect(ids(results)).not.toContain("ann");
    expect(ids(results)).not.toContain("mia");
    expect(ids(results)[0]).toBe("annabel");
    expect(results.every((r) => r.category === null)).toBe(true);
  });

  it("respects the limit", () => {
    expect(searchConnectCandidates("me", "", data, 2)).toHaveLength(2);
    expect(searchConnectCandidates("me", "a", data, 3)).toHaveLength(3);
  });
});

describe("hasExactNameMatch", () => {
  it("detects an exact, case-insensitive name among the results", () => {
    const results = searchConnectCandidates("me", "ann", data);
    expect(hasExactNameMatch(" ANN ", results)).toBe(true);
    expect(hasExactNameMatch("an", results)).toBe(false);
    expect(hasExactNameMatch("", results)).toBe(false);
  });
});
