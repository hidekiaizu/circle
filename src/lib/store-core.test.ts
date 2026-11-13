import { describe, expect, it } from "vitest";
import {
  addConnectedPerson,
  addPerson,
  addRelationship,
  claimPerson,
  computeStrength,
  confirmRelationship,
  emptyGraph,
  findRelationship,
  removePerson,
  removeRelationship,
  renamePerson,
  setAttributes,
  setRelationship,
  updateRelationshipCategory,
} from "./store-core";
import { CATEGORY, type GraphData, type Relationship } from "./types";

function peopleNamed(...names: string[]): GraphData {
  return names.reduce((graph, name) => addPerson(graph, name), emptyGraph);
}

function claimedAll(graph: GraphData): GraphData {
  return {
    ...graph,
    people: graph.people.map((person) => ({ ...person, claimed: true })),
  };
}

describe("addPerson", () => {
  it("adds an unclaimed person with an id, timestamp, and claim token", () => {
    const graph = addPerson(emptyGraph, "Alice");
    expect(graph.people).toHaveLength(1);
    expect(graph.people[0]).toMatchObject({ name: "Alice", claimed: false });
    expect(graph.people[0].id).toBeTruthy();
    expect(graph.people[0].createdAt).toBeTruthy();
    expect(graph.people[0].claimToken).toBeTruthy();
  });

  it("mints a unique nonempty token for every person", () => {
    let graph = emptyGraph;
    for (let index = 0; index < 25; index += 1) {
      graph = addPerson(graph, `Person ${index}`, `person-${index}`);
    }

    const tokens = graph.people.map((person) => person.claimToken);
    expect(tokens.every((token) => token.length > 0)).toBe(true);
    expect(new Set(tokens)).toHaveLength(tokens.length);
  });

  it("trims names and returns the original graph for empty input", () => {
    expect(addPerson(emptyGraph, "  Bob  ").people[0].name).toBe("Bob");
    expect(addPerson(emptyGraph, "   ")).toBe(emptyGraph);
  });

  it("uses an explicit id and rejects a duplicate id", () => {
    const graph = addPerson(emptyGraph, "Alice", "custom-id");
    expect(graph.people[0].id).toBe("custom-id");
    expect(addPerson(graph, "Other Alice", "custom-id")).toBe(graph);
  });

  it("does not mutate the input", () => {
    const before: GraphData = { people: [], relationships: [] };
    const next = addPerson(before, "Alice");
    expect(before).toEqual({ people: [], relationships: [] });
    expect(next).not.toBe(before);
  });
});

describe("addConnectedPerson", () => {
  it("adds the new person and their relationship in one graph change", () => {
    const graph = peopleNamed("Hideki Aizu");
    const ownerId = graph.people[0].id;
    const next = addConnectedPerson(
      graph,
      ownerId,
      "  Seiji  ",
      CATEGORY.VeryCloseFriend,
      "seiji-id",
    );

    expect(next.people).toHaveLength(2);
    expect(next.people[1]).toMatchObject({ id: "seiji-id", name: "Seiji" });
    expect(next.relationships).toHaveLength(1);
    expect(next.relationships[0]).toMatchObject({
      personAId: ownerId,
      personBId: "seiji-id",
      category: CATEGORY.VeryCloseFriend,
      proposedByPersonId: ownerId,
      confirmed: false,
    });
  });

  it("does not leave an orphan when the owner is missing", () => {
    expect(
      addConnectedPerson(
        emptyGraph,
        "missing-owner",
        "Seiji",
        CATEGORY.VeryCloseFriend,
        "seiji-id",
      ),
    ).toBe(emptyGraph);
  });
});

describe("renamePerson", () => {
  it("renames only the matching person", () => {
    const graph = peopleNamed("Alice", "Bob");
    const id = graph.people[0].id;
    const next = renamePerson(graph, id, "  Alicia  ");
    expect(next.people[0].name).toBe("Alicia");
    expect(next.people[1]).toBe(graph.people[1]);
  });

  it("returns the original graph for invalid or unchanged names", () => {
    const graph = peopleNamed("Alice");
    expect(renamePerson(graph, graph.people[0].id, "   ")).toBe(graph);
    expect(renamePerson(graph, graph.people[0].id, " Alice ")).toBe(graph);
    expect(renamePerson(graph, "missing", "Alicia")).toBe(graph);
  });
});

describe("setAttributes", () => {
  it("normalizes and shallow-merges profile attributes", () => {
    const graph = peopleNamed("Alice");
    const personId = graph.people[0].id;
    const profiled = setAttributes(graph, personId, {
      major: "  Computer Science ",
      year: " 2027 ",
      residence: " Morewood ",
      hometown: " Pittsburgh, PA ",
      clubs: [" Robotics Club ", "robotics club", "", " ScottyLabs "],
    });
    const next = setAttributes(profiled, personId, {
      residence: " Fifth Neville ",
    });

    expect(profiled.people[0].attributes).toEqual({
      major: "Computer Science",
      year: "2027",
      residence: "Morewood",
      hometown: "Pittsburgh, PA",
      clubs: ["Robotics Club", "ScottyLabs"],
    });
    expect(next.people[0].attributes).toEqual({
      ...profiled.people[0].attributes,
      residence: "Fifth Neville",
    });
  });

  it("supports intentional string and club clears", () => {
    const graph = peopleNamed("Alice");
    const personId = graph.people[0].id;
    const profiled = setAttributes(graph, personId, {
      major: "Design",
      clubs: ["Lunar Gala"],
    });
    const cleared = setAttributes(profiled, personId, {
      major: "   ",
      clubs: [],
    });

    expect(cleared.people[0].attributes).toMatchObject({ major: "", clubs: [] });
  });

  it("leaves unknown people and equivalent updates unchanged", () => {
    const graph = peopleNamed("Alice");
    const personId = graph.people[0].id;
    const profiled = setAttributes(graph, personId, {
      major: "Computer Science",
      clubs: ["ScottyLabs"],
    });

    expect(setAttributes(graph, "missing", { major: "History" })).toBe(graph);
    expect(
      setAttributes(profiled, personId, {
        major: " Computer Science ",
        clubs: [" ScottyLabs "],
      }),
    ).toBe(profiled);
    expect(setAttributes(graph, personId, {})).toBe(graph);
  });

  it("does not mutate the graph or caller-owned arrays", () => {
    const graph = peopleNamed("Alice");
    const clubs = [" Robotics ", "robotics"];
    const next = setAttributes(graph, graph.people[0].id, { clubs });

    expect(graph.people[0].attributes).toBeUndefined();
    expect(clubs).toEqual([" Robotics ", "robotics"]);
    expect(next.people[0].attributes?.clubs).toEqual(["Robotics"]);
  });
});

describe("claimPerson", () => {
  it("claims an existing unclaimed person only with the exact token", () => {
    const graph = peopleNamed("Alice", "Bob");
    const alice = graph.people[0];

    expect(claimPerson(graph, alice.id, "wrong-token")).toBe(graph);
    expect(claimPerson(graph, alice.id, ` ${alice.claimToken} `)).toBe(graph);

    const claimed = claimPerson(graph, alice.id, alice.claimToken);
    expect(claimed.people[0]).toMatchObject({
      claimed: true,
      claimToken: alice.claimToken,
    });
    expect(claimed.people[1]).toBe(graph.people[1]);
    expect(graph.people[0].claimed).toBe(false);
  });

  it("returns the original graph for missing and already-claimed people", () => {
    const graph = peopleNamed("Alice");
    const alice = graph.people[0];
    const claimed = claimPerson(graph, alice.id, alice.claimToken);

    expect(claimPerson(graph, "missing", alice.claimToken)).toBe(graph);
    expect(claimPerson(claimed, alice.id, alice.claimToken)).toBe(claimed);
  });
});

describe("removePerson", () => {
  it("removes the person and all incident relationships", () => {
    let graph = peopleNamed("Alice", "Bob", "Cara");
    const [aliceId, bobId, caraId] = graph.people.map((person) => person.id);
    graph = addRelationship(graph, aliceId, bobId, CATEGORY.Friend);
    graph = addRelationship(graph, bobId, caraId, CATEGORY.CloseFriend);

    const next = removePerson(graph, bobId);
    expect(next.people.map((person) => person.id)).toEqual([aliceId, caraId]);
    expect(next.relationships).toHaveLength(0);
    expect(removePerson(graph, "missing")).toBe(graph);
  });
});

describe("addRelationship", () => {
  it("adds an unconfirmed proposal from an endpoint", () => {
    const graph = peopleNamed("Alice", "Bob");
    const [aliceId, bobId] = graph.people.map((person) => person.id);
    const next = addRelationship(
      graph,
      aliceId,
      bobId,
      CATEGORY.Friend,
      bobId,
    );

    expect(next.relationships).toHaveLength(1);
    expect(next.relationships[0]).toMatchObject({
      personAId: aliceId,
      personBId: bobId,
      category: CATEGORY.Friend,
      proposedByPersonId: bobId,
      confirmed: false,
    });
    expect(graph.relationships).toHaveLength(0);
  });

  it("uses person A as the proposer by default", () => {
    const graph = peopleNamed("Alice", "Bob");
    const [aliceId, bobId] = graph.people.map((person) => person.id);
    const next = addRelationship(graph, aliceId, bobId, CATEGORY.Friend);
    expect(next.relationships[0].proposedByPersonId).toBe(aliceId);
  });

  it("rejects self-links and missing endpoints as reference no-ops", () => {
    const graph = peopleNamed("Alice");
    const aliceId = graph.people[0].id;
    expect(addRelationship(graph, aliceId, aliceId, CATEGORY.Friend)).toBe(graph);
    expect(addRelationship(graph, aliceId, "ghost", CATEGORY.Friend)).toBe(
      graph,
    );
  });

  it("rejects a proposer who is not an endpoint", () => {
    const graph = peopleNamed("Alice", "Bob", "Cara");
    const [aliceId, bobId, caraId] = graph.people.map((person) => person.id);
    expect(
      addRelationship(graph, aliceId, bobId, CATEGORY.Friend, caraId),
    ).toBe(graph);
  });

  it("rejects duplicate undirected pairs", () => {
    let graph = peopleNamed("Alice", "Bob");
    const [aliceId, bobId] = graph.people.map((person) => person.id);
    graph = addRelationship(graph, aliceId, bobId, CATEGORY.Friend);
    expect(
      addRelationship(graph, bobId, aliceId, CATEGORY.Acquaintance),
    ).toBe(graph);
  });
});

describe("confirmRelationship", () => {
  it("allows only the endpoint opposite the proposer to confirm", () => {
    let graph = peopleNamed("Alice", "Bob", "Cara");
    const [aliceId, bobId, caraId] = graph.people.map((person) => person.id);
    graph = addRelationship(graph, aliceId, bobId, CATEGORY.Friend, aliceId);
    const relationshipId = graph.relationships[0].id;

    expect(confirmRelationship(graph, relationshipId, aliceId)).toBe(graph);
    expect(confirmRelationship(graph, relationshipId, caraId)).toBe(graph);

    const confirmed = confirmRelationship(graph, relationshipId, bobId);
    expect(confirmed.relationships[0].confirmed).toBe(true);
    expect(graph.relationships[0].confirmed).toBe(false);
    expect(confirmRelationship(confirmed, relationshipId, bobId)).toBe(
      confirmed,
    );
  });

  it("returns the original graph for an unknown relationship", () => {
    const graph = peopleNamed("Alice", "Bob");
    expect(confirmRelationship(graph, "missing", graph.people[0].id)).toBe(
      graph,
    );
  });
});

describe("relationship updates", () => {
  it("updates only a matching relationship when its category changes", () => {
    let graph = peopleNamed("Alice", "Bob");
    const [aliceId, bobId] = graph.people.map((person) => person.id);
    graph = addRelationship(graph, aliceId, bobId, CATEGORY.Friend);
    const relationshipId = graph.relationships[0].id;
    const next = updateRelationshipCategory(
      graph,
      relationshipId,
      CATEGORY.VeryCloseFriend,
    );

    expect(next.relationships[0].category).toBe(CATEGORY.VeryCloseFriend);
    expect(
      updateRelationshipCategory(next, relationshipId, CATEGORY.VeryCloseFriend),
    ).toBe(next);
    expect(updateRelationshipCategory(graph, "missing", CATEGORY.Friend)).toBe(
      graph,
    );
  });

  it("removes only a matching relationship", () => {
    let graph = claimedAll(peopleNamed("Alice", "Bob"));
    const [aliceId, bobId] = graph.people.map((person) => person.id);
    graph = addRelationship(graph, aliceId, bobId, CATEGORY.Friend);
    const next = removeRelationship(graph, graph.relationships[0].id);

    expect(next.relationships).toHaveLength(0);
    expect(next.people).toHaveLength(2);
    expect(removeRelationship(graph, "missing")).toBe(graph);
  });

  it("drops an unclaimed endpoint left with no connections", () => {
    let graph = claimedAll(peopleNamed("Alice"));
    graph = addPerson(graph, "Ghost");
    const [aliceId, ghostId] = graph.people.map((person) => person.id);
    graph = addRelationship(graph, aliceId, ghostId, CATEGORY.Friend);
    const next = removeRelationship(graph, graph.relationships[0].id);

    expect(next.people.map((person) => person.id)).toEqual([aliceId]);
  });

  it("keeps an unclaimed endpoint that still has other connections", () => {
    let graph = claimedAll(peopleNamed("Alice", "Bob"));
    graph = addPerson(graph, "Ghost");
    const [aliceId, bobId, ghostId] = graph.people.map((person) => person.id);
    graph = addRelationship(graph, aliceId, ghostId, CATEGORY.Friend);
    graph = addRelationship(graph, bobId, ghostId, CATEGORY.Friend);
    const next = removeRelationship(graph, graph.relationships[0].id);

    expect(next.people).toHaveLength(3);
    expect(next.relationships).toHaveLength(1);
  });
});

describe("findRelationship", () => {
  it("finds an undirected pair", () => {
    let graph = peopleNamed("Alice", "Bob");
    const [aliceId, bobId] = graph.people.map((person) => person.id);
    graph = addRelationship(graph, aliceId, bobId, CATEGORY.Friend);
    expect(findRelationship(graph, aliceId, bobId)?.category).toBe(
      CATEGORY.Friend,
    );
    expect(findRelationship(graph, bobId, aliceId)?.category).toBe(
      CATEGORY.Friend,
    );
  });

  it("returns undefined when no relationship exists", () => {
    const graph = peopleNamed("Alice", "Bob");
    const [aliceId, bobId] = graph.people.map((person) => person.id);
    expect(findRelationship(graph, aliceId, bobId)).toBeUndefined();
  });
});

describe("setRelationship", () => {
  it("creates an unconfirmed connection with the supplied proposer", () => {
    const graph = peopleNamed("Alice", "Bob");
    const [aliceId, bobId] = graph.people.map((person) => person.id);
    const next = setRelationship(
      graph,
      aliceId,
      bobId,
      CATEGORY.Friend,
      bobId,
    );

    expect(next.relationships[0]).toMatchObject({
      category: CATEGORY.Friend,
      proposedByPersonId: bobId,
      confirmed: false,
    });
  });

  it("rejects an unrelated proposer when creating a connection", () => {
    const graph = peopleNamed("Alice", "Bob", "Cara");
    const [aliceId, bobId, caraId] = graph.people.map((person) => person.id);
    expect(
      setRelationship(graph, aliceId, bobId, CATEGORY.Friend, caraId),
    ).toBe(graph);
  });

  it("updates an existing category without replacing proposal metadata", () => {
    let graph = peopleNamed("Alice", "Bob");
    const [aliceId, bobId] = graph.people.map((person) => person.id);
    graph = setRelationship(graph, aliceId, bobId, CATEGORY.Acquaintance);
    const next = setRelationship(
      graph,
      bobId,
      aliceId,
      CATEGORY.VeryCloseFriend,
    );

    expect(next.relationships).toHaveLength(1);
    expect(next.relationships[0]).toMatchObject({
      category: CATEGORY.VeryCloseFriend,
      proposedByPersonId: aliceId,
      confirmed: false,
    });
    expect(
      setRelationship(next, aliceId, bobId, CATEGORY.VeryCloseFriend),
    ).toBe(next);
  });

  it("removes an existing connection for a null category", () => {
    let graph = peopleNamed("Alice", "Bob");
    const [aliceId, bobId] = graph.people.map((person) => person.id);
    graph = setRelationship(graph, aliceId, bobId, CATEGORY.Friend);
    expect(setRelationship(graph, aliceId, bobId, null).relationships).toEqual(
      [],
    );
  });

  it("returns the original graph for invalid removals and self-links", () => {
    const graph = peopleNamed("Alice", "Bob");
    const [aliceId, bobId] = graph.people.map((person) => person.id);
    expect(setRelationship(graph, aliceId, bobId, null)).toBe(graph);
    expect(setRelationship(graph, aliceId, aliceId, CATEGORY.Friend)).toBe(
      graph,
    );
  });
});

describe("computeStrength", () => {
  const relationship = (category: number): Relationship => ({
    id: "r",
    personAId: "a",
    personBId: "b",
    category: category as Relationship["category"],
    createdAt: "2026-01-01T00:00:00.000Z",
    proposedByPersonId: "a",
    confirmed: true,
  });

  it("maps categories 1 through 5 to 0 through 1", () => {
    expect(computeStrength(relationship(CATEGORY.Familiar))).toBe(0);
    expect(computeStrength(relationship(CATEGORY.Friend))).toBe(0.5);
    expect(computeStrength(relationship(CATEGORY.VeryCloseFriend))).toBe(1);
  });

  it("uses graph context through the store-core semantic seam", () => {
    let graph = peopleNamed("Alice", "Bob");
    const [aliceId, bobId] = graph.people.map((person) => person.id);
    graph = setAttributes(graph, aliceId, {
      major: "Computer Science",
      residence: "Morewood",
    });
    graph = setAttributes(graph, bobId, {
      major: "computer science",
      residence: "morewood",
    });
    graph = addRelationship(graph, aliceId, bobId, CATEGORY.Friend);
    const target = graph.relationships[0];

    expect(computeStrength(target, graph)).toBeGreaterThan(
      computeStrength(target),
    );
  });

  it("is monotonic by category", () => {
    const strengths = [1, 2, 3, 4, 5].map((category) =>
      computeStrength(relationship(category)),
    );
    for (let index = 1; index < strengths.length; index += 1) {
      expect(strengths[index]).toBeGreaterThan(strengths[index - 1]);
    }
  });
});
