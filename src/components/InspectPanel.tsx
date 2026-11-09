"use client";

import { useMemo, useState } from "react";
import { mutualNeighbors, neighborsOf, rankCandidatesFor } from "@/lib/graph";
import { useGraphStore } from "@/lib/GraphStore";
import { computeStrength } from "@/lib/strength";
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
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [draft, setDraft] = useState(() => ({
    name: person.name,
    major: person.attributes?.major ?? "",
    year: person.attributes?.year ?? "",
    residence: person.attributes?.residence ?? "",
    hometown: person.attributes?.hometown ?? "",
    clubs: person.attributes?.clubs?.join(", ") ?? "",
  }));

  const neighbors = neighborsOf(person.id, data);
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
    <aside className="absolute right-0 top-0 flex h-full w-80 flex-col border-l border-white/10 bg-slate-950/95 backdrop-blur">
      <div className="border-b border-white/10 px-5 py-4">
        <div className="flex items-start justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold ${person.claimed ? "bg-indigo-400 text-slate-950" : "border border-dashed border-slate-400 bg-slate-800 text-slate-300"}`}>
              {initials(person.name)}
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-widest text-indigo-400">
                {person.claimed ? "Claimed profile" : "Unclaimed profile"}
              </p>
              <h2 className="truncate text-xl font-semibold">{person.name}</h2>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close panel" className="ml-2 rounded-full p-1 text-slate-400 hover:bg-white/10 hover:text-white">✕</button>
        </div>
        <p className="mt-3 text-sm text-slate-400">
          {neighbors.length} {neighbors.length === 1 ? "connection" : "connections"}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {editing ? (
          <ProfileForm draft={draft} setDraft={setDraft} onSave={saveProfile} onCancel={() => setEditing(false)} />
        ) : (
          <ProfileDetails person={person} />
        )}

        {!person.claimed && (
          <button
            onClick={async () => {
              const url = `${window.location.origin}/claim/${encodeURIComponent(person.claimToken)}`;
              await navigator.clipboard.writeText(url);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1800);
            }}
            className="mt-4 w-full rounded-lg border border-indigo-400/30 bg-indigo-500/10 px-3 py-2 text-sm font-medium text-indigo-200 hover:bg-indigo-500/20"
          >
            {copied ? "Invite link copied" : "Copy invite link"}
          </button>
        )}

        <section className="mt-6">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Connections</h3>
          {neighbors.length === 0 ? (
            <p className="py-4 text-sm text-slate-500">No connections yet.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {neighbors.map(({ person: other, relationship }) => {
                const canEditConnection =
                  claimedPersonId === relationship.personAId ||
                  claimedPersonId === relationship.personBId;
                const canConfirm =
                  !relationship.confirmed &&
                  claimedPersonId !== null &&
                  claimedPersonId !== relationship.proposedByPersonId &&
                  (claimedPersonId === relationship.personAId ||
                    claimedPersonId === relationship.personBId);
                return (
                  <li key={relationship.id} className="rounded-lg bg-white/5 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <button onClick={() => onSelectPerson(other.id)} className="truncate text-sm font-medium hover:text-indigo-300">{other.name}</button>
                      <StrengthBar
                        strength={
                          linkStrengthById?.get(relationship.id) ??
                          computeStrength(relationship, data)
                        }
                        category={relationship.category}
                      />
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <select
                        disabled={!canEditConnection}
                        value={relationship.category}
                        onChange={(event) => {
                          const value = Number(event.target.value);
                          if (isCategory(value)) updateRelationshipCategory(relationship.id, value);
                        }}
                        className="min-w-0 flex-1 rounded bg-white/10 px-2 py-1 text-xs disabled:opacity-60"
                      >
                        {CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                      {!relationship.confirmed && <span className="text-[10px] uppercase tracking-wide text-amber-300">Pending</span>}
                    </div>
                    {canConfirm && (
                      <button onClick={() => confirmRelationship(relationship.id)} className="mt-2 w-full rounded bg-emerald-500/15 px-2 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25">
                        Confirm connection
                      </button>
                    )}
                    {canEditConnection && (
                      <button onClick={() => removeRelationship(relationship.id)} className="mt-2 text-xs text-rose-400 hover:text-rose-300">Remove</button>
                    )}
                    {mutualNeighbors(person.id, other.id, data).length > 0 && (
                      <p className="mt-1 text-xs text-slate-500">{mutualNeighbors(person.id, other.id, data).length} mutual</p>
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

      <div className="space-y-2 border-t border-white/10 px-5 py-3">
        {isOwner && !editing && <button onClick={() => setEditing(true)} className="w-full rounded-lg bg-indigo-500 px-3 py-2 text-sm font-semibold hover:bg-indigo-400">Edit profile</button>}
        {isOwner && <button onClick={() => onEditConnections(person.id)} className="w-full rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/20">Edit connections</button>}
        {isOwner && (
          <button
            onClick={() => {
              if (window.confirm(`Delete ${person.name} and all their connections?`)) {
                removePerson(person.id);
                onClose();
              }
            }}
            className="w-full rounded-lg border border-rose-500/40 px-3 py-2 text-sm text-rose-300 hover:bg-rose-500/10"
          >
            Delete profile
          </button>
        )}
      </div>
    </aside>
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
          <input value={draft[field]} onChange={(event) => setDraft((current) => ({ ...current, [field]: event.target.value }))} className="mt-1 w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-1 focus:ring-indigo-500" />
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
