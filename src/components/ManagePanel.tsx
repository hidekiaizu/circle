"use client";

import { useState } from "react";
import { useGraphStore } from "@/lib/GraphStore";
import StrengthPicker from "./StrengthPicker";
import { CATEGORY, type Category } from "@/lib/types";

interface ManagePanelProps {
  onClose: () => void;
  /** Called with the new person's id right after they are added. */
  onPersonAdded: (id: string) => void;
}

/** Add an unlisted person and one relationship owned by the current user. */
export default function ManagePanel({
  onClose,
  onPersonAdded,
}: ManagePanelProps) {
  const { addConnectedPerson, claimedPersonId } = useGraphStore();
  const [personName, setPersonName] = useState("");
  const [category, setCategory] = useState<Category | null>(CATEGORY.Friend);

  const submitPerson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimedPersonId || category === null) return;
    const id = addConnectedPerson(personName, category);
    setPersonName("");
    if (id) {
      onPersonAdded(id);
    }
  };

  return (
    <aside className="absolute left-0 top-0 flex h-full w-80 flex-col border-r border-white/10 bg-slate-950/95 backdrop-blur">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <h2 className="text-lg font-semibold">Add a connection</h2>
        <button
          onClick={onClose}
          aria-label="Close panel"
          className="rounded-full p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        <form onSubmit={submitPerson} className="space-y-4">
          <input
            autoFocus
            value={personName}
            onChange={(e) => setPersonName(e.target.value)}
            placeholder="Name"
            className="w-full rounded-lg bg-white/10 px-3 py-2 text-sm outline-none ring-1 ring-transparent focus:ring-indigo-500/60"
          />
          <div>
            <p className="mb-2 text-xs text-slate-400">How well do you know them?</p>
            <StrengthPicker value={category} onChange={setCategory} />
          </div>
          <button
            type="submit"
            disabled={!claimedPersonId || !personName.trim() || category === null}
            className="w-full rounded-lg bg-indigo-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add to my connections
          </button>
        </form>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          You can add and classify your own connections. Each person controls
          their own profile and relationships.
        </p>
      </div>
    </aside>
  );
}
