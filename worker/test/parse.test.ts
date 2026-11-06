import { describe, expect, it } from "vitest";
import { canonical, parseQuery, placeKeys, requiredTokens, variants } from "../src/parse.ts";

describe("parseQuery", () => {
  it("lowercase in is never Indiana", () => {
    const p = parseQuery("church in dallas");
    expect(p.tokens).toEqual(["church"]);
    expect(p.placeKey).toBe("dallas");
    expect(p.regionHint).toBeNull();
  });
  it("uppercase IN is Indiana", () => {
    const p = parseQuery("grace IN");
    expect(p.regionHint).toBe("IN");
    expect(p.tokens).toEqual(["grace"]);
  });
  it("leaves unmarked words as text", () => {
    expect(parseQuery("first baptist dallas")).toMatchObject({ tokens: ["first", "baptist", "dallas"], placeKey: null });
    expect(parseQuery("grace comm")).toMatchObject({ tokens: ["grace", "comm"], placeKey: null });
  });
  it("reads a comma as a place", () => {
    expect(parseQuery("grace, dallas, tx")).toMatchObject({ tokens: ["grace"], placeKey: "dallas", regionHint: "TX", countryHint: "US" });
    expect(parseQuery("grace, tx")).toMatchObject({ tokens: ["grace"], placeKey: null, regionHint: "TX" });
    expect(parseQuery("grace,")).toMatchObject({ tokens: ["grace"], placeKey: null });
  });
  it("reads connectors with a trailing region", () => {
    expect(parseQuery("grace near fort worth tx")).toMatchObject({ tokens: ["grace"], placeKey: "fort worth", regionHint: "TX" });
    expect(parseQuery("in dallas")).toMatchObject({ tokens: [], placeKey: "dallas" });
  });
  it("keeps fallback tokens for names like Church at the Cross", () => {
    const p = parseQuery("church at the cross");
    expect(p.placeKey).toBe("the cross");
    expect(p.fallbackTokens).toEqual(["church", "at", "the", "cross"]);
  });
  it("reads a trailing full region name", () => {
    expect(parseQuery("first baptist texas")).toMatchObject({ tokens: ["first", "baptist"], regionHint: "TX" });
    expect(parseQuery("grace new york")).toMatchObject({ tokens: ["grace"], regionHint: "NY" });
  });
  it("reads a trailing country name", () => expect(parseQuery("grace germany")).toMatchObject({ tokens: ["grace"], countryHint: "DE", regionHint: null }));
  it("needs words left over for a bare region name", () => expect(parseQuery("texas")).toMatchObject({ tokens: ["texas"], regionHint: null }));
  it("ignores codes when the whole query is uppercase", () => expect(parseQuery("GRACE CHURCH IN")).toMatchObject({ tokens: ["grace", "church", "in"], regionHint: null }));
  it("prefers the user's country for shared names", () => {
    const p = parseQuery("grace georgia", "US");
    expect(p.regionHint).toBe("GA");
  });
});

describe("lowercase codes and city names", () => {
  it("keeps a lowercase code as a word but reads it softly", () => {
    const p = parseQuery("first baptist tx");
    expect(p).toMatchObject({ tokens: ["first", "baptist", "tx"], softRegion: "TX", regionHint: null });
    expect(p.placeCandidates.map((c) => c.key)).toEqual(["baptist"]);
  });
  it("offers the words before a code as a city", () => {
    const p = parseQuery("saddleback lake forest ca");
    expect(p.softRegion).toBe("CA");
    expect(p.placeCandidates).toEqual([
      { key: "lake forest", rest: ["saddleback"] },
      { key: "forest", rest: ["saddleback", "lake"] },
    ]);
    expect(parseQuery("first baptist dallas TX")).toMatchObject({ regionHint: "TX", tokens: ["first", "baptist", "dallas"] });
    expect(parseQuery("first baptist dallas TX").placeCandidates[0]).toEqual({ key: "baptist dallas", rest: ["first"] });
  });
  it("leaves words being typed alone", () => {
    expect(parseQuery("grace co")).toMatchObject({ softRegion: "CO", placeCandidates: [] });
    for (const q of ["church in", "iglesia de", "grace church la", "tx"]) expect(parseQuery(q).softRegion, q).toBeNull();
  });
  it("reads dotted codes and short forms like uppercase", () => {
    expect(parseQuery("first baptist n.c.")).toMatchObject({ regionHint: "NC", tokens: ["first", "baptist"] });
    expect(parseQuery("kirche NRW")).toMatchObject({ regionHint: "DENW" });
    expect(parseQuery("st marys nsw")).toMatchObject({ softRegion: "AUNSW" });
  });
  it("reads a trailing city nickname as a place", () => {
    expect(parseQuery("st patricks cathedral nyc")).toMatchObject({ placeKey: "nyc", tokens: ["st", "patricks", "cathedral"] });
    expect(parseQuery("grace, la")).toMatchObject({ regionHint: "LA", placeKey: null });
    expect(parseQuery("grace in la")).toMatchObject({ placeKey: "la" });
  });
  it("tries every spelling of a place", () => {
    expect(placeKeys("ft worth")).toContain("fort worth");
    expect(placeKeys("n charleston")).toContain("north charleston");
    expect(placeKeys("nyc")).toContain("new york");
    expect(placeKeys("la")).toContain("los angeles");
    expect(placeKeys("st louis")).toContain("saint louis");
  });
});

describe("helpers", () => {
  it("knows common short forms", () => {
    expect(canonical("bapt")).toBe("baptist");
    expect(canonical("1st")).toBe("first");
    expect(variants("1st")).toContain("first");
    expect(variants("pres")).toContain("presbyterian");
  });
  it("drops stopwords only when something remains", () => {
    expect(requiredTokens(["church", "of", "christ"])).toEqual(["church", "christ"]);
    expect(requiredTokens(["the"])).toEqual(["the"]);
  });
  it("expands synonyms and German digraphs", () => {
    expect(variants("st")).toEqual(expect.arrayContaining(["saint", "st", "sankt"]));
    expect(variants("muenchen")).toContain("munchen");
    expect(variants("peters")).toContain("peter");
    expect(variants("cross")).not.toContain("cros");
    expect(canonical("st")).toBe(canonical("saint"));
  });
  it("tries saint spellings for places", () => expect(placeKeys("st louis")).toContain("saint louis"));
});
