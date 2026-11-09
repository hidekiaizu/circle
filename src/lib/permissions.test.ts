import { describe, expect, it } from "vitest";
import {
  canConnectPair,
  canEditProfile,
  canEditRelationship,
} from "./permissions";

describe("profile permissions", () => {
  it("allows only the claimed profile to be edited", () => {
    expect(canEditProfile("me", "me")).toBe(true);
    expect(canEditProfile("me", "other")).toBe(false);
    expect(canEditProfile(null, "me")).toBe(false);
  });
});

describe("relationship permissions", () => {
  const mine = { personAId: "me", personBId: "other" };
  const theirs = { personAId: "alice", personBId: "bob" };

  it("allows edits only when the claimed person is an endpoint", () => {
    expect(canEditRelationship("me", mine)).toBe(true);
    expect(canEditRelationship("me", theirs)).toBe(false);
    expect(canEditRelationship(null, mine)).toBe(false);
  });

  it("allows new connections only between the claimed person and someone else", () => {
    expect(canConnectPair("me", "me", "other")).toBe(true);
    expect(canConnectPair("me", "other", "me")).toBe(true);
    expect(canConnectPair("me", "alice", "bob")).toBe(false);
    expect(canConnectPair("me", "me", "me")).toBe(false);
    expect(canConnectPair(null, "me", "other")).toBe(false);
  });
});
