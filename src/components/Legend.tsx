"use client";

import { useEffect, useRef } from "react";
import { useEscapeToClose } from "@/lib/escape-stack";
import { linkWidth } from "@/lib/graph";
import { strengthFromCategory } from "@/lib/strength";
import { CATEGORY_OPTIONS } from "@/lib/types";

/**
 * A key explaining how the graph encodes relationship data visually and what
 * each relationship category means, so the layout is interpretable and
 * classifications are consistent.
 */
export default function Legend({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  // Focus the close control on open and dismiss on Escape.
  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
  }, []);
  useEscapeToClose(onClose);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="legend-title"
        className="flex max-h-[85dvh] w-full max-w-[28rem] flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 py-2 pr-2 pl-6">
          <h2 id="legend-title" className="text-lg font-semibold">
            How to read the graph
          </h2>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg leading-none text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pt-4 pb-6">
        <dl className="space-y-4 text-sm">
          <div className="flex gap-3">
            <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-400" />
            <div>
              <dt className="font-medium">Each dot is a person</dt>
              <dd className="text-slate-400">
                All dots are the same size. Size does not encode anything — only
                lines carry the relationship meaning.
              </dd>
            </div>
          </div>

          <div className="flex gap-3">
            <span className="mt-2 h-[5px] w-5 shrink-0 rounded-full bg-indigo-300" />
            <div>
              <dt className="font-medium">Line thickness = closeness</dt>
              <dd className="text-slate-400">
                Thicker, brighter lines are stronger relationships (Close and
                Very Close Friends). Thin, faint lines are weaker ones
                (Familiar, Acquaintance).
              </dd>
            </div>
          </div>

          <div className="flex gap-3">
            <span className="mt-2 h-[2px] w-5 shrink-0 rounded-full bg-indigo-300/50" />
            <div>
              <dt className="font-medium">Distance = closeness too</dt>
              <dd className="text-slate-400">
                Stronger relationships pull people closer together, so tight
                clusters are groups who know each other well. People drift apart
                when ties are weak or absent.
              </dd>
            </div>
          </div>

          <div className="flex gap-3">
            <span className="mt-2 flex shrink-0 gap-0.5">
              <span className="h-3 w-3 rounded-full bg-slate-500" />
              <span className="h-3 w-3 rounded-full bg-slate-500" />
            </span>
            <div>
              <dt className="font-medium">Clusters &amp; bridges</dt>
              <dd className="text-slate-400">
                Because the layout is physics-based, friend groups naturally
                bunch up, and a person linking two groups sits in the gap
                between them.
              </dd>
            </div>
          </div>

          <div className="flex gap-3">
            <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full border border-dashed border-slate-300 bg-slate-700" />
            <div>
              <dt className="font-medium">Dashed nodes are unclaimed</dt>
              <dd className="text-slate-400">
                Their invite link lets that person claim and edit the profile.
                Node colors follow the selected profile attribute.
              </dd>
            </div>
          </div>

          <div className="flex gap-3">
            <span className="mt-2 h-px w-5 shrink-0 border-t border-dashed border-amber-300" />
            <div>
              <dt className="font-medium">Dashed lines are pending</dt>
              <dd className="text-slate-400">
                The endpoint opposite the proposer must confirm the connection.
              </dd>
            </div>
          </div>
        </dl>

        <hr className="my-5 border-white/10" />

        <h3 className="text-sm font-semibold">Relationship categories</h3>
        <p className="mt-1 text-xs text-slate-500">
          Pick the one that best fits how you actually interact.
        </p>
        <ul className="mt-3 space-y-3">
          {CATEGORY_OPTIONS.map((o) => (
            <li key={o.value} className="flex gap-3">
              <span
                className="mt-2 shrink-0 rounded-full bg-indigo-300"
                style={{
                  width: 20,
                  height: Math.max(
                    2,
                    linkWidth(strengthFromCategory(o.value)),
                  ),
                }}
                aria-hidden
              />
              <div>
                <p className="text-sm font-medium">{o.label}</p>
                <p className="text-xs text-slate-400">{o.definition}</p>
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-5 text-xs text-slate-500">
          Tip: tap a person to highlight their connections and list each of
          their relationships. To declutter, open Filters and pick a
          Connections option such as &ldquo;Friend or closer&rdquo;.
        </p>
        </div>
      </div>
    </div>
  );
}
