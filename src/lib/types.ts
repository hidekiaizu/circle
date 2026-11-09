/**
 * Core domain types for Circle's shared social graph.
 *
 * A Person is a claimable profile node. A Relationship is an undirected,
 * proposed connection whose category records the self-reported closeness.
 */

/** Relationship categories, 1 (weakest) to 5 (strongest). */
export const CATEGORY = {
  Familiar: 1,
  Acquaintance: 2,
  Friend: 3,
  CloseFriend: 4,
  VeryCloseFriend: 5,
} as const;

export type Category = (typeof CATEGORY)[keyof typeof CATEGORY];

/** Human-readable labels for each category value. */
export const CATEGORY_LABELS: Record<Category, string> = {
  1: "Familiar",
  2: "Acquaintance",
  3: "Friend",
  4: "Close Friend",
  5: "Very Close Friend",
};

/**
 * Behavioral definitions so classifications are consistent rather than
 * guessed. Surfaced in the Key and inline at classification time.
 */
export const CATEGORY_DEFINITIONS: Record<Category, string> = {
  1: "You recognize each other and might nod or say hi, but haven't really talked.",
  2: "You've had real conversations and know a few basics about each other, but don't seek each other out.",
  3: "You hang out intentionally and stay in loose contact.",
  4: "You talk regularly, share personal things, and make time for each other.",
  5: "One of the people you rely on most; frequent contact and deep trust.",
};

/** Ordered list of categories for building menus and legends. */
export const CATEGORY_OPTIONS: {
  value: Category;
  label: string;
  definition: string;
}[] = ([1, 2, 3, 4, 5] as Category[]).map((value) => ({
  value,
  label: CATEGORY_LABELS[value],
  definition: CATEGORY_DEFINITIONS[value],
}));

export function isCategory(value: number): value is Category {
  return value >= 1 && value <= 5 && Number.isInteger(value);
}

/**
 * Profile attributes for a person. Every field is optional so unclaimed nodes
 * and partially completed profiles remain valid.
 */
export interface PersonAttributes {
  /** Academic major, for example "Computer Science". */
  major?: string;
  /** Class year, for example "2027" or "Junior". */
  year?: string;
  /** Current dorm or neighborhood, for example "Morewood". */
  residence?: string;
  /** Place of origin, for example "Seattle, WA". */
  hometown?: string;
  /** Clubs and organizations the person belongs to. */
  clubs?: string[];
}

export interface Person {
  id: string;
  name: string;
  createdAt: string; // ISO timestamp
  /** Whether a real user has claimed this profile as their identity. */
  claimed: boolean;
  /** Unique per-node token used by the profile's invite and claim link. */
  claimToken: string;
  attributes?: PersonAttributes;
}

export interface Relationship {
  id: string;
  personAId: string;
  personBId: string;
  category: Category;
  createdAt: string; // ISO timestamp
  /** The endpoint that proposed this connection. */
  proposedByPersonId: string;
  /** Whether the endpoint opposite the proposer has confirmed the connection. */
  confirmed: boolean;
}

export interface GraphData {
  people: Person[];
  relationships: Relationship[];
}
