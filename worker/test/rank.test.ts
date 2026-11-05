import { describe, expect, it } from "vitest";
import { band, BAND, rank, type Candidate } from "../src/rank.ts";
import { tokenize } from "../src/project.ts";

const cand = (rid: number, name: string, extra: Partial<Candidate> = {}): Candidate => ({
  rid, name, city: null, near: null, regionName: "Texas", countryName: "United States", lat: 32.7, lng: -96.8, completeness: 0, ...extra,
});
const b = (q: string, name: string, loc = "") => band(tokenize(q), tokenize(name), tokenize(loc));

describe("bands", () => {
  it("exact", () => expect(b("grace church", "Grace Church")).toBe(BAND.exact));
  it("exact treats st and saint alike", () => expect(b("st mary", "Saint Mary")).toBe(BAND.exact));
  it("in order, last token a prefix", () => expect(b("grace comm", "Grace Community Church")).toBe(BAND.inOrder));
  it("any order", () => expect(b("baptist first", "First Baptist Church")).toBe(BAND.anyOrder));
  it("uses location for any order", () => expect(b("grace dallas", "Grace Church", "Dallas Texas")).toBe(BAND.anyOrder));
  it("partial", () => expect(b("grace zzz", "Grace Church")).toBe(BAND.partial));
});

describe("guardrails", () => {
  it("a complete, close listing can't beat a better name band", () => {
    const out = rank([
      cand(1, "Grace Community Church of Dallas", { completeness: 100, city: "Dallas" }),
      cand(2, "Grace Church", { completeness: 0, lat: 50, lng: 10 }),
    ], tokenize("grace church"), { lat: 32.7, lng: -96.8 });
    expect(out[0]!.item.rid).toBe(2);
    expect(out[0]!.band).toBe(BAND.exact);
  });
  it("never orders a lower band above a higher one", () => {
    const names = ["Grace Church", "Grace Bible Church", "Church of Grace", "First Church", "Grace Chapel"];
    const out = rank(names.map((n, i) => cand(i, n, { completeness: i * 20 })), tokenize("grace church"), null);
    for (let i = 1; i < out.length; i++) expect(out[i]!.band).toBeGreaterThanOrEqual(out[i - 1]!.band);
  });
  it("caps corrected and partial results", () => {
    const [c] = rank([cand(1, "Grace", { corrected: true })], ["grace"], null);
    const [p] = rank([cand(1, "Grace", { partial: true })], ["grace"], null);
    expect(c!.band).toBe(BAND.anyOrder);
    expect(p!.band).toBe(BAND.partial);
  });
  it("drops results outside a named place below worse name matches inside it", () => {
    const out = rank([cand(1, "Grace", { lat: 50, lng: 10 }), cand(2, "Grace Bible Church")], tokenize("grace"), { lat: 32.7, lng: -96.8 }, (c) => c.lat === 50);
    expect(out[0]!.item.rid).toBe(2);
    expect(out[1]!.band).toBe(BAND.partial);
  });
  it("common words don't drive text score", () => {
    const out = rank([cand(1, "Church of St Paul"), cand(2, "Calvary Baptist")], tokenize("calvary church"), null);
    expect(out[0]!.item.rid).toBe(2);
  });
  it("proximity breaks ties inside a band", () => {
    const out = rank([cand(1, "Grace Church", { lat: 40, lng: -100 }), cand(2, "Grace Church", { lat: 32.7, lng: -96.8 })], tokenize("grace church"), { lat: 32.7, lng: -96.8 });
    expect(out[0]!.item.rid).toBe(2);
  });
});
