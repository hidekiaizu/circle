import { describe, expect, it } from "vitest";
import { attributeOptions, colorForKey, filterGraphData } from "./selectors";
import type { GraphData } from "./types";

const data: GraphData = {
  people: [
    {
      id: "a",
      name: "A",
      createdAt: "2026-01-01T00:00:00.000Z",
      claimed: true,
      claimToken: "a-token",
      attributes: { major: "Computer Science", year: "2029", residence: "Mudge" },
    },
    {
      id: "b",
      name: "B",
      createdAt: "2026-01-01T00:00:00.000Z",
      claimed: false,
      claimToken: "b-token",
      attributes: { major: " computer science ", year: "2028", residence: "Mudge" },
    },
    {
      id: "c",
      name: "C",
      createdAt: "2026-01-01T00:00:00.000Z",
      claimed: false,
      claimToken: "c-token",
      attributes: { major: "Economics", year: "2029", residence: "Morewood" },
    },
  ],
  relationships: [
    {
      id: "ab",
      personAId: "a",
      personBId: "b",
      category: 3,
      createdAt: "2026-01-01T00:00:00.000Z",
      proposedByPersonId: "a",
      confirmed: true,
    },
    {
      id: "ac",
      personAId: "a",
      personBId: "c",
      category: 1,
      createdAt: "2026-01-01T00:00:00.000Z",
      proposedByPersonId: "a",
      confirmed: false,
    },
  ],
};

describe("profile graph selectors", () => {
  it("deduplicates and sorts attribute options case-insensitively", () => {
    expect(attributeOptions(data.people, "major")).toEqual([
      "Computer Science",
      "Economics",
    ]);
  });

  it("filters people and removes edges whose endpoints are filtered out", () => {
    const filtered = filterGraphData(data, {
      major: "computer science",
      year: "",
      residence: "",
      minStrength: 0,
    });
    expect(filtered.people.map((person) => person.id)).toEqual(["a", "b"]);
    expect(filtered.relationships.map((relationship) => relationship.id)).toEqual(["ab"]);
  });

  it("applies the contextual strength threshold", () => {
    const filtered = filterGraphData(data, {
      major: "",
      year: "",
      residence: "",
      minStrength: 0.9,
    });
    expect(filtered.relationships).toEqual([]);
  });

  it("assigns deterministic colors", () => {
    expect(colorForKey("Computer Science")).toBe(colorForKey("Computer Science"));
    expect(colorForKey("Not set")).toBe("#64748b");
  });
});
