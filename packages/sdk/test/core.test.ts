import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { consentDiff, contributable, createLookup, createLookupController, fieldValue, fillTargets, findTargets, planFill, type ControllerState } from "../src/core.ts";

const result = (id: string, name: string) => ({ id, name, label: name, locationLabel: "Dallas, Texas", street: null, city: "Dallas", nearestPlace: null, region: "TX", regionName: "Texas", country: "US", countryName: "United States", latitude: 1, longitude: 2, denomination: null, completeness: 50, distanceKm: null, band: 1, source: "lexical" as const });
const record = {
  id: "R-1", completeness: 60, missing: ["phone"], hints: { nearestPlace: null }, attribution: "",
  fields: { name: "Grace Church", street: "1 Main", city: "Dallas", region: "TX", country: "US", phone: null, website: "https://grace.example", serviceTimes: { raw: "Sun 10:30 AM", slots: [], parsed: true }, languages: ["English", "Spanish"] },
};

let searches: { q: string; settled: boolean; params: URLSearchParams }[] = [];
let responses: Record<string, ReturnType<typeof result>[]> = {};
let fail = false;
const lookup = createLookup({
  client: "lookup-demo",
  fetch: (async (url: string) => {
    const u = new URL(url);
    if (u.pathname.startsWith("/v1/churches/")) return Response.json(record);
    if (fail) return Response.json({ error: "down" }, { status: 503 });
    const q = u.searchParams.get("q")!;
    const settled = u.searchParams.get("settled") === "1";
    searches.push({ q, settled, params: u.searchParams });
    return Response.json({ query: q, results: responses[settled ? `${q}|settled` : q] ?? responses[q] ?? [] });
  }) as typeof fetch,
});
const flush = (ms = 200) => vi.advanceTimersByTimeAsync(ms);

beforeEach(() => { vi.useFakeTimers(); searches = []; responses = {}; fail = false; });
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
    expect(contributable(meta, "email", "US")).toBeNull();
    expect(contributable(null, "phone", "US")).toBeNull();
  });
  it("lists changed rows that haven't been sent", () => {
    const rows = [{ field: "phone", was: "1", value: "2" }, { field: "city", was: "Dallas", value: " Dallas " }, { field: "website", was: "", value: "" }, { field: "name", was: "A", value: "B" }];
    expect(consentDiff(rows).map((r) => r.field)).toEqual(["phone", "name"]);
    expect(consentDiff(rows, new Map([["name", "B"]])).map((r) => r.field)).toEqual(["phone"]);
  });
});
