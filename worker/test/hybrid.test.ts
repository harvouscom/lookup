import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import worker from "../src/index.ts";
import { seed } from "./seed.ts";

beforeAll(async () => { await seed(env.DB); });

const ctx = { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext;
const vec = (ids: string[], seen: unknown[] = []) => ({
  query: async (_v: number[], opts: unknown) => { seen.push(opts); return { matches: ids.map((id, i) => ({ id, score: 0.9 - i * 0.01 })), count: ids.length }; },
}) as unknown as VectorizeIndex;
const ai = (delayMs = 0) => ({ run: async (_m: string, input: { text: string[] }) => { if (delayMs) await new Promise((r) => setTimeout(r, delayMs)); return { data: input.text.map(() => new Array(1024).fill(0.01)) }; } }) as unknown as Ai;
const call = async (q: string, extra: Partial<Record<string, unknown>> = {}, params = "&settled=1") => {
  const res = await worker.fetch(new Request(`https://lookup.test/v1/search?geo=off&q=${encodeURIComponent(q)}${params}`), { DB: env.DB, SEMANTIC_ENABLED: "true", AI: ai(), VEC: vec(["R-4", "R-5"]), ...extra } as never, ctx);
  return { res, body: (await res.json()) as any };
};

describe("hybrid", () => {
  it("adds semantic results below every lexical band", async () => {
    const { body } = await call("baptist zzqx");
    expect(body.semantic).toBe("used");
    const sem = body.results.filter((r: any) => r.source === "semantic");
    expect(sem.map((r: any) => r.id)).toEqual(expect.arrayContaining(["R-4", "R-5"]));
    for (const r of sem) expect(r.band).toBe(3);
    const lastLexicalBest = Math.max(...body.results.filter((r: any) => r.band < 3).map((_: any, i: number) => i), -1);
    expect(body.results.findIndex((r: any) => r.source === "semantic")).toBeGreaterThan(lastLexicalBest);
  });
  it("only runs on settled queries", async () => {
    expect((await call("baptist zzqx", {}, "")).body.semantic).toBe("off");
  });
  it("skips when lexical is strong", async () => {
    expect((await call("church")).body.semantic).toBe("skipped");
  });
  it("skips short queries", async () => {
    expect((await call("abc")).body.semantic).toBe("skipped");
  });
  it("is off when the kill switch is off", async () => {
    expect((await call("baptist zzqx", { SEMANTIC_ENABLED: "false" })).body.semantic).toBe("off");
  });
  it("times out to lexical with degraded:true", async () => {
    const t0 = Date.now();
    const { res, body } = await call("wroclaw zzqx", { AI: ai(3000) });
    expect(Date.now() - t0).toBeLessThan(2500);
    expect(body.degraded).toBe(true);
    expect(body.semantic).toBe("failed");
    expect(res.headers.get("cache-control")).toBeNull();
    expect(body.results.length).toBeGreaterThan(0);
  });
  it("drops vectors whose rows no longer exist", async () => {
    const { body } = await call("baptist zzqx", { VEC: vec(["GONE-1", "R-4"]) });
    expect(body.results.map((r: any) => r.id)).not.toContain("GONE-1");
  });
  it("filters Vectorize by a named place's cells", async () => {
    const seen: any[] = [];
    await call("chapel in dallas", { VEC: vec(["R-1"], seen) });
    expect(seen[0].filter.g3.$in).toHaveLength(9);
  });
  it("respects the semantic rate limit", async () => {
    const { body } = await call("baptist zzqx", { RL_SEMANTIC: { limit: async () => ({ success: false }) } });
    expect(body.semantic).toBe("off");
  });
});

describe("labels", () => {
  it("gives every result a display label", async () => {
    const { body } = await call("grace", {}, "");
    for (const r of body.results) {
      expect(typeof r.label).toBe("string");
      expect(r.label.startsWith(r.name)).toBe(true);
    }
    expect(body.results.find((r: any) => r.id === "R-0").label).toBe("Grace Community Church, 1 Main, Dallas, Texas");
  });
});
