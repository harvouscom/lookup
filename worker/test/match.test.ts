import { describe, expect, it } from "vitest";
import { allTokens, anyToken, rungs } from "../src/match.ts";
import { findRuns, normalizeSeq } from "../src/abbrev.ts";
import { tokenize } from "../src/project.ts";

const q = (s: string, opts = {}) => allTokens(tokenize(s), true, opts);

describe("abbreviations", () => {
  it("expands a short form to its full words", () => {
    expect(q("umc austin")).toBe('{name loc} : ("umc" OR "united methodist") AND {name loc} : "austin"*');
    expect(q("lds church")).toBe('{name loc} : ("lds" OR "latter day saints") AND {name loc} : ("church"* OR "ch")');
  });
  it("matches spelled-out words to the short form too", () => {
    expect(q("grace united methodist")).toBe('{name loc} : "grace" AND (({name loc} : "united" AND {name loc} : ("methodist"* OR "meth")) OR {name loc} : "umc")');
  });
  it("nests a shorter form inside a longer one", () => {
    const m = q("first united methodist houston")!;
    expect(m).toContain('{name loc} : "fumc"');
    expect(m).toContain('{name loc} : "umc"');
  });
  it("keeps stopwords inside a spelled-out form", () => {
    expect(q("church of god")).toContain('{name loc} : "of"');
    expect(findRuns(tokenize("church of god in christ"))).toEqual([{ start: 0, end: 5, abbr: "cogic" }]);
  });
  it("treats half-typed short forms as prefixes, not abbreviations", () => {
    expect(q("first u")).toBe('{name loc} : ("first" OR "1st") AND {name loc} : "u"*');
  });
  it("normalizes both sides the same way", () => {
    expect(normalizeSeq(["fbc"]).map((t) => t.t)).toEqual(["first", "baptist"]);
    expect(normalizeSeq(["1st", "bapt"]).map((t) => t.t)).toEqual(["first", "baptist"]);
  });
});

describe("soft codes and fallbacks", () => {
  it("lets a lowercase code match the word or the region", () => {
    expect(q("first baptist tx", { softRegion: "TX" })).toBe('(({name loc} : ("first" OR "1st") AND {name loc} : ("baptist" OR "bapt")) OR {name loc} : "fbc") AND ({name loc} : "tx"* OR geo : "rtx")');
  });
  it("makes every word a prefix and church optional in the fallback", () => {
    expect(q("first bap church dallas", { prefixAll: true, dropGeneric: true })).toBe('{name loc} : ("first"* OR "1st") AND {name loc} : "bap"* AND {name loc} : ("dallas"* OR "dalla")');
  });
  it("leaves words under three letters out of the any-word fallback", () => {
    expect(anyToken(["saddleback", "lake", "forest", "ca"], true)).toBe('{name loc} : ("saddleback" OR "lake" OR "forest")');
    expect(anyToken(["tx"], true)).toBeNull();
  });
  it("searches the named city before wider cells", () => {
    const [first] = rungs("{name loc} : \"saddleback\"*", { center: { lat: 33.65, lng: -117.69 }, city: { key: "lake forest", region: "CA" }, region: "CA", country: null, filter: null });
    expect(first).toBe('({name loc} : "saddleback"*) AND (loc : "lake forest") AND (geo : ("rca"))');
  });
});
