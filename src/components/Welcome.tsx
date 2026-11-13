"use client";

import { useEffect, useRef, useState } from "react";
import { useEscapeToClose } from "@/lib/escape-stack";

const POINTS = [
  "Each dot is a person.",
  "Stronger connections appear closer and thicker.",
  "Claim your profile to add and confirm connections.",
];

/**
 * Short two-screen first-run introduction. Screen 1 explains how to read the
 * map in three points; screen 2 points at claiming a profile and adding a
 * first connection. Shown once (the caller persists dismissal).
 */
export default function Welcome({
  claimed,
  onStart,
  onShowLegend,
  onClose,
}: {
  claimed: boolean;
  /** Screen 2 primary action: add a connection, or learn how to claim. */
  onStart: () => void;
  onShowLegend: () => void;
  onClose: () => void;
}) {
  const [screen, setScreen] = useState<1 | 2>(1);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Focus the close control on open and dismiss on Escape.
  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
  }, []);
  useEscapeToClose(onClose);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 pt-[max(1rem,env(safe-area-inset-top))] sm:items-center sm:px-4 sm:pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        className="flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-slate-900 shadow-2xl sm:max-w-[28rem] sm:rounded-2xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 py-2 pr-2 pl-6">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-indigo-400">
            Welcome · {screen} of 2
          </p>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg leading-none text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-5">
          {screen === 1 ? (
            <>
              <h2 id="welcome-title" className="text-2xl font-semibold">
                Explore the CMU network
              </h2>
              <ul className="mt-4 space-y-3">
                {POINTS.map((point, index) => (
                  <li key={point} className="flex gap-3 text-sm text-slate-200">
                    <span
                      aria-hidden
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-semibold text-indigo-200"
                    >
                      {index + 1}
                    </span>
                    <span className="pt-0.5">{point}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <h2 id="welcome-title" className="text-2xl font-semibold">
                Claim your profile and add connections
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                {claimed
                  ? "Your profile is claimed. Add the people you know, and each connection is confirmed when they accept it."
                  : "Open the personal invite link you received to claim your profile. Then you can add the people you know."}
              </p>
            </>
          )}
          <button
            onClick={onShowLegend}
            className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-indigo-300 underline-offset-4 hover:text-indigo-200 hover:underline"
          >
            How to read the graph
          </button>
        </div>

        <div className="flex shrink-0 gap-3 border-t border-white/10 px-6 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4">
          <button
            onClick={screen === 1 ? () => setScreen(2) : onStart}
            className="min-h-11 flex-1 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-400"
          >
            {screen === 1
              ? "Next"
              : claimed
                ? "Add your first connection"
                : "How to claim your profile"}
          </button>
          <button
            onClick={onClose}
            className="min-h-11 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            Explore first
          </button>
        </div>
      </div>
    </div>
  );
}
