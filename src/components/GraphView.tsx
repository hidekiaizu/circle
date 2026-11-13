"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D, {
  type ForceGraphMethods,
} from "react-force-graph-2d";
import {
  endpointId,
  focusNodeIds,
  linkDistance,
  linkForceStrength,
  linkOpacity,
  linkWidth,
  type ForceGraphData,
  type GraphLink,
  type GraphNode,
} from "@/lib/graph";
import {
  fitView,
  hitRadius,
  nearestDistance,
  nodeRadius,
  shouldShowLabel,
} from "@/lib/graph-view";

interface GraphViewProps {
  data: ForceGraphData;
  /** When true, Familiar (category 1) links are hidden. */
  hideWeak: boolean;
  /** Currently selected person id, or null. */
  selectedId: string | null;
  focusedId: string | null;
  onSelect: (id: string | null) => void;
  /**
   * A focus request: changing the `nonce` re-centers the view on `id`.
   * Using a nonce lets the same node be focused repeatedly.
   */
  focusRequest: { id: string; nonce: number } | null;
  fitRequest: number;
  /** Idea B: when true, clicking two nodes in turn connects them. */
  connectMode: boolean;
  /** The first node picked in connect mode, awaiting a second. */
  pendingSourceId: string | null;
  onNodeClickConnect: (id: string) => void;
  /** Called when a link is clicked (used for edge deletion). */
  onLinkClick: (linkId: string) => void;
}

const NODE_DIM_COLOR = "#3b3f52";
const NODE_SELECTED_COLOR = "#f0abfc";
const NODE_PENDING_COLOR = "#34d399"; // connect-mode source node
const NODE_LABEL_COLOR = "#e6e9f0";
const NODE_LABEL_DIM_COLOR = "#6b7280";
const LINK_RGB = "165, 180, 252";
const LINK_HIGHLIGHT_RGB = "240, 171, 252";

function makeProfileClusterForce() {
  let nodes: GraphNode[] = [];
  const force = (alpha: number) => {
    const centers = new Map<string, { x: number; y: number; count: number }>();
    for (const node of nodes) {
      const center = centers.get(node.colorKey) ?? { x: 0, y: 0, count: 0 };
      center.x += node.x ?? 0;
      center.y += node.y ?? 0;
      center.count += 1;
      centers.set(node.colorKey, center);
    }
    for (const node of nodes) {
      const center = centers.get(node.colorKey);
      if (!center || center.count < 2) continue;
      const targetX = center.x / center.count;
      const targetY = center.y / center.count;
      node.vx = (node.vx ?? 0) + (targetX - (node.x ?? 0)) * 0.006 * alpha;
      node.vy = (node.vy ?? 0) + (targetY - (node.y ?? 0)) * 0.006 * alpha;
    }
  };
  force.initialize = (nextNodes: GraphNode[]) => {
    nodes = nextNodes;
  };
  return force;
}

/**
 * Interactive force-directed graph. Nodes repel, connected nodes attract,
 * and stronger relationships are drawn thicker and pulled moderately closer.
 * Selecting a node highlights it and its direct connections.
 */
export default function GraphView({
  data,
  hideWeak,
  selectedId,
  focusedId,
  onSelect,
  focusRequest,
  fitRequest,
  connectMode,
  pendingSourceId,
  onNodeClickConnect,
  onLinkClick,
}: GraphViewProps) {
  const fgRef = useRef<ForceGraphMethods<GraphNode, GraphLink> | undefined>(
    undefined,
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  // Latest measured canvas size. Delayed frames read this instead of the
  // size captured by the render that scheduled them, so a frame that lands
  // after chrome or a banner changed the canvas height uses the new height.
  const sizeRef = useRef({ width: 0, height: 0 });
  // True once the user has zoomed, panned or tapped the canvas since the last
  // programmatic frame. While false, height changes reframe the view.
  const viewTouchedRef = useRef(false);
  // Initial framing is a one-time event. Later simulation stops (including
  // category edits) must not override a person's focus or manual zoom.
  // Only set once a frame actually happened (not on an empty graph).
  const settledRef = useRef(false);
  const lastSettledFrameRef = useRef<{
    request: number | null;
    graphData: ForceGraphData;
  } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let raf = 0;
    const update = () => {
      // Coalesce rapid resize callbacks into one state update per frame to
      // avoid a visible jump while a panel/header animates.
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const w = el.clientWidth;
        const h = el.clientHeight;
        sizeRef.current = { width: w, height: h };
        setSize((prev) =>
          prev.width === w && prev.height === h ? prev : { width: w, height: h },
        );
      });
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    // Capture phase: d3-zoom stops propagation of the canvas events it uses.
    const markTouched = () => {
      viewTouchedRef.current = true;
    };
    const listenerOptions = { capture: true, passive: true } as const;
    el.addEventListener("pointerdown", markTouched, listenerOptions);
    el.addEventListener("wheel", markTouched, listenerOptions);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      el.removeEventListener("pointerdown", markTouched, listenerOptions);
      el.removeEventListener("wheel", markTouched, listenerOptions);
    };
  }, []);

  // Filter out weak (Familiar) links when requested. Nodes always remain.
  const graphData = useMemo<ForceGraphData>(() => {
    const links = hideWeak ? data.links.filter((link) => link.structural) : data.links;
    return { nodes: data.nodes, links };
  }, [data, hideWeak]);

  const activeFocusId =
    focusedId && graphData.nodes.some((node) => node.id === focusedId)
      ? focusedId
      : null;
  const focusIds = useMemo(
    () => (activeFocusId ? focusNodeIds(activeFocusId, graphData) : null),
    [activeFocusId, graphData],
  );
  // Nodes that can be tapped, used to keep neighboring hit areas apart.
  const hitNodes = useMemo(
    () =>
      focusIds
        ? graphData.nodes.filter((node) => focusIds.has(node.id))
        : graphData.nodes,
    [focusIds, graphData.nodes],
  );

  const radius = nodeRadius(size.width);

  /** Fits the visible nodes. Returns false when there was nothing to frame. */
  const frameView = useCallback(
    (durationMs = 450): boolean => {
      const fg = fgRef.current;
      const { width, height } = sizeRef.current;
      if (!fg || width === 0 || height === 0) return false;
      const bounds = fg.getGraphBbox(
        focusIds ? (node) => focusIds.has(node.id) : undefined,
      );
      if (!bounds) return false;
      const [left, right] = bounds.x;
      const [top, bottom] = bounds.y;
      if (![left, right, top, bottom].every(Number.isFinite)) return false;
      const labels: { x: number; chars: number }[] = [];
      for (const node of graphData.nodes) {
        if (focusIds && !focusIds.has(node.id)) continue;
        if (node.x == null) continue;
        labels.push({ x: node.x, chars: node.name.length });
      }
      // Reserve room for the names drawn below nodes so labels near the left
      // and right edges are not clipped by the canvas edge.
      const view = fitView({
        left,
        right,
        top,
        bottom,
        width,
        height,
        labels,
        radius: nodeRadius(width),
      });
      fg.centerAt(view.x, view.y, durationMs);
      fg.zoom(view.zoom, durationMs);
      viewTouchedRef.current = false;
      return true;
    },
    [focusIds, graphData.nodes],
  );

  // The highlight set: selected node + its direct neighbors (over visible links).
  const highlightNodeIds = useMemo(() => {
    if (!selectedId) return null;
    const set = new Set<string>([selectedId]);
    for (const l of graphData.links) {
      const s = endpointId(l.source);
      const t = endpointId(l.target);
      if (s === selectedId) set.add(t);
      else if (t === selectedId) set.add(s);
    }
    return set;
  }, [selectedId, graphData.links]);

  const isLinkIncident = (l: GraphLink): boolean =>
    !!selectedId &&
    (endpointId(l.source) === selectedId ||
      endpointId(l.target) === selectedId);

  // Configure d3 forces for an organic, readable layout.
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;

    const charge = fg.d3Force("charge");
    if (charge) charge.strength(-240).distanceMax(400);

    const link = fg.d3Force("link");
    if (link) {
      link
        .distance((l: GraphLink) => linkDistance(l.strength))
        .strength((l: GraphLink) => linkForceStrength(l.strength));
    }

    const center = fg.d3Force("center");
    if (center) center.strength(0.03);

    fg.d3Force("profile-cluster", makeProfileClusterForce() as never);

    fg.d3ReheatSimulation();
  }, [graphData]);

  // Explicit focus/fit requests reframe the visible view. Data edits do not
  // trigger the old whole-map zoom-out. A focused view is framed once more on
  // engine stop if its neighbors move during the edit.
  useEffect(() => {
    if (!settledRef.current && !focusRequest && fitRequest === 0) return;
    const t = setTimeout(() => frameView(), 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest, fitRequest]);

  // Width changes (rotation, desktop side panels) reframe. Height-only
  // changes do not once the user has zoomed, panned or tapped the map: on
  // phones they come from the header and bottom bar hiding while a sheet is
  // open, the mobile search row, or the browser toolbar, and reframing there
  // would throw away the user's view. force-graph already keeps the view
  // centered when the canvas height changes.
  useEffect(() => {
    if (!settledRef.current) return;
    const t = setTimeout(() => frameView(), 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width]);

  // While the view still shows the last programmatic frame (nothing for the
  // user to lose), a height change refits it to the new canvas, e.g. when the
  // Welcome card is dismissed or the connect-mode banner mounts.
  useEffect(() => {
    if (!settledRef.current || viewTouchedRef.current) return;
    const t = setTimeout(() => frameView(), 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.height]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full touch-none"
      role="application"
      aria-label="Social graph. Use the Search people field to find and focus a person with the keyboard."
    >
      {size.width > 0 && (
        <ForceGraph2D
          ref={fgRef}
          width={size.width}
          height={size.height}
          graphData={graphData}
          backgroundColor="#0b0f1a"
          maxZoom={3.6}
          nodeVisibility={(node) => !focusIds || focusIds.has(node.id)}
          linkVisibility={(link) =>
            !focusIds ||
            (focusIds.has(endpointId(link.source)) &&
              focusIds.has(endpointId(link.target)))
          }
          nodeRelSize={radius}
          nodeColor={(node) => {
            const id = (node as GraphNode).id;
            if (connectMode && id === pendingSourceId)
              return NODE_PENDING_COLOR;
            if (id === selectedId) return NODE_SELECTED_COLOR;
            if (highlightNodeIds && !highlightNodeIds.has(id))
              return NODE_DIM_COLOR;
            return (node as GraphNode).claimed
              ? (node as GraphNode).color
              : "#64748b";
          }}
          nodeLabel={(node) => (node as GraphNode).name}
          linkColor={(link) => {
            const l = link as GraphLink;
            if (isLinkIncident(l))
              return `rgba(${LINK_HIGHLIGHT_RGB}, ${Math.min(
                1,
                linkOpacity(l.strength) + 0.2,
              )})`;
            const base = linkOpacity(l.strength) * (l.confirmed ? 1 : 0.35);
            const dim = selectedId ? base * 0.25 : base;
            return `rgba(${LINK_RGB}, ${dim})`;
          }}
          linkWidth={(link) => {
            const l = link as GraphLink;
            const w = linkWidth(l.strength);
            return isLinkIncident(l) ? w + 1.2 : w;
          }}
          linkLineDash={(link) =>
            (link as GraphLink).confirmed ? null : [4, 4]
          }
          d3VelocityDecay={0.3}
          warmupTicks={60}
          cooldownTicks={150}
          onNodeClick={(node) => {
            const id = (node as GraphNode).id;
            if (connectMode) onNodeClickConnect(id);
            else onSelect(id);
          }}
          onLinkClick={(link) => onLinkClick((link as GraphLink).id)}
          onBackgroundClick={() => onSelect(null)}
          nodeCanvasObjectMode={() => "replace"}
          nodeCanvasObject={(node, ctx, globalScale) => {
            const n = node as GraphNode;
            const dim = highlightNodeIds && !highlightNodeIds.has(n.id);
            const selected = n.id === selectedId;
            const pending = connectMode && n.id === pendingSourceId;
            const fill = pending
              ? NODE_PENDING_COLOR
              : selected
                ? NODE_SELECTED_COLOR
                : dim
                  ? NODE_DIM_COLOR
                  : n.claimed
                    ? n.color
                    : "#475569";
            const x = n.x ?? 0;
            const y = n.y ?? 0;
            const anchor = n.id === activeFocusId;
            if (selected || pending) {
              // Outer glow ring so the selected person stands out on a phone.
              ctx.beginPath();
              ctx.arc(x, y, radius + 3.5, 0, Math.PI * 2);
              ctx.fillStyle = pending
                ? "rgba(52, 211, 153, 0.22)"
                : "rgba(240, 171, 252, 0.22)";
              ctx.fill();
              ctx.beginPath();
              ctx.arc(x, y, radius + 2, 0, Math.PI * 2);
              ctx.strokeStyle = pending ? NODE_PENDING_COLOR : NODE_SELECTED_COLOR;
              ctx.lineWidth = Math.max(1, 1.5 / globalScale);
              ctx.stroke();
            } else if (anchor) {
              ctx.beginPath();
              ctx.arc(x, y, radius + 2, 0, Math.PI * 2);
              ctx.strokeStyle = "rgba(165, 180, 252, 0.8)";
              ctx.lineWidth = Math.max(0.8, 1.2 / globalScale);
              ctx.stroke();
            }
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fillStyle = fill;
            ctx.fill();
            if (!n.claimed) {
              ctx.save();
              ctx.setLineDash([2, 2]);
              ctx.strokeStyle = "#cbd5e1";
              ctx.lineWidth = 0.8;
              ctx.stroke();
              ctx.restore();
            }
            const initials = n.name
              .split(/\s+/)
              .slice(0, 2)
              .map((part) => part[0])
              .join("")
              .toUpperCase();
            ctx.font = `bold ${Math.max(3.2, radius / globalScale)}px ui-sans-serif, system-ui, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "#0b0f1a";
            ctx.fillText(initials, x, y + 0.2);
            const showLabel = shouldShowLabel({
              globalScale,
              isSelected: selected || pending,
              isHighlighted: !!highlightNodeIds?.has(n.id),
              isFocusContext: anchor || (!!focusIds && focusIds.has(n.id)),
              nodeCount: graphData.nodes.length,
            });
            if (!showLabel) return;
            const emphasized = selected || anchor;
            const fontSize = Math.max((emphasized ? 13 : 12) / globalScale, 2.5);
            ctx.font = `${emphasized ? "600 " : ""}${fontSize}px ui-sans-serif, system-ui, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.fillStyle = dim ? NODE_LABEL_DIM_COLOR : NODE_LABEL_COLOR;
            ctx.fillText(n.name, x, y + radius + (emphasized ? 4 : 2));
          }}
          nodePointerAreaPaint={(node, color, ctx, globalScale) => {
            // Paint a larger hit region onto the offscreen pointer-detection
            // canvas. Its radius is in screen px (about a 44px tap target at
            // any zoom), capped at half the gap to the nearest visible node
            // so close neighbors do not steal each other's taps.
            const n = node as GraphNode;
            if (focusIds && !focusIds.has(n.id)) return;
            const x = n.x ?? 0;
            const y = n.y ?? 0;
            const nearest = nearestDistance(
              n.id,
              x,
              y,
              hitNodes,
            );
            ctx.beginPath();
            ctx.arc(x, y, hitRadius(globalScale, 22, radius, nearest), 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
          }}
          onEngineStop={() => {
            const request = focusRequest?.nonce ?? null;
            const needsFocusFrame =
              !!focusIds &&
              (lastSettledFrameRef.current?.request !== request ||
                lastSettledFrameRef.current?.graphData !== graphData);
            if (!settledRef.current || needsFocusFrame) {
              // The engine also settles on the empty graph while the API is
              // still loading. Nothing is framed then, so stay unsettled and
              // let the loaded graph get its first fit on the next stop.
              if (!frameView(350)) return;
            }
            settledRef.current = true;
            lastSettledFrameRef.current = { request, graphData };
          }}
        />
      )}
    </div>
  );
}

export { endpointId };
