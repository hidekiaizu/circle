import { describe, expect, it } from "vitest";
import {
  focusNodeIds,
  mutualNeighbors,
  neighborIds,
  neighborsOf,
  rankCandidatesFor,
  toForceGraphData,
} from "./graph";
import { computeStrength, strengthFromCategory } from "./strength";
import type { Category, GraphData, Person, Relationship } from "./types";

function person(id: string, name: string): Person {
  return {
    id,
    name,
    createdAt: "2026-01-01T00:00:00.000Z",
    claimed: true,
    claimToken: `token-${id}`,
  };
}

function relationship(
  id: string,
  personAId: string,
  personBId: string,
  category: Category,
): Relationship {
  return {
    id,
    personAId,
    personBId,
    category,
    createdAt: "x",
    proposedByPersonId: personAId,
    confirmed: true,
  };
}

const data: GraphData = {
  people: [
    person("a", "Alice"),
    person("b", "Bob"),
    person("c", "Cara"),
    person("d", "Devon"),
  ],
  relationships: [
    relationship("r1", "a", "b", 3),
    relationship("r2", "a", "c", 5),
    relationship("r3", "b", "c", 2),
    relationship("r4", "c", "d", 4),
  ],
};

describe("neighborsOf", () => {
  it("finds neighbors in either edge direction, strongest first", () => {
    const neighbors = neighborsOf("a", data);
    expect(neighbors.map((neighbor) => neighbor.person.id)).toEqual(["c", "b"]);
  });

  it("returns empty for an isolated person", () => {
    const isolated: GraphData = {
      people: [person("z", "Zed")],
      relationships: [],
    };
    expect(neighborsOf("z", isolated)).toHaveLength(0);
  });
});

describe("neighborIds", () => {
  it("returns connected ids", () => {
    expect([...neighborIds("c", data)].sort()).toEqual(["a", "b", "d"]);
  });
});

describe("focusNodeIds", () => {
  it("includes only the anchor and its visible direct neighbors", () => {
    const graph = toForceGraphData(data);
    expect([...focusNodeIds("a", graph)].sort()).toEqual(["a", "b", "c"]);
    graph.links = graph.links.filter((link) => link.category > 2);
    expect([...focusNodeIds("b", graph)].sort()).toEqual(["a", "b"]);
  });
});

describe("mutualNeighbors", () => {
  it("finds people connected to both endpoints", () => {
    expect(mutualNeighbors("a", "b", data).map((value) => value.id)).toEqual([
      "c",
    ]);
  });

  it("returns empty when there are no mutuals", () => {
    const noMutual: GraphData = {
      people: [
        person("x", "X"),
        person("y", "Y"),
        person("m", "M"),
        person("n", "N"),
      ],
      relationships: [
        relationship("e1", "x", "m", 3),
        relationship("e2", "y", "n", 3),
      ],
    };
    expect(mutualNeighbors("x", "y", noMutual)).toHaveLength(0);
  });
});

describe("rankCandidatesFor", () => {
  it("excludes the anchor and includes everyone else", () => {
    const ranked = rankCandidatesFor("a", data);
    expect(ranked.map((candidate) => candidate.person.id).sort()).toEqual([
      "b",
      "c",
      "d",
    ]);
  });

  it("reports the current category with the anchor", () => {
    const ranked = rankCandidatesFor("a", data);
    const bob = ranked.find((candidate) => candidate.person.id === "b");
    const devon = ranked.find((candidate) => candidate.person.id === "d");
    expect(bob?.category).toBe(3);
    expect(devon?.category).toBeNull();
  });

  it("puts connected people before unconnected people", () => {
    const ranked = rankCandidatesFor("a", data);
    expect(ranked[ranked.length - 1].person.id).toBe("d");
  });

  it("ranks unconnected candidates by mutual count", () => {
    const graph: GraphData = {
      people: [
        person("x", "X"),
        person("m", "M"),
        person("n", "N"),
        person("p", "P"),
        person("q", "Q"),
      ],
      relationships: [
        relationship("e1", "x", "m", 3),
        relationship("e2", "x", "n", 3),
        relationship("e3", "p", "m", 3),
      ],
    };
    const ranked = rankCandidatesFor("x", graph);
    const unconnected = ranked.filter((candidate) => candidate.category == null);
    expect(unconnected[0].person.id).toBe("p");
    expect(unconnected[0].mutualCount).toBe(1);
  });

  it("blends graph proximity and shared attributes into explainable reasons", () => {
    const anchor = {
      ...person("x", "X"),
      attributes: {
        major: "Computer Science",
        year: "2029",
        clubs: ["ScottyLabs"],
      },
    };
    const shared = {
      ...person("p", "Profile match"),
      attributes: {
        major: "computer science",
        year: "2029",
        clubs: ["scottylabs"],
      },
    };
    const graph: GraphData = {
      people: [anchor, shared, person("m", "Mutual")],
      relationships: [
        relationship("xm", "x", "m", 3),
        relationship("pm", "p", "m", 3),
      ],
    };
    const candidate = rankCandidatesFor("x", graph).find(
      (value) => value.person.id === "p",
    );
    expect(candidate?.score).toBe(4);
    expect(candidate?.reasons).toEqual([
      "1 mutual",
      "same major",
      "same year",
      "both in scottylabs",
    ]);
  });
});

describe("toForceGraphData", () => {
  it("gives nodes distinct finite positions before the simulation starts", () => {
    const graph = toForceGraphData(data);
    const positions = graph.nodes.map((node) => `${node.x},${node.y}`);

    expect(graph.nodes.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y))).toBe(true);
    expect(new Set(positions).size).toBe(graph.nodes.length);
  });

  it("retains existing node positions when graph data changes", () => {
    const before = toForceGraphData(data);
    before.nodes[0].x = 42;
    before.nodes[0].y = -17;
    const after = toForceGraphData(data, before);
    expect(after.nodes[0]).toMatchObject({ id: "a", x: 42, y: -17 });
    expect(after.nodes[0]).not.toBe(before.nodes[0]);
  });

  it("maps relationships with context-aware visual strength", () => {
    const graph = toForceGraphData(data);
    const relationship = data.relationships[0];
    const link = graph.links.find((candidate) => candidate.id === relationship.id);

    expect(graph.nodes).toHaveLength(4);
    expect(graph.links).toHaveLength(4);
    expect(link?.strength).toBe(computeStrength(relationship, data));
    expect(link?.strength).toBeGreaterThan(
      strengthFromCategory(relationship.category),
    );
    expect(graph.links.find((candidate) => candidate.id === "r2")?.strength).toBe(
      1,
    );
    expect(link).toMatchObject({ confirmed: true, structural: true });
  });

  it("carries claim colors and pending/structural rendering metadata", () => {
    const pending = relationship("pending", "a", "b", 1);
    pending.confirmed = false;
    const graph = toForceGraphData({
      people: [person("a", "Alice"), { ...person("b", "Bob"), claimed: false }],
      relationships: [pending],
    });
    expect(graph.nodes[1]).toMatchObject({ claimed: false, colorKey: "Not set" });
    expect(graph.links[0]).toMatchObject({ confirmed: false, structural: false });
  });

  it("drops links that reference missing nodes", () => {
    const broken: GraphData = {
      people: [person("a", "Alice")],
      relationships: [relationship("r", "a", "ghost", 3)],
    };
    expect(toForceGraphData(broken).links).toHaveLength(0);
  });
});
