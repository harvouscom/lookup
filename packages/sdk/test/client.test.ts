import { afterEach, describe, expect, it, vi } from "vitest";
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
    const f = fake({ error: "overloaded", code: "overloaded" }, 503, { "retry-after": "2" });
    const err = await createLookup({ fetch: f.fetch }).search("grace").catch((e) => e);
    expect(err).toBeInstanceOf(LookupError);
    expect(err).toMatchObject({ name: "LookupError", status: 503, message: "overloaded", retryAfter: 2, code: "overloaded" });
  });
  it("survives an error body that isn't JSON", async () => {
    const fetch = (async () => new Response("<html>Bad gateway</html>", { status: 502, statusText: "Bad Gateway" })) as unknown as typeof globalThis.fetch;
    const err = await createLookup({ fetch }).search("grace").catch((e) => e);
    expect(err).toMatchObject({ status: 502, message: "Bad Gateway", code: undefined });
  });
  it("follows a church that moved, unless asked not to", async () => {
    const calls: string[] = [];
    const fetch = (async (url: string) => {
      calls.push(url);
      return Response.json(url.endsWith("/OLD") ? { id: "OLD", movedTo: "NEW" } : { id: "NEW", fields: { name: "Grace" } });
    }) as unknown as typeof globalThis.fetch;
    const lookup = createLookup({ fetch });
    expect(await lookup.getChurch("OLD")).toMatchObject({ id: "NEW", movedFrom: "OLD", fields: { name: "Grace" } });
    expect(await lookup.getChurch("OLD", { follow: false })).toEqual({ id: "OLD", movedTo: "NEW" });
    expect(calls).toHaveLength(3);
  });
  it("sends lat and lng", async () => {
    const f = fake({ results: [] });
    await createLookup({ fetch: f.fetch }).search("grace", { lat: 32.78, lng: -96.8 });
    expect(new URL(f.calls[0]!).searchParams.get("lat")).toBe("32.78");
  });
  it("adds a church, and sends contributions with keepalive when asked", async () => {
    const sent: { url: string; init: RequestInit }[] = [];
    const fetch = (async (url: string, init: RequestInit) => { sent.push({ url, init }); return Response.json({ status: "live", id: "NEW-1", results: [] }); }) as unknown as typeof globalThis.fetch;
    const lookup = createLookup({ fetch, client: "acme" });
    expect(await lookup.addChurch({ name: "New Hope", city: "Dallas", region: "TX" }, { confirmAdd: true })).toMatchObject({ status: "live", id: "NEW-1" });
    expect(sent[0]!.url).toBe("https://lookup.heresmychurch.com/v1/churches");
    expect(JSON.parse(String(sent[0]!.init.body))).toEqual({ client: "acme", church: { name: "New Hope", city: "Dallas", region: "TX" }, confirmAdd: true });
    await lookup.contribute("R-1", [{ field: "phone", value: "1" }], { keepalive: true });
    expect(sent[1]!.init.keepalive).toBe(true);
    await lookup.contribute("R-1", [{ field: "phone", value: "1" }]);
    expect(sent[2]!.init.keepalive).toBeUndefined();
  });

  // A fetch that answers only when aborted, the way a hung request behaves.
  const hang = (() => (_: string, init?: RequestInit) => new Promise((_r, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
  })) as unknown as () => typeof globalThis.fetch;
  it("times out with a LookupError", async () => {
    const err = await createLookup({ fetch: hang(), timeout: 20 }).search("grace").catch((e) => e);
    expect(err).toBeInstanceOf(LookupError);
    expect(err).toMatchObject({ status: 0, code: "timeout" });
  });
  it("still rejects with AbortError when the caller aborts", async () => {
    const ctl = new AbortController();
    const p = createLookup({ fetch: hang(), timeout: 5000 }).search("grace", { signal: ctl.signal }).catch((e) => e);
    ctl.abort();
    expect(await p).toMatchObject({ name: "AbortError" });
  });
});

describe("setup hints", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("warns once on a dev host when client is missing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("location", { hostname: "localhost" });
    vi.resetModules();
    const { createLookup: fresh } = await import("../src/client.ts");
    fresh(); fresh(); fresh({ client: "my-app" });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).toMatch(/client="my-app"/);
    warn.mockRestore();
  });
  it("stays quiet in production", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("location", { hostname: "www.example.org" });
    vi.resetModules();
    const { createLookup: fresh } = await import("../src/client.ts");
    fresh();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
