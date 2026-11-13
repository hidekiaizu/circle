/**
 * Pure helpers for how the graph canvas and the profile connection list are
 * drawn: node sizes, tap targets, label visibility, fit framing, and the
 * ordering/summary of a person's connections. Kept free of React and canvas
 * APIs so they can be unit tested.
 */

import { mutualNeighbors, type Neighbor } from "./graph";
import type { Category, GraphData } from "./types";

/** Visible node radius (graph units) on wide screens. */
export const NODE_RADIUS = 5;
/** Slightly larger visible radius used on narrow (phone) screens. */
export const NODE_RADIUS_NARROW = 6.5;
/** Viewport width below which the narrow radius applies (Tailwind `sm`). */
export const NARROW_BREAKPOINT_PX = 640;

/** Visible node radius for a given canvas width. */
export function nodeRadius(viewportWidth: number): number {
  return viewportWidth < NARROW_BREAKPOINT_PX ? NODE_RADIUS_NARROW : NODE_RADIUS;
}

/**
 * Pointer hit radius in graph units. Aims for `minScreenPx` screen pixels
 * (22 px radius ≈ 44 px tap target) regardless of zoom, but is capped at half
 * the distance to the nearest visible node (graph units) so neighboring
 * targets do not overlap and a tap selects the dot under the finger. Never
 * smaller than the visible dot plus a small margin.
 */
export function hitRadius(
  globalScale: number,
  minScreenPx = 22,
  visibleRadius = NODE_RADIUS,
  nearestDistance = Infinity,
): number {
  const scale = globalScale > 0 && Number.isFinite(globalScale) ? globalScale : 1;
  const spacingCap = nearestDistance >= 0 ? nearestDistance / 2 : Infinity;
  return Math.max(visibleRadius + 2, Math.min(minScreenPx / scale, spacingCap));
}

/** Distance (graph units) from `id` at (x, y) to the closest other point. */
export function nearestDistance(
  id: string,
  x: number,
  y: number,
  points: readonly { id: string; x?: number; y?: number }[],
): number {
  let best = Infinity;
  for (const p of points) {
    if (p.id === id || p.x == null || p.y == null) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < best) best = d;
  }
  return best;
}

/** Zoom level below which non-essential labels are hidden. */
export const LABEL_MIN_ZOOM = 1.1;
/** Graphs this small always show every label. */
export const LABEL_ALWAYS_MAX_NODES = 12;

export interface LabelVisibilityInput {
  globalScale: number;
  isSelected: boolean;
  isHighlighted: boolean;
  isFocusContext: boolean;
  nodeCount: number;
}

/**
 * Whether a node's name label should be drawn. The selected node, its
 * highlighted neighbors, and nodes in an active focus set always get labels;
 * other labels only appear once the user zooms in, unless the graph is small.
 */
export function shouldShowLabel({
  globalScale,
  isSelected,
  isHighlighted,
  isFocusContext,
  nodeCount,
}: LabelVisibilityInput): boolean {
  if (isSelected || isHighlighted || isFocusContext) return true;
  if (nodeCount <= LABEL_ALWAYS_MAX_NODES) return true;
  return globalScale >= LABEL_MIN_ZOOM;
}

/** Approximate rendered width of one label character at the 12px label font. */
export const LABEL_PX_PER_CHAR = 7;
/** Longest label width (screen px) reserved when framing. */
export const LABEL_MAX_PX = 180;
/** Base screen-px margin kept around the framed graph. */
export const FRAME_MARGIN_PX = 20;
/** Screen px reserved under the lowest node for its name label. */
export const LABEL_HEIGHT_PX = 22;

export interface FramePadding {
  x: number;
  top: number;
  bottom: number;
}

/**
 * Screen-pixel padding to keep around the graph so names drawn beside and
 * below nodes stay inside the canvas. Labels are centered on their node, so
 * half of the widest label is reserved on each side.
 */
export function framePadding(maxLabelChars: number): FramePadding {
  const labelPx = Math.min(Math.max(0, maxLabelChars) * LABEL_PX_PER_CHAR, LABEL_MAX_PX);
  return {
    x: FRAME_MARGIN_PX + labelPx / 2,
    top: FRAME_MARGIN_PX,
    bottom: FRAME_MARGIN_PX + LABEL_HEIGHT_PX,
  };
}

export interface FitLabel {
  /** Node center x in graph units. */
  x: number;
  /** Characters in the node's name label. */
  chars: number;
}

export interface FitInput {
  /** Node-center bounds in graph units. */
  left: number;
  right: number;
  top: number;
  bottom: number;
  /** Canvas size in screen px. */
  width: number;
  height: number;
  /**
   * Framed nodes and their label lengths. Only a label's overhang past the
   * canvas edge matters, so a long name near the middle costs nothing while
   * one at the left or right edge pulls the zoom in.
   */
  labels: readonly FitLabel[];
  /** Visible node radius in graph units. */
  radius: number;
  minZoom?: number;
  maxZoom?: number;
}

export interface FitResult {
  x: number;
  y: number;
  zoom: number;
}

/**
 * Center and zoom that fit the node bounds plus their labels into the canvas.
 * Each node's centered label must fit between its node and the nearer canvas
 * edge, so padding depends on the names at the edges, not the longest name.
 */
export function fitView({
  left,
  right,
  top,
  bottom,
  width,
  height,
  labels,
  radius,
  minZoom = 0.1,
  maxZoom = 3.6,
}: FitInput): FitResult {
  const pad = framePadding(0);
  const cx = (left + right) / 2;
  const halfWidth = width / 2;
  // Keep at least a quarter of the width usable on tiny canvases.
  const minRoom = width * 0.125;
  const dotRoom = Math.max(halfWidth - FRAME_MARGIN_PX, minRoom);
  let zoomX = dotRoom / (Math.max(right - left, 1) / 2 + radius);
  for (const label of labels) {
    const dx = Math.abs(label.x - cx);
    if (dx < 1e-6) continue;
    const labelHalf = framePadding(label.chars).x - FRAME_MARGIN_PX;
    const room = Math.max(halfWidth - FRAME_MARGIN_PX - labelHalf, minRoom);
    zoomX = Math.min(zoomX, room / dx);
  }
  const spanY = Math.max(bottom - top, 1) + radius * 2;
  const availY = Math.max(height - pad.top - pad.bottom, height * 0.25);
  const zoom = Math.max(minZoom, Math.min(maxZoom, zoomX, availY / spanY));
  // The label hangs below the lowest node, so shift the view center down by
  // half the extra bottom padding (converted to graph units).
  const y = (top + bottom) / 2 + (pad.bottom - pad.top) / 2 / zoom;
  return { x: cx, y, zoom };
}

/** Short category labels for compact relationship rows. */
export const SHORT_CATEGORY_LABELS: Record<Category, string> = {
  1: "Familiar",
  2: "Acquaintance",
  3: "Friend",
  4: "Close",
  5: "Very Close",
};

export type NeighborSort = "closeness" | "mutual" | "name";

export const NEIGHBOR_SORT_OPTIONS: { value: NeighborSort; label: string }[] = [
  { value: "closeness", label: "Closeness" },
  { value: "mutual", label: "Mutual" },
  { value: "name", label: "Name" },
];

export interface NeighborRow extends Neighbor {
  mutualCount: number;
}

function byName(a: NeighborRow, b: NeighborRow): number {
  const an = a.person.name.toLowerCase();
  const bn = b.person.name.toLowerCase();
  if (an !== bn) return an < bn ? -1 : 1;
  return a.person.id < b.person.id ? -1 : a.person.id > b.person.id ? 1 : 0;
}

/**
 * A person's connections with mutual counts, ordered by the chosen mode.
 * closeness: category desc, then mutual desc, then name.
 * mutual: mutual desc, then category desc, then name.
 * name: name asc (case-insensitive), then id.
 */
export function sortNeighbors(
  personId: string,
  neighbors: readonly Neighbor[],
  mode: NeighborSort,
  data: GraphData,
): NeighborRow[] {
  const rows: NeighborRow[] = neighbors.map((neighbor) => ({
    ...neighbor,
    mutualCount: mutualNeighbors(personId, neighbor.person.id, data).length,
  }));
  return rows.sort((a, b) => {
    if (mode === "name") return byName(a, b);
    const category = b.relationship.category - a.relationship.category;
    const mutual = b.mutualCount - a.mutualCount;
    if (mode === "mutual") return mutual || category || byName(a, b);
    return category || mutual || byName(a, b);
  });
}

export interface ConnectionSummary {
  total: number;
  pending: number;
  text: string;
}

/** One-line summary such as `9 connections · 3 pending`. */
export function connectionSummary(neighbors: readonly Neighbor[]): ConnectionSummary {
  const total = neighbors.length;
  const pending = neighbors.filter((n) => !n.relationship.confirmed).length;
  const base = `${total} ${total === 1 ? "connection" : "connections"}`;
  return { total, pending, text: pending > 0 ? `${base} · ${pending} pending` : base };
}
