import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Person, Relationship } from "../types";
import { GraphRepository } from "./repository";

const person: Person = {
  id: "seiji",
  name: "Seiji",
  createdAt: "2026-01-01T00:00:00.000Z",
  claimed: false,
  claimToken: "seiji-token",
};

const relationship: Relationship = {
  id: "hideki-seiji",
  personAId: "hideki",
  personBId: "seiji",
  category: 5,
  proposedByPersonId: "hideki",
  confirmed: false,
  createdAt: "2026-01-01T00:00:00.000Z",
};

function repositoryWithoutClient(): GraphRepository {
  return new GraphRepository({} as SupabaseClient);
}

describe("GraphRepository.insertConnectedPerson", () => {
  it("waits for the person insert before inserting the relationship", async () => {
    const repository = repositoryWithoutClient();
    const order: string[] = [];
    vi.spyOn(repository, "insertPerson").mockImplementation(async () => {
      order.push("person");
    });
    vi.spyOn(repository, "insertRelationship").mockImplementation(async () => {
      order.push("relationship");
    });

    await repository.insertConnectedPerson(person, relationship);

    expect(order).toEqual(["person", "relationship"]);
  });

  it("removes the new person if the relationship insert fails", async () => {
    const repository = repositoryWithoutClient();
    vi.spyOn(repository, "insertPerson").mockResolvedValue();
    vi.spyOn(repository, "insertRelationship").mockRejectedValue(
      new Error("foreign key failure"),
    );
    const remove = vi.spyOn(repository, "deletePerson").mockResolvedValue();

    await expect(
      repository.insertConnectedPerson(person, relationship),
    ).rejects.toThrow("foreign key failure");
    expect(remove).toHaveBeenCalledWith(person.id);
  });
});
