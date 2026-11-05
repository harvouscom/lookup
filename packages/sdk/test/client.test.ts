import { describe, expect, it } from "vitest";
import { createLookup, LookupError } from "../src/client.ts";

const fake = (body: unknown, status = 200, headers: Record<string, string> = {}) => {
  const calls: string[] = [];
  const fetch = (async (url: string) => { calls.push(url); return new Response(JSON.stringify(body), { status, headers }); }) as unknown as typeof globalThis.fetch;
  return { calls, fetch };
};

describe("client", () => {
  it("builds search URLs", async () => {
    const f = fake({ results: [] });
    await createLookup({ fetch: f.fetch, client: "my-tool" }).search("grace comm", { settled: true, region: "TX", geo: false, limit: 5 });
    const u = new URL(f.calls[0]!);
    expect(u.origin + u.pathname).toBe("https://lookup.heresmychurch.com/v1/search");
    expect(Object.fromEntries(u.searchParams)).toEqual({ q: "grace comm", region: "TX", limit: "5", settled: "1", geo: "off", client: "my-tool" });
  });
  it("encodes ids and honors baseUrl", async () => {
    const f = fake({ id: "x" });
    await createLookup({ fetch: f.fetch, baseUrl: "http://localhost:8787/" }).getChurch("TX/1 2");
    expect(f.calls[0]).toBe("http://localhost:8787/v1/churches/TX%2F1%202");
  });
  it("throws LookupError with retry-after", async () => {
    const f = fake({ error: "overloaded" }, 503, { "retry-after": "2" });
    const err = await createLookup({ fetch: f.fetch }).search("grace").catch((e) => e);
    expect(err).toBeInstanceOf(LookupError);
    expect(err).toMatchObject({ status: 503, message: "overloaded", retryAfter: 2 });
  });
});
