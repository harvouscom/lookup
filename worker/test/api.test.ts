import { env, SELF } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { project, tokenize, type ExportChurch } from "../src/project.ts";
import schema from "../schema.sql?raw";
import worker from "../src/index.ts";

const DALLAS = { lat: 32.78, lng: -96.8 };
const rows: (Partial<ExportChurch> & { name: string; region: string; regionName: string; countryName: string; near?: string })[] = [
  { name: "Grace Community Church", region: "TX", regionName: "Texas", countryName: "United States", country: "US", city: "Dallas", ...DALLAS, website: "https://grace.example", address: "1 Main, 75201", postcode: "75201", serviceTimes: "Sun 10:30 AM" },
  { name: "Grace Bible Chapel", region: "TX", regionName: "Texas", countryName: "United States", country: "US", city: "Plano", lat: 33.02, lng: -96.7 },
  { name: "First Baptist Church", region: "TX", regionName: "Texas", countryName: "United States", country: "US", city: "Dallas", ...DALLAS },
  { name: "First Baptist Church", region: "IN", regionName: "Indiana", countryName: "United States", country: "US", city: "Fort Wayne", lat: 41.08, lng: -85.14 },
  { name: "Saint Mary's Catholic Church", region: "TX", regionName: "Texas", countryName: "United States", country: "US", city: "Dallas", ...DALLAS },
  { name: "Kościół pw. Świętego Jana", region: "PLWP", regionName: "Wielkopolskie", countryName: "Poland", country: "PL", city: "Wrocław", lat: 51.1, lng: 17.03 },
  { name: "Evangelische Kirche München", region: "DEBY", regionName: "Bayern", countryName: "Germany", country: "DE", city: "München", lat: 48.13, lng: 11.58 },
  { name: "Church at the Cross", region: "TX", regionName: "Texas", countryName: "United States", country: "US", city: "Dallas", ...DALLAS },
];

beforeAll(async () => {
  for (const stmt of schema.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean)) await env.DB.prepare(stmt).run();
  const df = new Map<string, number>();
  const places = new Map<string, { name: string; region: string; country: string; lat: number; lng: number; n: number }>();
  for (const [i, r] of rows.entries()) {
    const p = project({ id: `R-${i}`, country: r.country!, lat: r.lat!, lng: r.lng!, ...r } as ExportChurch, r.region, r);
    await env.DB.prepare("INSERT INTO church (rowid,id,name,street,city,postal_code,region,country,lat,lng,website,service_times,completeness,doc_hash,embed_hash) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(i + 1, p.id, p.name, p.street, p.city, p.postalCode, p.region, p.country, p.lat, p.lng, p.website, p.serviceTimes, p.completeness, p.docHash, p.embedHash).run();
    await env.DB.prepare("INSERT INTO church_fts (rowid,name,loc,geo) VALUES (?,?,?,?)").bind(i + 1, tokenize(p.name).join(" "), tokenize(p.loc).join(" "), p.geo).run();
    for (const t of new Set(tokenize(p.name))) df.set(t, (df.get(t) ?? 0) + 1);
    const key = tokenize(p.city!).join(" ");
    places.set(`${key}|${p.region}`, { name: p.city!, region: p.region, country: p.country, lat: p.lat, lng: p.lng, n: (places.get(`${key}|${p.region}`)?.n ?? 0) + 1 });
  }
  for (const [id, pl] of places) {
    await env.DB.prepare("INSERT INTO places (key,name,region,country,lat,lng,n) VALUES (?,?,?,?,?,?,?)").bind(id.split("|")[0], pl.name, pl.region, pl.country, pl.lat, pl.lng, pl.n).run();
  }
  const { deletions1 } = await import("../src/vocab.ts");
  let id = 1;
  for (const [t, c] of df) {
    await env.DB.prepare("INSERT INTO vocab (id,token,df) VALUES (?,?,?)").bind(id, t, c).run();
    for (const d of new Set([t, ...deletions1(t)])) await env.DB.prepare("INSERT OR IGNORE INTO vocab_del (del,id) VALUES (?,?)").bind(d, id).run();
    id++;
  }
  await env.DB.prepare("INSERT INTO moved (id,moved_to) VALUES ('OLD-1','R-0')").run();
  await env.DB.prepare("INSERT INTO lookup_meta (key,value) VALUES ('build', ?)").bind(JSON.stringify({ counts: { churches: rows.length }, fill: {}, builtAt: "now" })).run();
});

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
