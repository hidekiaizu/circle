"use client";

import { useEffect, useRef } from "react";
import { useEscapeToClose } from "@/lib/escape-stack";
import { useKeyboardVisibleArea } from "@/lib/keyboard-viewport";

interface PanelSheetProps {
  /** id of the element that names the surface (used for aria-labelledby). */
  labelledBy: string;
  /** Title row content; the 44px close button is rendered beside it. */
  title: React.ReactNode;
  onClose: () => void;
  /** Sticky primary actions. Omit for surfaces without a footer. */
  footer?: React.ReactNode;
  children: React.ReactNode;
  /**
   * Below lg: `sheet` is a bottom sheet with a drag handle and a dimmed
   * backdrop; `full` is a full-screen surface.
   */
  mobile?: "sheet" | "full";
  /** Mobile sheet height class, for example `h-[85dvh]` or `max-h-[85dvh]`. */
  mobileHeight?: string;
  /**
   * At lg and above: `left`/`right` are full-height side panels inside the
   * graph region (the canvas reserves room with lg:ml-80 / lg:mr-80 / lg:mr-96);
   * `popover` floats at the top right of the graph region.
   */
  desktop: "left" | "right" | "popover";
  /** Desktop width class, for example `lg:w-80` or `lg:w-96`. */
  desktopWidth?: string;
  /** Padding classes for the scrollable content region. */
  contentClassName?: string;
  /** Focus the close button on open. Disable when a field uses autoFocus. */
  focusCloseOnOpen?: boolean;
  /**
   * Escape handler when it should differ from closing (for example going
   * back one step). Escape only reaches the topmost open surface.
   */
  onEscape?: () => void;
}

const DESKTOP_PLACEMENT: Record<PanelSheetProps["desktop"], string> = {
  left: "lg:inset-auto lg:left-0 lg:top-0 lg:h-full lg:max-h-none lg:border-t-0 lg:border-r lg:border-white/10 lg:rounded-none lg:shadow-none lg:z-20",
  right:
    "lg:inset-auto lg:right-0 lg:top-0 lg:h-full lg:max-h-none lg:border-t-0 lg:border-l lg:border-white/10 lg:rounded-none lg:shadow-none lg:z-20",
  popover:
    "lg:inset-auto lg:right-4 lg:top-4 lg:h-auto lg:max-h-[calc(100%-2rem)] lg:rounded-2xl lg:border lg:border-white/10 lg:shadow-2xl lg:z-30",
};

/**
 * Shared shell for panels: a viewport-level bottom sheet or full-screen
 * surface on phones, and today's side panel (or popover) at lg. Provides a
 * persistent title row with a 44px close button, exactly one scrollable
 * content region, an optional sticky footer padded for the home indicator,
 * Escape-to-close, and initial focus on the close button.
 */
export default function PanelSheet({
  labelledBy,
  title,
  onClose,
  footer,
  children,
  mobile = "sheet",
  mobileHeight = "h-[85dvh]",
  desktop,
  desktopWidth = "lg:w-80",
  contentClassName = "px-5 py-4",
  focusCloseOnOpen = true,
  onEscape,
}: PanelSheetProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dragStartY = useRef<number | null>(null);

  useEffect(() => {
    // focusCloseOnOpen is fixed per surface, so this runs once on open and
    // later re-renders never steal focus. Only below lg, where the surface
    // takes over the viewport; desktop side panels stay non-modal and leave
    // focus where it was (for example in the search box).
    if (!focusCloseOnOpen) return;
    if (window.matchMedia("(min-width: 64rem)").matches) return;
    closeRef.current?.focus({ preventScroll: true });
  }, [focusCloseOnOpen]);

  useEscapeToClose(onEscape ?? onClose);

  // While an on-screen keyboard is open below lg, size the surface to the
  // visible area so the focused field and the sticky footer stay reachable.
  const keyboardArea = useKeyboardVisibleArea("(max-width: 63.98rem)");
  const keyboardStyle: React.CSSProperties | undefined = keyboardArea
    ? { top: keyboardArea.top, bottom: "auto", height: keyboardArea.height }
    : undefined;

  const isSheet = mobile === "sheet";
  const mobilePlacement = isSheet
    ? `inset-x-0 bottom-0 ${mobileHeight} rounded-t-2xl border-t border-white/10 shadow-2xl`
    : "inset-0 pt-[env(safe-area-inset-top)] lg:pt-0";

  // A downward swipe on the handle/title area dismisses a mobile sheet.
  const dragHandlers = isSheet
    ? {
        onTouchStart: (e: React.TouchEvent) => {
          dragStartY.current = e.touches[0]?.clientY ?? null;
        },
        onTouchEnd: (e: React.TouchEvent) => {
          const start = dragStartY.current;
          dragStartY.current = null;
          const end = e.changedTouches[0]?.clientY;
          if (start != null && end != null && end - start > 80) onClose();
        },
      }
    : {};

  return (
    <>
      {isSheet && (
        <div
          aria-hidden
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        />
      )}
      <div
        role="dialog"
        aria-labelledby={labelledBy}
        style={keyboardStyle}
        className={`fixed z-40 flex w-full flex-col bg-slate-950 lg:absolute lg:bg-slate-950/95 lg:backdrop-blur ${mobilePlacement} ${DESKTOP_PLACEMENT[desktop]} ${desktopWidth}`}
      >
        <div className="shrink-0 border-b border-white/10" {...dragHandlers}>
          {isSheet && (
            <div className="flex justify-center pt-2 lg:hidden" aria-hidden>
              <span className="h-1.5 w-10 rounded-full bg-white/25" />
            </div>
          )}
          <div className="flex items-start justify-between gap-2 py-3 pr-2 pl-5">
            <div className="min-w-0 flex-1 pt-1">{title}</div>
            <button
              ref={closeRef}
              onClick={onClose}
              aria-label="Close panel"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg leading-none text-slate-400 transition hover:bg-white/10 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>

        <div
          className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${contentClassName}`}
        >
          {children}
        </div>

        {footer ? (
          <div className="shrink-0 border-t border-white/10 px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:pb-3">
            {footer}
          </div>
        ) : (
          <div className="h-[env(safe-area-inset-bottom)] shrink-0 lg:hidden" />
        )}
      </div>
    </>
  );
}
