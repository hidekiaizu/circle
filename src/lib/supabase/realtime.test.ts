import { describe, expect, it } from "vitest";
import { reduceRealtimeGraph } from "./realtime";
import { graphFromRows, type PersonRow, type RelationshipRow } from "./rows";

const a: PersonRow = {
  id: "a",
  name: "A",
  created_at: "2026-01-01T00:00:00.000Z",
  claimed: true,
  claim_token: "a-token",
  major: "CS",
  year: null,
  residence: null,
  hometown: null,
  clubs: ["ScottyLabs"],
};
const b: PersonRow = { ...a, id: "b", name: "B", claimed: false, claim_token: "b-token" };
const relationship: RelationshipRow = {
  id: "ab",
  person_a_id: "a",
  person_b_id: "b",
  category: 3,
  proposed_by_person_id: "a",
  confirmed: false,
  created_at: "2026-01-01T00:00:00.000Z",
};

describe("Supabase row mapping and realtime reduction", () => {
  it("maps database rows into the domain model", () => {
    const graph = graphFromRows([a, b], [relationship]);
    expect(graph.people[0].attributes).toEqual({ major: "CS", clubs: ["ScottyLabs"] });
    expect(graph.relationships[0]).toMatchObject({ category: 3, confirmed: false });
  });

  it("deduplicates echoed inserts and applies updates", () => {
    const graph = graphFromRows([a, b], [relationship]);
    const inserted = reduceRealtimeGraph(graph, {
      table: "relationships",
      event: "INSERT",
      row: relationship,
    });
    expect(inserted.relationships).toHaveLength(1);
    const confirmed = reduceRealtimeGraph(inserted, {
      table: "relationships",
      event: "UPDATE",
      row: { ...relationship, confirmed: true },
    });
    expect(confirmed.relationships[0].confirmed).toBe(true);
  });

  it("cascades a realtime person deletion locally", () => {
    const graph = graphFromRows([a, b], [relationship]);
    const next = reduceRealtimeGraph(graph, { table: "people", event: "DELETE", id: "a" });
    expect(next.people.map((person) => person.id)).toEqual(["b"]);
    expect(next.relationships).toEqual([]);
  });

  it("removes relationships by realtime id", () => {
    const graph = graphFromRows([a, b], [relationship]);
    const next = reduceRealtimeGraph(graph, {
      table: "relationships",
      event: "DELETE",
      id: "ab",
    });
    expect(next.relationships).toEqual([]);
  });
});
