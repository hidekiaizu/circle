"use client";

import dynamic from "next/dynamic";
import type { ForceGraphData } from "@/lib/graph";

// react-force-graph-2d touches the DOM/window and must not be server-rendered.
const GraphView = dynamic(() => import("./GraphView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-slate-400">
      Loading graph…
    </div>
  ),
});

export default function GraphCanvas({
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
}: {
  data: ForceGraphData;
  hideWeak: boolean;
  selectedId: string | null;
  focusedId: string | null;
  onSelect: (id: string | null) => void;
  focusRequest: { id: string; nonce: number } | null;
  fitRequest: number;
  connectMode: boolean;
  pendingSourceId: string | null;
  onNodeClickConnect: (id: string) => void;
  onLinkClick: (linkId: string) => void;
}) {
  return (
    <GraphView
      data={data}
      hideWeak={hideWeak}
      selectedId={selectedId}
      focusedId={focusedId}
      onSelect={onSelect}
      focusRequest={focusRequest}
      fitRequest={fitRequest}
      connectMode={connectMode}
      pendingSourceId={pendingSourceId}
      onNodeClickConnect={onNodeClickConnect}
      onLinkClick={onLinkClick}
    />
  );
}
