"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A "⋯" button that opens a small dropdown of secondary toolbar actions,
 * keeping the main toolbar uncluttered. Closes on outside click/tap or Escape.
 */
export default function OverflowMenu({
  children,
  label = "More options",
}: {
  children: (close: () => void) => React.ReactNode;
  /** Accessible name of the trigger button. */
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Claim Escape so a panel hosting this menu stays open.
        e.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        className="inline-flex h-11 min-w-11 items-center justify-center rounded-full border border-white/15 px-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10 lg:h-auto lg:min-w-0 lg:py-1.5"
      >
        ⋯
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-2 w-56 overflow-hidden rounded-xl border border-white/10 bg-slate-900 p-1 shadow-2xl"
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
