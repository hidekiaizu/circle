"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEscapeToClose } from "@/lib/escape-stack";
import GraphCanvas from "./GraphCanvas";
import InspectPanel from "./InspectPanel";
import ManagePanel from "./ManagePanel";
import ConnectionsEditor from "./ConnectionsEditor";
import SearchBox from "./SearchBox";
import Legend from "./Legend";
import EdgeInspector from "./EdgeInspector";
import OverflowMenu from "./OverflowMenu";
import Welcome from "./Welcome";
import FilterSheet from "./FilterSheet";
import { toForceGraphData, type ForceGraphData } from "@/lib/graph";
import { findRelationship } from "@/lib/store-core";
import {
  activeFilterChips,
  clearChipFilters,
  clearFilter,
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

  const [colorBy, setColorBy] = useState<ColorBy>("major");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  // Mobile-only collapsible search under the compact header.
  const [searchOpen, setSearchOpen] = useState(false);
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
  // Explains how unclaimed visitors claim a profile before adding connections.
  const [claimInfoOpen, setClaimInfoOpen] = useState(false);

  // Familiar ties stay in the filtered data but are hidden on the canvas
  // unless the Connections filter is "All connections".
  const hideWeak = filters.minCategory > CATEGORY.Familiar;
  const filterChips = activeFilterChips(filters);
  const filterCount = filterChips.length;

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
      setSearchOpen(false);
      setFocusedId(id);
      setFocusRequest({ id, nonce: Date.now() });
    }
  }, []);

  const focusPerson = useCallback((id: string) => {
    setSearchOpen(false);
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

  // Mobile bottom bar "Explore": back to the whole map with nothing open.
  const explore = useCallback(() => {
    setSearchOpen(false);
    setFilterSheetOpen(false);
    setManageOpen(false);
    setEditorPersonId(null);
    setConnectMode(false);
    setConnectPair(null);
    setClaimInfoOpen(false);
    showAll();
  }, [showAll]);

  const openAddConnection = useCallback(() => {
    if (!claimedPersonId) return;
    setSearchOpen(false);
    setFilterSheetOpen(false);
    setConnectMode(false);
    setConnectPair(null);
    setManageOpen(true);
  }, [claimedPersonId]);

  const openClaimInfo = useCallback(() => {
    setSearchOpen(false);
    setFilterSheetOpen(false);
    setClaimInfoOpen(true);
  }, []);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }, [router]);

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

  const editorOpen = !!editorPerson && editorPerson.id === claimedPersonId;
  // Below lg, any open panel, sheet, or dialog takes over the viewport, so the
  // normal header, filter chips, search, and bottom bar step aside.
  const mobileSurfaceOpen =
    manageOpen ||
    editorOpen ||
    !!selectedPerson ||
    !!selectedRelationship ||
    filterSheetOpen ||
    legendOpen ||
    (hydrated && welcomeOpen) ||
    claimInfoOpen ||
    !!connectPair;
  const filtersLabel = filterCount > 0 ? `Filters · ${filterCount}` : "Filters";

  return (
    <main className="graph-shell flex h-dvh flex-col overflow-hidden">
      <header
        className={`${mobileSurfaceOpen ? "hidden lg:block" : "block"} shrink-0 border-b border-white/10 pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]`}
      >
        <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6 lg:h-auto lg:gap-4 lg:py-3">
          <div className="flex min-w-0 items-baseline gap-3">
            <h1 className="text-lg font-semibold tracking-tight">Circle</h1>
            <span className="truncate text-sm text-slate-400" suppressHydrationWarning>
              {hydrated ? (
                <>
                  <span className="lg:hidden">
                    {pluralize(forceData.nodes.length, "person", "people")}
                  </span>
                  <span className="hidden lg:inline">
                    {`${pluralize(forceData.nodes.length, "person", "people")} · ${pluralize(
                      visibleLinks,
                      "connection",
                      "connections",
                    )}`}
                  </span>
                </>
              ) : (
                "Loading…"
              )}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2 lg:items-end lg:gap-3">
            <div className="hidden lg:block">
              <SearchBox people={data.people} onPick={focusPerson} />
            </div>
            <button
              onClick={() => setFilterSheetOpen((open) => !open)}
              aria-haspopup="dialog"
              aria-expanded={filterSheetOpen}
              className={`hidden items-center rounded-full px-4 py-1.5 text-sm font-semibold transition lg:inline-flex ${
                filterCount > 0 || filterSheetOpen
                  ? "bg-indigo-500/20 text-indigo-100 hover:bg-indigo-500/30"
                  : "bg-white/10 text-slate-200 hover:bg-white/20"
              }`}
            >
              {filtersLabel}
            </button>
            {hydrated &&
              (claimedPersonId ? (
                <button
                  onClick={() =>
                    manageOpen ? setManageOpen(false) : openAddConnection()
                  }
                  aria-haspopup="dialog"
                  aria-expanded={manageOpen}
                  className="hidden items-center rounded-full bg-indigo-500 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-indigo-400 lg:inline-flex"
                >
                  + Add connection
                </button>
              ) : (
                <button
                  onClick={openClaimInfo}
                  aria-haspopup="dialog"
                  className="hidden items-center rounded-full bg-indigo-500 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-indigo-400 lg:inline-flex"
                >
                  Claim your profile to add connections
                </button>
              ))}
            <button
              onClick={signOut}
              className="hidden rounded-full bg-white/10 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/20 lg:inline-flex"
            >
              Sign out
            </button>
            <OverflowMenu>
              {(close) => (
                <>
                  {claimedPersonId && (
                    <button
                      role="menuitem"
                      onClick={() => {
                        toggleConnectMode();
                        close();
                      }}
                      className="min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/10 lg:min-h-0"
                    >
                      {connectMode ? "Stop connecting" : "Connect on the map"}
                    </button>
                  )}
                  <button
                    role="menuitem"
                    onClick={() => {
                      setLegendOpen(true);
                      close();
                    }}
                    className="min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/10 lg:min-h-0"
                  >
                    How to read the graph
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => {
                      setWelcomeOpen(true);
                      close();
                    }}
                    className="min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/10 lg:min-h-0"
                  >
                    Show intro
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => {
                      close();
                      void signOut();
                    }}
                    className="min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/10 lg:hidden"
                  >
                    Sign out
                  </button>
                </>
              )}
            </OverflowMenu>
          </div>
        </div>
        {searchOpen && (
          <div className="px-4 pb-3 sm:px-6 lg:hidden">
            <SearchBox
              people={data.people}
              onPick={focusPerson}
              onDismiss={() => setSearchOpen(false)}
              autoFocus
              hideLabel
              className="w-full"
            />
          </div>
        )}
      </header>

      {filterCount > 0 && (
        <div
          aria-label="Active filters"
          className={`${mobileSurfaceOpen ? "hidden lg:flex" : "flex"} no-scrollbar shrink-0 items-center gap-2 overflow-x-auto border-b border-white/10 px-4 py-1 sm:px-6 lg:py-2`}
        >
          {filterChips.map((chip) => (
            <button
              key={chip.key}
              onClick={() => setFilters((current) => clearFilter(current, chip.key))}
              aria-label={`Remove filter: ${chip.label}`}
              className="inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-indigo-400/30 bg-indigo-500/15 pr-3 pl-4 text-sm text-indigo-100 transition hover:bg-indigo-500/25 lg:min-h-8"
            >
              {chip.label}
              <span aria-hidden className="text-base leading-none text-indigo-300">
                ×
              </span>
            </button>
          ))}
          {filterCount > 1 && (
            <button
              onClick={() => setFilters(clearChipFilters)}
              className="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full px-3 text-sm font-medium text-slate-400 transition hover:text-white lg:min-h-8"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {error && <div className="border-b border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-200 sm:px-6">Could not sync Circle: {error}</div>}
      {loading && <div className="border-b border-indigo-500/20 bg-indigo-500/10 px-4 py-2 text-sm text-indigo-200 sm:px-6">Loading the shared network…</div>}

      {connectMode && (
        <div className="flex shrink-0 items-center gap-3 border-b border-emerald-500/30 bg-emerald-500/10 py-1 pr-2 pl-4 text-sm text-emerald-200 sm:pl-6">
          <p className="min-w-0 flex-1">
            {pendingSourceId
              ? "Tap someone to add or update your connection with them. Tap one of your lines to remove it."
              : "Tap someone to connect them to you."}
          </p>
          <button
            onClick={toggleConnectMode}
            className="min-h-11 shrink-0 rounded-full bg-emerald-500 px-4 text-sm font-semibold text-white transition hover:bg-emerald-400 lg:min-h-8"
          >
            Done
          </button>
        </div>
      )}

      <div className="relative min-h-0 flex-1">
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
          <div className={`absolute top-3 left-[max(0.75rem,env(safe-area-inset-left))] z-10 lg:top-4 lg:left-4 ${mobileSurfaceOpen ? "hidden lg:block" : ""} ${manageOpen ? "lg:left-[21rem]" : ""}`}>
            {focusedPerson ? (
              <div className="flex max-w-[70vw] items-center rounded-full border border-indigo-400/30 bg-slate-950/90 pl-4 text-sm shadow-lg backdrop-blur sm:max-w-80">
                <span
                  className="min-w-0 truncate text-slate-200"
                  title={`${focusedPerson.name} · ${focusedVisibleConnections} ${focusedVisibleConnections === 1 ? "tie" : "ties"}`}
                >
                  {focusedPerson.name} · {focusedVisibleConnections}
                </span>
                <button
                  onClick={showAll}
                  aria-label="Show all people"
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg leading-none text-indigo-300 hover:text-indigo-100"
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setFitRequest((request) => request + 1)}
                aria-label="Fit map"
                title="Fit map"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-slate-950/80 text-slate-400 shadow-lg backdrop-blur hover:text-white lg:h-auto lg:w-auto lg:px-4 lg:py-2"
              >
                <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5 lg:hidden">
                  <path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="hidden text-sm font-medium lg:inline">Fit map</span>
              </button>
            )}
          </div>
        )}

        {manageOpen && (
          <ManagePanel
            onClose={() => setManageOpen(false)}
            onChanged={notify}
            onPersonAdded={(id) => {
              setManageOpen(false);
              focusPerson(id);
            }}
            onPersonConnected={(id) => {
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

        {/* Confirmation toast: above the mobile bottom bar / sheet footers and
            the home indicator on phones, inside the graph region at lg. */}
        {toast && (
          <div
            role="status"
            aria-live="polite"
            className="pointer-events-none fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-1/2 z-[60] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-4 rounded-full border border-white/10 bg-slate-900/95 px-5 py-2.5 text-center shadow-2xl backdrop-blur lg:absolute lg:bottom-6 lg:z-30"
          >
            <span className="text-sm text-slate-200">{toast}</span>
          </div>
        )}

        {filterSheetOpen && (
          <FilterSheet
            people={data.people}
            filters={filters}
            onFiltersChange={setFilters}
            colorBy={colorBy}
            onColorByChange={setColorBy}
            onClose={() => setFilterSheetOpen(false)}
          />
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
            onStart={() => {
              dismissWelcome();
              if (claimedPersonId) openAddConnection();
              else openClaimInfo();
            }}
            onShowLegend={() => {
              dismissWelcome();
              setLegendOpen(true);
            }}
            onClose={dismissWelcome}
          />
        )}

        {claimInfoOpen && <ClaimInfo onClose={() => setClaimInfoOpen(false)} />}
      </div>

      {/* Mobile bottom bar: the last flex child, so it never covers the graph. */}
      <nav
        aria-label="Graph actions"
        className={`${mobileSurfaceOpen ? "hidden" : "grid"} shrink-0 grid-cols-4 border-t border-white/10 bg-slate-950 pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] lg:hidden`}
      >
        <BarButton label="Explore" onClick={explore} icon={<ExploreIcon />} />
        <BarButton
          label="Search"
          onClick={() => {
            setFilterSheetOpen(false);
            setSearchOpen((open) => !open);
          }}
          pressed={searchOpen}
          icon={<SearchIcon />}
        />
        {!hydrated ? (
          // Neutral placeholder until we know whether the visitor has claimed.
          <span aria-hidden className="min-h-14" />
        ) : claimedPersonId ? (
          <button
            onClick={openAddConnection}
            aria-label="Add connection"
            className="flex min-h-14 flex-col items-center justify-center gap-0.5 py-1 text-[11px] font-medium text-slate-200"
          >
            <span
              aria-hidden
              className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-500 text-white shadow-lg shadow-indigo-500/30"
            >
              <PlusIcon />
            </span>
            Add
          </button>
        ) : (
          <button
            onClick={openClaimInfo}
            aria-haspopup="dialog"
            aria-label="Claim your profile to add connections"
            className="flex min-h-14 flex-col items-center justify-center gap-0.5 py-1 text-[11px] font-medium text-indigo-200"
          >
            <span
              aria-hidden
              className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-400/40"
            >
              <LockIcon />
            </span>
            Claim profile
          </button>
        )}
        <BarButton
          label="Filters"
          onClick={() => {
            setSearchOpen(false);
            setFilterSheetOpen(true);
          }}
          expanded={filterSheetOpen}
          icon={
            <span className="relative">
              <FilterIcon />
              {filterCount > 0 && (
                <span className="absolute -top-1.5 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-500 px-1 text-[10px] font-semibold text-white">
                  {filterCount}
                </span>
              )}
            </span>
          }
        />
      </nav>
    </main>
  );
}

function BarButton({
  label,
  icon,
  onClick,
  pressed,
  expanded,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  /** For toggles (Search). */
  pressed?: boolean;
  /** For buttons that open a sheet (Filters). */
  expanded?: boolean;
}) {
  const active = pressed || expanded;
  return (
    <button
      onClick={onClick}
      aria-pressed={pressed}
      aria-expanded={expanded}
      aria-haspopup={expanded === undefined ? undefined : "dialog"}
      className={`flex min-h-14 flex-col items-center justify-center gap-1 py-1 text-[11px] font-medium transition ${
        active ? "text-indigo-300" : "text-slate-300 hover:text-white"
      }`}
    >
      <span aria-hidden className="flex h-6 items-center">
        {icon}
      </span>
      {label}
    </button>
  );
}

const ICON_PROPS = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function ExploreIcon() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg {...ICON_PROPS} width={22} height={22}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M4 6h16M7 12h10M10 18h4" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

/** Viewport-level explanation of how an unclaimed visitor claims a profile. */
function ClaimInfo({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
  }, []);
  useEscapeToClose(onClose);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 pt-[max(1rem,env(safe-area-inset-top))] sm:items-center sm:px-4 sm:pb-[max(1rem,env(safe-area-inset-bottom))]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="claim-info-title"
        className="flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-slate-900 shadow-2xl sm:max-w-sm sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 py-2 pr-2 pl-5">
          <h2 id="claim-info-title" className="text-lg font-semibold">
            Claim your profile
          </h2>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg leading-none text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-5 py-4 text-sm leading-relaxed text-slate-300">
          <p>
            Circle is invite-only. To claim your profile, open the personal
            invite link you received.
          </p>
          <p className="text-slate-400">
            Once your profile is claimed, you can add connections and confirm
            the ones other people propose. Until then you can explore the map.
          </p>
        </div>
        <div className="shrink-0 border-t border-white/10 px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-3">
          <button
            onClick={onClose}
            className="min-h-11 w-full rounded-lg bg-indigo-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
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
  const closeRef = useRef<HTMLButtonElement>(null);

  // Focus the close control on open and cancel on Escape.
  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
  }, []);
  useEscapeToClose(onCancel);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-picker-title"
        className="flex max-h-[85dvh] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-white/10 py-3 pr-2 pl-5">
          <div className="min-w-0 pt-1">
            <p className="text-sm text-slate-400">
              {current ? "Update connection" : "Connect"}
            </p>
            <h3 id="category-picker-title" className="mt-1 text-lg font-semibold">
              {aName} &amp; {bName}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              How well do they know each other?
            </p>
          </div>
          <button
            ref={closeRef}
            onClick={onCancel}
            aria-label="Close"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg leading-none text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-5 py-4">
          {CATEGORY_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => onPick(isCategory(o.value) ? o.value : null)}
              className={`min-h-11 w-full rounded-lg px-3 py-2 text-left transition ${
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
        <div className="flex shrink-0 gap-2 border-t border-white/10 px-5 py-3">
          {current && (
            <button
              onClick={() => onPick(null)}
              className="min-h-11 flex-1 rounded-lg border border-rose-500/40 px-3 py-2 text-sm font-medium text-rose-300 transition hover:bg-rose-500/10"
            >
              Remove
            </button>
          )}
          <button
            onClick={onCancel}
            className="min-h-11 flex-1 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/20"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

