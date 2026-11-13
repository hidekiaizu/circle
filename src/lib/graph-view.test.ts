import { describe, expect, it } from "vitest";
import { neighborsOf } from "./graph";
import {
  connectionSummary,
  fitView,
  framePadding,
  hitRadius,
  LABEL_MAX_PX,
  nearestDistance,
  nodeRadius,
  shouldShowLabel,
  sortNeighbors,
} from "./graph-view";
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

function rel(
  id: string,
  a: string,
  b: string,
  category: Category,
  confirmed = true,
): Relationship {
  return {
    id,
    personAId: a,
    personBId: b,
    category,
    createdAt: "x",
    proposedByPersonId: a,
    confirmed,
  };
}

describe("hitRadius", () => {
  it("keeps about 22 screen px of radius when zoomed out", () => {
    expect(hitRadius(0.5, 22, 5)).toBe(44);
    expect(hitRadius(1, 22, 5)).toBe(22);
  });

  it("never drops below the visible dot plus a margin when zoomed in", () => {
    expect(hitRadius(10, 22, 5)).toBe(7);
    expect(hitRadius(10, 22, 6.5)).toBe(8.5);
  });

  it("treats an invalid scale as 1", () => {
    expect(hitRadius(0, 22, 5)).toBe(22);
  });

  it("caps the target at half the gap to the nearest node", () => {
    // Zoomed out: 44 graph units wanted, neighbor 30 units away caps it at 15.
    expect(hitRadius(0.5, 22, 5, 30)).toBe(15);
    // Isolated node keeps the full target.
    expect(hitRadius(0.5, 22, 5, 400)).toBe(44);
    // Never below the visible dot plus a margin, even when nodes overlap.
    expect(hitRadius(0.5, 22, 5, 4)).toBe(7);
  });
});

describe("nearestDistance", () => {
  it("finds the closest other positioned point", () => {
    const points = [
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 30, y: 40 },
      { id: "c", x: -6, y: -8 },
      { id: "d" },
    ];
    expect(nearestDistance("a", 0, 0, points)).toBe(10);
    expect(nearestDistance("b", 30, 40, points)).toBe(50);
    expect(nearestDistance("a", 0, 0, [{ id: "a", x: 0, y: 0 }])).toBe(Infinity);
  });
});

describe("nodeRadius", () => {
  it("is larger on narrow screens", () => {
    expect(nodeRadius(393)).toBe(6.5);
    expect(nodeRadius(639)).toBe(6.5);
    expect(nodeRadius(640)).toBe(5);
    expect(nodeRadius(1280)).toBe(5);
  });
});

describe("shouldShowLabel", () => {
  const base = {
    globalScale: 0.6,
    isSelected: false,
    isHighlighted: false,
    isFocusContext: false,
    nodeCount: 40,
  };

  it("hides plain labels when zoomed out on a larger graph", () => {
    expect(shouldShowLabel(base)).toBe(false);
  });

  it("shows plain labels once zoomed in", () => {
    expect(shouldShowLabel({ ...base, globalScale: 1.1 })).toBe(true);
  });

  it("always shows selected, highlighted, and focus labels", () => {
    expect(shouldShowLabel({ ...base, isSelected: true })).toBe(true);
    expect(shouldShowLabel({ ...base, isHighlighted: true })).toBe(true);
    expect(shouldShowLabel({ ...base, isFocusContext: true })).toBe(true);
  });

  it("shows every label on a small graph", () => {
    expect(shouldShowLabel({ ...base, nodeCount: 10 })).toBe(true);
  });
});

describe("framePadding / fitView", () => {
  it("grows horizontal padding with longer labels and caps it", () => {
    const short = framePadding(4);
    const long = framePadding(20);
    expect(long.x).toBeGreaterThan(short.x);
    expect(framePadding(500).x).toBe(framePadding(1000).x);
    expect(framePadding(500).x).toBe(20 + LABEL_MAX_PX / 2);
    expect(short.bottom).toBeGreaterThan(short.top);
  });

  it("zooms out further for longer labels at the edges", () => {
    const common = {
      left: -100,
      right: 100,
      top: -50,
      bottom: 50,
      width: 400,
      height: 800,
      radius: 5,
    };
    const edges = (chars: number) => [
      { x: -100, chars },
      { x: 100, chars },
    ];
    const shortFit = fitView({ ...common, labels: edges(3) });
    const longFit = fitView({ ...common, labels: edges(24) });
    expect(longFit.zoom).toBeLessThan(shortFit.zoom);
    // (200 - 20 - 3 * 7 / 2) px of room beside an edge node 100 units out.
    expect(shortFit.zoom).toBeCloseTo(169.5 / 100, 5);
    expect(shortFit.x).toBe(0);
    expect(shortFit.y).toBeGreaterThan(0);
  });

  it("ignores long names near the middle", () => {
    const common = {
      left: -100,
      right: 100,
      top: -50,
      bottom: 50,
      width: 320,
      height: 800,
      radius: 5,
    };
    const edgesOnly = fitView({
      ...common,
      labels: [
        { x: -100, chars: 8 },
        { x: 100, chars: 8 },
      ],
    });
    const withLongMiddle = fitView({
      ...common,
      labels: [
        { x: -100, chars: 8 },
        { x: 0, chars: 26 },
        { x: 5, chars: 26 },
        { x: 100, chars: 8 },
      ],
    });
    // (160 - 20 - 28) px beside each edge node: the graph spans 224 of 320 px.
    expect(edgesOnly.zoom).toBeCloseTo(112 / 100, 5);
    expect(withLongMiddle.zoom).toBeCloseTo(edgesOnly.zoom, 5);
  });

  it("clamps zoom to the min and max", () => {
    const tiny = fitView({
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      width: 800,
      height: 800,
      labels: [{ x: 0, chars: 5 }],
      radius: 5,
    });
    expect(tiny.zoom).toBe(3.6);
    const huge = fitView({
      left: -1e6,
      right: 1e6,
      top: -1e6,
      bottom: 1e6,
      width: 400,
      height: 400,
      labels: [{ x: 1e6, chars: 5 }],
      radius: 5,
    });
    expect(huge.zoom).toBe(0.1);
  });
});

describe("sortNeighbors / connectionSummary", () => {
  // me: bea (Friend, 2 mutual), cal (Close, 0 mutual), ann (Friend, 1 mutual),
  // dan (Close, 1 mutual, pending).
  const data: GraphData = {
    people: [
      person("me", "Me"),
      person("ann", "ann"),
      person("bea", "Bea"),
      person("cal", "Cal"),
      person("dan", "Dan"),
    ],
    relationships: [
      rel("r1", "me", "bea", 3),
      rel("r2", "me", "cal", 4),
      rel("r3", "me", "ann", 3),
      rel("r4", "me", "dan", 4, false),
      rel("r5", "bea", "ann", 1),
      rel("r6", "bea", "dan", 2),
    ],
  };
  const neighbors = neighborsOf("me", data);
  const names = (mode: "closeness" | "mutual" | "name") =>
    sortNeighbors("me", neighbors, mode, data).map((row) => row.person.id);

  it("reports mutual counts", () => {
    const rows = sortNeighbors("me", neighbors, "name", data);
    expect(Object.fromEntries(rows.map((r) => [r.person.id, r.mutualCount]))).toEqual({
      ann: 1,
      bea: 2,
      cal: 0,
      dan: 1,
    });
  });

  it("sorts by closeness, then mutual, then name", () => {
    expect(names("closeness")).toEqual(["dan", "cal", "bea", "ann"]);
  });

  it("sorts by mutual, then closeness, then name", () => {
    expect(names("mutual")).toEqual(["bea", "dan", "ann", "cal"]);
  });

  it("sorts by name case-insensitively", () => {
    expect(names("name")).toEqual(["ann", "bea", "cal", "dan"]);
  });

  it("summarizes total and pending connections", () => {
    expect(connectionSummary(neighbors)).toEqual({
      total: 4,
      pending: 1,
      text: "4 connections · 1 pending",
    });
    expect(
      connectionSummary(neighbors.filter((n) => n.person.id === "cal")).text,
    ).toBe("1 connection");
    expect(connectionSummary([]).text).toBe("0 connections");
  });
});
