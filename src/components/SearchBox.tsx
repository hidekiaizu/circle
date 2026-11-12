"use client";

import { useId, useMemo, useRef, useState } from "react";
import type { Person } from "@/lib/types";

interface SearchBoxProps {
  people: Person[];
  onPick: (id: string) => void;
}

/**
 * Accessible type-ahead combobox that jumps to a person on the graph. Because
 * the graph itself is a canvas (not focusable DOM nodes), this doubles as the
 * keyboard path to any node: search, arrow to a result, Enter to focus it.
 */
export default function SearchBox({ people, onPick }: SearchBoxProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const labelId = useId();
  const listId = useId();

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return people.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8);
  }, [people, query]);

  const pick = (person: Person) => {
    onPick(person.id);
    setQuery(person.name);
    setOpen(false);
    setActiveIndex(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && matches[activeIndex]) {
        e.preventDefault();
        pick(matches[activeIndex]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  return (
    <div className="relative w-full sm:w-56">
      <label
        id={labelId}
        htmlFor={`${listId}-input`}
        className="mb-1 block text-xs font-medium text-slate-400"
      >
        Search people
      </label>
      <input
        id={`${listId}-input`}
        role="combobox"
        aria-expanded={open && matches.length > 0}
        aria-controls={listId}
        aria-labelledby={labelId}
        aria-autocomplete="list"
        aria-activedescendant={
          activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined
        }
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setOpen(false), 120);
        }}
        placeholder="Type a name…"
        className="min-h-11 w-full rounded-full bg-white/10 px-4 py-1.5 text-base text-slate-100 outline-none ring-1 ring-transparent placeholder:text-slate-500 focus:ring-indigo-500/60 sm:min-h-0 sm:text-sm"
      />
      {open && matches.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          aria-labelledby={labelId}
          className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-white/10 bg-slate-900 shadow-xl"
        >
          {matches.map((p, i) => (
            <li
              key={p.id}
              id={`${listId}-opt-${i}`}
              role="option"
              aria-selected={i === activeIndex}
            >
              <button
                tabIndex={-1}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseDown={(e) => {
                  // onMouseDown fires before blur, keeping the list alive.
                  e.preventDefault();
                  if (blurTimer.current) clearTimeout(blurTimer.current);
                  pick(p);
                }}
                className={`block w-full px-4 py-2 text-left text-sm ${
                  i === activeIndex ? "bg-white/10" : "hover:bg-white/10"
                }`}
              >
                {p.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
