"use client";

import { useId, useMemo, useState } from "react";
import { useGraphStore } from "@/lib/GraphStore";
import { findRelationship } from "@/lib/store-core";
import { hasExactNameMatch, searchConnectCandidates } from "@/lib/connect";
import PanelSheet from "./PanelSheet";
import { CATEGORY_LABELS, CATEGORY_OPTIONS, type Category } from "@/lib/types";

interface ManagePanelProps {
  onClose: () => void;
  /** Called with the new person's id right after they are added. */
  onPersonAdded: (id: string) => void;
  /** Called with the other person's id after connecting to someone existing. */
  onPersonConnected: (id: string) => void;
  /** Toast a confirmation such as `Connected A and B`. */
  onChanged: (message: string) => void;
}

type Step =
  | { kind: "search" }
  | { kind: "classify"; personId: string }
  | { kind: "create" };

/**
 * The single add-connection flow: search existing Circle profiles, pick one
 * and classify the connection, or add someone who is not listed (their
 * profile then offers an invite link).
 */
export default function ManagePanel({
  onClose,
  onPersonAdded,
  onPersonConnected,
  onChanged,
}: ManagePanelProps) {
  const { data, addConnectedPerson, setRelationship, claimedPersonId } =
    useGraphStore();
  const [step, setStep] = useState<Step>({ kind: "search" });
  const [query, setQuery] = useState("");
  const [newName, setNewName] = useState("");
  const [category, setCategory] = useState<Category | null>(null);
  const titleId = useId();
  const formId = useId();

  const meId = claimedPersonId ?? "";
  const results = useMemo(
    () => (meId ? searchConnectCandidates(meId, query, data) : []),
    [meId, query, data],
  );
  const myName = data.people.find((p) => p.id === meId)?.name ?? "You";

  const other =
    step.kind === "classify"
      ? (data.people.find((p) => p.id === step.personId) ?? null)
      : null;
  const existing =
    other && meId ? (findRelationship(data, meId, other.id) ?? null) : null;
  // If the picked person disappeared (for example removed elsewhere), fall
  // back to the search step.
  const current: Step["kind"] =
    step.kind === "classify" && !other ? "search" : step.kind;

  const pick = (personId: string) => {
    const rel = meId ? findRelationship(data, meId, personId) : undefined;
    setCategory(rel?.category ?? null);
    setStep({ kind: "classify", personId });
  };

  const startCreate = () => {
    setNewName(query.trim());
    setCategory(null);
    setStep({ kind: "create" });
  };

  const back = () => {
    setCategory(null);
    setStep({ kind: "search" });
  };

  const saveExisting = (next: Category | null) => {
    if (!meId || !other) return;
    const had = existing != null;
    setRelationship(meId, other.id, next);
    if (next === null) onChanged(`Disconnected ${myName} and ${other.name}`);
    else if (had) onChanged(`Updated ${myName} and ${other.name}`);
    else onChanged(`Connected ${myName} and ${other.name}`);
    onPersonConnected(other.id);
  };

  const submitNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!meId || category === null || !newName.trim()) return;
    const id = addConnectedPerson(newName, category);
    if (id) onPersonAdded(id);
  };

  const trimmed = query.trim();
  const showAddNew = !hasExactNameMatch(query, results);

  const title =
    current === "search" ? (
      <h2 id={titleId} className="text-lg font-semibold">
        Add a connection
      </h2>
    ) : (
      <div className="-mt-1 flex items-center gap-1">
        <button
          onClick={back}
          aria-label="Back to search"
          className="-ml-3 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg text-slate-300 transition hover:bg-white/10 hover:text-white"
        >
          ←
        </button>
        <div className="min-w-0">
          <h2 id={titleId} className="truncate text-lg font-semibold">
            {current === "classify" ? other?.name : "Add someone new"}
          </h2>
          <p className="text-xs text-slate-400">How well do you know them?</p>
        </div>
      </div>
    );

  let footer: React.ReactNode = undefined;
  if (current === "classify") {
    footer = (
      <div className="flex gap-2">
        {existing && (
          <button
            onClick={() => saveExisting(null)}
            className="min-h-11 rounded-lg border border-rose-500/40 px-3 py-2 text-sm font-medium text-rose-300 transition hover:bg-rose-500/10"
          >
            Remove connection
          </button>
        )}
        <button
          onClick={() => saveExisting(category)}
          disabled={
            !meId || category === null || category === existing?.category
          }
          className="min-h-11 flex-1 rounded-lg bg-indigo-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {existing ? "Update connection" : "Connect"}
        </button>
      </div>
    );
  } else if (current === "create") {
    footer = (
      <button
        type="submit"
        form={formId}
        disabled={!meId || !newName.trim() || category === null}
        className="min-h-11 w-full rounded-lg bg-indigo-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Add to my connections
      </button>
    );
  }

  return (
    <PanelSheet
      labelledBy={titleId}
      onClose={onClose}
      // Escape in the classify and create steps goes back to search first.
      onEscape={current === "search" ? onClose : back}
      desktop="left"
      mobileHeight="h-[90dvh]"
      contentClassName="px-5 py-4"
      // The search and name fields autofocus instead.
      focusCloseOnOpen={false}
      title={title}
      footer={footer}
    >
      {current === "search" && (
        <>
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && results[0]) pick(results[0].person.id);
            }}
            placeholder="Search Circle profiles…"
            aria-label="Search Circle profiles"
            autoComplete="off"
            className="w-full rounded-lg bg-white/10 px-3 py-2.5 text-base outline-none ring-1 ring-transparent focus:ring-indigo-500/60 lg:text-sm"
          />
          <p className="mt-4 mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
            {trimmed ? "Results" : "Suggested"}
          </p>
          <ul className="-mx-2">
            {results.map(({ person, category: existingCategory, mutualCount }) => (
              <li key={person.id}>
                <button
                  onClick={() => pick(person.id)}
                  className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-white/10"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-100">
                      {person.name}
                    </span>
                    <span className="block text-xs text-slate-400">
                      {mutualCount} mutual
                    </span>
                  </span>
                  {existingCategory != null && (
                    <span className="shrink-0 rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs text-indigo-200">
                      {CATEGORY_LABELS[existingCategory]}
                    </span>
                  )}
                </button>
              </li>
            ))}
            {results.length === 0 && (
              <li className="px-2 py-2 text-sm text-slate-400">
                {trimmed
                  ? "No Circle profiles match."
                  : "Type a name to find someone."}
              </li>
            )}
            {showAddNew && (
              <li className="mt-1 border-t border-white/10 pt-1">
                <button
                  onClick={startCreate}
                  className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-medium text-indigo-300 transition hover:bg-white/10 hover:text-indigo-200"
                >
                  <span aria-hidden>＋</span>
                  <span className="min-w-0 truncate">
                    {trimmed
                      ? `Add someone new: “${trimmed}”`
                      : "Add someone new"}
                  </span>
                </button>
              </li>
            )}
          </ul>
        </>
      )}

      {current === "classify" && (
        <CategoryChoices value={category} onChange={setCategory} />
      )}

      {current === "create" && (
        <form id={formId} onSubmit={submitNew} className="space-y-4">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Name"
            aria-label="Name"
            className="w-full rounded-lg bg-white/10 px-3 py-2.5 text-base outline-none ring-1 ring-transparent focus:ring-indigo-500/60 lg:text-sm"
          />
          <CategoryChoices value={category} onChange={setCategory} />
          <p className="text-xs leading-relaxed text-slate-500">
            They get an unclaimed profile, which opens after you add them. Tap
            “Create and copy invite link” there to send them a link to claim
            it and confirm your connection.
          </p>
        </form>
      )}
    </PanelSheet>
  );
}

/** The five categories as full-width choices with their definitions. */
function CategoryChoices({
  value,
  onChange,
}: {
  value: Category | null;
  onChange: (category: Category) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Connection category" className="space-y-2">
      {CATEGORY_OPTIONS.map((o) => {
        const selected = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={`min-h-11 w-full rounded-lg px-3 py-2 text-left transition ${
              selected
                ? "bg-indigo-500 text-white"
                : "bg-white/5 text-slate-200 hover:bg-white/10"
            }`}
          >
            <span className="block text-sm font-medium">{o.label}</span>
            <span
              className={`block text-xs ${selected ? "text-indigo-100" : "text-slate-400"}`}
            >
              {o.definition}
            </span>
          </button>
        );
      })}
    </div>
  );
}
