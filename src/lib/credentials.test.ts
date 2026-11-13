import { describe, expect, it } from "vitest";
import { hashPassword, normalizeUsername, tokenHash, validPassword, validUsername, verifyPassword } from "./credentials";

describe("invite-only credentials", () => {
  it("hashes passwords with a random salt and rejects an incorrect password", async () => {
    const a = await hashPassword("long and private password");
    const b = await hashPassword("long and private password");
    expect(a).not.toBe(b);
    expect(a).not.toContain("long and private password");
    expect(await verifyPassword("long and private password", a)).toBe(true);
    expect(await verifyPassword("wrong password", a)).toBe(false);
  });

  it("normalizes unique login names and rejects weak inputs", () => {
    expect(normalizeUsername("  Hideki_Aizu  ")).toBe("hideki_aizu");
    expect(validUsername("hideki_aizu")).toBe(true);
    expect(validUsername("Hideki Aizu")).toBe(false);
    expect(validPassword("short")).toBe(false);
    expect(validPassword("long and private password")).toBe(true);
    expect(tokenHash("private link")).not.toContain("private link");
  });
});
