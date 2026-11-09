import { computeStrength } from "./strength";
import type { GraphData, Person } from "./types";

export type ColorBy = "major" | "year" | "residence" | "claimed";

export interface GraphFilters {
  major: string;
  year: string;
  residence: string;
  minStrength: number;
}

export const EMPTY_FILTERS: GraphFilters = {
  major: "",
  year: "",
  residence: "",
  minStrength: 0,
};

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
      computeStrength(relationship, data) >= filters.minStrength,
  );
  return { people, relationships };
}
