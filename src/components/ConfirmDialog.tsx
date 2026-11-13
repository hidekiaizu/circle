"use client";

import { useEffect, useRef } from "react";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** When true, the confirm button is styled as destructive. */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * An in-app confirmation modal (replaces window.confirm for a consistent,
 * accessible look). Traps nothing fancy, but is focusable, dismissable with
 * Escape, and labelled for assistive tech.
 */
export default function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Focus the confirm button on open and close on Escape.
  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Claim Escape (capture phase) so a panel behind the dialog stays open.
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        className="max-h-[85dvh] w-full max-w-sm overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-title" className="text-lg font-semibold">
          {title}
        </h2>
        <p id="confirm-message" className="mt-2 text-sm text-slate-300">
          {message}
        </p>
        <div className="mt-5 flex gap-2">
          <button
            onClick={onCancel}
            className="min-h-11 flex-1 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/20"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            className={`min-h-11 flex-1 rounded-lg px-3 py-2 text-sm font-semibold text-white transition ${
              destructive
                ? "bg-rose-500 hover:bg-rose-400"
                : "bg-indigo-500 hover:bg-indigo-400"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
