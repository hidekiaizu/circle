import type { SupabaseClient } from "@supabase/supabase-js";
import type { GraphData, Person, PersonAttributes, Relationship } from "../types";
import { getSupabaseBrowserClient } from "./client";
import type { GraphRealtimeEvent } from "./realtime";
import {
  graphFromRows,
  personToRow,
  relationshipToRow,
  type PersonRow,
  type RelationshipRow,
} from "./rows";

function unwrap(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export class GraphRepository {
  constructor(private readonly client: SupabaseClient = getSupabaseBrowserClient()) {}

  async load(): Promise<GraphData> {
    const [peopleResult, relationshipResult] = await Promise.all([
      this.client.from("people").select("*").order("created_at"),
      this.client.from("relationships").select("*").order("created_at"),
    ]);
    unwrap(peopleResult.error);
    unwrap(relationshipResult.error);
    return graphFromRows(
      (peopleResult.data ?? []) as PersonRow[],
      (relationshipResult.data ?? []) as RelationshipRow[],
    );
  }

  async insertPerson(person: Person): Promise<void> {
    const { error } = await this.client.from("people").insert(personToRow(person));
    unwrap(error);
  }

  /**
   * Persist a newly introduced person before its relationship so the
   * relationship cannot race the person's foreign-key row. If the second
   * write fails, remove the orphaned person and let the store reload.
   */
  async insertConnectedPerson(
    person: Person,
    relationship: Relationship,
  ): Promise<void> {
    await this.insertPerson(person);
    try {
      await this.insertRelationship(relationship);
    } catch (cause) {
      try {
        await this.deletePerson(person.id);
      } catch {
        // Preserve the relationship error; a reload will expose any cleanup issue.
      }
      throw cause;
    }
  }

  async updatePerson(
    id: string,
    patch: Partial<PersonAttributes> & { name?: string; claimed?: boolean },
  ): Promise<void> {
    const row = {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.claimed !== undefined ? { claimed: patch.claimed } : {}),
      ...(patch.major !== undefined ? { major: patch.major || null } : {}),
      ...(patch.year !== undefined ? { year: patch.year || null } : {}),
      ...(patch.residence !== undefined ? { residence: patch.residence || null } : {}),
      ...(patch.hometown !== undefined ? { hometown: patch.hometown || null } : {}),
      ...(patch.clubs !== undefined ? { clubs: patch.clubs } : {}),
    };
    const { error } = await this.client.from("people").update(row).eq("id", id);
    unwrap(error);
  }

  async claimPerson(id: string, token: string): Promise<boolean> {
    const { data, error } = await this.client
      .from("people")
      .update({ claimed: true })
      .eq("id", id)
      .eq("claim_token", token)
      .eq("claimed", false)
      .select("id")
      .maybeSingle();
    unwrap(error);
    return data !== null;
  }

  async deletePerson(id: string): Promise<void> {
    const { error } = await this.client.from("people").delete().eq("id", id);
    unwrap(error);
  }

  async insertRelationship(relationship: Relationship): Promise<void> {
    const { error } = await this.client
      .from("relationships")
      .insert(relationshipToRow(relationship));
    unwrap(error);
  }

  async updateRelationship(
    id: string,
    patch: { category?: number; confirmed?: boolean },
  ): Promise<void> {
    const { error } = await this.client.from("relationships").update(patch).eq("id", id);
    unwrap(error);
  }

  async deleteRelationship(id: string): Promise<void> {
    const { error } = await this.client.from("relationships").delete().eq("id", id);
    unwrap(error);
  }

  subscribe(onEvent: (event: GraphRealtimeEvent) => void): () => void {
    const channel = this.client
      .channel("circle-shared-graph")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "people" },
        (payload) => {
          if (payload.eventType === "DELETE") {
            onEvent({ table: "people", event: "DELETE", id: String(payload.old.id) });
          } else {
            onEvent({ table: "people", event: payload.eventType, row: payload.new as PersonRow });
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "relationships" },
        (payload) => {
          if (payload.eventType === "DELETE") {
            onEvent({ table: "relationships", event: "DELETE", id: String(payload.old.id) });
          } else {
            onEvent({
              table: "relationships",
              event: payload.eventType,
              row: payload.new as RelationshipRow,
            });
          }
        },
      )
      .subscribe();

    return () => {
      void this.client.removeChannel(channel);
    };
  }
}
