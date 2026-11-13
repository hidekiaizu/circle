import { useEffect, useState } from "react";

/**
 * Screen px of the layout viewport covered below the visual viewport. Small
 * differences come from browser toolbars; only a larger overlap is treated as
 * an on-screen keyboard.
 */
export const KEYBOARD_MIN_OVERLAP_PX = 120;

export interface VisibleArea {
  top: number;
  height: number;
}

export interface ViewportMetrics {
  /** window.innerHeight (layout viewport). */
  layoutHeight: number;
  /** visualViewport.height */
  visualHeight: number;
  /** visualViewport.offsetTop */
  offsetTop: number;
  /** visualViewport.scale; pinch zoom is not a keyboard. */
  scale: number;
}

/**
 * The visible area to size a fixed surface to while an on-screen keyboard is
 * open, or null when no keyboard covers the layout viewport. iOS keeps
 * `dvh` and fixed layout at full height under the keyboard, so a bottom
 * sheet would otherwise hide its footer and lower fields behind it.
 */
export function keyboardVisibleArea({
  layoutHeight,
  visualHeight,
  offsetTop,
  scale,
}: ViewportMetrics): VisibleArea | null {
  if (!(layoutHeight > 0) || !(visualHeight > 0)) return null;
  if (scale > 1.01) return null;
  const top = Math.max(0, offsetTop);
  const overlap = layoutHeight - (visualHeight + top);
  if (overlap < KEYBOARD_MIN_OVERLAP_PX) return null;
  return { top, height: visualHeight };
}

/**
 * Tracks `window.visualViewport` and returns the visible area while a
 * keyboard is open (see keyboardVisibleArea). Returns null on browsers
 * without visualViewport and whenever `mediaQuery` (if given) does not match.
 */
export function useKeyboardVisibleArea(mediaQuery?: string): VisibleArea | null {
  const [area, setArea] = useState<VisibleArea | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const applies = !mediaQuery || window.matchMedia(mediaQuery).matches;
      const next = applies
        ? keyboardVisibleArea({
            layoutHeight: window.innerHeight,
            visualHeight: vv.height,
            offsetTop: vv.offsetTop,
            scale: vv.scale,
          })
        : null;
      setArea((prev) =>
        prev?.top === next?.top && prev?.height === next?.height ? prev : next,
      );
    };
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [mediaQuery]);
  return area;
}
