import { describe, expect, it, vi } from "vitest";
import { createEscapeStack } from "./escape-stack";

describe("createEscapeStack", () => {
  it("runs only the most recently pushed handler", () => {
    const stack = createEscapeStack();
    const panel = vi.fn();
    const legend = vi.fn();
    stack.push(panel);
    stack.push(legend);
    expect(stack.handle()).toBe(true);
    expect(legend).toHaveBeenCalledTimes(1);
    expect(panel).not.toHaveBeenCalled();
  });

  it("falls back to the next surface once the top one is removed", () => {
    const stack = createEscapeStack();
    const panel = vi.fn();
    const popover = vi.fn();
    stack.push(panel);
    const removePopover = stack.push(popover);
    removePopover();
    stack.handle();
    expect(panel).toHaveBeenCalledTimes(1);
    expect(popover).not.toHaveBeenCalled();
  });

  it("removes a lower surface without disturbing the top", () => {
    const stack = createEscapeStack();
    const lower = vi.fn();
    const top = vi.fn();
    const removeLower = stack.push(lower);
    stack.push(top);
    removeLower();
    removeLower();
    expect(stack.size()).toBe(1);
    stack.handle();
    expect(top).toHaveBeenCalledTimes(1);
    expect(lower).not.toHaveBeenCalled();
  });

  it("reports an empty stack", () => {
    expect(createEscapeStack().handle()).toBe(false);
  });
});
