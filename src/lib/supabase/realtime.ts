import type { GraphData } from "../types";
import {
  personFromRow,
  relationshipFromRow,
  type PersonRow,
  type RelationshipRow,
} from "./rows";

export type GraphRealtimeEvent =
  | { table: "people"; event: "INSERT" | "UPDATE"; row: PersonRow }
  | { table: "people"; event: "DELETE"; id: string }
  | { table: "relationships"; event: "INSERT" | "UPDATE"; row: RelationshipRow }
  | { table: "relationships"; event: "DELETE"; id: string };

function upsertById<T extends { id: string }>(items: T[], item: T): T[] {
  const index = items.findIndex((candidate) => candidate.id === item.id);
  if (index === -1) return [...items, item];
  const next = [...items];
  next[index] = item;
  return next;
}

export function reduceRealtimeGraph(
  data: GraphData,
  event: GraphRealtimeEvent,
): GraphData {
  if (event.table === "people") {
    if (event.event === "DELETE") {
      return {
        people: data.people.filter((person) => person.id !== event.id),
        relationships: data.relationships.filter(
          (relationship) =>
            relationship.personAId !== event.id &&
            relationship.personBId !== event.id,
        ),
      };
    }
    return { ...data, people: upsertById(data.people, personFromRow(event.row)) };
  }

  if (event.event === "DELETE") {
    return {
      ...data,
      relationships: data.relationships.filter(
        (relationship) => relationship.id !== event.id,
      ),
    };
  }
  return {
    ...data,
    relationships: upsertById(
      data.relationships,
      relationshipFromRow(event.row),
    ),
  };
}
