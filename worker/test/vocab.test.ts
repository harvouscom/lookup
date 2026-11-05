import { describe, expect, it } from "vitest";
import { deletions1, editDistance, lookupKeys, pickCorrection } from "../src/vocab.ts";

describe("vocab", () => {
  it("makes deletions", () => expect(deletions1("abc").sort()).toEqual(["ab", "ac", "bc"]));
  it("reaches a transposition through a shared deletion", () => {
    const keys = new Set(lookupKeys("garce"));
    expect(deletions1("grace").some((d) => keys.has(d))).toBe(true);
  });
  it("measures edits", () => {
    expect(editDistance("grace", "gracee")).toBe(1);
    expect(editDistance("garce", "grace")).toBe(1);
    expect(editDistance("presbyterain", "presbyterian")).toBe(1);
    expect(editDistance("abc", "xyz")).toBe(3);
  });
  it("picks closest, then most common", () => {
    expect(pickCorrection("gracee", [{ token: "grace", df: 100 }, { token: "graces", df: 5 }])).toBe("grace");
    expect(pickCorrection("baptis", [{ token: "baptist", df: 500 }, { token: "baptism", df: 2 }])).toBe("baptist");
  });
  it("refuses corrections beyond the limit", () => expect(pickCorrection("grace", [{ token: "grapes", df: 500 }])).toBeNull());
  it("never returns the token itself", () => expect(pickCorrection("grace", [{ token: "grace", df: 5 }])).toBeNull());
});
