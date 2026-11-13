"use client";

import { useId, useMemo, useRef, useState } from "react";
import type { Person } from "@/lib/types";

interface SearchBoxProps {
  people: Person[];
  onPick: (id: string) => void;
  /** Focus the input on mount (used when search is revealed on mobile). */
  autoFocus?: boolean;
  /** Called on Escape when no result list is open (collapses mobile search). */
  onDismiss?: () => void;
  /** Visually hide the "Search people" label (it stays for screen readers). */
  hideLabel?: boolean;
  className?: string;
}

/**
 * Accessible type-ahead combobox that jumps to a person on the graph. Because
 * the graph itself is a canvas (not focusable DOM nodes), this doubles as the
 * keyboard path to any node: search, arrow to a result, Enter to focus it.
 */
export default function SearchBox({
  people,
  onPick,
  autoFocus = false,
  onDismiss,
  hideLabel = false,
  className = "w-full sm:w-56",
}: SearchBoxProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const justFocused = useRef(false);
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

  const clear = () => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    setQuery("");
    setActiveIndex(-1);
    setOpen(false);
    inputRef.current?.focus();
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
      if (open && matches.length > 0) {
        // Claim Escape so an open panel behind the search stays open.
        e.preventDefault();
        setOpen(false);
        setActiveIndex(-1);
      } else {
        setOpen(false);
        setActiveIndex(-1);
        if (onDismiss) {
          e.preventDefault();
          onDismiss();
        }
      }
    }
  };

  return (
    <div className={`relative ${className}`}>
      <label
        id={labelId}
        htmlFor={`${listId}-input`}
        className={hideLabel ? "sr-only" : "mb-1 block text-xs font-medium text-slate-400"}
      >
        Search people
      </label>
      <div className="relative">
      <input
        ref={inputRef}
        id={`${listId}-input`}
        autoFocus={autoFocus}
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
        onFocus={(e) => {
          // Select the previous person's name so typing replaces it. A
          // click or tap collapses a selection made during focus on the
          // following mouseup/touchend, so select again after the pointer
          // sequence and cancel the first mouseup's caret placement.
          const input = e.currentTarget;
          input.select();
          window.setTimeout(() => {
            if (document.activeElement === input) input.select();
          }, 0);
          setOpen(true);
        }}
        onMouseDown={(e) => {
          // Only the click that focuses the field keeps the selection.
          justFocused.current = document.activeElement !== e.currentTarget;
        }}
        onMouseUp={(e) => {
          if (!justFocused.current) return;
          justFocused.current = false;
          e.preventDefault();
        }}
        onKeyDown={onKeyDown}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setOpen(false), 120);
        }}
        placeholder="Type a name…"
        className={`min-h-11 w-full rounded-full bg-white/10 py-1.5 pl-4 text-base text-slate-100 outline-none ring-1 ring-transparent placeholder:text-slate-500 focus:ring-indigo-500/60 sm:min-h-0 sm:text-sm ${query ? "pr-11 sm:pr-9" : "pr-4"}`}
      />
      {query && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={clear}
          aria-label="Clear search"
          className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center rounded-full text-lg leading-none text-slate-400 hover:text-white sm:w-9"
        >
          <span aria-hidden="true">×</span>
        </button>
      )}
      </div>
      {open && matches.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          aria-labelledby={labelId}
          className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-white/10 bg-slate-900 shadow-xl"
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
                className={`block min-h-11 w-full px-4 py-2 text-left text-base sm:min-h-0 sm:text-sm ${
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
