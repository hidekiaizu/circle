import { useEffect, useRef } from "react";

/**
 * A stack of open surfaces that close on Escape. Only the most recently
 * opened surface handles the key, so stacked panels, popovers, and dialogs
 * close one at a time.
 */
export interface EscapeStack {
  /** Register a handler on top of the stack. Returns a function that removes it. */
  push(handler: () => void): () => void;
  /** Run the topmost handler. Returns false when the stack is empty. */
  handle(): boolean;
  size(): number;
}

export function createEscapeStack(): EscapeStack {
  const entries: { handler: () => void }[] = [];
  return {
    push(handler) {
      const entry = { handler };
      entries.push(entry);
      return () => {
        const index = entries.indexOf(entry);
        if (index >= 0) entries.splice(index, 1);
      };
    },
    handle() {
      const top = entries[entries.length - 1];
      if (!top) return false;
      top.handler();
      return true;
    },
    size() {
      return entries.length;
    },
  };
}

const sharedStack = createEscapeStack();
let listening = false;

function onKeyDown(e: KeyboardEvent) {
  // Inner widgets (an open search listbox, an overflow menu, a confirm
  // dialog) claim Escape with preventDefault before this bubble listener.
  if (e.key !== "Escape" || e.defaultPrevented) return;
  if (sharedStack.handle()) e.preventDefault();
}

/**
 * Close this surface on Escape when it is the topmost open surface. The
 * surface is registered once on mount, so re-renders that pass a new
 * `onEscape` do not move it to the top of the stack.
 */
export function useEscapeToClose(onEscape: () => void): void {
  const handlerRef = useRef(onEscape);
  useEffect(() => {
    handlerRef.current = onEscape;
  }, [onEscape]);
  useEffect(() => {
    if (!listening) {
      window.addEventListener("keydown", onKeyDown);
      listening = true;
    }
    return sharedStack.push(() => handlerRef.current());
  }, []);
}
