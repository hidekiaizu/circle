import { computeStrength } from "./strength";
import { colorForKey, colorKeyFor, type ColorBy } from "./selectors";
import type { Category, GraphData, Person, Relationship } from "./types";
import { isStructuralEdge } from "./strength";

// Keep the existing graph-module export while strength.ts owns the behavior.
export { strengthFromCategory } from "./strength";

/**
 * The node/link shapes consumed by react-force-graph-2d. The force simulation
 * mutates these objects in place (adding x, y, vx, vy), so they are plain
 * objects distinct from our immutable domain model.
 */
export interface GraphNode {
  id: string;
  name: string;
  claimed: boolean;
  colorKey: string;
  color: string;
  // Mutated by the force simulation at runtime:
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number;
  fy?: number;
}

export interface GraphLink {
  id: string;
  source: string | GraphNode;
  target: string | GraphNode;
  category: Category;
  /** Derived visual strength, 0..1, used for width/opacity/forces. */
  strength: number;
  confirmed: boolean;
  structural: boolean;
  proposedByPersonId: string;
}

export interface ForceGraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

/** Line width in canvas units, scaled moderately by strength. */
export function linkWidth(strength: number): number {
  return 0.6 + strength * 4.4; // ~0.6 (weak) .. 5 (strong)
}

/** Line opacity, scaled by strength so weak ties recede. */
export function linkOpacity(strength: number): number {
  return 0.18 + strength * 0.62; // ~0.18 (weak) .. 0.8 (strong)
}

/** A desired link distance: stronger ties sit closer together. */
export function linkDistance(strength: number): number {
  return 160 - strength * 90; // 160 (weak) .. 70 (strong)
}

/** d3 link force strength: stronger ties pull moderately harder. */
export function linkForceStrength(strength: number): number {
  return 0.08 + strength * 0.22; // 0.08 .. 0.30, kept gentle to avoid clumping
}

/** Map our domain graph into the force-graph node/link shape. */
export function toForceGraphData(
  data: GraphData,
  previous?: ForceGraphData,
  colorBy: ColorBy = "major",
): ForceGraphData {
  const previousNodes = new Map(previous?.nodes.map((node) => [node.id, node]));
  const count = data.people.length;
  const nodes: GraphNode[] = data.people.map((p: Person, index) => {
    const colorKey = colorKeyFor(p, colorBy);
    const previousNode = previousNodes.get(p.id);
    // Seed every new node away from the origin. react-force-graph otherwise
    // paints all undefined positions at (0, 0) before its first simulation
    // ticks, producing a visibly crushed initial graph.
    const angle = index * Math.PI * (3 - Math.sqrt(5));
    const radius = count <= 1 ? 0 : 45 + 18 * Math.sqrt(index);
    return {
      id: p.id,
      name: p.name,
      claimed: p.claimed,
      colorKey,
      color: colorForKey(colorKey),
      x: previousNode?.x ?? Math.cos(angle) * radius,
      y: previousNode?.y ?? Math.sin(angle) * radius,
      vx: previousNode?.vx ?? 0,
      vy: previousNode?.vy ?? 0,
    };
  });

  const nodeIds = new Set(nodes.map((n) => n.id));

  const links: GraphLink[] = data.relationships
    .filter(
      (r: Relationship) =>
        nodeIds.has(r.personAId) && nodeIds.has(r.personBId),
    )
    .map((r: Relationship) => ({
      id: r.id,
      source: r.personAId,
      target: r.personBId,
      category: r.category,
      strength: computeStrength(r, data),
      confirmed: r.confirmed,
      structural: isStructuralEdge(r),
      proposedByPersonId: r.proposedByPersonId,
    }));

  return { nodes, links };
}

/** Resolve a link endpoint to a node id, whether it is a string or object. */
export function endpointId(endpoint: string | GraphNode): string {
  return typeof endpoint === "object" ? endpoint.id : endpoint;
}

/** Visible one-hop focus: the anchor plus neighbors on currently shown links. */
export function focusNodeIds(anchorId: string, data: ForceGraphData): Set<string> {
  const ids = new Set<string>([anchorId]);
  for (const link of data.links) {
    const source = endpointId(link.source);
    const target = endpointId(link.target);
    if (source === anchorId) ids.add(target);
    else if (target === anchorId) ids.add(source);
  }
  return ids;
}

export interface Neighbor {
  person: Person;
  relationship: Relationship;
}

/**
 * Direct neighbors of a person, each paired with the relationship that
 * connects them. Sorted strongest-first for display.
 */
export function neighborsOf(
  personId: string,
  data: GraphData,
): Neighbor[] {
  const peopleById = new Map(data.people.map((p) => [p.id, p]));
  const result: Neighbor[] = [];

  for (const rel of data.relationships) {
    let otherId: string | null = null;
    if (rel.personAId === personId) otherId = rel.personBId;
    else if (rel.personBId === personId) otherId = rel.personAId;
    if (!otherId) continue;

    const person = peopleById.get(otherId);
    if (person) result.push({ person, relationship: rel });
  }

  return result.sort((a, b) => b.relationship.category - a.relationship.category);
}

/** Ids of people directly connected to the given person. */
export function neighborIds(personId: string, data: GraphData): Set<string> {
  return new Set(neighborsOf(personId, data).map((n) => n.person.id));
}

/** People both A and B are directly connected to. */
export function mutualNeighbors(
  aId: string,
  bId: string,
  data: GraphData,
): Person[] {
  const aNeighbors = neighborIds(aId, data);
  const bNeighbors = neighborIds(bId, data);
  const peopleById = new Map(data.people.map((p) => [p.id, p]));
  const mutuals: Person[] = [];
  for (const id of aNeighbors) {
    if (bNeighbors.has(id)) {
      const p = peopleById.get(id);
      if (p) mutuals.push(p);
    }
  }
  return mutuals;
}

export interface Candidate {
  person: Person;
  /** The current relationship category with the anchor person, or null. */
  category: Relationship["category"] | null;
  /** How many people this candidate shares with the anchor person. */
  mutualCount: number;
  score: number;
  reasons: string[];
}

/**
 * Rank everyone else relative to an anchor person for the connections editor:
 * already-connected people first, then by shared-connection count (likely
 * ties), then alphabetically. Each entry carries the current category and
 * mutual count so the UI can render without recomputing.
 */
export function rankCandidatesFor(
  anchorId: string,
  data: GraphData,
): Candidate[] {
  const anchorNeighbors = neighborIds(anchorId, data);

  // Map of otherId -> current category with the anchor.
  const categoryByOther = new Map<string, Relationship["category"]>();
  for (const r of data.relationships) {
    if (r.personAId === anchorId) categoryByOther.set(r.personBId, r.category);
    else if (r.personBId === anchorId)
      categoryByOther.set(r.personAId, r.category);
  }

  const candidates: Candidate[] = data.people
    .filter((p) => p.id !== anchorId)
    .map((person) => {
      const theirNeighbors = neighborIds(person.id, data);
      let mutualCount = 0;
      for (const id of anchorNeighbors) {
        if (id !== person.id && theirNeighbors.has(id)) mutualCount++;
      }
      const reasons: string[] = [];
      if (mutualCount > 0) reasons.push(`${mutualCount} mutual${mutualCount === 1 ? "" : "s"}`);
      const anchor = data.people.find((candidate) => candidate.id === anchorId);
      const sharedFields = [
        ["major", "same major"],
        ["year", "same year"],
        ["residence", "same residence"],
        ["hometown", "same hometown"],
      ] as const;
      let sharedScore = 0;
      for (const [field, label] of sharedFields) {
        const left = anchor?.attributes?.[field]?.trim().toLowerCase();
        const right = person.attributes?.[field]?.trim().toLowerCase();
        if (left && right && left === right) {
          reasons.push(label);
          sharedScore += 1;
        }
      }
      const anchorClubs = new Set(
        (anchor?.attributes?.clubs ?? []).map((club) => club.trim().toLowerCase()),
      );
      const sharedClubs = (person.attributes?.clubs ?? []).filter((club) =>
        anchorClubs.has(club.trim().toLowerCase()),
      );
      if (sharedClubs.length) {
        reasons.push(`both in ${sharedClubs[0]}`);
        sharedScore += 1;
      }
      return {
        person,
        category: categoryByOther.get(person.id) ?? null,
        mutualCount,
        score: mutualCount + sharedScore,
        reasons,
      };
    });

  return candidates.sort((a, b) => {
    const aConnected = a.category != null ? 1 : 0;
    const bConnected = b.category != null ? 1 : 0;
    if (aConnected !== bConnected) return bConnected - aConnected;
    if (a.score !== b.score) return b.score - a.score;
    return a.person.name.localeCompare(b.person.name);
  });
}
