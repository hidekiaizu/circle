import { describe, expect, it } from "vitest";
import { keyboardVisibleArea } from "./keyboard-viewport";

describe("keyboardVisibleArea", () => {
  const base = { layoutHeight: 844, visualHeight: 844, offsetTop: 0, scale: 1 };

  it("is null without a keyboard", () => {
    expect(keyboardVisibleArea(base)).toBeNull();
  });

  it("ignores small toolbar-sized differences", () => {
    expect(keyboardVisibleArea({ ...base, visualHeight: 780 })).toBeNull();
  });

  it("returns the visible area while a keyboard covers the bottom", () => {
    expect(keyboardVisibleArea({ ...base, visualHeight: 500 })).toEqual({
      top: 0,
      height: 500,
    });
    // iOS can scroll the visual viewport down inside the layout viewport.
    expect(
      keyboardVisibleArea({ ...base, visualHeight: 450, offsetTop: 60 }),
    ).toEqual({ top: 60, height: 450 });
  });

  it("ignores pinch zoom and invalid sizes", () => {
    expect(keyboardVisibleArea({ ...base, visualHeight: 400, scale: 2 })).toBeNull();
    expect(keyboardVisibleArea({ ...base, layoutHeight: 0 })).toBeNull();
  });
});
