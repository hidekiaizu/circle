import { describe, expect, it } from "vitest";
import {
  activeFilterChips,
  activeFilterCount,
  attributeOptions,
  clearChipFilters,
  clearFilter,
  CLOSENESS_OPTIONS,
  colorForKey,
  EMPTY_FILTERS,
  filterGraphData,
} from "./selectors";
import { CATEGORY, type GraphData } from "./types";

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
    {
      id: "bc",
      personAId: "b",
      personBId: "c",
      category: 2,
      createdAt: "2026-01-01T00:00:00.000Z",
      proposedByPersonId: "b",
      confirmed: true,
    },
  ],
};

const relationshipIds = (graph: GraphData) =>
  graph.relationships.map((relationship) => relationship.id);

describe("profile graph selectors", () => {
  it("deduplicates and sorts attribute options case-insensitively", () => {
    expect(attributeOptions(data.people, "major")).toEqual([
      "Computer Science",
      "Economics",
    ]);
  });

  it("filters people and removes edges whose endpoints are filtered out", () => {
    const filtered = filterGraphData(data, {
      ...EMPTY_FILTERS,
      major: "computer science",
    });
    expect(filtered.people.map((person) => person.id)).toEqual(["a", "b"]);
    expect(relationshipIds(filtered)).toEqual(["ab"]);
  });

  it("keeps every relationship in the default view", () => {
    expect(EMPTY_FILTERS.minCategory).toBe(CATEGORY.Acquaintance);
    expect(relationshipIds(filterGraphData(data, EMPTY_FILTERS))).toEqual([
      "ab",
      "ac",
      "bc",
    ]);
  });

  it("drops ties below the closeness threshold but retains Familiar ties", () => {
    const filtered = filterGraphData(data, {
      ...EMPTY_FILTERS,
      minCategory: CATEGORY.Friend,
    });
    // bc (Acquaintance) is removed; ab (Friend) stays; ac (Familiar) is kept
    // in the data so it still feeds mutual strength (the canvas hides it).
    expect(relationshipIds(filtered)).toEqual(["ab", "ac"]);
  });

  it("keeps everything for All connections", () => {
    const filtered = filterGraphData(data, {
      ...EMPTY_FILTERS,
      minCategory: CATEGORY.Familiar,
    });
    expect(relationshipIds(filtered)).toEqual(["ab", "ac", "bc"]);
  });

  it("offers the four named closeness options", () => {
    expect(CLOSENESS_OPTIONS).toEqual([
      { label: "All connections", value: CATEGORY.Familiar },
      { label: "Acquaintance or closer", value: CATEGORY.Acquaintance },
      { label: "Friend or closer", value: CATEGORY.Friend },
      { label: "Close Friend or closer", value: CATEGORY.CloseFriend },
    ]);
  });

  it("counts active filters relative to the default view", () => {
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
    expect(
      activeFilterCount({ ...EMPTY_FILTERS, major: "Economics", year: "2029" }),
    ).toBe(2);
    expect(
      activeFilterCount({ ...EMPTY_FILTERS, minCategory: CATEGORY.Familiar }),
    ).toBe(0);
    expect(
      activeFilterChips({ ...EMPTY_FILTERS, minCategory: CATEGORY.Familiar }),
    ).toEqual([]);
    expect(
      activeFilterCount({
        major: "Economics",
        year: "2029",
        residence: "Mudge",
        minCategory: CATEGORY.CloseFriend,
      }),
    ).toBe(4);
  });

  it("labels active filter chips", () => {
    expect(activeFilterChips(EMPTY_FILTERS)).toEqual([]);
    expect(
      activeFilterChips({
        major: "Computer Science",
        year: "",
        residence: "Mudge",
        minCategory: CATEGORY.Friend,
      }),
    ).toEqual([
      { key: "major", label: "Major: Computer Science" },
      { key: "residence", label: "Residence: Mudge" },
      { key: "minCategory", label: "Friend or closer" },
    ]);
  });

  it("clears only the requested filter", () => {
    const filters = {
      major: "Economics",
      year: "2029",
      residence: "Mudge",
      minCategory: CATEGORY.CloseFriend,
    } as const;
    expect(clearFilter(filters, "year")).toEqual({ ...filters, year: "" });
    expect(clearFilter(filters, "minCategory")).toEqual({
      ...filters,
      minCategory: CATEGORY.Acquaintance,
    });
    expect(filters.year).toBe("2029");
  });

  it("clears all chip-backed filters but keeps All connections", () => {
    expect(
      clearChipFilters({
        major: "Economics",
        year: "2029",
        residence: " ",
        minCategory: CATEGORY.Familiar,
      }),
    ).toEqual({
      major: "",
      year: "",
      residence: " ",
      minCategory: CATEGORY.Familiar,
    });
    expect(
      clearChipFilters({
        major: "Economics",
        year: "",
        residence: "Mudge",
        minCategory: CATEGORY.CloseFriend,
      }),
    ).toEqual(EMPTY_FILTERS);
    expect(clearChipFilters(EMPTY_FILTERS)).toEqual(EMPTY_FILTERS);
  });

  it("assigns deterministic colors", () => {
    expect(colorForKey("Computer Science")).toBe(colorForKey("Computer Science"));
    expect(colorForKey("Not set")).toBe("#64748b");
  });
});
