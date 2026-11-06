import { env, SELF } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { seed } from "./seed.ts";
import { confirm, contribute, ipHash, type ContributeEnv } from "../src/contribute.ts";

beforeAll(async () => { await seed(env.DB); });

// R-0 is Grace Community Church (US, has a website). R-5 is in Poland.
type Call = { path: string; body: any };
function hmcStub(...responses: (Response | (() => Response))[]) {
  const calls: Call[] = [];
  const fetcher = {
    fetch: async (url: string, init: RequestInit) => {
      calls.push({ path: new URL(url).pathname, body: JSON.parse(String(init.body)) });
      const next = responses.shift() ?? Response.json({ success: true, applied: true, needsModeration: false });
      return typeof next === "function" ? next() : next;
    },
  } as unknown as Fetcher;
  return { calls, fetcher };
}
const live = () => Response.json({ success: true, applied: true, needsModeration: false });
const maintenance = () => Response.json({ error: "maintenance" }, { status: 503, headers: { "retry-after": "3" } });
function makeEnv(fetcher?: Fetcher, extra: Partial<ContributeEnv> = {}): ContributeEnv {
  return { DB: env.DB, HMC_API: fetcher, LOOKUP_INTERNAL_KEY: "test-key", CONTRIBUTIONS_ENABLED: "true", ...extra };
}
const noWait = async () => {};

describe("contributions", () => {
  it("is off without the kill switch", async () => {
    const out = await contribute(makeEnv(undefined, { CONTRIBUTIONS_ENABLED: undefined }), "R-0", "1.2.3.4", { client: "acme", changes: [{ field: "denomination", value: "Baptist" }] });
    expect(out.status).toBe(503);
  });
  it("validates client and changes", async () => {
    expect((await contribute(makeEnv(), "R-0", "ip", { client: "Bad Client!", changes: [{ field: "denomination", value: "x" }] })).status).toBe(400);
    expect((await contribute(makeEnv(), "R-0", "ip", { client: "acme", changes: [] })).status).toBe(400);
    expect((await contribute(makeEnv(), "nope", "ip", { client: "acme", changes: [{ field: "denomination", value: "x" }] })).status).toBe(404);
  });
  it("maps each Here's My Church answer to a field status", async () => {
    const { calls, fetcher } = hmcStub(
      Response.json({ success: true, applied: true, needsModeration: false }),
      Response.json({ success: true, applied: false, needsModeration: true }),
      Response.json({ success: true, applied: false, needsModeration: false }),
      Response.json({ error: "Invalid service times" }, { status: 400 }),
    );
    const out = await contribute(makeEnv(fetcher), "R-0", "1.2.3.4", {
      client: "acme-chms",
      changes: [
        { field: "denomination", value: "Baptist" },
        { field: "website", value: "https://new.example" },
        { field: "languages", value: ["English", "Spanish"] },
        { field: "serviceTimes", value: "whenever" },
      ],
    }, noWait);
    expect(out.status).toBe(200);
    expect((out.body as any).results.map((r: any) => r.status)).toEqual(["live", "in_review", "not_applied", "rejected"]);
    expect((out.body as any).results[3].message).toBe("Invalid service times");
    expect(calls.map((c) => c.body.field)).toEqual(["denomination", "website", "languages", "serviceTimes"]);
    expect(calls[2]!.body.value).toBe("English, Spanish");
  });
  it("sends a salted hash, never the IP", async () => {
    const { calls, fetcher } = hmcStub(live());
    await contribute(makeEnv(fetcher), "R-0", "203.0.113.9", { client: "acme", changes: [{ field: "denomination", value: "Lutheran" }] }, noWait);
    const body = calls[0]!.body;
    expect(body.ipHash).toMatch(/^[a-f0-9]{32}$/);
    expect(body.ipHash).toBe(await ipHash("203.0.113.9", "test-key"));
    expect(JSON.stringify(body)).not.toContain("203.0.113.9");
    expect(body).toMatchObject({ client: "acme", churchId: "R-0", field: "denomination" });
  });
  it("maps street to address", async () => {
    const { calls, fetcher } = hmcStub(Response.json({ success: true, applied: false, needsModeration: true }));
    const out = await contribute(makeEnv(fetcher), "R-0", "ip", { client: "acme", changes: [{ field: "street", value: "9 Elm St" }] }, noWait);
    expect(calls[0]!.body.field).toBe("address");
    expect((out.body as any).results[0].status).toBe("in_review");
  });
  it("retries once on maintenance, honoring Retry-After, and never says rejected", async () => {
    const waits: number[] = [];
    const wait = async (ms: number) => { waits.push(ms); };
    const a = hmcStub(maintenance(), live());
    const ok = await contribute(makeEnv(a.fetcher), "R-0", "ip", { client: "acme", changes: [{ field: "denomination", value: "Methodist" }] }, wait);
    expect((ok.body as any).results[0].status).toBe("live");
    expect(waits).toEqual([3000]);
    const b = hmcStub(maintenance(), maintenance());
    const still = await contribute(makeEnv(b.fetcher), "R-0", "ip", { client: "acme", changes: [{ field: "denomination", value: "Methodist" }] }, wait);
    expect((still.body as any).results[0].status).toBe("try_again");
    expect(b.calls).toHaveLength(2);
  });
  it("treats rate limits and outages as try again", async () => {
    const { fetcher } = hmcStub(Response.json({ error: "Too many" }, { status: 429 }), new Response("boom", { status: 502 }));
    const out = await contribute(makeEnv(fetcher), "R-0", "ip", { client: "acme", changes: [{ field: "denomination", value: "A" }, { field: "ministries", value: "Youth" }] }, noWait);
    expect((out.body as any).results.map((r: any) => r.status)).toEqual(["try_again", "try_again"]);
  });
  it("applies country rules before sending anything", async () => {
    const { calls, fetcher } = hmcStub();
    const out = await contribute(makeEnv(fetcher), "R-5", "ip", { client: "acme", changes: [{ field: "phone", value: "+48 12 345 67 89" }, { field: "street", value: "ul. Długa 1" }] }, noWait);
    expect((out.body as any).results.map((r: any) => r.status)).toEqual(["rejected", "rejected"]);
    expect(calls).toHaveLength(0);
  });
  it("says name is coming soon and doesn't send it", async () => {
    const { calls, fetcher } = hmcStub();
    const out = await contribute(makeEnv(fetcher), "R-0", "ip", { client: "acme", changes: [{ field: "name", value: "Grace Church Dallas" }] }, noWait);
    expect((out.body as any).results[0]).toMatchObject({ field: "name", status: "coming_soon" });
    expect(calls).toHaveLength(0);
  });
  it("skips a value that's already listed", async () => {
    const { calls, fetcher } = hmcStub();
    const out = await contribute(makeEnv(fetcher), "R-0", "ip", { client: "acme", changes: [{ field: "website", value: "https://grace.example" }] }, noWait);
    expect((out.body as any).results[0].status).toBe("not_applied");
    expect(calls).toHaveLength(0);
  });
  it("refuses fields Lookup never contributes", async () => {
    const out = await contribute(makeEnv(), "R-0", "ip", { client: "acme", changes: [{ field: "email", value: "a@b.c" }, { field: "pastorName", value: "Pat" }] }, noWait);
    expect((out.body as any).results.map((r: any) => r.status)).toEqual(["rejected", "rejected"]);
  });
  it("sandboxes the demo client: validated, never forwarded", async () => {
    const { calls, fetcher } = hmcStub();
    const out = await contribute(makeEnv(fetcher), "R-0", "ip", { client: "lookup-demo", changes: [{ field: "denomination", value: "Baptist" }, { field: "website", value: "https://x.example" }, { field: "name", value: "X" }] }, noWait);
    expect((out.body as any).sandbox).toBe(true);
    expect((out.body as any).results.map((r: any) => r.status)).toEqual(["live", "in_review", "coming_soon"]);
    expect(calls).toHaveLength(0);
  });
});

describe("confirm", () => {
  it("sandboxes the demo client", async () => {
    const { calls, fetcher } = hmcStub();
    const out = await confirm(makeEnv(fetcher), "R-0", "ip", { client: "lookup-demo" }, noWait);
    expect(out.body).toMatchObject({ status: "confirmed", sandbox: true });
    expect(calls).toHaveLength(0);
  });
  it("forwards and maps maintenance to try again", async () => {
    const a = hmcStub(Response.json({ ok: true, lastVerified: 1730000000000 }));
    expect((await confirm(makeEnv(a.fetcher), "R-0", "ip", { client: "acme" }, noWait)).body).toMatchObject({ status: "confirmed", lastVerified: 1730000000000 });
    expect(a.calls[0]!.path).toBe("/internal/lookup/confirm");
    const b = hmcStub(maintenance(), maintenance());
    expect((await confirm(makeEnv(b.fetcher), "R-0", "ip", { client: "acme" }, noWait)).body).toMatchObject({ status: "try_again" });
  });
});

describe("routes", () => {
  it("lists name as coming soon in meta", async () => {
    const res = await SELF.fetch("https://lookup.test/v1/meta");
    const body = (await res.json()) as any;
    expect(body.contributableFields.name.status).toBe("coming_soon");
    expect(body.contributableFields.serviceTimes.status).toBeUndefined();
  });
  it("only accepts POST for writes, and is paused without the switch", async () => {
    expect((await SELF.fetch("https://lookup.test/v1/churches/R-0/contributions")).status).toBe(405);
    const res = await SELF.fetch("https://lookup.test/v1/churches/R-0/contributions", { method: "POST", body: JSON.stringify({ client: "acme", changes: [{ field: "denomination", value: "x" }] }) });
    expect(res.status).toBe(503);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });
});
