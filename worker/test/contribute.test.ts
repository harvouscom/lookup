import { env, SELF } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { seed } from "./seed.ts";
import { addChurch, confirm, contribute, countryCode, ipHash, regionCode, type ContributeEnv } from "../src/contribute.ts";

beforeAll(async () => { await seed(env.DB); });

// R-0 is Grace Community Church (US, has a website). R-5 is in Poland.
type Call = { path: string; body: any };
/** R-7 as Here's My Church's export would send it, with `over` applied. */
const exportRow = (over: Record<string, unknown> = {}) => ({ id: "R-7", shortId: "abc123", name: "Church at the Cross", city: "Dallas", state: "TX", country: "US", lat: 32.78, lng: -96.8, ...over });
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
  it("keeps a maintenance 503 as try again, even with a claimed-listing answer around it", async () => {
    const { fetcher } = hmcStub(maintenance(), maintenance(), Response.json({ success: true, applied: false, needsModeration: true, reviewBy: "church" }));
    const out = await contribute(makeEnv(fetcher), "R-0", "ip", { client: "acme", changes: [{ field: "denomination", value: "Anglican" }, { field: "ministries", value: "Choir" }] }, noWait);
    const results = (out.body as any).results;
    expect(results.map((r: any) => r.status)).toEqual(["try_again", "in_review"]);
    expect(results[0].reviewBy).toBeUndefined();
    expect(results[0].message).toContain("busy");
  });
  it("passes reviewBy through when the church reviews a held change", async () => {
    const { fetcher } = hmcStub(
      Response.json({ success: true, applied: false, needsModeration: true, reviewBy: "church" }),
      Response.json({ success: true, applied: false, needsModeration: true }),
      Response.json({ success: true, applied: false, needsModeration: true, reviewBy: "someone-else" }),
    );
    const out = await contribute(makeEnv(fetcher), "R-0", "ip", { client: "acme", changes: [{ field: "denomination", value: "Anglican" }, { field: "website", value: "https://w.example" }, { field: "ministries", value: "Choir" }] }, noWait);
    expect((out.body as any).results).toEqual([
      { field: "denomination", status: "in_review", reviewBy: "church" },
      { field: "website", status: "in_review" },
      { field: "ministries", status: "in_review" },
    ]);
  });
  it("treats rate limits and outages as try again", async () => {
    const { fetcher } = hmcStub(Response.json({ error: "Too many" }, { status: 429 }), new Response("boom", { status: 502 }));
    const out = await contribute(makeEnv(fetcher), "R-0", "ip", { client: "acme", changes: [{ field: "denomination", value: "A" }, { field: "ministries", value: "Youth" }] }, noWait);
    expect((out.body as any).results.map((r: any) => r.status)).toEqual(["try_again", "try_again"]);
  });
  it("takes phone and address in every country", async () => {
    const { calls, fetcher } = hmcStub(live(), Response.json({ success: true, applied: false, needsModeration: true }));
    const out = await contribute(makeEnv(fetcher), "R-5", "ip", { client: "acme", changes: [{ field: "phone", value: "+48 12 345 67 89" }, { field: "street", value: "ul. Długa 1" }] }, noWait);
    expect((out.body as any).results.map((r: any) => r.status)).toEqual(["live", "in_review"]);
    expect(calls.map((c) => c.body.field)).toEqual(["phone", "address"]);
    expect(JSON.parse(calls[1]!.body.value)).toEqual({ address: "ul. Długa 1", city: "Wrocław", state: "PLWP", postcode: "", country: "PL" });
  });
  it("sends street, city and postal code as one structured address", async () => {
    const { calls, fetcher } = hmcStub(Response.json({ success: true, applied: false, needsModeration: true }));
    const out = await contribute(makeEnv(fetcher), "R-0", "ip", { client: "acme", changes: [{ field: "street", value: "9 Elm St" }, { field: "city", value: "Irving" }, { field: "postalCode", value: "75038" }, { field: "denomination", value: "Baptist" }] }, noWait);
    expect(calls.filter((c) => c.body.field === "address")).toHaveLength(1);
    expect(JSON.parse(calls[0]!.body.value)).toEqual({ address: "9 Elm St", city: "Irving", state: "TX", postcode: "75038", country: "US" });
    expect((out.body as any).results.map((r: any) => [r.field, r.status])).toEqual([["address", "in_review"], ["denomination", "live"]]);
    const one = hmcStub(Response.json({ success: true, applied: false, needsModeration: true }));
    await contribute(makeEnv(one.fetcher), "R-0", "ip", { client: "acme", changes: [{ field: "address", value: { street: "9 Elm St", postalCode: "75201" } }] }, noWait);
    expect(JSON.parse(one.calls[0]!.body.value)).toMatchObject({ address: "9 Elm St", city: "Dallas", postcode: "75201" });
  });
  it("skips an address that's already listed", async () => {
    const { calls, fetcher } = hmcStub();
    const out = await contribute(makeEnv(fetcher), "R-0", "ip", { client: "acme", changes: [{ field: "address", value: { street: "1 Main", city: "Dallas" } }] }, noWait);
    expect((out.body as any).results[0]).toMatchObject({ field: "address", status: "not_applied" });
    expect(calls).toHaveLength(0);
  });
  it("forwards email, pastor name and reports, which a moderator reviews", async () => {
    const review = () => Response.json({ success: true, applied: false, needsModeration: true });
    const { calls, fetcher } = hmcStub(review(), review(), review(), review(), review());
    const out = await contribute(makeEnv(fetcher), "R-0", "ip", { client: "acme", changes: [
      { field: "email", value: "office@grace.example" }, { field: "pastorName", value: "Pat Lee" },
      { field: "reportClosed", value: "true" }, { field: "reportDuplicate", value: "R-2" }, { field: "reportRelocated", value: "5 Oak Ave, Dallas" },
    ] }, noWait);
    expect((out.body as any).results.every((r: any) => r.status === "in_review")).toBe(true);
    expect(calls.map((c) => c.body.field)).toEqual(["email", "pastorName", "reportClosed", "reportDuplicate", "reportRelocated"]);
  });
  it("checks an email's shape before sending it", async () => {
    const { calls, fetcher } = hmcStub();
    const out = await contribute(makeEnv(fetcher), "R-0", "ip", { client: "acme", changes: [{ field: "email", value: "not an email" }] }, noWait);
    expect((out.body as any).results[0].status).toBe("rejected");
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
    const { calls, fetcher } = hmcStub();
    const out = await contribute(makeEnv(fetcher), "R-0", "ip", { client: "acme", changes: [{ field: "latitude", value: "1" }, { field: "region", value: "OK" }] }, noWait);
    expect((out.body as any).results.map((r: any) => r.status)).toEqual(["rejected", "rejected"]);
    expect(calls).toHaveLength(0);
  });
  it("writes a live change straight into D1 and the search index", async () => {
    const { fetcher } = hmcStub(Response.json({ success: true, applied: true, needsModeration: false, church: exportRow({ name: "Zion Church at the Cross", denomination: "Baptist" }) }));
    const out = await contribute(makeEnv(fetcher), "R-7", "ip", { client: "acme", changes: [{ field: "denomination", value: "Baptist" }] }, noWait);
    expect(out.body).toMatchObject({ updated: true, results: [{ field: "denomination", status: "live" }] });
    expect(out.purge).toEqual(["R-7"]);
    const row = await env.DB.prepare("SELECT rowid AS rid, name, denomination, short_id FROM church WHERE id = 'R-7'").first<any>();
    expect(row).toMatchObject({ rid: 8, name: "Zion Church at the Cross", denomination: "Baptist", short_id: "abc123" });
    const fts = await env.DB.prepare(`SELECT rowid FROM church_fts WHERE church_fts MATCH 'name:"zion"'`).all();
    expect(fts.results).toEqual([{ rowid: 8 }]);
    expect(await env.DB.prepare("SELECT id FROM embed_pending WHERE id = 'R-7'").first()).toEqual({ id: "R-7" });
    const rec = (await (await SELF.fetch("https://lookup.test/v1/churches/R-7")).json()) as any;
    expect(rec.fields.denomination).toBe("Baptist");
    expect(rec.links).toEqual({ heresMyChurch: "https://heresmychurch.com/US/TX/abc123" });
  });
  it("leaves D1 alone when nothing went live", async () => {
    const { fetcher } = hmcStub(Response.json({ success: true, applied: false, needsModeration: true, church: exportRow({ name: "Should Not Write" }) }));
    const out = await contribute(makeEnv(fetcher), "R-7", "ip", { client: "acme", changes: [{ field: "website", value: "https://x.example" }] }, noWait);
    expect(out.purge).toEqual([]);
    expect((await env.DB.prepare("SELECT name FROM church WHERE id = 'R-7'").first<any>()).name).toBe("Church at the Cross");
  });
  it("sandboxes the demo client: validated, never forwarded", async () => {
    const { calls, fetcher } = hmcStub();
    const out = await contribute(makeEnv(fetcher), "R-0", "ip", { client: "lookup-demo", changes: [{ field: "denomination", value: "Baptist" }, { field: "website", value: "https://x.example" }, { field: "name", value: "X" }] }, noWait);
    expect((out.body as any).sandbox).toBe(true);
    expect((out.body as any).results.map((r: any) => r.status)).toEqual(["live", "in_review", "coming_soon"]);
    expect(calls).toHaveLength(0);
  });
  it("sandboxes a claimed listing as the church's to review", async () => {
    await env.DB.prepare("UPDATE church SET claimed = 1 WHERE id = 'R-1'").run();
    const out = await contribute(makeEnv(), "R-1", "ip", { client: "lookup-demo", changes: [{ field: "denomination", value: "Baptist" }] }, noWait);
    expect((out.body as any).results).toEqual([{ field: "denomination", status: "in_review", reviewBy: "church" }]);
    await env.DB.prepare("UPDATE church SET claimed = 0 WHERE id = 'R-1'").run();
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
  it("writes the new last-verified date into D1", async () => {
    const a = hmcStub(Response.json({ ok: true, lastVerified: 1760000000000 }));
    const out = await confirm(makeEnv(a.fetcher), "R-1", "ip", { client: "acme" }, noWait);
    expect(out.purge).toEqual(["R-1"]);
    expect((await env.DB.prepare("SELECT last_verified FROM church WHERE id = 'R-1'").first<any>()).last_verified).toBe(1760000000000);
  });
});

describe("add a church", () => {
  const addEnv = (fetcher?: Fetcher, extra: Partial<ContributeEnv> = {}) => makeEnv(fetcher, { ADD_ENABLED: "true", ...extra });
  const body = (church: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({ client: "acme", church: { name: "New Hope Fellowship", city: "Dallas", region: "TX", ...church }, ...extra });

  it("reads countries and regions from codes or names", () => {
    expect(countryCode("us")).toBe("US");
    expect(countryCode("United States")).toBe("US");
    expect(countryCode("Narnia")).toBeNull();
    expect(regionCode("tx", "US")).toBe("TX");
    expect(regionCode("Texas", null)).toBe("TX");
    expect(regionCode("greater poland", "PL")).toBe("PLWP");
    expect(regionCode("WP", "PL")).toBe("PLWP");
    expect(regionCode("Texas", "CA")).toBeNull();
  });
  it("is off without its kill switch", async () => {
    expect((await addChurch(addEnv(undefined, { ADD_ENABLED: undefined }), "ip", body({}))).status).toBe(503);
  });
  it("rejects what Here's My Church couldn't place", async () => {
    const { calls, fetcher } = hmcStub();
    expect((await addChurch(addEnv(fetcher), "ip", body({ city: "" }))).body).toMatchObject({ status: "rejected", message: "A city is required" });
    expect((await addChurch(addEnv(fetcher), "ip", body({ region: "Atlantis" }))).body).toMatchObject({ status: "rejected" });
    expect((await addChurch(addEnv(fetcher), "ip", body({ country: "Narnia" }))).body).toMatchObject({ status: "rejected", message: "Unknown country" });
    expect((await addChurch(addEnv(fetcher), "ip", { client: "acme" })).status).toBe(400);
    expect(calls).toHaveLength(0);
  });
  it("offers similar churches as search results, then adds with confirmAdd", async () => {
    const { calls, fetcher } = hmcStub(
      Response.json({ needsConfirmation: true, similar: [{ id: "R-0", name: "Grace Community Church" }, { id: "HMC-9", name: "Grace Community", city: "Dallas", state: "TX", country: "US", lat: 32.8, lng: -96.8 }] }),
      Response.json({ success: true, church: exportRow({ id: "NEW-1", shortId: "new1", name: "Grace Community Church North", city: "Dallas" }) }),
    );
    const first = await addChurch(addEnv(fetcher), "203.0.113.9", body({ name: "Grace Community Church", region: "Texas", country: "United States", street: "2 Oak", postalCode: "75201", phone: "214-555-0100" }), noWait);
    expect(first.body).toMatchObject({ status: "similar" });
    const similar = (first.body as any).similar;
    expect(similar.map((r: any) => r.id)).toEqual(["R-0", "HMC-9"]);
    expect(similar[0]).toMatchObject({ name: "Grace Community Church", locationLabel: "1 Main, Dallas, Texas", regionName: "Texas", country: "US" });
    expect(similar[1]).toMatchObject({ name: "Grace Community", city: "Dallas", region: "TX", latitude: 32.8 });
    expect(calls[0]!.path).toBe("/internal/lookup/churches");
    expect(calls[0]!.body).toMatchObject({ client: "acme", church: { name: "Grace Community Church", address: "2 Oak", city: "Dallas", state: "TX", postcode: "75201", country: "US", phone: "214-555-0100" } });
    expect(calls[0]!.body.ipHash).toBe(await ipHash("203.0.113.9", "test-key"));
    expect(calls[0]!.body.confirmAdd).toBeUndefined();

    const second = await addChurch(addEnv(fetcher), "ip", body({ name: "Grace Community Church North" }, { confirmAdd: true }), noWait);
    expect(second.body).toEqual({ status: "live", id: "NEW-1" });
    expect(second.purge).toEqual(["NEW-1"]);
    expect(calls[1]!.body.confirmAdd).toBe(true);
    const row = await env.DB.prepare("SELECT name, region, short_id FROM church WHERE id = 'NEW-1'").first();
    expect(row).toEqual({ name: "Grace Community Church North", region: "TX", short_id: "new1" });
    const fts = await env.DB.prepare(`SELECT c.id FROM church_fts f JOIN church c ON c.rowid = f.rowid WHERE church_fts MATCH 'name:"north"'`).all();
    expect(fts.results).toEqual([{ id: "NEW-1" }]);
  });
  it("says try again on maintenance and rejected on a refusal", async () => {
    const a = hmcStub(maintenance(), maintenance());
    expect((await addChurch(addEnv(a.fetcher), "ip", body({}), noWait)).body).toMatchObject({ status: "try_again" });
    const b = hmcStub(Response.json({ error: "Name looks like spam" }, { status: 400 }));
    expect((await addChurch(addEnv(b.fetcher), "ip", body({}), noWait)).body).toEqual({ status: "rejected", message: "Name looks like spam" });
  });
  it("sandboxes the demo client with a local duplicate check", async () => {
    const { calls, fetcher } = hmcStub();
    const dup = await addChurch(addEnv(fetcher), "ip", { client: "lookup-demo", church: { name: "Grace Community Church", city: "Dallas", region: "TX" } }, noWait);
    expect(dup.body).toMatchObject({ status: "similar", sandbox: true });
    expect((dup.body as any).similar.map((r: any) => r.id)).toEqual(["R-0"]);
    const ok = await addChurch(addEnv(fetcher), "ip", { client: "lookup-demo", church: { name: "Grace Community Church", city: "Dallas", region: "TX" }, confirmAdd: true }, noWait);
    expect(ok.body).toEqual({ status: "live", sandbox: true, id: null });
    const fresh = await addChurch(addEnv(fetcher), "ip", { client: "lookup-demo", church: { name: "Totally New Chapel", city: "Austin", region: "TX" } }, noWait);
    expect((fresh.body as any).status).toBe("live");
    expect(calls).toHaveLength(0);
  });
});

describe("routes", () => {
  it("lists name as coming soon in meta", async () => {
    const res = await SELF.fetch("https://lookup.test/v1/meta");
    const body = (await res.json()) as any;
    expect(body.contributableFields.name.status).toBe("coming_soon");
    expect(body.contributableFields.serviceTimes.status).toBeUndefined();
  });
  it("routes POST /v1/churches to adding, paused without the switch", async () => {
    expect((await SELF.fetch("https://lookup.test/v1/churches")).status).toBe(405);
    const res = await SELF.fetch("https://lookup.test/v1/churches", { method: "POST", body: JSON.stringify({ client: "lookup-demo", church: { name: "X Church", city: "Dallas", region: "TX" } }) });
    expect(res.status).toBe(503);
    expect(((await res.json()) as any).retryable).toBe(true);
  });
  it("only accepts POST for writes, and is paused without the switch", async () => {
    expect((await SELF.fetch("https://lookup.test/v1/churches/R-0/contributions")).status).toBe(405);
    const res = await SELF.fetch("https://lookup.test/v1/churches/R-0/contributions", { method: "POST", body: JSON.stringify({ client: "acme", changes: [{ field: "denomination", value: "x" }] }) });
    expect(res.status).toBe(503);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });
});
