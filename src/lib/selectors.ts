import { CATEGORY, type Category, type GraphData, type Person } from "./types";

export type ColorBy = "major" | "year" | "residence" | "claimed";

export interface GraphFilters {
  major: string;
  year: string;
  residence: string;
  /**
   * Weakest relationship category shown. Familiar ties are never removed from
   * the filtered data (they still feed mutual-friend strength); the canvas
   * hides them whenever this is above Familiar.
   */
  minCategory: Category;
}

export const EMPTY_FILTERS: GraphFilters = {
  major: "",
  year: "",
  residence: "",
  // Matches the long-standing default of hiding weak (Familiar) ties.
  minCategory: CATEGORY.Acquaintance,
};

/** Named closeness thresholds offered by the Filters sheet. */
export const CLOSENESS_OPTIONS: { label: string; value: Category }[] = [
  { label: "All connections", value: CATEGORY.Familiar },
  { label: "Acquaintance or closer", value: CATEGORY.Acquaintance },
  { label: "Friend or closer", value: CATEGORY.Friend },
  { label: "Close Friend or closer", value: CATEGORY.CloseFriend },
];

export type FilterKey = "major" | "year" | "residence" | "minCategory";

const ATTRIBUTE_FILTERS: { key: "major" | "year" | "residence"; label: string }[] = [
  { key: "major", label: "Major" },
  { key: "year", label: "Year" },
  { key: "residence", label: "Residence" },
];

/** Number of filters that hide something compared with the default view. */
export function activeFilterCount(filters: GraphFilters): number {
  return activeFilterChips(filters).length;
}

/**
 * One dismissible chip per active filter, in display order. Only choices that
 * hide something count: "All connections" shows more than the default view,
 * so it is a display choice and gets no chip (dismissing one would hide weak
 * ties again).
 */
export function activeFilterChips(
  filters: GraphFilters,
): { key: FilterKey; label: string }[] {
  const chips: { key: FilterKey; label: string }[] = [];
  for (const { key, label } of ATTRIBUTE_FILTERS) {
    const value = filters[key].trim();
    if (value) chips.push({ key, label: `${label}: ${value}` });
  }
  if (filters.minCategory > EMPTY_FILTERS.minCategory) {
    const option = CLOSENESS_OPTIONS.find((o) => o.value === filters.minCategory);
    chips.push({
      key: "minCategory",
      label: option?.label ?? "Custom closeness",
    });
  }
  return chips;
}

/** Reset a single filter to its default value, leaving the others intact. */
export function clearFilter(filters: GraphFilters, key: FilterKey): GraphFilters {
  return { ...filters, [key]: EMPTY_FILTERS[key] };
}

/**
 * Reset every filter that has a chip ("Clear all" in the chip row). Closeness
 * at or below the default (e.g. "All connections") has no chip, so it is kept.
 */
export function clearChipFilters(filters: GraphFilters): GraphFilters {
  return activeFilterChips(filters).reduce(
    (current, chip) => clearFilter(current, chip.key),
    filters,
  );
}

function normalized(value: string | undefined): string {
  return value?.trim().toLocaleLowerCase() ?? "";
}

export function attributeOptions(
  people: Person[],
  field: "major" | "year" | "residence",
): string[] {
  const values = new Map<string, string>();
  for (const person of people) {
    const value = person.attributes?.[field]?.trim();
    if (value && !values.has(normalized(value))) values.set(normalized(value), value);
  }
  return [...values.values()].sort((a, b) => a.localeCompare(b));
}

export function colorKeyFor(person: Person, colorBy: ColorBy): string {
  if (colorBy === "claimed") return person.claimed ? "Claimed" : "Unclaimed";
  return person.attributes?.[colorBy]?.trim() || "Not set";
}

const PALETTE = [
  "#a5b4fc",
  "#67e8f9",
  "#6ee7b7",
  "#f9a8d4",
  "#fde68a",
  "#c4b5fd",
  "#fdba74",
  "#93c5fd",
];

export function colorForKey(key: string): string {
  if (key === "Unclaimed" || key === "Not set") return "#64748b";
  let hash = 0;
  for (const character of key) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export function filterGraphData(data: GraphData, filters: GraphFilters): GraphData {
  const people = data.people.filter((person) => {
    const attributes = person.attributes;
    return (
      (!filters.major || normalized(attributes?.major) === normalized(filters.major)) &&
      (!filters.year || normalized(attributes?.year) === normalized(filters.year)) &&
      (!filters.residence ||
        normalized(attributes?.residence) === normalized(filters.residence))
    );
  });
  const ids = new Set(people.map((person) => person.id));
  const relationships = data.relationships.filter(
    (relationship) =>
      ids.has(relationship.personAId) &&
      ids.has(relationship.personBId) &&
      // Familiar ties stay in the data (the canvas hides them) so they keep
      // contributing to mutual-friend strength exactly as before.
      (relationship.category === CATEGORY.Familiar ||
        relationship.category >= filters.minCategory),
  );
  return { people, relationships };
}
