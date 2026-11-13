"use client";

import { useId } from "react";
import { strengthFromCategory } from "@/lib/strength";
import { useGraphStore } from "@/lib/GraphStore";
import PanelSheet from "./PanelSheet";
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
  const titleId = useId();
  const strength = strengthFromCategory(relationship.category);
  const isEndpoint =
    claimedPersonId === relationship.personAId ||
    claimedPersonId === relationship.personBId;
  const canConfirm =
    !relationship.confirmed &&
    isEndpoint &&
    claimedPersonId !== relationship.proposedByPersonId;

  return (
    <PanelSheet
      labelledBy={titleId}
      onClose={onClose}
      desktop="right"
      title={
        <>
          <p className="text-xs uppercase tracking-widest text-indigo-400">
            Connection
          </p>
          <h2 id={titleId} className="mt-1 text-lg font-semibold leading-snug">
            <button
              onClick={() => onSelectPerson(personA.id)}
              className="min-h-11 hover:text-indigo-300 lg:min-h-0"
            >
              {personA.name}
            </button>{" "}
            <span className="text-slate-500">&amp;</span>{" "}
            <button
              onClick={() => onSelectPerson(personB.id)}
              className="min-h-11 hover:text-indigo-300 lg:min-h-0"
            >
              {personB.name}
            </button>
          </h2>
        </>
      }
      footer={
        isEndpoint ? (
          <button
            onClick={() => {
              removeRelationship(relationship.id);
              onRemoved(personA.name, personB.name);
              onClose();
            }}
            className="min-h-11 w-full rounded-lg border border-rose-500/40 px-3 py-2 text-sm font-medium text-rose-300 transition hover:bg-rose-500/10 lg:min-h-0"
          >
            Remove connection
          </button>
        ) : undefined
      }
    >
      <div>
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
          <button onClick={() => confirmRelationship(relationship.id)} className="mt-3 min-h-11 w-full rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-400">
            Confirm connection
          </button>
        )}

        {isEndpoint && (
        <>
        <label htmlFor={`${titleId}-category`} className="mt-5 block text-xs text-slate-400">
          Change classification
        </label>
        <select
          id={`${titleId}-category`}
          value={relationship.category}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (isCategory(v)) updateRelationshipCategory(relationship.id, v);
          }}
          className="mt-1 min-h-11 w-full rounded-lg bg-white/10 px-3 py-2 text-base text-slate-100 outline-none focus:ring-1 focus:ring-indigo-500/60 sm:text-sm lg:min-h-0"
        >
          {CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        </>
        )}
      </div>
    </PanelSheet>
  );
}
