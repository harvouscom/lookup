import { describe, expect, it } from "vitest";
import { implicitCandidates, pickImplicit } from "../src/search.ts";
import { tokenize } from "../src/project.ts";

const place = (key: string, region: string, n: number, lat = 32.78, lng = -96.8) => ({ key, name: key, region, country: "US", lat, lng, n });
const DALLAS_TX = place("dallas", "TX", 900);
const DALLAS_GA = place("dallas", "GA", 40, 33.92, -84.84);

describe("unmarked trailing city", () => {
  it("offers the last one or two words, never a common word", () => {
    expect(implicitCandidates(tokenize("calvary chapel fort lauderdale"))).toEqual(["fort lauderdale", "lauderdale"]);
    expect(implicitCandidates(tokenize("first baptist dallas"))).toEqual(["baptist dallas", "dallas"]);
    expect(implicitCandidates(tokenize("new hope baptist"))).toEqual([]);
    expect(implicitCandidates(tokenize("lakewood church"))).toEqual([]);
    expect(implicitCandidates(tokenize("dallas"))).toEqual([]);
  });
  it("accepts a big, clear place", () => {
    expect(pickImplicit(["dallas"], [DALLAS_TX, DALLAS_GA], [{ token: "dallas", df: 300 }], null, null, null)).toBe(DALLAS_TX);
  });
  it("refuses words that are mostly names, and small places", () => {
    expect(pickImplicit(["hope"], [place("hope", "AR", 30)], [{ token: "hope", df: 4000 }], null, null, null)).toBeNull();
    expect(pickImplicit(["katy"], [place("katy", "TX", 3)], [{ token: "katy", df: 2 }], null, null, null)).toBeNull();
  });
  it("refuses an ambiguous name unless the visitor is near one", () => {
    const york = [place("york", "PA", 200, 39.96, -76.73), place("york", "ON", 150, 43.7, -79.4)];
    expect(pickImplicit(["york"], york, [{ token: "york", df: 50 }], null, null, null)).toBeNull();
    expect(pickImplicit(["york"], york, [{ token: "york", df: 50 }], { lat: 43.65, lng: -79.38 }, null, null)?.region).toBe("ON");
    expect(pickImplicit(["dallas"], [DALLAS_TX, DALLAS_GA], [{ token: "dallas", df: 300 }], { lat: 33.75, lng: -84.39 }, null, null)).toBe(DALLAS_GA);
  });
  it("respects a region or country filter", () => {
    expect(pickImplicit(["dallas"], [DALLAS_TX, DALLAS_GA], [{ token: "dallas", df: 30 }], null, "GA", null)).toBe(DALLAS_GA);
  });
});
