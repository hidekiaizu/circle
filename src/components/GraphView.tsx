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
  // Initial framing is a one-time event. Later simulation stops (including
  // category edits) must not override a person's focus or manual zoom.
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
        setSize((prev) =>
          prev.width === w && prev.height === h ? prev : { width: w, height: h },
        );
      });
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
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

  const frameView = useCallback(
    (durationMs = 450) => {
      const fg = fgRef.current;
      if (!fg || size.width === 0 || size.height === 0) return;
      const bounds = fg.getGraphBbox(
        focusIds ? (node) => focusIds.has(node.id) : undefined,
      );
      if (!bounds) return;
      const [left, right] = bounds.x;
      const [top, bottom] = bounds.y;
      if (![left, right, top, bottom].every(Number.isFinite)) return;
      const spanX = Math.max(right - left, 1);
      const spanY = Math.max(bottom - top, 1);
      const zoom = Math.max(
        0.1,
        Math.min(
          3.6,
          (size.width - 100) / spanX,
          (size.height - 100) / spanY,
        ),
      );
      fg.centerAt((left + right) / 2, (top + bottom) / 2, durationMs);
      fg.zoom(zoom, durationMs);
    },
    [focusIds, size.width, size.height],
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

  // Explicit focus/fit requests and canvas resizes reframe the visible view.
  // Data edits do not trigger the old whole-map zoom-out. A focused view is
  // framed once more on engine stop if its neighbors move during the edit.
  useEffect(() => {
    if (!settledRef.current && !focusRequest && fitRequest === 0) return;
    const t = setTimeout(() => frameView(), 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest, fitRequest, size.width, size.height]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
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
          nodeRelSize={5}
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
            ctx.beginPath();
            ctx.arc(n.x ?? 0, n.y ?? 0, 5, 0, Math.PI * 2);
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
            ctx.font = `bold ${Math.max(3.2, 5 / globalScale)}px ui-sans-serif, system-ui, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "#0b0f1a";
            ctx.fillText(initials, n.x ?? 0, n.y ?? 0.2);
            const fontSize = Math.max(12 / globalScale, 2.5);
            ctx.font = `${fontSize}px ui-sans-serif, system-ui, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.fillStyle = dim ? NODE_LABEL_DIM_COLOR : NODE_LABEL_COLOR;
            ctx.fillText(n.name, n.x ?? 0, (n.y ?? 0) + 7);
          }}
          onEngineStop={() => {
            const request = focusRequest?.nonce ?? null;
            const needsFocusFrame =
              !!focusIds &&
              (lastSettledFrameRef.current?.request !== request ||
                lastSettledFrameRef.current?.graphData !== graphData);
            if (!settledRef.current || needsFocusFrame) frameView(350);
            settledRef.current = true;
            lastSettledFrameRef.current = { request, graphData };
          }}
        />
      )}
    </div>
  );
}

export { endpointId };
