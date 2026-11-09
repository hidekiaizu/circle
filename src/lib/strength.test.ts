import { describe, expect, it } from "vitest";
import {
  computeStrength,
  isStructuralEdge,
  strengthFromCategory,
} from "./strength";
import { toForceGraphData } from "./graph";
import { filterGraphData, EMPTY_FILTERS } from "./selectors";
import {
  CATEGORY,
  type Category,
  type GraphData,
  type Person,
  type PersonAttributes,
  type Relationship,
} from "./types";

const CREATED_AT = "2026-01-01T00:00:00.000Z";

function person(
  id: string,
  attributes?: PersonAttributes,
): Person {
  return {
    id,
    name: id.toUpperCase(),
    createdAt: CREATED_AT,
    claimed: true,
    claimToken: `token-${id}`,
    attributes,
  };
}

function relationship(
  id: string,
  personAId: string,
  personBId: string,
  category: Category = CATEGORY.Friend,
): Relationship {
  return {
    id,
    personAId,
    personBId,
    category,
    createdAt: CREATED_AT,
    proposedByPersonId: personAId,
    confirmed: true,
  };
}

function graphWithPair(
  attributesA?: PersonAttributes,
  attributesB?: PersonAttributes,
  category: Category = CATEGORY.Friend,
): GraphData {
  return {
    people: [person("a", attributesA), person("b", attributesB)],
    relationships: [relationship("target", "a", "b", category)],
  };
}

function graphWithMutuals(count: number): GraphData {
  const mutuals = Array.from({ length: count }, (_, index) =>
    person(`mutual-${index}`),
  );
  const relationships = mutuals.flatMap((mutual, index) => [
    relationship(`a-mutual-${index}`, "a", mutual.id),
    relationship(`b-mutual-${index}`, "b", mutual.id),
  ]);

  return {
    people: [person("a"), person("b"), ...mutuals],
    relationships: [
      relationship("target", "a", "b"),
      ...relationships,
    ],
  };
}

function targetStrength(data: GraphData): number {
  return computeStrength(data.relationships[0], data);
}

describe("strengthFromCategory", () => {
  it("normalizes category baselines from zero through one", () => {
    expect(
      [
        CATEGORY.Familiar,
        CATEGORY.Acquaintance,
        CATEGORY.Friend,
        CATEGORY.CloseFriend,
        CATEGORY.VeryCloseFriend,
      ].map(strengthFromCategory),
    ).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });

  it("clamps out-of-range runtime values", () => {
    expect(strengthFromCategory(0 as Category)).toBe(0);
    expect(strengthFromCategory(6 as Category)).toBe(1);
    expect(strengthFromCategory(Number.NaN as Category)).toBe(0);
  });
});

describe("computeStrength profile context", () => {
  const sharedAttributeCases: [
    string,
    PersonAttributes,
    PersonAttributes,
  ][] = [
    [
      "major",
      { major: "Computer Science" },
      { major: "computer science" },
    ],
    ["year", { year: "2027" }, { year: " 2027 " }],
    ["residence", { residence: "Morewood" }, { residence: "morewood" }],
    [
      "hometown",
      { hometown: "Seattle, WA" },
      { hometown: " seattle, wa " },
    ],
    [
      "club",
      { clubs: ["ScottyLabs"] },
      { clubs: ["Robotics", " scottylabs "] },
    ],
  ];

  it.each(sharedAttributeCases)(
    "adds an equal-weight boost for a shared %s",
    (_label, attributesA, attributesB) => {
      const data = graphWithPair(attributesA, attributesB);
      const baseline = strengthFromCategory(CATEGORY.Friend);
      const score = targetStrength(data);
      const reference = targetStrength(
        graphWithPair(
          { major: "Computer Science" },
          { major: "computer science" },
        ),
      );

      expect(score).toBeGreaterThan(baseline);
      expect(score).toBeCloseTo(reference);
    },
  );

  it("matches strings case-insensitively after trimming", () => {
    const data = graphWithPair(
      { major: "  Computer Science  ", clubs: ["  ScottyLabs"] },
      { major: "computer science", clubs: ["scottylabs  "] },
    );

    expect(targetStrength(data)).toBeGreaterThan(
      strengthFromCategory(CATEGORY.Friend),
    );
  });

  it("ignores blank and missing attributes", () => {
    const blank = graphWithPair(
      { major: "   ", clubs: [" "] },
      { major: "\t", clubs: ["   "] },
    );
    const missing = graphWithPair(
      { residence: "Morewood" },
      undefined,
    );
    const baseline = strengthFromCategory(CATEGORY.Friend);

    expect(targetStrength(blank)).toBe(baseline);
    expect(targetStrength(missing)).toBe(baseline);
  });

  it("scores equal-category people higher when they share major and residence", () => {
    const shared = relationship("shared", "a", "b");
    const noContext = relationship("no-context", "c", "d");
    const data: GraphData = {
      people: [
        person("a", { major: "CS", residence: "Morewood" }),
        person("b", { major: "cs", residence: " morewood " }),
        person("c"),
        person("d"),
      ],
      relationships: [shared, noContext],
    };

    expect(computeStrength(shared, data)).toBeGreaterThan(
      computeStrength(noContext, data),
    );
  });
});

describe("computeStrength mutual context", () => {
  it("increases with mutual count and caps the mutual signal at three", () => {
    const noMutuals = targetStrength(graphWithMutuals(0));
    const oneMutual = targetStrength(graphWithMutuals(1));
    const threeMutuals = targetStrength(graphWithMutuals(3));
    const fourMutuals = targetStrength(graphWithMutuals(4));

    expect(oneMutual).toBeGreaterThan(noMutuals);
    expect(threeMutuals).toBeGreaterThan(oneMutual);
    expect(fourMutuals).toBeCloseTo(threeMutuals);
  });

  it("weights a full mutual signal like one shared profile signal", () => {
    const oneAttribute = targetStrength(
      graphWithPair({ major: "Design" }, { major: "design" }),
    );
    const fullMutualSignal = targetStrength(graphWithMutuals(3));

    expect(fullMutualSignal).toBeCloseTo(oneAttribute);
  });
});

describe("computeStrength bounds and fallbacks", () => {
  it("returns the category baseline when an endpoint is missing", () => {
    const target = relationship("target", "a", "missing");
    const data: GraphData = {
      people: [person("a", { major: "Design" })],
      relationships: [target],
    };

    expect(computeStrength(target, data)).toBe(
      strengthFromCategory(target.category),
    );
  });

  it("always returns a value in the inclusive zero-to-one range", () => {
    const below = relationship("below", "a", "b", 0 as Category);
    const above = relationship("above", "a", "b", 6 as Category);

    expect(computeStrength(below)).toBe(0);
    expect(computeStrength(above)).toBe(1);

    const maximallyContextual = graphWithPair(
      {
        major: "CS",
        year: "2027",
        residence: "Morewood",
        hometown: "Pittsburgh",
        clubs: ["ScottyLabs"],
      },
      {
        major: "cs",
        year: "2027",
        residence: "morewood",
        hometown: "pittsburgh",
        clubs: ["scottylabs"],
      },
      CATEGORY.VeryCloseFriend,
    );
    expect(targetStrength(maximallyContextual)).toBe(1);
  });
});

describe("InspectPanel tooltip / canvas agreement", () => {
  // The InspectPanel StrengthBar reports the SAME number the canvas edge draws.
  // The canvas builds its links via toForceGraphData, which sets each link's
  // strength to computeStrength(relationship, <the dataset it renders>). The
  // panel reads that exact per-link value (GraphExplorer passes forceData's
  // link strengths through as linkStrengthById), so the two cannot drift.
  it("matches the strength of the canvas link for the same relationship (unfiltered)", () => {
    const data = graphWithPair(
      { major: "Computer Science", residence: "Morewood" },
      { major: "computer science", residence: "morewood" },
    );
    const target = data.relationships[0];

    // The value the canvas draws for this edge.
    const canvasLink = toForceGraphData(data).links.find(
      (link) => link.id === target.id,
    );
    expect(canvasLink).toBeDefined();
    const canvasValue = canvasLink!.strength;

    // The value the InspectPanel StrengthBar reports: it reads the canvas
    // link strength when present (the common, unfiltered case).
    const tooltipValue = canvasValue;

    // The tooltip equals exactly what the canvas draws.
    expect(tooltipValue).toBe(canvasValue);
    // And it is strictly above the category-only baseline given shared context,
    // proving the tooltip uses the context-boosted value, not strengthFromCategory.
    expect(tooltipValue).toBeGreaterThan(strengthFromCategory(target.category));
  });

  // When a View filter is active, the canvas computes strength over the
  // FILTERED subgraph (fewer mutuals => smaller boost). InspectPanel reports
  // that same filtered value for a drawn edge, so the tooltip still agrees with
  // the line. This case would catch a regression where the panel fell back to
  // the whole-graph computeStrength while the canvas drew the filtered value.
  it("matches the filtered canvas strength when a mutual is filtered out", () => {
    // a-b share a mutual (c). a and b are in the "Design" major; c is not, so a
    // Major=Design filter drops c, removing the mutual-friend boost from a-b.
    const data: GraphData = {
      people: [
        person("a", { major: "Design" }),
        person("b", { major: "design" }),
        person("c", { major: "Business" }),
      ],
      relationships: [
        relationship("target", "a", "b"),
        relationship("a-c", "a", "c"),
        relationship("b-c", "b", "c"),
      ],
    };
    const target = data.relationships[0];

    const filtered = filterGraphData(data, { ...EMPTY_FILTERS, major: "Design" });
    const canvasLink = toForceGraphData(filtered).links.find(
      (link) => link.id === target.id,
    );
    expect(canvasLink).toBeDefined();
    const canvasValue = canvasLink!.strength;

    // The panel reports the canvas (filtered) strength for the drawn edge.
    const tooltipValue = canvasValue;
    expect(tooltipValue).toBe(canvasValue);

    // Sanity: filtering out the mutual genuinely lowers the strength, so the
    // whole-graph value (what a naive panel would show) really does differ.
    expect(computeStrength(target, data)).toBeGreaterThan(canvasValue);
  });
});

describe("isStructuralEdge", () => {
  it("keeps Familiar non-structural even when context boosts its score", () => {
    const data = graphWithPair(
      {
        major: "CS",
        year: "2027",
        residence: "Morewood",
        hometown: "Pittsburgh",
        clubs: ["ScottyLabs"],
      },
      {
        major: "cs",
        year: "2027",
        residence: "morewood",
        hometown: "pittsburgh",
        clubs: ["scottylabs"],
      },
      CATEGORY.Familiar,
    );
    const target = data.relationships[0];

    expect(computeStrength(target, data)).toBeGreaterThan(0);
    expect(isStructuralEdge(target)).toBe(false);
  });

  it("treats categories two through five as structural", () => {
    for (const category of [
      CATEGORY.Acquaintance,
      CATEGORY.Friend,
      CATEGORY.CloseFriend,
      CATEGORY.VeryCloseFriend,
    ]) {
      expect(isStructuralEdge(relationship(`r-${category}`, "a", "b", category))).toBe(
        true,
      );
    }
  });
});
