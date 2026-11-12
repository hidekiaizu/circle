"use client";

import { strengthFromCategory } from "@/lib/strength";
import { useGraphStore } from "@/lib/GraphStore";
import {
  CATEGORY_DEFINITIONS,
  CATEGORY_LABELS,
  CATEGORY_OPTIONS,
  isCategory,
  type Person,
  type Relationship,
} from "@/lib/types";

interface EdgeInspectorProps {
  relationship: Relationship;
  personA: Person;
  personB: Person;
  onSelectPerson: (id: string) => void;
  /** Called after the connection is removed. */
  onRemoved: (aName: string, bName: string) => void;
  onClose: () => void;
}

/**
 * Panel shown when a connection (edge) is clicked outside Connect mode. It
 * reveals the classification between the two people and lets you re-rate or
 * remove it — without the accidental-delete-on-click behavior.
 */
export default function EdgeInspector({
  relationship,
  personA,
  personB,
  onSelectPerson,
  onRemoved,
  onClose,
}: EdgeInspectorProps) {
  const {
    claimedPersonId,
    confirmRelationship,
    updateRelationshipCategory,
    removeRelationship,
  } = useGraphStore();
  const strength = strengthFromCategory(relationship.category);
  const isEndpoint =
    claimedPersonId === relationship.personAId ||
    claimedPersonId === relationship.personBId;
  const canConfirm =
    !relationship.confirmed &&
    isEndpoint &&
    claimedPersonId !== relationship.proposedByPersonId;

  return (
    <aside className="absolute right-0 top-0 z-20 flex h-full w-full flex-col border-l border-white/10 bg-slate-950/95 backdrop-blur sm:w-80">
      <div className="flex items-start justify-between border-b border-white/10 px-5 py-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-indigo-400">
            Connection
          </p>
          <h2 className="mt-1 text-lg font-semibold leading-snug">
            <button
              onClick={() => onSelectPerson(personA.id)}
              className="hover:text-indigo-300"
            >
              {personA.name}
            </button>{" "}
            <span className="text-slate-500">&amp;</span>{" "}
            <button
              onClick={() => onSelectPerson(personB.id)}
              className="hover:text-indigo-300"
            >
              {personB.name}
            </button>
          </h2>
        </div>
        <button
          onClick={onClose}
          aria-label="Close panel"
          className="ml-2 rounded-full p-2 text-lg leading-none text-slate-400 transition hover:bg-white/10 hover:text-white sm:p-1 sm:text-base"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
        <p className="text-xs uppercase tracking-widest text-slate-500">
          Classification
        </p>
        <div className="mt-2 flex items-center gap-3">
          <span className="text-base font-medium">
            {CATEGORY_LABELS[relationship.category]}
          </span>
          <span className="inline-flex h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
            <span
              className="h-full rounded-full bg-indigo-400"
              style={{ width: `${Math.max(8, strength * 100)}%` }}
            />
          </span>
        </div>
        <p className="mt-2 text-xs leading-snug text-slate-400">
          {CATEGORY_DEFINITIONS[relationship.category]}
        </p>
        <div className={`mt-4 rounded-lg px-3 py-2 text-sm ${relationship.confirmed ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"}`}>
          {relationship.confirmed ? "Confirmed by both people" : "Waiting for mutual confirmation"}
        </div>
        {canConfirm && (
          <button onClick={() => confirmRelationship(relationship.id)} className="mt-3 w-full rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-400">
            Confirm connection
          </button>
        )}

        <label className="mt-5 block text-xs text-slate-400">
          Change classification
        </label>
        <select
          disabled={!isEndpoint}
          value={relationship.category}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (isCategory(v)) updateRelationshipCategory(relationship.id, v);
          }}
          className="mt-1 w-full rounded-lg bg-white/10 px-3 py-2 text-base text-slate-100 outline-none focus:ring-1 focus:ring-indigo-500/60 sm:text-sm"
        >
          {CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {isEndpoint && <div className="border-t border-white/10 px-5 py-3">
        <button
          onClick={() => {
            removeRelationship(relationship.id);
            onRemoved(personA.name, personB.name);
            onClose();
          }}
          className="w-full rounded-lg border border-rose-500/40 px-3 py-2 text-sm font-medium text-rose-300 transition hover:bg-rose-500/10"
        >
          Remove connection
        </button>
      </div>}
    </aside>
  );
}
