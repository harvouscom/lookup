import { describe, expect, it } from "vitest";
import { cleanServiceTimes, cellsAround, completeness, exclusionReason, fold, geohash, hash64, isOfficeHours, project, stripPostcode, tokenize } from "../src/project.ts";

const info = { regionName: "Texas", countryName: "United States" };
const base = { id: "TX-1", name: "Grace Church", country: "US", lat: 32.7, lng: -96.8 };

describe("fold and tokenize", () => {
  it("folds letters NFD can't reduce", () => {
    expect(fold("Kościół")).toBe("kosciol");
    expect(fold("Wrocław")).toBe("wroclaw");
    expect(fold("Straße")).toBe("strasse");
    expect(fold("Søndre")).toBe("sondre");
  });
  it("joins possessive s so prefixes still match", () => {
    expect(tokenize("St. Mary's Church")).toEqual(["st", "marys", "church"]);
    expect(tokenize("St. Mary’s")).toEqual(["st", "marys"]);
  });
  it("splits other apostrophes and hyphens", () => {
    expect(tokenize("L'Église Saint-Jean")).toEqual(["l", "eglise", "saint", "jean"]);
  });
});

describe("exclusions", () => {
  it.each([
    [{ ...base, name: "Unnamed Church" }, "unnamed"],
    [{ ...base, name: "unknown" }, "unnamed"],
    [{ ...base, name: "  " }, "unnamed"],
    [{ ...base, lat: 0, lng: 0 }, "no-geo"],
    [{ ...base, lat: NaN }, "no-geo"],
    [{ ...base, listingStatus: "pending_reverify" }, "pending-reverify"],
    [{ ...base, relocatedTo: "TX-2" }, "relocated"],
    [base, null],
  ])("%j", (row, why) => expect(exclusionReason(row as never)).toBe(why));
  it("keeps names that merely start like an excluded word", () => {
    expect(exclusionReason({ ...base, name: "Unnamed" })).toBe("unnamed");
    expect(exclusionReason({ ...base, name: "Unity Church" })).toBeNull();
  });
});

describe("stripPostcode", () => {
  it("removes a trailing postcode", () => expect(stripPostcode("5 Kirchenplatz, 8330", "8330")).toBe("5 Kirchenplatz"));
  it("blanks an address that is only a postcode", () => expect(stripPostcode("95515", "95515")).toBeNull());
  it("keeps addresses without it", () => expect(stripPostcode("8440 Grace Street", "75034")).toBe("8440 Grace Street"));
  it("handles missing values", () => {
    expect(stripPostcode(undefined, "1")).toBeNull();
    expect(stripPostcode("1 Main", undefined)).toBe("1 Main");
  });
});

describe("office hours", () => {
  it.each(["24/7", "closed", "by appointment", '"see website"', "Mo-Su 08:00-18:00", "Tu-Su 12:00-17:00; PH on", "Mo - Fr  00:00-23:00"])("nulls %s", (v) => {
    expect(isOfficeHours(v)).toBe(true);
    expect(cleanServiceTimes(v)).toBeNull();
  });
  it.each(["Su 10:00", "Sun 10:30 AM", "Su 09:30-11:00", "Mo-Fr 19:00; Sa 12:30", "Sa: 10 Uhr", "We 19:00-21:00; Su 09:00-12:00,18:00-20:00"])("keeps %s", (v) => {
    expect(isOfficeHours(v)).toBe(false);
  });
});

describe("completeness", () => {
  it("adds the published weights", () => {
    const all = { street: "x", city: "x", website: "x", phone: "x", serviceTimes: "x", denomination: "x", languages: ["x"], ministries: ["x"] };
    expect(completeness(all)).toBe(100);
    expect(completeness({ ...all, street: null, serviceTimes: null })).toBe(55);
  });
  it("doesn't credit Unknown denomination", () => {
    expect(project({ ...base, denomination: "Unknown" }, "TX", info).completeness).toBe(0);
    expect(project({ ...base, denomination: "Baptist" }, "TX", info).completeness).toBe(5);
  });
});

describe("project", () => {
  it("uses the export region when state is missing", () => {
    expect(project(base, "AL", info).region).toBe("AL");
    expect(project(base, "AL", info).geo).toContain("ral");
  });
  it("uses near in loc but never in city", () => {
    const p = project(base, "TX", info, "Dallas");
    expect(p.city).toBeNull();
    expect(p.near).toBe("Dallas");
    expect(p.loc).toBe("Dallas Texas United States");
  });
  it("ignores near when a city exists", () => {
    const p = project({ ...base, city: "Plano" }, "TX", info, "Dallas");
    expect(p.near).toBeNull();
    expect(p.loc).toBe("Plano Texas United States");
  });
  it("doc hash changes with content, embed hash only with embedded text", () => {
    const a = project(base, "TX", info);
    const phone = project({ ...base, phone: "555" }, "TX", info);
    const renamed = project({ ...base, name: "Grace Chapel" }, "TX", info);
    expect(phone.docHash).not.toBe(a.docHash);
    expect(phone.embedHash).toBe(a.embedHash);
    expect(renamed.embedHash).not.toBe(a.embedHash);
    expect(project(base, "TX", info).docHash).toBe(a.docHash);
  });
});

describe("geo", () => {
  it("matches known geohashes", () => expect(geohash(57.64911, 10.40744, 6)).toBe("u4pruy"));
  it("returns the cell and neighbours", () => {
    const c = cellsAround(32.78, -96.8, 4);
    expect(c).toHaveLength(9);
    expect(c).toContain(geohash(32.78, -96.8, 4));
  });
  it("wraps at the antimeridian", () => expect(cellsAround(0, 179.99, 3).length).toBe(9));
  it("hash64 is stable", () => expect(hash64("a")).toBe(hash64("a")));
});
