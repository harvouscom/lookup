import { env, SELF } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { seed, rows, searchRows } from "./seed.ts";
import worker from "../src/index.ts";



beforeAll(async () => { await seed(env.DB, true); });

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
    expect(body.results[0].distanceKm).toBeLessThanOrEqual(75);
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
  it("allows up to 50 results and says when there are more", async () => {
    expect((await s("church", "&limit=50")).res.status).toBe(200);
    const over = await s("church", "&limit=51");
    expect(over.res.status).toBe(400);
    expect(over.body.code).toBe("invalid");
    expect(over.body.error).toContain("50");
    const few = await s("church", "&limit=2");
    expect(few.body.results).toHaveLength(2);
    expect(few.body.hasMore).toBe(true);
    const all = await s("church", "&limit=50");
    expect(all.body.hasMore).toBe(false);
    expect(all.body.results.slice(0, 2).map((r: any) => r.id)).toEqual(few.body.results.map((r: any) => r.id));
    expect((await s("g")).body).toMatchObject({ results: [], hasMore: false, semantic: "skipped" });
  });
  it("exposes the headers the SDK reads to other origins", async () => {
    const { res } = await s("grace");
    expect(res.headers.get("access-control-expose-headers")).toContain("retry-after");
    expect(res.headers.get("access-control-expose-headers")).toContain("x-lookup-degraded");
  });
  it("orders bands", async () => {
    const { body } = await s("grace");
    for (let i = 1; i < body.results.length; i++) expect(body.results[i].band).toBeGreaterThanOrEqual(body.results[i - 1].band);
  });
});

describe("smarter search", () => {
  const top = async (q: string, extra = "") => (await s(q, extra)).body.results[0];
  it("reads a lowercase state code without junk from other countries", async () => {
    const { body } = await s("first baptist tx");
    expect(body.results.length).toBeGreaterThan(0);
    expect(names(body)).not.toContain("San Juan Txiki");
    expect(body.results.filter((r: any) => r.band < 3).every((r: any) => r.region === "TX")).toBe(true);
  });
  it("turns a city before a lowercase code into a place", async () => {
    const { body } = await s("saddleback lake forest ca");
    expect(body.place).toMatchObject({ name: "Lake Forest", region: "CA" });
    expect(names(body)).toEqual(["Saddleback Church"]);
  });
  it("keeps typeahead working when a short word looks like a code", async () => {
    expect((await top("grace co")).name).toBe("Grace Community Church");
  });
  it("reads city nicknames", async () => {
    const r = await top("st patricks cathedral nyc");
    expect(r.region).toBe("NY");
  });
  it("expands church-name abbreviations", async () => {
    expect((await top("ame church atlanta ga")).name).toBe("Bethel AME Church");
    const umc = names((await s("umc austin")).body);
    expect(umc).toEqual(expect.arrayContaining(["First United Methodist Church", "Grace UMC"]));
    expect(names((await s("grace united methodist")).body)).toContain("Grace UMC");
    expect(names((await s("lds church")).body)).toContain("The Church of Jesus Christ of Latter-day Saints");
    expect(names((await s("1st baptist austin")).body)).toContain("First Baptist Church Sanctuary");
    expect((await top("first presbyterian ch austin")).name).toBe("First Presbyterian Church");
    expect((await top("first meth austin")).name).toBe("First United Methodist Church");
  });
  it("finds half-typed words anywhere in the query", async () => {
    expect((await top("first bap church dallas", "&lat=32.78&lng=-96.8")).name).toBe("First Baptist Church");
    expect(names((await s("grac comm church")).body)[0]).toBe("Grace Community Church");
  });
  it("ranks the church in a named city above more complete ones nearby", async () => {
    expect((await top("first baptist, austin tx")).name).toBe("First Baptist Church Sanctuary");
    expect((await top("first baptist austin tx")).name).toBe("First Baptist Church Sanctuary");
  });
  it("lets a nearby longer name beat an exact name far away, only for a location the caller sent", async () => {
    expect((await top("calvary chapel", "&lat=26.12&lng=-80.14&region=FL")).name).toBe("Calvary Chapel West Boca");
    expect((await top("calvary chapel")).name).toBe("Calvary Chapel");
  });
  it("puts Dallas, Texas above Dallas, Georgia for a Dallas caller", async () => {
    const { body } = await s("first baptist dallas", "&lat=32.78&lng=-96.8");
    const ga = body.results.findIndex((r: any) => r.region === "GA");
    expect(ga).toBeGreaterThan(0);
    expect(body.results.slice(0, ga).every((r: any) => r.region === "TX")).toBe(true);
  });
  it("finds a church by postcode", async () => {
    expect((await top("grace 75201")).name).toBe("Grace Community Church");
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
  it("404s unknown ids", async () => {
    const { res, body } = await get("/v1/churches/nope");
    expect(res.status).toBe(404);
    expect(body.code).toBe("not_found");
  });
});

describe("meta and routing", () => {
  it("serves meta", async () => {
    const { body } = await get("/v1/meta");
    expect(body.completenessWeights.serviceTimes).toBe(25);
    expect(body.contributableFields.email).toBeUndefined();
    expect(body.contributableFields.pastorName).toBeUndefined();
    expect(body.contributableFields.name.review).toBe("moderated");
    expect(body.contributableFields.serviceTimes.review).toBe("live");
    expect(body.counts.churches).toBe(rows.length + searchRows.length);
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
    expect(((await res.json()) as any)).toMatchObject({ error: "overloaded", code: "overloaded" });
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
    expect(((await res.json()) as any).code).toBe("rate_limited");
  });
});
