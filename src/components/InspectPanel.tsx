"use client";

import { useId, useMemo, useState } from "react";
import { neighborsOf, rankCandidatesFor } from "@/lib/graph";
import {
  connectionSummary,
  NEIGHBOR_SORT_OPTIONS,
  SHORT_CATEGORY_LABELS,
  sortNeighbors,
  type NeighborSort,
} from "@/lib/graph-view";
import { useGraphStore } from "@/lib/GraphStore";
import { computeStrength } from "@/lib/strength";
import ConfirmDialog from "./ConfirmDialog";
import OverflowMenu from "./OverflowMenu";
import PanelSheet from "./PanelSheet";
import {
  CATEGORY_LABELS,
  CATEGORY_OPTIONS,
  isCategory,
  type Category,
  type GraphData,
  type Person,
  type PersonAttributes,
} from "@/lib/types";

interface InspectPanelProps {
  person: Person;
  data: GraphData;
  /**
   * The strength the canvas actually drew for each relationship, keyed by
   * relationship id. The canvas computes computeStrength over the FILTERED
   * subgraph, so an active View filter can lower a tie's mutual-friend boost;
   * reading this map keeps the StrengthBar tooltip in agreement with the drawn
   * edge. Relationships absent from the map (filtered out of the canvas) fall
   * back to the whole-graph computeStrength value.
   */
  linkStrengthById?: ReadonlyMap<string, number>;
  onSelectPerson: (id: string) => void;
  onEditConnections: (id: string) => void;
  onClose: () => void;
}

export default function InspectPanel({
  person,
  data,
  linkStrengthById,
  onSelectPerson,
  onEditConnections,
  onClose,
}: InspectPanelProps) {
  const {
    claimedPersonId,
    renamePerson,
    removePerson,
    setAttributes,
    confirmRelationship,
    updateRelationshipCategory,
    removeRelationship,
  } = useGraphStore();
  const isOwner = claimedPersonId === person.id;
  const titleId = useId();
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sortMode, setSortMode] = useState<NeighborSort>("closeness");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [draft, setDraft] = useState(() => ({
    name: person.name,
    major: person.attributes?.major ?? "",
    year: person.attributes?.year ?? "",
    residence: person.attributes?.residence ?? "",
    hometown: person.attributes?.hometown ?? "",
    clubs: person.attributes?.clubs?.join(", ") ?? "",
  }));

  const neighbors = neighborsOf(person.id, data);
  const rows = sortNeighbors(person.id, neighbors, sortMode, data);
  const summary = connectionSummary(neighbors);
  const recommendations = useMemo(
    () =>
      rankCandidatesFor(person.id, data)
        .filter((candidate) => candidate.category === null && candidate.score > 0)
        .slice(0, 5),
    [data, person.id],
  );

  const saveProfile = () => {
    if (!isOwner) return;
    renamePerson(person.id, draft.name);
    const attributes: PersonAttributes = {
      major: draft.major,
      year: draft.year,
      residence: draft.residence,
      hometown: draft.hometown,
      clubs: draft.clubs.split(","),
    };
    setAttributes(person.id, attributes);
    setEditing(false);
  };

  return (
    <>
    <PanelSheet
      labelledBy={titleId}
      onClose={onClose}
      desktop="right"
      title={
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold ${person.claimed ? "bg-indigo-400 text-slate-950" : "border border-dashed border-slate-400 bg-slate-800 text-slate-300"}`}>
              {initials(person.name)}
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-widest text-indigo-400">
                {person.claimed ? "Claimed profile" : "Unclaimed profile"}
              </p>
              <h2 id={titleId} className="truncate text-xl font-semibold">{person.name}</h2>
            </div>
          </div>
          {isOwner && (
            <OverflowMenu label="Profile options">
              {(close) => (
                <button
                  role="menuitem"
                  onClick={() => {
                    close();
                    setConfirmingDelete(true);
                  }}
                  className="min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm text-rose-300 transition hover:bg-rose-500/10"
                >
                  Delete profile
                </button>
              )}
            </OverflowMenu>
          )}
        </div>
      }
      footer={
        isOwner ? (
          <div className="flex gap-2">
            {!editing && <button onClick={() => setEditing(true)} className="min-h-11 flex-1 rounded-lg bg-indigo-500 px-3 py-2 text-sm font-semibold hover:bg-indigo-400">Edit profile</button>}
            <button onClick={() => onEditConnections(person.id)} className="min-h-11 flex-1 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/20">Edit connections</button>
          </div>
        ) : undefined
      }
    >
      <div>
        {editing ? (
          <ProfileForm draft={draft} setDraft={setDraft} onSave={saveProfile} onCancel={() => setEditing(false)} />
        ) : (
          <ProfileDetails person={person} />
        )}

        {!person.claimed && claimedPersonId && data.relationships.some(r =>
          (r.personAId === claimedPersonId && r.personBId === person.id) ||
          (r.personBId === claimedPersonId && r.personAId === person.id)
        ) && (
          <button
            onClick={async () => {
              try {
                const response = await fetch("/api/invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ personId: person.id }) });
                if (!response.ok) throw new Error("Could not create invitation.");
                const { url } = await response.json() as { url: string };
                await navigator.clipboard.writeText(url);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1800);
              } catch { setCopied(false); }
            }}
            className="mt-4 w-full rounded-lg border border-indigo-400/30 bg-indigo-500/10 px-3 py-2 text-sm font-medium text-indigo-200 hover:bg-indigo-500/20"
          >
            {copied ? "Invite link copied" : "Create and copy invite link"}
          </button>
        )}

        <section className="mt-6">
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Connections</h3>
              <p className="mt-1 text-sm text-slate-400">{summary.text}</p>
            </div>
            {neighbors.length > 1 && (
              <label className="flex shrink-0 items-center gap-1 text-xs text-slate-500">
                Sort
                <select
                  value={sortMode}
                  onChange={(event) => setSortMode(event.target.value as NeighborSort)}
                  className="min-h-11 rounded-lg bg-white/10 px-2 text-base text-slate-200 sm:text-xs lg:min-h-8"
                >
                  {NEIGHBOR_SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {neighbors.length === 0 ? (
            <p className="py-4 text-sm text-slate-500">No connections yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-white/5 overflow-hidden rounded-lg bg-white/5">
              {rows.map(({ person: other, relationship, mutualCount }) => {
                const canEditConnection =
                  claimedPersonId === relationship.personAId ||
                  claimedPersonId === relationship.personBId;
                const canConfirm =
                  !relationship.confirmed &&
                  claimedPersonId !== null &&
                  claimedPersonId !== relationship.proposedByPersonId &&
                  canEditConnection;
                const expanded = canEditConnection && expandedId === relationship.id;
                const strength =
                  linkStrengthById?.get(relationship.id) ??
                  computeStrength(relationship, data);
                return (
                  <li key={relationship.id}>
                    <div className="flex items-center gap-2 pr-1">
                      <button
                        onClick={() => onSelectPerson(other.id)}
                        className="min-h-11 min-w-0 flex-1 py-2 pl-3 text-left hover:text-indigo-300"
                      >
                        <span className="block truncate text-sm font-medium">{other.name}</span>
                        <span className="block text-xs text-slate-500">{mutualCount} mutual</span>
                      </button>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="flex items-center gap-1.5">
                          {!relationship.confirmed && (
                            <span
                              role="img"
                              aria-label="Pending confirmation"
                              title="Pending confirmation"
                              className="h-2 w-2 rounded-full bg-amber-300/80"
                            />
                          )}
                          {canEditConnection ? (
                            <select
                              aria-label={`Closeness with ${other.name}`}
                              value={relationship.category}
                              onChange={(event) => {
                                const value = Number(event.target.value);
                                if (isCategory(value)) updateRelationshipCategory(relationship.id, value);
                              }}
                              className="min-h-11 max-w-32 rounded-lg bg-white/10 px-2 text-base sm:text-xs lg:min-h-8"
                            >
                              {CATEGORY_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{SHORT_CATEGORY_LABELS[option.value]}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-xs text-slate-300">{SHORT_CATEGORY_LABELS[relationship.category]}</span>
                          )}
                        </span>
                        <StrengthBar strength={strength} category={relationship.category} />
                      </div>
                      {canEditConnection && (
                        <button
                          onClick={() => setExpandedId(expanded ? null : relationship.id)}
                          aria-expanded={expanded}
                          aria-label={`${expanded ? "Hide" : "Show"} actions for ${other.name}`}
                          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-white/10 hover:text-white"
                        >
                          <span aria-hidden="true" className={`text-xs transition ${expanded ? "rotate-180" : ""}`}>▾</span>
                        </button>
                      )}
                    </div>
                    {expanded && (
                      <div className="flex gap-2 px-3 pb-3">
                        {canConfirm && (
                          <button
                            onClick={() => confirmRelationship(relationship.id)}
                            className="min-h-11 flex-1 rounded-lg bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 lg:min-h-9"
                          >
                            Confirm connection
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setExpandedId(null);
                            removeRelationship(relationship.id);
                          }}
                          className="min-h-11 flex-1 rounded-lg border border-rose-500/30 px-3 py-2 text-xs text-rose-300 hover:bg-rose-500/10 lg:min-h-9"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {recommendations.length > 0 && (
          <section className="mt-6">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">People you might know</h3>
            <ul className="mt-2 space-y-2">
              {recommendations.map((candidate) => (
                <li key={candidate.person.id}>
                  <button onClick={() => onSelectPerson(candidate.person.id)} className="w-full rounded-lg bg-white/5 p-3 text-left hover:bg-white/10">
                    <span className="block text-sm font-medium">{candidate.person.name}</span>
                    <span className="mt-1 flex flex-wrap gap-1">
                      {candidate.reasons.map((reason) => <span key={reason} className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] text-indigo-200">{reason}</span>)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </PanelSheet>
    {confirmingDelete && (
      <ConfirmDialog
        title="Delete profile?"
        message={`Delete ${person.name} and all their connections? This cannot be undone.`}
        confirmLabel="Delete profile"
        destructive
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={() => {
          setConfirmingDelete(false);
          removePerson(person.id);
          onClose();
        }}
      />
    )}
    </>
  );
}

function ProfileDetails({ person }: { person: Person }) {
  const fields = [
    ["Major", person.attributes?.major],
    ["Year", person.attributes?.year],
    ["Residence", person.attributes?.residence],
    ["Hometown", person.attributes?.hometown],
    ["Clubs", person.attributes?.clubs?.join(", ")],
  ];
  return (
    <dl className="grid grid-cols-[5rem_1fr] gap-x-3 gap-y-2 text-sm">
      {fields.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-slate-500">{label}</dt>
          <dd className="text-slate-200">{value || "Not set"}</dd>
        </div>
      ))}
    </dl>
  );
}

function ProfileForm({
  draft,
  setDraft,
  onSave,
  onCancel,
}: {
  draft: Record<"name" | "major" | "year" | "residence" | "hometown" | "clubs", string>;
  setDraft: React.Dispatch<React.SetStateAction<typeof draft>>;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-3">
      {(["name", "major", "year", "residence", "hometown", "clubs"] as const).map((field) => (
        <label key={field} className="block text-xs capitalize text-slate-400">
          {field === "clubs" ? "Clubs (comma-separated)" : field}
          <input value={draft[field]} onChange={(event) => setDraft((current) => ({ ...current, [field]: event.target.value }))} className="mt-1 w-full rounded-lg bg-white/10 px-3 py-2 text-base text-slate-100 outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm" />
        </label>
      ))}
      <div className="flex gap-2">
        <button onClick={onSave} className="flex-1 rounded-lg bg-indigo-500 px-3 py-2 text-sm font-semibold">Save</button>
        <button onClick={onCancel} className="rounded-lg bg-white/10 px-3 py-2 text-sm">Cancel</button>
      </div>
    </div>
  );
}

function StrengthBar({
  strength,
  category,
}: {
  strength: number;
  category: Category;
}) {
  const tooltip = `${CATEGORY_LABELS[category]} · ${Math.round(strength * 100)}%`;
  return (
    <span className="inline-flex h-1.5 w-12 overflow-hidden rounded-full bg-white/10" title={tooltip}>
      <span className="h-full rounded-full bg-indigo-400" style={{ width: `${Math.max(8, strength * 100)}%` }} />
    </span>
  );
}

function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}
