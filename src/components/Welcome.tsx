"use client";

import { CATEGORY_OPTIONS } from "@/lib/types";

/**
 * First-run welcome overlay. Explains the concept and the relationship
 * categories, then nudges the user to claim or complete their profile. Shown once
 * (the caller persists dismissal in localStorage).
 */
export default function Welcome({
  claimed,
  hasOriginatorToClaim,
  onStart,
  onClose,
}: {
  claimed: boolean;
  hasOriginatorToClaim: boolean;
  onStart: () => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        className="max-h-[85vh] w-[32rem] overflow-y-auto rounded-2xl border border-white/10 bg-slate-900 p-7 shadow-2xl"
      >
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-indigo-400">
          Welcome to Circle
        </p>
        <h2 id="welcome-title" className="mt-2 text-2xl font-semibold">
          Find your place in the CMU network
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">
          Circle is a shared map built by the people in it. Claim your invited
          profile, add a few details, and propose connections. New connections
          become established when the other person confirms them.
        </p>

        <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
          <h3 className="text-sm font-semibold">
            How you&rsquo;ll classify a connection
          </h3>
          <ul className="mt-3 space-y-2">
            {CATEGORY_OPTIONS.map((o) => (
              <li key={o.value} className="text-sm">
                <span className="font-medium text-slate-100">{o.label}</span>
                <span className="text-slate-400"> — {o.definition}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-4 text-sm text-slate-400">
          Start by opening your claim link. Then complete your profile and add
          your first connection. Unclaimed profiles have dashed outlines, and
          pending connections use dashed lines until they are confirmed.
        </p>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onStart}
            className="flex-1 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-400"
          >
            {claimed
              ? "Complete your profile"
              : hasOriginatorToClaim
                ? "Claim your profile"
                : "Add someone you know"}
          </button>
          <button
            onClick={onClose}
            className="rounded-lg bg-white/10 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/20"
          >
            Explore first
          </button>
        </div>
      </div>
    </div>
  );
}
