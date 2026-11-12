import { describe, expect, it } from "vitest";
import { canRestoreClaimedPerson } from "./identity";
import type { GraphData } from "./types";

const data: GraphData = {
  people: [
    {
      id: "p-hideki",
      name: "Hideki Aizu",
      claimed: true,
      claimToken: "hideki-token",
      createdAt: "2026-11-11T00:00:00.000Z",
    },
    {
      id: "p-friend",
      name: "Friend",
      claimed: false,
      claimToken: "friend-token",
      createdAt: "2026-11-11T00:00:00.000Z",
    },
  ],
  relationships: [],
};

describe("canRestoreClaimedPerson", () => {
  it("accepts the matching claim link for an already-claimed profile", () => {
    expect(
      canRestoreClaimedPerson(data, "p-hideki", "hideki-token"),
    ).toBe(true);
  });

  it("rejects a wrong token, missing profile, or unclaimed profile", () => {
    expect(canRestoreClaimedPerson(data, "p-hideki", "wrong-token")).toBe(
      false,
    );
    expect(canRestoreClaimedPerson(data, "missing", "hideki-token")).toBe(
      false,
    );
    expect(
      canRestoreClaimedPerson(data, "p-friend", "friend-token"),
    ).toBe(false);
  });
});
