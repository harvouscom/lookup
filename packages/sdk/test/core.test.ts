import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addUrl, changeFor, isStale, mergeAddress, newChurchFrom, suggestUrl, STALE_MS } from "../src/core.ts";
import { consentDiff, contributable, createLookup, createLookupController, fieldValue, fillTargets, findTargets, planFill, type ControllerState } from "../src/core.ts";

const result = (id: string, name: string) => ({ id, name, label: name, locationLabel: "Dallas, Texas", street: null, city: "Dallas", nearestPlace: null, region: "TX", regionName: "Texas", country: "US", countryName: "United States", latitude: 1, longitude: 2, denomination: null, completeness: 50, distanceKm: null, band: 1, source: "lexical" as const });
const record = {
  id: "R-1", completeness: 60, missing: ["phone"], hints: { nearestPlace: null }, attribution: "",
  fields: { name: "Grace Church", street: "1 Main", city: "Dallas", region: "TX", country: "US", phone: null, website: "https://grace.example", serviceTimes: { raw: "Sun 10:30 AM", slots: [], parsed: true }, languages: ["English", "Spanish"] },
};

let searches: { q: string; settled: boolean; params: URLSearchParams }[] = [];
let responses: Record<string, ReturnType<typeof result>[]> = {};
let fail = false;
/** Statuses (and Retry-After) the next searches fail with, in order. */
let failures: [number, string?][] = [];
let churchFails = false;
const lookup = createLookup({
  client: "lookup-demo",
  fetch: (async (url: string) => {
    const u = new URL(url);
    if (u.pathname.startsWith("/v1/churches/")) return churchFails ? Response.json({ error: "down" }, { status: 500 }) : Response.json(record);
    if (fail) return Response.json({ error: "down" }, { status: 503 });
    const q = u.searchParams.get("q")!;
    const settled = u.searchParams.get("settled") === "1";
    searches.push({ q, settled, params: u.searchParams });
    const f = failures.shift();
    if (f) return Response.json({ error: "busy" }, { status: f[0], headers: f[1] ? { "retry-after": f[1] } : {} });
    // Like the API: the top `limit` rows, and whether more ranked past them.
    const all = responses[settled ? `${q}|settled` : q] ?? responses[q] ?? [];
    const limit = Number(u.searchParams.get("limit")) || 8;
    return Response.json({ query: q, results: all.slice(0, limit), hasMore: all.length > limit, corrected: q === "gracee" ? "grace" : null });
  }) as typeof fetch,
});
const flush = (ms = 200) => vi.advanceTimersByTimeAsync(ms);
const many = (n: number) => Array.from({ length: n }, (_, i) => result(`R-${i}`, `Grace ${i}`));
const ids = (s: Readonly<ControllerState>) => s.results.map((r) => r.id);

beforeEach(() => { vi.useFakeTimers(); searches = []; responses = {}; fail = false; failures = []; churchFails = false; });
afterEach(() => { vi.useRealTimers(); });

describe("createLookupController", () => {
  it("has no side effects on import", () => {
    expect(customElements.get("church-lookup")).toBeUndefined();
  });

  it("debounces typing into one search and opens with the results", async () => {
    responses.grac = [result("R-1", "Grace Church"), result("R-2", "Grace Chapel")];
    const shown: number[] = [];
    const ctl = createLookupController({ lookup, onShow: (s) => shown.push(s.results.length) });
    for (const t of ["g", "gr", "gra", "grac"]) ctl.input(t);
    expect(ctl.state.loading).toBe(false);
    await flush(160);
    expect(searches.filter((s) => !s.settled).map((s) => s.q)).toEqual(["grac"]);
    expect(ctl.state.open).toBe(true);
    expect(ctl.state.results.map((r) => r.id)).toEqual(["R-1", "R-2"]);
    expect(shown).toEqual([2]);
  });

  it("sends a settled search for 4+ characters only", async () => {
    const a = createLookupController({ lookup });
    a.input("grace comm");
    await flush(800);
    expect(searches.map((s) => s.settled)).toEqual([false, true]);
    searches = [];
    const b = createLookupController({ lookup });
    b.input("gra");
    await flush(800);
    expect(searches.map((s) => s.settled)).toEqual([false]);
  });

  it("closes and searches nothing under 2 characters", async () => {
    responses.gr = [result("R-1", "Grace Church")];
    const ctl = createLookupController({ lookup });
    ctl.input("gr");
    await flush(160);
    expect(ctl.state.open).toBe(true);
    ctl.input("g");
    await flush(800);
    expect(ctl.state.open).toBe(false);
    expect(ctl.state.results).toEqual([]);
    expect(searches).toHaveLength(1);
  });

  it("drops results for text that's no longer in the box", async () => {
    responses.grac = [result("R-1", "Grace Church")];
    let text = "grac";
    const ctl = createLookupController({ lookup, text: () => text });
    ctl.input("grac");
    text = "grace c";
    await flush(160);
    expect(ctl.state.results).toEqual([]);
  });

  it("passes search params and the client name", async () => {
    const ctl = createLookupController({ lookup, params: () => ({ region: "TX", near: "Dallas", limit: 5, geo: false }) });
    ctl.input("grace");
    await flush(160);
    const p = searches[0]!.params;
    expect([p.get("region"), p.get("near"), p.get("limit"), p.get("geo"), p.get("client")]).toEqual(["TX", "Dallas", "5", "off", "lookup-demo"]);
  });

  it("keeps the highlighted church in place when settled results arrive", async () => {
    responses["grace comm"] = [result("R-1", "A"), result("R-2", "B"), result("R-3", "C")];
    responses["grace comm|settled"] = [result("R-9", "Z"), result("R-3", "C"), result("R-1", "A")];
    const ctl = createLookupController({ lookup });
    ctl.input("grace comm");
    await flush(160);
    ctl.move(1); ctl.move(1);
    expect(ctl.state.results[ctl.state.active]!.id).toBe("R-2");
    await flush(700);
    expect(ctl.state.active).toBe(1);
    expect(ctl.state.results.map((r) => r.id)).toEqual(["R-9", "R-2", "R-3", "R-1"]);
  });

  it("moves the highlight and wraps both ways", async () => {
    responses.grac = [result("R-1", "A"), result("R-2", "B")];
    const ctl = createLookupController({ lookup });
    ctl.input("grac");
    await flush(160);
    ctl.move(-1);
    expect(ctl.state.active).toBe(1);
    ctl.move(1);
    expect(ctl.state.active).toBe(0);
  });

  it("reports a failed search as an error with no results", async () => {
    fail = true;
    const ctl = createLookupController({ lookup });
    ctl.input("grac");
    await flush(160);
    expect(ctl.state).toMatchObject({ error: true, results: [], open: true, loading: false });
  });

  it("chooses a result, loads its record, and forgets it when the text changes", async () => {
    responses.grac = [result("R-1", "Grace Church")];
    const states: ControllerState[] = [];
    const ctl = createLookupController({ lookup, onChange: (s) => states.push({ ...s }) });
    ctl.input("grac");
    await flush(160);
    ctl.move(1);
    const rec = await ctl.choose();
    expect(rec?.id).toBe("R-1");
    expect(ctl.state).toMatchObject({ open: false, results: [], active: -1, query: "Grace Church" });
    expect(ctl.state.selected?.id).toBe("R-1");
    ctl.input("Grace Church");
    expect(ctl.state.selected?.id).toBe("R-1");
    ctl.input("Grace Chur");
    expect(ctl.state.selected).toBeNull();
    expect(states.length).toBeGreaterThan(3);
  });

  it("lets onSelect cancel a choice", async () => {
    responses.grac = [result("R-1", "Grace Church")];
    const ctl = createLookupController({ lookup, onSelect: () => false });
    ctl.input("grac");
    await flush(160);
    expect(await ctl.choose(0)).toBeNull();
    expect(ctl.state.selected).toBeNull();
  });

  it("says it's loading while a search is in flight", async () => {
    const seen: boolean[] = [];
    const ctl = createLookupController({ lookup, onChange: (s) => seen.push(s.loading) });
    ctl.input("grac");
    await flush(160);
    expect(seen).toContain(true);
    expect(ctl.state.loading).toBe(false);
  });

  it("shows more with one request, appending only new rows", async () => {
    responses.grace = many(20);
    const more: boolean[] = [];
    const ctl = createLookupController({ lookup, onResults: (d) => more.push(d.more) });
    ctl.input("grace");
    await flush(160);
    expect(ids(ctl.state)).toEqual(ids({ results: many(8) } as never));
    expect(ctl.state.hasMore).toBe(true);
    const first = ctl.state.results.slice();
    const added = await ctl.more();
    expect(added.map((r) => r.id)).toEqual(["R-8", "R-9", "R-10", "R-11", "R-12", "R-13", "R-14", "R-15"]);
    expect(ctl.state.results.slice(0, 8)).toEqual(first);
    // One request for every row it can reach, which replaces the pending settled search.
    expect(searches.map((s) => [s.params.get("limit"), s.settled])).toEqual([["8", false], ["50", true]]);
    await ctl.more();
    expect(ctl.state.results).toHaveLength(20);
    expect(ctl.state.hasMore).toBe(false);
    await flush(800);
    expect(searches).toHaveLength(2);
    expect(more).toEqual([false, true, true]);
  });

  it("keeps the rows already shown in place when more arrive in a different order", async () => {
    responses.grace = many(10);
    const ctl = createLookupController({ lookup, params: { semantic: false } });
    ctl.input("grace");
    await flush(160);
    responses.grace = [...many(10)].reverse();
    await ctl.more();
    expect(ids(ctl.state)).toEqual([...ids({ results: many(8) } as never), "R-9", "R-8"]);
  });

  it("stops at maxResults and uses limit as the page size", async () => {
    responses.grace = many(30);
    const ctl = createLookupController({ lookup, params: { limit: 5, maxResults: 12 } });
    ctl.input("grace");
    await flush(160);
    expect(ctl.state.results).toHaveLength(5);
    await ctl.more();
    expect(searches.at(-1)!.params.get("limit")).toBe("12");
    expect(ctl.state.results).toHaveLength(10);
    await ctl.more();
    expect(ctl.state.results).toHaveLength(12);
    expect(ctl.state.hasMore).toBe(false);
  });

  it("drops more results for text that's no longer in the box", async () => {
    responses.grace = many(20);
    let text = "grace";
    const ctl = createLookupController({ lookup, text: () => text });
    ctl.input("grace");
    await flush(160);
    const pending = ctl.more();
    text = "grace c";
    expect(await pending).toEqual([]);
    expect(ctl.state.results).toHaveLength(8);
  });

  it("moves through the Show more row, and down on it shows more", async () => {
    responses.grace = many(20);
    const ctl = createLookupController({ lookup });
    ctl.input("grace");
    await flush(160);
    ctl.move(-1);
    expect(ctl.state.active).toBe(8);
    ctl.move(1);
    await flush(0);
    expect(ctl.state.results).toHaveLength(16);
    expect(ctl.state.active).toBe(8);
    ctl.highlight(16);
    expect(await ctl.choose()).toBeNull();
    expect(ctl.state.results).toHaveLength(20);
    expect(ctl.state.active).toBe(16);
  });

  it("reports the corrected spelling", async () => {
    responses.gracee = [result("R-1", "Grace Church")];
    const ctl = createLookupController({ lookup, params: { semantic: false } });
    ctl.input("gracee");
    await flush(160);
    expect(ctl.state.corrected).toBe("grace");
  });

  it("waits out a short Retry-After once, and reports other failures", async () => {
    responses.grac = [result("R-1", "Grace Church")];
    failures = [[503, "2"]];
    const errors: unknown[] = [];
    const ctl = createLookupController({ lookup, onError: (e) => errors.push(e) });
    ctl.input("grac");
    await flush(160);
    expect(ctl.state).toMatchObject({ loading: true, error: false });
    await flush(2000);
    expect(ids(ctl.state)).toEqual(["R-1"]);
    expect(errors).toEqual([]);
    failures = [[429, "60"]];
    ctl.input("grace");
    await flush(160);
    expect(ctl.state.error).toBe(true);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ status: 429, retryAfter: 60 });
    ctl.retry();
    await flush(0);
    expect(ctl.state.error).toBe(false);
  });

  it("honors minChars, debounce, semantic and lat/lng", async () => {
    const ctl = createLookupController({ lookup, params: { minChars: 3, debounce: 400, semantic: false, lat: 32.78, lng: -96.8 } });
    ctl.input("gr");
    await flush(800);
    expect(searches).toEqual([]);
    ctl.input("grace comm");
    await flush(300);
    expect(searches).toEqual([]);
    await flush(800);
    expect(searches.map((s) => [s.settled, s.params.get("lat"), s.params.get("lng")])).toEqual([[false, "32.78", "-96.8"]]);
  });

  it("only marks a church chosen once its record loads", async () => {
    responses.grac = [result("R-1", "Grace Church")];
    churchFails = true;
    const ctl = createLookupController({ lookup });
    ctl.input("grac");
    await flush(160);
    await expect(ctl.choose(0)).rejects.toMatchObject({ status: 500 });
    expect(ctl.state.selected).toBeNull();
  });

  it("stops pending searches on reset and destroy", async () => {
    const ctl = createLookupController({ lookup });
    ctl.input("grace comm");
    ctl.reset();
    await flush(800);
    expect(searches).toEqual([]);
    ctl.input("grace comm");
    ctl.destroy();
    await flush(800);
    expect(searches).toEqual([]);
  });
});

describe("fill", () => {
  const form = (html: string) => { document.body.innerHTML = `<form>${html}</form>`; return document.querySelector("form")!; };
  it("fills empty tagged fields with input events and lists what's missing", () => {
    const f = form(`<input data-hmc-field="city"><input data-hmc-field="phone"><input data-hmc-field="website" value="kept"><textarea data-hmc-field="serviceTimes"></textarea>`);
    const seen: string[] = [];
    f.addEventListener("input", (e) => seen.push((e.target as HTMLInputElement).dataset.hmcField!));
    const { changes, empty } = fillTargets(record as never, findTargets(f));
    expect(changes.map((c) => c.field)).toEqual(["city", "serviceTimes"]);
    expect(empty).toEqual(["phone"]);
    expect(seen).toEqual(["city", "serviceTimes"]);
    expect((f.querySelector("[data-hmc-field=website]") as HTMLInputElement).value).toBe("kept");
  });
  it("overwrites only when asked, and skips options a select doesn't have", () => {
    const f = form(`<input data-hmc-field="website" value="old"><select data-hmc-field="region"><option>CA</option></select>`);
    expect(planFill(record as never, findTargets(f)).changes).toEqual([]);
    expect(planFill(record as never, findTargets(f), { overwrite: true }).changes.map((c) => c.field)).toEqual(["website"]);
  });
  it("picks select options by value or text, as a code or a name", () => {
    const f = form(`<select data-hmc-field="region"><option value="">Pick</option><option value="tx">Texas</option></select>
      <select data-hmc-field="regionName"><option value=""></option><option value="1">TX</option></select>
      <select data-hmc-field="country"><option value=""></option><option value="840"> United States </option></select>`);
    const rec = { ...record, fields: { ...record.fields, regionName: "Texas", countryName: "United States" } };
    expect(planFill(rec as never, findTargets(f)).changes.map((c) => [c.field, c.value])).toEqual([["region", "tx"], ["regionName", "1"], ["country", "840"]]);
  });
  it("fieldValue flattens lists and service times", () => {
    expect(fieldValue(record as never, "languages")).toBe("English, Spanish");
    expect(fieldValue(record as never, "serviceTimes")).toBe("Sun 10:30 AM");
    expect(fieldValue(record as never, "id")).toBe("R-1");
  });
});

describe("consent", () => {
  const meta = { fields: [], completenessWeights: {}, attribution: "", contributableFields: {
    phone: { countries: ["US", "CA"], review: "live" as const },
    address: { countries: ["US"], review: "moderated" as const },
    name: { countries: "all" as const, review: "moderated" as const, status: "coming_soon" as const },
  } };
  it("knows which fields can be shared in which country", () => {
    expect(contributable(meta, "phone", "US")?.review).toBe("live");
    expect(contributable(meta, "phone", "DE")).toBeNull();
    expect(contributable(meta, "street", "US")?.review).toBe("moderated");
    expect(contributable(meta, "city", "US")?.review).toBe("moderated");
    expect(contributable(meta, "postalCode", "US")?.review).toBe("moderated");
    expect(contributable(meta, "email", "US")).toBeNull();
    expect(contributable(null, "phone", "US")).toBeNull();
  });
  it("lists changed rows that haven't been sent", () => {
    const rows = [{ field: "phone", was: "1", value: "2" }, { field: "city", was: "Dallas", value: " Dallas " }, { field: "website", was: "", value: "" }, { field: "name", was: "A", value: "B" }];
    expect(consentDiff(rows).map((r) => r.field)).toEqual(["phone", "name"]);
    expect(consentDiff(rows, new Map([["name", "B"]])).map((r) => r.field)).toEqual(["phone"]);
  });
  it("merges street, city and postal code into one address row in the first one's place", () => {
    const rows = [{ field: "phone", was: "1", value: "2" }, { field: "city", was: "Dallas", value: "Irving" }, { field: "street", was: "1 Main", value: "1 Main" }];
    const merged = mergeAddress(rows);
    expect(merged.map((r) => r.field)).toEqual(["phone", "address"]);
    expect(merged[1]).toMatchObject({ was: "Dallas, 1 Main", value: "Irving, 1 Main", parts: { city: "Irving", street: "1 Main" } });
    expect(changeFor(merged[1]!)).toEqual({ field: "address", value: { city: "Irving", street: "1 Main" } });
    expect(changeFor(merged[0]!)).toEqual({ field: "phone", value: "2" });
    expect(mergeAddress([{ field: "phone", was: "", value: "" }])).toHaveLength(1);
  });
});

describe("Here's My Church", () => {
  const rec = (lastVerified: number | null | undefined, link: string | null = null) => ({ id: "R-1", fields: {}, freshness: lastVerified === undefined ? undefined : { lastVerified }, links: { heresMyChurch: link } }) as never;
  it("is stale when never confirmed or not this year", () => {
    const now = Date.UTC(2026, 10, 6);
    expect(isStale(rec(null), now)).toBe(true);
    expect(isStale(rec(undefined), now)).toBe(true);
    expect(isStale(rec(now - STALE_MS - 1), now)).toBe(true);
    expect(isStale(rec(now - 30 * 864e5), now)).toBe(false);
  });
  it("builds the suggest and add links", () => {
    expect(suggestUrl(rec(null, "https://heresmychurch.com/US/TX/abc"))).toBe("https://heresmychurch.com/US/TX/abc?suggest=1");
    expect(suggestUrl(rec(null))).toBeNull();
    expect(addUrl({ name: " Grace & Truth ", city: "Dallas", region: "" })).toBe("https://heresmychurch.com/add?name=Grace+%26+Truth&city=Dallas");
    expect(addUrl()).toBe("https://heresmychurch.com/add");
  });
  it("builds a church to add from the typed name and mapped fields", () => {
    const input = (v: string) => Object.assign(document.createElement("input"), { value: v });
    const targets = new Map([["city", input("Dallas")], ["regionName", input("Texas")], ["phone", input(" 214 ")], ["latitude", input("1")], ["website", input("")]]);
    expect(newChurchFrom("New Hope", targets)).toEqual({ name: "New Hope", city: "Dallas", region: "Texas", phone: "214" });
    expect(newChurchFrom("NH", targets)).toBeNull();
    expect(newChurchFrom("New Hope", new Map([["city", input("Dallas")]]))).toBeNull();
  });
});
