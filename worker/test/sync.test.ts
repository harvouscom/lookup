import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { toRecord, type ChurchRow } from "../src/record.ts";
import { pickRegions, tick, writeChurch } from "../src/sync.ts";
import { seed } from "./seed.ts";
import schema from "../schema.sql?raw";

beforeAll(async () => {
  await seed(env.DB);
  for (const s of schema.split(/;\s*\n/).map((x) => x.trim()).filter((x) => /sync_state|embed_pending|places_lat/.test(x))) {
    await env.DB.prepare(s.replace("CREATE TABLE", "CREATE TABLE IF NOT EXISTS").replace("CREATE INDEX", "CREATE INDEX IF NOT EXISTS")).run();
  }
});

const upserts: string[][] = [];
const deletes: string[][] = [];
const fakeEnv = (exportRows: Record<string, unknown[]>, dirty: Record<string, number> = {}) => ({
  DB: env.DB,
  LOOKUP_INTERNAL_KEY: "k",
  AI: { run: async (_m: string, i: { text: string[] }) => ({ data: i.text.map(() => new Array(1024).fill(0.1)) }) } as unknown as Ai,
  VEC: {
    upsert: async (v: { id: string }[]) => { upserts.push(v.map((x) => x.id)); return {}; },
    deleteByIds: async (ids: string[]) => { deletes.push(ids); return {}; },
  } as unknown as VectorizeIndex,
  HMC_API: {
    fetch: async (url: string, init: { headers: Record<string, string> }) => {
      expect(init.headers["x-lookup-key"]).toBe("k");
      const path = new URL(url).pathname;
      if (path.endsWith("/regions")) return Response.json({ regions: Object.keys(exportRows).map((a) => ({ cc: a === "PLWP" ? "PL" : "US", abbrev: a, dirtyAt: dirty[a] ?? null })) });
      const abbrev = path.split("/").pop()!;
      const churches = exportRows[abbrev];
      return churches ? Response.json({ count: churches.length, churches }) : new Response("{}", { status: 404 });
    },
  } as unknown as Fetcher,
});

const tx = (id: string, name: string, extra: Record<string, unknown> = {}) => ({ id, name, state: "TX", country: "US", lat: 32.78, lng: -96.8, city: "Dallas", ...extra });

describe("pickRegions", () => {
  it("puts dirty regions first, then never synced, then oldest", () => {
    const listing = [{ cc: "US", abbrev: "TX", dirtyAt: null }, { cc: "US", abbrev: "IN", dirtyAt: 50 }, { cc: "US", abbrev: "AL", dirtyAt: null }, { cc: "US", abbrev: "GA", dirtyAt: 5 }];
    const state = new Map([
      ["TX", { region: "TX", synced_at: 100, dirty_at: null }],
      ["IN", { region: "IN", synced_at: 10, dirty_at: 40 }],
      ["GA", { region: "GA", synced_at: 10, dirty_at: 5 }],
    ]);
    expect(pickRegions(listing, state, 4).map((r) => r.abbrev)).toEqual(["IN", "AL", "GA", "TX"]);
  });
  it("skips regions it has no table entry for", () => {
    expect(pickRegions([{ cc: "NL", abbrev: "NLBQ2", dirtyAt: 1 }], new Map())).toEqual([]);
  });
});

describe("tick", () => {
  it("applies inserts, updates and deletes, and re-embeds only changed text", async () => {
    upserts.length = 0; deletes.length = 0;
    const exportTx = [
      tx("R-0", "Grace Community Church", { website: "https://grace.example", address: "1 Main, 75201", postcode: "75201", serviceTimes: "Sun 10:30 AM", phone: "555" }),
      tx("R-2", "First Baptist Church of Dallas"),
      tx("R-4", "Saint Mary's Catholic Church"),
      tx("R-7", "Church at the Cross"),
      tx("NEW-1", "Brand New Fellowship"),
      tx("X-1", "Unnamed Church"),
    ];
    const out = await tick(fakeEnv({ TX: exportTx }), ["TX"]);
    const r = out.regions[0]!;
    expect(r.error).toBeUndefined();
    expect(r).toMatchObject({ inserted: 1, deleted: 1, deletesSkipped: 0 });
    expect(r.updated).toBeGreaterThanOrEqual(2);
    expect(await env.DB.prepare("SELECT phone FROM church WHERE id='R-0'").first("phone")).toBe("555");
    expect(await env.DB.prepare("SELECT count(*) c FROM church WHERE id='R-1'").first("c")).toBe(0);
    expect(await env.DB.prepare("SELECT count(*) c FROM church_fts WHERE church_fts MATCH 'brand'").first("c")).toBe(1);
    expect(deletes.flat()).toContain("R-1");
    const embedded = upserts.flat();
    expect(embedded).toEqual(expect.arrayContaining(["NEW-1", "R-2"]));
    expect(embedded).not.toContain("R-0"); // phone changed; the embedded text didn't
    expect(out.embedded).toBe(embedded.length);
    expect(await env.DB.prepare("SELECT count(*) c FROM embed_pending").first("c")).toBe(0);
    const state = await env.DB.prepare("SELECT synced_at FROM sync_state WHERE region='TX'").first<{ synced_at: number }>();
    expect(state?.synced_at).toBeGreaterThan(0);
  });
  it("is a no-op when nothing changed", async () => {
    // Storage resets between tests, so apply the export once, then check a second identical tick.
    const exportTx = [
      tx("R-0", "Grace Community Church", { website: "https://grace.example", address: "1 Main, 75201", postcode: "75201", serviceTimes: "Sun 10:30 AM", phone: "555" }),
      tx("R-2", "First Baptist Church of Dallas"), tx("R-4", "Saint Mary's Catholic Church"), tx("R-7", "Church at the Cross"), tx("NEW-1", "Brand New Fellowship"),
    ];
    await tick(fakeEnv({ TX: exportTx }), ["TX"]);
    upserts.length = 0;
    const again = await tick(fakeEnv({ TX: exportTx }), ["TX"]);
    expect(again.regions[0], JSON.stringify(again.regions[0])).toMatchObject({ inserted: 0, updated: 0, deleted: 0, embedQueued: 0 });
    expect(upserts.flat()).toEqual([]);
  });
  it("carries claimed from the export into D1 and the record, and clears it when it's gone", async () => {
    const exportTx = [
      tx("R-0", "Grace Community Church", { website: "https://grace.example", address: "1 Main, 75201", postcode: "75201", serviceTimes: "Sun 10:30 AM" }),
      tx("R-2", "First Baptist Church of Dallas"), tx("R-4", "Saint Mary's Catholic Church"), tx("R-7", "Church at the Cross", { claimed: true }),
    ];
    await tick(fakeEnv({ TX: exportTx }), ["TX"]);
    const row = (id: string) => env.DB.prepare("SELECT * FROM church WHERE id = ?").bind(id).first<ChurchRow>();
    expect((await row("R-7"))!.claimed).toBe(1);
    expect(toRecord((await row("R-7"))!).claimed).toBe(true);
    expect(toRecord((await row("R-0"))!).claimed).toBe(false);
    // Unclaimed: the field is simply absent from the export.
    exportTx[3] = tx("R-7", "Church at the Cross");
    const again = await tick(fakeEnv({ TX: exportTx }), ["TX"]);
    expect(again.regions[0]).toMatchObject({ updated: 1, embedQueued: 0 });
    expect(toRecord((await row("R-7"))!).claimed).toBe(false);
    // A church written back after a contribution carries it too.
    await writeChurch(env, tx("R-2", "First Baptist Church of Dallas", { claimed: true }) as never, "TX");
    expect(toRecord((await row("R-2"))!).claimed).toBe(true);
  });
  it("skips deletes when a region shrinks by more than half", async () => {
    const out = await tick(fakeEnv({ TX: [tx("R-0", "Grace Community Church")] }), ["TX"]);
    expect(out.regions[0]).toMatchObject({ deleted: 0, deletesSkipped: 4 });
    expect(await env.DB.prepare("SELECT count(*) c FROM church WHERE region='TX'").first("c")).toBe(5);
  });
  it("records a failed region without stopping the tick", async () => {
    const out = await tick(fakeEnv({ TX: [tx("R-0", "Grace Community Church")], PLWP: undefined as never }), ["PLWP", "TX"]);
    expect(out.regions.find((r) => r.region === "PLWP")?.error).toContain("404");
    expect(out.regions.find((r) => r.region === "TX")?.error).toBeUndefined();
  });
});
