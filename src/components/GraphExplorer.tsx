"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import GraphCanvas from "./GraphCanvas";
import InspectPanel from "./InspectPanel";
import ManagePanel from "./ManagePanel";
import ConnectionsEditor from "./ConnectionsEditor";
import SearchBox from "./SearchBox";
import Legend from "./Legend";
import EdgeInspector from "./EdgeInspector";
import OverflowMenu from "./OverflowMenu";
import Welcome from "./Welcome";
import { toForceGraphData, type ForceGraphData } from "@/lib/graph";
import { findRelationship } from "@/lib/store-core";
import {
  attributeOptions,
  EMPTY_FILTERS,
  filterGraphData,
  type ColorBy,
} from "@/lib/selectors";
import {
  CATEGORY,
  CATEGORY_OPTIONS,
  isCategory,
  type Category,
} from "@/lib/types";
import { useGraphStore } from "@/lib/GraphStore";

/** "1 person" / "2 people" style pluralization. */
function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

const WELCOME_KEY = "circle:welcome-seen:v1";

function readWelcomeSeen(): boolean {
  if (typeof window === "undefined") return true; // don't flash on the server
  try {
    return window.localStorage.getItem(WELCOME_KEY) === "1";
  } catch {
    return true;
  }
}

function markWelcomeSeen(): void {
  try {
    window.localStorage.setItem(WELCOME_KEY, "1");
  } catch {
    // ignore
  }
}

/**
 * Client shell around the graph canvas. Owns all exploration/edit UI state:
 * weak-tie visibility, selection, add panel, per-person connections editor
 * (Idea A), click-to-connect mode (Idea B), search, and focus.
 */
export default function GraphExplorer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    data,
    hydrated,
    loading,
    error,
    claimedPersonId,
    setRelationship,
    removeRelationship,
  } = useGraphStore();
  const [toast, setToast] = useState<string | null>(null);

  // Show a transient confirmation toast after a change.
  const notify = useCallback((message: string) => {
    setToast(message);
  }, []);

  // Auto-dismiss the toast after a few seconds.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const [hideWeak, setHideWeak] = useState(true);
  const [colorBy, setColorBy] = useState<ColorBy>("major");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [fitRequest, setFitRequest] = useState(0);
  const [manageOpen, setManageOpen] = useState(false);
  const [editorPersonId, setEditorPersonId] = useState<string | null>(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  // Show the first-run welcome unless it was dismissed before. Read lazily so
  // there is no setState-in-effect; only rendered once hydrated (below).
  const [welcomeOpen, setWelcomeOpen] = useState<boolean>(
    () => !readWelcomeSeen(),
  );
  const [focusRequest, setFocusRequest] = useState<{
    id: string;
    nonce: number;
  } | null>(null);

  // Idea B: connect mode.
  const [connectMode, setConnectMode] = useState(false);
  const [pendingSourceId, setPendingSourceId] = useState<string | null>(null);
  const [connectPair, setConnectPair] = useState<{
    aId: string;
    bId: string;
  } | null>(null);

  const filteredData = useMemo(() => filterGraphData(data, filters), [data, filters]);
  const visualSource = useMemo(() => ({ data: filteredData, colorBy }), [filteredData, colorBy]);
  const [visualGraph, setVisualGraph] = useState(() => ({
    source: visualSource,
    graph: toForceGraphData(visualSource.data, undefined, colorBy),
  }));
  // React's conditional state adjustment keeps simulation coordinates while
  // letting the canvas receive the new graph in the same render as an edit.
  let currentVisualGraph = visualGraph;
  if (visualGraph.source !== visualSource) {
    currentVisualGraph = {
      source: visualSource,
      graph: toForceGraphData(visualSource.data, visualGraph.graph, colorBy),
    };
    setVisualGraph(currentVisualGraph);
  }
  const forceData: ForceGraphData = currentVisualGraph.graph;

  // The exact strength the canvas drew for each visible relationship, keyed by
  // relationship id. The canvas computes computeStrength over the FILTERED
  // subgraph, so this is what InspectPanel's StrengthBar must report to agree
  // with the drawn edge. Relationships filtered out of the canvas are simply
  // absent; InspectPanel falls back to the whole-graph value for those.
  const linkStrengthById = useMemo(() => {
    const map = new Map<string, number>();
    for (const link of forceData.links) map.set(link.id, link.strength);
    return map;
  }, [forceData]);

  const selectedPerson = useMemo(
    () => data.people.find((p) => p.id === selectedId) ?? null,
    [data.people, selectedId],
  );
  const originatorToClaim =
    data.people.length === 1 && !data.people[0].claimed ? data.people[0] : null;

  const focusedPerson = data.people.find((person) => person.id === focusedId);
  const focusedVisibleConnections = focusedPerson
    ? data.relationships.filter(
        (relationship) =>
          (relationship.personAId === focusedPerson.id ||
            relationship.personBId === focusedPerson.id) &&
          (!hideWeak || relationship.category > CATEGORY.Familiar),
      ).length
    : 0;

  const editorPerson = useMemo(
    () => data.people.find((p) => p.id === editorPersonId) ?? null,
    [data.people, editorPersonId],
  );

  const nameById = useCallback(
    (id: string) => data.people.find((p) => p.id === id)?.name ?? "someone",
    [data.people],
  );

  const visibleLinks = hideWeak
    ? forceData.links.filter((link) => link.structural).length
    : forceData.links.length;

  const dismissWelcome = useCallback(() => {
    markWelcomeSeen();
    setWelcomeOpen(false);
  }, []);

  // Selecting a person clears any selected edge, so only one inspector shows.
  const selectNode = useCallback((id: string | null) => {
    setSelectedId(id);
    setSelectedLinkId(null);
    if (id) {
      setFocusedId(id);
      setFocusRequest({ id, nonce: Date.now() });
    }
  }, []);

  const focusPerson = useCallback((id: string) => {
    setSelectedId(id);
    setSelectedLinkId(null);
    setFocusedId(id);
    setFocusRequest({ id, nonce: Date.now() });
  }, []);

  const showAll = useCallback(() => {
    setFocusedId(null);
    setFocusRequest(null);
    setSelectedId(null);
    setSelectedLinkId(null);
    setFitRequest((request) => request + 1);
  }, []);

  // Opening the connections editor for a brand-new or existing person.
  const openEditorFor = useCallback((id: string) => {
    if (id !== claimedPersonId) return;
    setEditorPersonId(id);
    setManageOpen(false);
    setSelectedId(null);
    setSelectedLinkId(null);
    setFocusedId(id);
    setFocusRequest({ id, nonce: Date.now() });
  }, [claimedPersonId]);

  // Deep-link support: after claiming a profile, ClaimProfile redirects to
  // `/graph?person=<id>&onboarding=1`. Once the async person list has
  // hydrated, center the graph on that person (and, when onboarding, open
  // their connections editor so they are guided into completing their
  // profile). Runs at most once per mount.
  const deepLinkHandled = useRef(false);
  useEffect(() => {
    if (deepLinkHandled.current) return;
    if (!hydrated) return;
    const personId = searchParams.get("person");
    if (!personId) {
      // No deep link to act on; mark handled so a later param change (which
      // we intentionally do not react to) cannot retrigger focus.
      deepLinkHandled.current = true;
      return;
    }
    const exists = data.people.some((person) => person.id === personId);
    if (!exists) return; // wait in case data is still catching up
    deepLinkHandled.current = true;
    // Defer the focus/edit call out of the effect body so we are not calling
    // setState synchronously during the effect (which triggers cascading
    // renders). The graph has already hydrated, so the next microtask is a
    // safe place to center on the deep-linked person.
    const onboarding = searchParams.get("onboarding") === "1";
    queueMicrotask(() => {
      if (onboarding) {
        // The onboarding deep link opens the connections editor as the single
        // guided surface. Suppress the first-run Welcome so its z-50 overlay
        // does not stack on top of the editor. This marks Welcome as seen.
        dismissWelcome();
        openEditorFor(personId);
      } else {
        focusPerson(personId);
      }
    });
  }, [
    hydrated,
    searchParams,
    data.people,
    focusPerson,
    openEditorFor,
    dismissWelcome,
  ]);

  // Connect mode always anchors the pair to the claimed person.
  const handleConnectClick = useCallback(
    (id: string) => {
      if (!claimedPersonId || id === claimedPersonId) return;
      setConnectPair({ aId: claimedPersonId, bId: id });
      setPendingSourceId(claimedPersonId);
    },
    [claimedPersonId],
  );

  const toggleConnectMode = useCallback(() => {
    if (!claimedPersonId) return;
    setConnectMode((on) => !on);
    setFocusedId(null);
    setFocusRequest(null);
    setFitRequest((request) => request + 1);
    setSelectedId(null);
    setPendingSourceId(claimedPersonId);
    setConnectPair(null);
    setSelectedLinkId(null);
  }, [claimedPersonId]);

  const handleLinkClick = useCallback(
    (linkId: string) => {
      const rel = data.relationships.find((r) => r.id === linkId);
      if (!rel) return;
      if (connectMode) {
        const isMine =
          claimedPersonId === rel.personAId || claimedPersonId === rel.personBId;
        if (!isMine) return;
        // In the explicit editing mode, edge-click is a quick remove.
        const a = nameById(rel.personAId);
        const b = nameById(rel.personBId);
        removeRelationship(linkId);
        notify(`Disconnected ${a} and ${b}`);
      } else {
        // Default: reveal the connection's classification; no deletion.
        setSelectedLinkId(linkId);
        setSelectedId(null);
      }
    },
    [
      claimedPersonId,
      connectMode,
      data.relationships,
      nameById,
      removeRelationship,
      notify,
    ],
  );

  const selectedRelationship = useMemo(
    () => data.relationships.find((r) => r.id === selectedLinkId) ?? null,
    [data.relationships, selectedLinkId],
  );

  const existingPairCategory: Category | null = connectPair
    ? (findRelationship(data, connectPair.aId, connectPair.bId)?.category ??
      null)
    : null;

  return (
    <main className="flex h-screen flex-col">
      <header className="flex flex-col gap-3 border-b border-white/10 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4 sm:px-6">
        <div className="flex items-baseline gap-3">
          <h1 className="text-lg font-semibold tracking-tight">Circle</h1>
          <span className="text-sm text-slate-400" suppressHydrationWarning>
            {hydrated
              ? `${pluralize(forceData.nodes.length, "person", "people")} · ${pluralize(
                  visibleLinks,
                  "connection",
                  "connections",
                )}`
              : "Loading…"}
          </span>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <SearchBox people={data.people} onPick={focusPerson} />
          <button
            onClick={() => setManageOpen((o) => !o)}
            disabled={!claimedPersonId}
            title={claimedPersonId ? "Add someone to your connections" : "Claim your profile first"}
            className="inline-flex min-h-11 items-center rounded-full bg-indigo-500 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-0"
          >
            {manageOpen ? "Close" : "Add connection"}
          </button>
          <button
            onClick={toggleConnectMode}
            disabled={!claimedPersonId}
            title={claimedPersonId ? "Connect yourself to someone" : "Claim your profile first"}
            className={`inline-flex min-h-11 items-center rounded-full px-4 py-1.5 text-sm font-semibold transition sm:min-h-0 ${
              connectMode
                ? "bg-emerald-500 text-white hover:bg-emerald-400"
                : "bg-white/10 text-slate-200 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
            }`}
          >
            {connectMode ? "Connecting…" : "Connect"}
          </button>
          <OverflowMenu>
            {(close) => (
              <>
                <button
                  role="menuitem"
                  onClick={() => setHideWeak((v) => !v)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/10"
                >
                  Hide weak ties
                  <span
                    className={`ml-3 inline-flex h-4 w-4 items-center justify-center rounded border ${
                      hideWeak
                        ? "border-indigo-400 bg-indigo-500 text-white"
                        : "border-white/20"
                    }`}
                    aria-hidden
                  >
                    {hideWeak ? "✓" : ""}
                  </span>
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    setLegendOpen(true);
                    close();
                  }}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/10"
                >
                  How to read the graph
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    setWelcomeOpen(true);
                    close();
                  }}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/10"
                >
                  Show intro
                </button>
              </>
            )}
          </OverflowMenu>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-2 text-xs text-slate-400 sm:px-6">
        <span className="font-medium text-slate-300">View</span>
        <FilterSelect label="Major" value={filters.major} options={attributeOptions(data.people, "major")} onChange={(major) => setFilters((current) => ({ ...current, major }))} />
        <FilterSelect label="Year" value={filters.year} options={attributeOptions(data.people, "year")} onChange={(year) => setFilters((current) => ({ ...current, year }))} />
        <FilterSelect label="Residence" value={filters.residence} options={attributeOptions(data.people, "residence")} onChange={(residence) => setFilters((current) => ({ ...current, residence }))} />
        <label className="flex items-center gap-1 rounded-full bg-white/5 px-2 py-1">
          Strength
          <input type="range" min="0" max="1" step="0.05" value={filters.minStrength} onChange={(event) => setFilters((current) => ({ ...current, minStrength: Number(event.target.value) }))} className="w-20" />
          <span>{Math.round(filters.minStrength * 100)}%</span>
        </label>
        <label className="flex items-center gap-1">
          Color by
          <select value={colorBy} onChange={(event) => setColorBy(event.target.value as ColorBy)} className="min-h-11 rounded bg-white/10 px-2 py-1 text-base text-slate-200 sm:min-h-0 sm:text-xs">
            <option value="major">Major</option>
            <option value="year">Year</option>
            <option value="residence">Residence</option>
            <option value="claimed">Claim status</option>
          </select>
        </label>
      </div>

      {error && <div className="border-b border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-200 sm:px-6">Could not sync Circle: {error}</div>}
      {loading && <div className="border-b border-indigo-500/20 bg-indigo-500/10 px-4 py-2 text-sm text-indigo-200 sm:px-6">Loading the shared network…</div>}
      {!loading && !claimedPersonId && originatorToClaim && (
        <div className="flex flex-col gap-2 border-b border-indigo-400/30 bg-indigo-500/10 px-4 py-2 text-sm text-indigo-100 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6">
          <span>This network starts with your profile, {originatorToClaim.name}.</span>
          <button
            onClick={() =>
              router.push(
                `/claim/${encodeURIComponent(originatorToClaim.claimToken)}`,
              )
            }
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-indigo-500 px-4 py-1.5 font-semibold text-white hover:bg-indigo-400 sm:min-h-0"
          >
            Claim your profile
          </button>
        </div>
      )}

      {connectMode && (
        <div className="border-b border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200 sm:px-6">
          {pendingSourceId
            ? `Click someone to add or update your connection with them. Click one of your lines to remove it.`
            : "Click someone to connect them to you."}
        </div>
      )}

      <div className="relative flex-1">
        <div
          className={`h-full ${manageOpen ? "lg:ml-80" : ""} ${
            editorPerson
              ? "lg:mr-96"
              : selectedPerson || selectedRelationship
                ? "lg:mr-80"
                : ""
          }`}
        >
          <GraphCanvas
            data={forceData}
            hideWeak={hideWeak}
            selectedId={selectedId}
            focusedId={focusedPerson?.id ?? null}
            onSelect={selectNode}
            focusRequest={focusRequest}
            fitRequest={fitRequest}
            connectMode={connectMode}
            pendingSourceId={pendingSourceId}
            onNodeClickConnect={handleConnectClick}
            onLinkClick={handleLinkClick}
          />
        </div>

        {!connectMode && (
          <div className={`absolute top-4 left-4 z-10 ${manageOpen ? "hidden lg:block lg:left-[21rem]" : editorPerson || selectedPerson || selectedRelationship ? "hidden lg:block" : ""}`}>
            {focusedPerson ? (
              <div className="flex items-center gap-3 rounded-full border border-indigo-400/30 bg-slate-950/90 px-4 py-2 text-sm shadow-lg backdrop-blur">
                <span className="max-w-64 truncate text-slate-200">
                  Focus: {focusedPerson.name} · {focusedVisibleConnections} ties
                </span>
                <button
                  onClick={showAll}
                  className="shrink-0 font-semibold text-indigo-300 hover:text-indigo-200"
                >
                  Show all
                </button>
              </div>
            ) : (
              <button
                onClick={() => setFitRequest((request) => request + 1)}
                className="rounded-full border border-white/10 bg-slate-950/90 px-4 py-2 text-sm font-medium text-slate-300 shadow-lg backdrop-blur hover:text-white"
              >
                Fit map
              </button>
            )}
          </div>
        )}

        {manageOpen && (
          <ManagePanel
            onClose={() => setManageOpen(false)}
            onPersonAdded={(id) => {
              setManageOpen(false);
              focusPerson(id);
            }}
          />
        )}

        {editorPerson && (
          <ConnectionsEditor
            person={editorPerson}
            onChanged={notify}
            onClose={() => setEditorPersonId(null)}
          />
        )}

        {selectedPerson && !editorPerson && (
          <InspectPanel
            key={selectedPerson.id}
            person={selectedPerson}
            data={data}
            linkStrengthById={linkStrengthById}
            onSelectPerson={focusPerson}
            onEditConnections={openEditorFor}
            onClose={() => setSelectedId(null)}
          />
        )}

        {selectedRelationship &&
          !selectedPerson &&
          !editorPerson &&
          (() => {
            const a = data.people.find(
              (p) => p.id === selectedRelationship.personAId,
            );
            const b = data.people.find(
              (p) => p.id === selectedRelationship.personBId,
            );
            if (!a || !b) return null;
            return (
              <EdgeInspector
                relationship={selectedRelationship}
                personA={a}
                personB={b}
                onSelectPerson={focusPerson}
                onRemoved={(an, bn) => notify(`Disconnected ${an} and ${bn}`)}
                onClose={() => setSelectedLinkId(null)}
              />
            );
          })()}

        {/* Confirmation toast */}
        {toast && (
          <div className="absolute bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-4 rounded-full border border-white/10 bg-slate-900/95 px-5 py-2.5 shadow-2xl backdrop-blur">
            <span className="text-sm text-slate-200">{toast}</span>
          </div>
        )}

        {/* Connect-mode category picker */}
        {connectPair && (
          <CategoryPicker
            aName={nameById(connectPair.aId)}
            bName={nameById(connectPair.bId)}
            current={existingPairCategory}
            onPick={(category) => {
              const a = nameById(connectPair.aId);
              const b = nameById(connectPair.bId);
              const had = existingPairCategory != null;
              setRelationship(connectPair.aId, connectPair.bId, category);
              if (category == null && had) notify(`Disconnected ${a} and ${b}`);
              else if (!had) notify(`Connected ${a} and ${b}`);
              else notify(`Updated ${a} and ${b}`);
              setConnectPair(null);
            }}
            onCancel={() => setConnectPair(null)}
          />
        )}

        {legendOpen && <Legend onClose={() => setLegendOpen(false)} />}

        {hydrated && welcomeOpen && (
          <Welcome
            claimed={claimedPersonId !== null}
            hasOriginatorToClaim={originatorToClaim !== null}
            onStart={() => {
              dismissWelcome();
              if (claimedPersonId) focusPerson(claimedPersonId);
              else if (originatorToClaim)
                router.push(
                  `/claim/${encodeURIComponent(originatorToClaim.claimToken)}`,
                );
              else setManageOpen(true);
            }}
            onClose={dismissWelcome}
          />
        )}
      </div>
    </main>
  );
}

function CategoryPicker({
  aName,
  bName,
  current,
  onPick,
  onCancel,
}: {
  aName: string;
  bName: string;
  current: Category | null;
  onPick: (category: Category | null) => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <div
        className="max-h-[85vh] w-full max-w-sm overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm text-slate-400">
          {current ? "Update connection" : "Connect"}
        </p>
        <h3 className="mt-1 text-lg font-semibold">
          {aName} &amp; {bName}
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          How well do they know each other?
        </p>
        <div className="mt-4 space-y-2">
          {CATEGORY_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => onPick(isCategory(o.value) ? o.value : null)}
              className={`w-full rounded-lg px-3 py-2 text-left transition ${
                current === o.value
                  ? "bg-indigo-500 text-white"
                  : "bg-white/5 text-slate-200 hover:bg-white/10"
              }`}
            >
              <span className="block text-sm font-medium">{o.label}</span>
              <span
                className={`block text-xs ${
                  current === o.value ? "text-indigo-100" : "text-slate-400"
                }`}
              >
                {o.definition}
              </span>
            </button>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          {current && (
            <button
              onClick={() => onPick(null)}
              className="flex-1 rounded-lg border border-rose-500/40 px-3 py-2 text-sm font-medium text-rose-300 transition hover:bg-rose-500/10"
            >
              Remove
            </button>
          )}
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/20"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center gap-1">
      <span className="sr-only">Filter by {label}</span>
      <select
        aria-label={`Filter by ${label}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 rounded bg-white/10 px-2 py-1 text-base text-slate-200 sm:min-h-0 sm:text-xs"
      >
        <option value="">All {label.toLowerCase()}s</option>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}
