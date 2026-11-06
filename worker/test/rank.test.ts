import { describe, expect, it } from "vitest";
import { band, BAND, rank, type Candidate } from "../src/rank.ts";
import { tokenize } from "../src/project.ts";

const cand = (rid: number, name: string, extra: Partial<Candidate> = {}): Candidate => ({
  rid, name, city: null, near: null, regionName: "Texas", countryName: "United States", region: "TX", country: "US", lat: 32.7, lng: -96.8, completeness: 0, ...extra,
});
const b = (q: string, name: string, loc = "") => band(tokenize(q), tokenize(name), tokenize(loc));
const HERE = { lat: 32.7, lng: -96.8 };

describe("bands", () => {
  it("exact", () => expect(b("grace church", "Grace Church")).toBe(BAND.exact));
  it("exact treats st and saint alike", () => expect(b("st mary", "Saint Mary")).toBe(BAND.exact));
  it("in order, last token a prefix", () => expect(b("grace comm", "Grace Community Church")).toBe(BAND.inOrder));
  it("any order", () => expect(b("baptist first", "First Baptist Church")).toBe(BAND.anyOrder));
  it("uses location for any order", () => expect(b("grace dallas", "Grace Church", "Dallas Texas")).toBe(BAND.anyOrder));
  it("partial", () => expect(b("grace zzz", "Grace Church")).toBe(BAND.partial));
  it("a typed short form still prefix-matches the word it starts", () => {
    expect(b("st", "Stephens Church")).toBe(BAND.inOrder);
    expect(b("pres", "Presentation Church")).toBe(BAND.inOrder);
  });
  it("expands abbreviations on both sides", () => {
    expect(b("fbc", "First Baptist")).toBe(BAND.exact);
    expect(b("trinity umc", "Trinity United Methodist")).toBe(BAND.exact);
    expect(b("trinity united methodist", "Trinity UMC")).toBe(BAND.exact);
    expect(b("1st baptist", "First Baptist Church")).toBe(BAND.inOrder);
    expect(b("first meth", "First Methodist Church")).toBe(BAND.inOrder);
  });
  it("matches region codes and postcodes in the location", () => {
    expect(b("first baptist tx", "First Baptist Church", "Dallas Texas tx United States")).toBe(BAND.anyOrder);
    expect(b("grace 75201", "Grace Church", "Dallas 75201 Texas tx United States")).toBe(BAND.anyOrder);
  });
  it("lets prefixed rows match every word as a prefix, without church", () => {
    expect(band(tokenize("first bap church dallas"), tokenize("First Baptist Dallas"), [], { prefixAll: true })).toBe(BAND.inOrder);
    expect(band(tokenize("first bap church dallas"), tokenize("First Baptist Dallas"), [])).toBe(BAND.partial);
  });
});

describe("strict bands without a location the person gave", () => {
  it("a complete, close listing can't beat a better name band near the request's location", () => {
    const out = rank([
      cand(1, "Grace Community Church of Dallas", { completeness: 100, city: "Dallas" }),
      cand(2, "Grace Church", { completeness: 0, lat: 50, lng: 10 }),
    ], tokenize("grace church"), { center: HERE, centerKind: "ip" });
    expect(out[0]!.item.rid).toBe(2);
    expect(out[0]!.band).toBe(BAND.exact);
  });
  it("never orders a lower band above a higher one", () => {
    const names = ["Grace Church", "Grace Bible Church", "Church of Grace", "First Church", "Grace Chapel"];
    const out = rank(names.map((n, i) => cand(i, n, { completeness: i * 20 })), tokenize("grace church"));
    for (let i = 1; i < out.length; i++) expect(out[i]!.band).toBeGreaterThanOrEqual(out[i - 1]!.band);
  });
  it("caps corrected, prefixed and partial results", () => {
    const [c] = rank([cand(1, "Grace", { corrected: true })], ["grace"]);
    const [f] = rank([cand(1, "Grace", { prefixed: true })], ["grace"]);
    const [p] = rank([cand(1, "Grace", { partial: true })], ["grace"]);
    expect(c!.band).toBe(BAND.anyOrder);
    expect(f!.band).toBe(BAND.anyOrder);
    expect(p!.band).toBe(BAND.partial);
  });
  it("drops results outside a named place below worse name matches inside it", () => {
    const out = rank([cand(1, "Grace", { lat: 50, lng: 10 }), cand(2, "Grace Bible Church")], tokenize("grace"), { center: HERE, centerKind: "place", isOutside: (c) => c.lat === 50 });
    expect(out[0]!.item.rid).toBe(2);
    expect(out[1]!.band).toBe(BAND.partial);
  });
  it("common words don't drive text score", () => {
    const out = rank([cand(1, "Church of St Paul"), cand(2, "Calvary Baptist")], tokenize("calvary church"));
    expect(out[0]!.item.rid).toBe(2);
  });
  it("proximity breaks ties inside a band", () => {
    const out = rank([cand(1, "Grace Church", { lat: 40, lng: -100 }), cand(2, "Grace Church", { lat: 32.7, lng: -96.8 })], tokenize("grace church"), { center: HERE, centerKind: "ip" });
    expect(out[0]!.item.rid).toBe(2);
  });
});

describe("one tier with a location the person gave", () => {
  const FLL = { lat: 26.12, lng: -80.14 };
  it("a nearby longer name beats an exact name far away", () => {
    const out = rank([
      cand(1, "Calvary Chapel", { lat: 27.84, lng: -82.7, completeness: 40, region: "FL" }),
      cand(2, "Calvary Chapel West Boca", { lat: 26.37, lng: -80.2, completeness: 10, region: "FL" }),
    ], tokenize("calvary chapel"), { center: FLL, centerKind: "user" });
    expect(out[0]!.item.rid).toBe(2);
  });
  it("an exact name still wins at a similar distance", () => {
    const out = rank([
      cand(1, "Calvary Chapel Fellowship", { lat: 26.13, lng: -80.14, completeness: 100 }),
      cand(2, "Calvary Chapel", { lat: 26.2, lng: -80.2, completeness: 0 }),
    ], tokenize("calvary chapel"), { center: FLL, centerKind: "user" });
    expect(out[0]!.item.rid).toBe(2);
  });
  it("a church in the named city beats a more complete one in the next town", () => {
    const DALLAS = { lat: 32.78, lng: -96.8 };
    const out = rank([
      cand(1, "First Baptist Church", { city: "Forney", lat: 32.75, lng: -96.47, completeness: 100 }),
      cand(2, "First Baptist Church Sanctuary", { near: "Dallas", lat: 32.79, lng: -96.83, completeness: 0 }),
    ], tokenize("first baptist"), { center: DALLAS, centerKind: "place", placeKeys: ["dallas"] });
    expect(out[0]!.item.rid).toBe(2);
  });
  it("a word found in the location counts, so Dallas, Georgia doesn't beat Dallas, Texas", () => {
    const out = rank([
      cand(1, "First Baptist Church of Dallas", { near: "Dallas", regionName: "Georgia", region: "GA", lat: 33.92, lng: -84.84 }),
      cand(2, "Solid Rock First Baptist Church", { near: "Dallas", lat: 32.8, lng: -96.8 }),
    ], tokenize("first baptist dallas"), { center: { lat: 32.78, lng: -96.8 }, centerKind: "user" });
    expect(out[0]!.item.rid).toBe(2);
  });
  it("never puts a partial match above a full one", () => {
    const out = rank([cand(1, "Grace Church", { partial: true }), cand(2, "Grace Church", { lat: 40, lng: -80 })], tokenize("grace church"), { center: HERE, centerKind: "user" });
    expect(out.map((r) => r.item.rid)).toEqual([2, 1]);
  });
});

describe("soft region codes", () => {
  const rows = () => [cand(1, "Grace Community Church", { completeness: 0 }), cand(2, "Grace Church", { region: "CO", regionName: "Colorado", lat: 39.7, lng: -105 })];
  it("while typing, grace co still means Community first", () => {
    const out = rank(rows(), tokenize("grace co"), { softRegion: "CO" });
    expect(out[0]!.item.rid).toBe(1);
  });
  it("once settled, a church in that region bands by its other words", () => {
    const co = (settled: boolean) => rank(rows(), tokenize("grace co"), { softRegion: "CO", settled }).find((r) => r.item.rid === 2)!;
    expect(co(false).band).toBe(BAND.anyOrder);
    expect(co(true).band).toBe(BAND.inOrder);
  });
});
