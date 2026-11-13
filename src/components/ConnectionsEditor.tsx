"use client";

import { useId, useMemo, useState } from "react";
import PanelSheet from "./PanelSheet";
import StrengthPicker from "./StrengthPicker";
import { useGraphStore } from "@/lib/GraphStore";
import { rankCandidatesFor, type Candidate } from "@/lib/graph";
import type { Category, Person } from "@/lib/types";

interface ConnectionsEditorProps {
  person: Person;
  /** Called with a short message whenever a connection changes (for the confirmation toast). */
  onChanged: (message: string) => void;
  onClose: () => void;
}

/**
 * Idea A+B+C: batch connections editor anchored to one person.
 * - Segmented strength pills instead of a dropdown (one click to set/clear).
 * - Candidates ranked by relevance (connected first, then shared ties).
 * - Split into "Connected" (pinned) and "Add a connection" (searchable).
 */
export default function ConnectionsEditor({
  person,
  onChanged,
  onClose,
}: ConnectionsEditorProps) {
  const { data, claimedPersonId, setRelationship } = useGraphStore();
  const [query, setQuery] = useState("");
  const titleId = useId();

  const ranked = useMemo(
    () => rankCandidatesFor(person.id, data),
    [data, person.id],
  );

  const connected = useMemo(
    () => ranked.filter((c) => c.category != null),
    [ranked],
  );

  const unconnected = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ranked
      .filter((c) => c.category == null)
      .filter((c) => (q ? c.person.name.toLowerCase().includes(q) : true));
  }, [ranked, query]);

  const apply = (
    other: Person,
    category: Category | null,
    hadCategory: boolean,
  ) => {
    setRelationship(person.id, other.id, category);
    if (category == null && hadCategory) {
      onChanged(`Disconnected ${person.name} and ${other.name}`);
    } else if (!hadCategory) {
      onChanged(`Connected ${person.name} and ${other.name}`);
    } else {
      onChanged(`Updated ${person.name} and ${other.name}`);
    }
  };

  if (claimedPersonId !== person.id) return null;

  return (
    <PanelSheet
      labelledBy={titleId}
      onClose={onClose}
      mobile="full"
      desktop="right"
      desktopWidth="lg:w-96"
      contentClassName="px-2 py-2"
      title={
        <>
          <p className="text-xs uppercase tracking-widest text-indigo-400">
            Connections
          </p>
          <h2 id={titleId} className="mt-1 truncate text-xl font-semibold">{person.name}</h2>
          <p className="mt-1 text-sm text-slate-400">
            Connected to {connected.length} of {data.people.length - 1}
          </p>
        </>
      }
      footer={
        <button
          onClick={onClose}
          className="min-h-11 w-full rounded-lg bg-indigo-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 lg:min-h-0"
        >
          Done
        </button>
      }
    >
        {data.people.length <= 1 ? (
          <p className="px-3 py-6 text-center text-sm text-slate-500">
            Add more people first, then connect them here.
          </p>
        ) : (
          <>
            {connected.length > 0 && (
              <Section title="Connected">
                {connected.map((c) => (
                  <CandidateRow
                    key={c.person.id}
                    candidate={c}
                    onChange={(cat) => apply(c.person, cat, true)}
                  />
                ))}
              </Section>
            )}

            <Section
              title={connected.length > 0 ? "Add a connection" : "People"}
              action={
                <label className="flex items-center gap-2 text-xs text-slate-400">
                  <span>Filter</span>
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="name…"
                    className="min-h-11 w-28 rounded-md bg-white/10 px-2 py-1 text-base lg:min-h-0 lg:w-24 text-slate-100 outline-none ring-1 ring-transparent placeholder:text-slate-500 focus:ring-indigo-500/60 sm:text-xs"
                  />
                </label>
              }
            >
              {unconnected.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-slate-500">
                  {query ? `No matches for “${query}”.` : "Everyone connected."}
                </p>
              ) : (
                unconnected.map((c) => (
                  <CandidateRow
                    key={c.person.id}
                    candidate={c}
                    onChange={(cat) => apply(c.person, cat, false)}
                  />
                ))
              )}
            </Section>
          </>
        )}
    </PanelSheet>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-2">
      <div className="flex items-center justify-between px-3 py-1.5">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          {title}
        </h3>
        {action}
      </div>
      <ul className="space-y-0.5">{children}</ul>
    </section>
  );
}

function CandidateRow({
  candidate,
  onChange,
}: {
  candidate: Candidate;
  onChange: (category: Category | null) => void;
}) {
  const { person, mutualCount } = candidate;
  return (
    <li className="flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 hover:bg-white/5">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {person.name}
        </span>
        {mutualCount > 0 && (
          <span className="text-[11px] text-slate-500">
            {mutualCount} mutual
          </span>
        )}
      </span>
      <StrengthPicker value={candidate.category} onChange={onChange} />
    </li>
  );
}
