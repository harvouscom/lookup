import { env, SELF } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { seed, rows } from "./seed.ts";
import worker from "../src/index.ts";



beforeAll(async () => { await seed(env.DB); });

const get = async (path: string) => {
  const res = await SELF.fetch(`https://lookup.test${path}`);
  return { res, body: (await res.json()) as any };
};
const names = (b: any) => b.results.map((r: any) => r.name);
const s = (q: string, extra = "") => get(`/v1/search?geo=off&q=${encodeURIComponent(q)}${extra}`);

describe("search", () => {
  it.each([["grac"], ["grace"], ["grace comm"], ["grace c"], ["g r"]])("finds Grace for %s or stays safe", async (q) => {
    const { res } = await s(q);
    expect(res.status).toBe(200);
  });
  it("matches prefixes", async () => {
    expect(names((await s("grac")).body)).toContain("Grace Community Church");
    expect(names((await s("grace comm")).body)[0]).toBe("Grace Community Church");
    expect(names((await s("first bapt")).body)).toContain("First Baptist Church");
  });
  it("corrects gracee", async () => {
    const { body } = await s("gracee");
    expect(body.corrected).toBe("grace");
    expect(names(body)).toContain("Grace Community Church");
  });
  it("resolves church in dallas without Indiana", async () => {
    const { body } = await s("church in dallas");
    expect(body.place).toMatchObject({ name: "Dallas", region: "TX" });
    expect(body.results[0].city).toBe("Dallas");
    const dallasFirst = body.results.findIndex((r: any) => r.region === "IN");
    if (dallasFirst >= 0) expect(body.results.slice(0, dallasFirst).every((r: any) => r.city === "Dallas")).toBe(true);
  });
  it("falls back when in-words aren't a place", async () => {
    expect(names((await s("church at the cross")).body)[0]).toBe("Church at the Cross");
  });
  it("folds polish and german", async () => {
    expect(names((await s("kosciol")).body)).toContain("Kościół pw. Świętego Jana");
    expect(names((await s("wroclaw")).body)).toContain("Kościół pw. Świętego Jana");
    expect(names((await s("muenchen")).body)).toContain("Evangelische Kirche München");
  });
  it("expands st to saint and handles possessives", async () => {
    expect(names((await s("st mary")).body)).toContain("Saint Mary's Catholic Church");
    expect(names((await s("st marys")).body)).toContain("Saint Mary's Catholic Church");
  });
  it("matches a curly apostrophe like a straight one", async () => {
    expect(names((await s("st mary\u2019s")).body)).toContain("Saint Mary's Catholic Church");
  });
  it("ranks a named place above an exact name elsewhere", async () => {
    const { body } = await s("first baptist, fort wayne");
    expect(body.results[0].city).toBe("Fort Wayne");
    expect(body.results[1].band).toBe(3);
  });
  it("applies hard filters", async () => {
    const { body } = await s("first baptist", "&region=IN");
    expect(body.results.every((r: any) => r.region === "IN")).toBe(true);
    expect(body.results).toHaveLength(1);
  });
  it("applies non-US country and region filters", async () => {
    // A location far from the filter (a US caller filtering to Germany) must not hide the filtered rows.
    for (const at of ["", "&lat=32.78&lng=-96.8"]) {
      for (const extra of ["&country=DE", "&region=DEBY", "&country=de&region=deby"]) {
        const { body } = await s("kirche", extra + at);
        expect(names(body), extra + at).toEqual(["Evangelische Kirche München"]);
      }
      expect(names((await s("kosciol", "&country=PL" + at)).body), at).toEqual(["Kościół pw. Świętego Jana"]);
      expect((await s("church", "&country=DE" + at)).body.results, at).toEqual([]);
    }
    // The same with the caller's location coming from Cloudflare rather than lat/lng.
    const res = await SELF.fetch("https://lookup.test/v1/search?q=kirche&country=DE", { cf: { latitude: "32.78", longitude: "-96.8", country: "US" } } as RequestInit);
    expect(names(await res.json())).toEqual(["Evangelische Kirche München"]);
    const inRegion = await SELF.fetch("https://lookup.test/v1/search?q=kirche&region=DEBY", { cf: { latitude: "32.78", longitude: "-96.8", country: "US" } } as RequestInit);
    expect(names(await inRegion.json())).toEqual(["Evangelische Kirche München"]);
  });
  it("uses coordinates for proximity", async () => {
    const { body } = await s("first baptist", "&lat=41.08&lng=-85.14");
    expect(body.results[0].region).toBe("IN");
  });
  it("uppercase code scopes by region", async () => {
    const { body } = await s("first baptist IN");
    expect(body.results[0].region).toBe("IN");
  });
  it("returns nothing for nonsense without erroring", async () => {
    const { res, body } = await s("zzqxv");
    expect(res.status).toBe(200);
    expect(body.results).toEqual([]);
  });
  it("survives FTS syntax in the query", async () => {
    for (const q of ['"', "grace*", "NEAR(a b)", "a AND", "name:x", "(", "-", "{}"]) {
      expect((await s(q)).res.status).toBe(200);
    }
  });
  it("validates input", async () => {
    expect((await s("grace", "&lat=999&lng=0")).res.status).toBe(400);
    expect((await s("grace", "&lat=1")).res.status).toBe(400);
    expect((await s("grace", "&limit=999")).res.status).toBe(400);
    expect((await s("grace", "&country=ZZ")).res.status).toBe(400);
    expect((await s("g")).body.results).toEqual([]);
  });
  it("caps limit and sends CORS and attribution", async () => {
    const { res, body } = await s("church", "&limit=2");
    expect(body.results.length).toBeLessThanOrEqual(2);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(body.attribution).toContain("OpenStreetMap");
  });
  it("orders bands", async () => {
    const { body } = await s("grace");
    for (let i = 1; i < body.results.length; i++) expect(body.results[i].band).toBeGreaterThanOrEqual(body.results[i - 1].band);
  });
});

describe("churches", () => {
  it("returns a stable record", async () => {
    const { body } = await get("/v1/churches/R-0");
    expect(body.fields.street).toBe("1 Main");
    expect(body.fields.postalCode).toBe("75201");
    expect(body.fields.phone).toBeNull();
    expect(body.fields.languages).toEqual([]);
    expect(body.fields.serviceTimes.slots).toEqual([{ dayOfWeek: 0, startTime: "10:30" }]);
    expect(body.missing).toContain("phone");
    expect(body.missing).not.toContain("website");
    expect(body.fields.regionName).toBe("Texas");
  });
  it("reports moved ids", async () => expect((await get("/v1/churches/OLD-1")).body.movedTo).toBe("R-0"));
  it("404s unknown ids", async () => expect((await get("/v1/churches/nope")).res.status).toBe(404));
});

describe("meta and routing", () => {
  it("serves meta", async () => {
    const { body } = await get("/v1/meta");
    expect(body.completenessWeights.serviceTimes).toBe(25);
    expect(body.contributableFields.email).toBeUndefined();
    expect(body.contributableFields.pastorName).toBeUndefined();
    expect(body.contributableFields.name.review).toBe("moderated");
    expect(body.contributableFields.serviceTimes.review).toBe("live");
    expect(body.counts.churches).toBe(rows.length);
  });
  it("404s other paths and refuses writes", async () => {
    expect((await get("/nope")).res.status).toBe(404);
    expect((await SELF.fetch("https://lookup.test/v1/search", { method: "POST" })).status).toBe(405);
    expect((await SELF.fetch("https://lookup.test/v1/search", { method: "OPTIONS" })).status).toBe(204);
  });
});

describe("failure handling", () => {
  const ctx = { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext;
  const failing = (message: string) => ({ withSession: () => ({ prepare: () => ({ bind: () => ({}) }), batch: async () => { throw new Error(message); } }), prepare: () => ({ first: async () => { throw new Error(message); } }) }) as unknown as D1Database;
  const call = (message: string, q: string) => worker.fetch(new Request(`https://lookup.test/v1/search?geo=off&q=${q}`), { DB: failing(message) }, ctx);

  it("turns D1 overload into a retryable 503", async () => {
    const res = await call("D1_ERROR: D1 DB is overloaded. Too many resources consumed within a 10 second window", "overloadtest");
    expect(res.status).toBe(503);
    expect(res.headers.get("retry-after")).toBe("2");
    expect(((await res.json()) as any).error).toBe("overloaded");
  });
  it("hides other errors", async () => {
    const res = await call("no such table: secret_table", "errortest");
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain("secret_table");
  });
  it("returns 429 when the rate limit is exceeded", async () => {
    const res = await worker.fetch(new Request("https://lookup.test/v1/search?q=grace"), { DB: env.DB, RL_SEARCH: { limit: async () => ({ success: false }) } as unknown as RateLimit }, ctx);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("60");
  });
});
