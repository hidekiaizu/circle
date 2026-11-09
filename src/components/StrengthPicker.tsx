"use client";

import { useState } from "react";
import {
  CATEGORY_DEFINITIONS,
  CATEGORY_LABELS,
  CATEGORY_OPTIONS,
  type Category,
} from "@/lib/types";

/** Short labels for the compact pips. */
const SHORT: Record<Category, string> = {
  1: "Fam",
  2: "Acq",
  3: "Fr",
  4: "Close",
  5: "V.Close",
};

interface StrengthPickerProps {
  value: Category | null;
  /** Called with a category to set, or null to disconnect. */
  onChange: (category: Category | null) => void;
  /** When true, show the definition of the hovered/active category below. */
  showHint?: boolean;
}

/**
 * Segmented strength control: the whole scale is visible as pips, so setting
 * a connection is a single click (no dropdown hunting). Clicking the active
 * pip again disconnects. Hovering/focusing a pip reveals its definition.
 */
export default function StrengthPicker({
  value,
  onChange,
  showHint = false,
}: StrengthPickerProps) {
  const [hint, setHint] = useState<Category | null>(null);
  const shown = hint ?? value;

  return (
    <div className="flex flex-col items-end gap-1">
      <div
        className="inline-flex overflow-hidden rounded-lg ring-1 ring-white/10"
        role="group"
        onMouseLeave={() => setHint(null)}
      >
        {CATEGORY_OPTIONS.map((o) => {
          const active = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              title={`${o.label} — ${o.definition}`}
              aria-label={`${o.label}: ${o.definition}`}
              aria-pressed={active}
              onMouseEnter={() => setHint(o.value)}
              onFocus={() => setHint(o.value)}
              onBlur={() => setHint(null)}
              onClick={() => onChange(active ? null : o.value)}
              className={`px-2 py-1 text-[11px] font-medium transition ${
                active
                  ? "bg-indigo-500 text-white"
                  : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200"
              }`}
            >
              {SHORT[o.value]}
            </button>
          );
        })}
      </div>
      {showHint && shown != null && (
        <p className="max-w-[16rem] text-right text-[11px] leading-snug text-slate-500">
          <span className="font-medium text-slate-400">
            {CATEGORY_LABELS[shown]}:
          </span>{" "}
          {CATEGORY_DEFINITIONS[shown]}
        </p>
      )}
    </div>
  );
}
