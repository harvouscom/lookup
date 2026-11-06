import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChurchLookup, fieldValue, setNativeValue } from "../src/element.ts";
import { createLookup } from "../src/client.ts";
import "../src/strings-es.ts";
import "../src/strings-pl.ts";

const result = (id: string, name: string) => ({ id, name, label: `${name}, Dallas, Texas`, locationLabel: "Dallas, Texas", street: null, city: "Dallas", nearestPlace: null, region: "TX", regionName: "Texas", country: "US", countryName: "United States", latitude: 1, longitude: 2, denomination: null, completeness: 50, distanceKm: null, band: 1, source: "lexical" as const });
const record = {
  id: "R-1", completeness: 60, missing: ["phone"], hints: { nearestPlace: null }, attribution: "",
  fields: { name: "Grace Church", street: "1 Main", city: "Dallas", region: "TX", postalCode: "75201", phone: null, website: "https://grace.example", serviceTimes: { raw: "Sun 10:30 AM", slots: [], parsed: true }, languages: ["English", "Spanish"], ministries: [] },
};

let searches: { q: string; settled: boolean }[] = [];
let responses: Record<string, ReturnType<typeof result>[]> = {};
function mount(html = "") {
  document.body.innerHTML = `<form id="f"><church-lookup label="Your church"></church-lookup>${html}</form>`;
  const el = document.querySelector("church-lookup") as ChurchLookup;
  el.lookup = createLookup({
    fetch: (async (url: string) => {
      const u = new URL(url);
      if (u.pathname.startsWith("/v1/churches/")) return Response.json(record);
      const q = u.searchParams.get("q")!;
      searches.push({ q, settled: u.searchParams.get("settled") === "1" });
      const key = u.searchParams.get("settled") === "1" ? `${q}|settled` : q;
      return Response.json({ query: q, results: responses[key] ?? responses[q] ?? [], corrected: null, degraded: false, attribution: "" });
    }) as typeof fetch,
  });
  const root = el.shadowRoot!;
  const input = root.querySelector("input")!;
  return { el, root, input };
}
const type = (input: HTMLInputElement, v: string) => { input.value = v; input.dispatchEvent(new Event("input")); };
const key = (input: HTMLInputElement, k: string, extra: KeyboardEventInit = {}) => input.dispatchEvent(new KeyboardEvent("keydown", { key: k, cancelable: true, ...extra }));
const flush = async (ms = 200) => { await vi.advanceTimersByTimeAsync(ms); };

beforeEach(() => { vi.useFakeTimers(); searches = []; responses = {}; });
afterEach(() => { vi.useRealTimers(); });

describe("combobox semantics", () => {
  it("renders an ARIA 1.2 combobox with a label", () => {
    const { root, input } = mount();
    expect(input.getAttribute("role")).toBe("combobox");
    expect(input.getAttribute("aria-expanded")).toBe("false");
    expect(input.getAttribute("aria-autocomplete")).toBe("list");
    const list = root.getElementById(input.getAttribute("aria-controls")!)!;
    expect(list.getAttribute("role")).toBe("listbox");
    expect(root.querySelector(`label[for="${input.id}"]`)!.textContent).toBe("Your church");
  });
  it("debounces, shows options and announces the count", async () => {
    responses.grac = [result("R-1", "Grace Church"), result("R-2", "Grace Chapel")];
    const { root, input } = mount();
    type(input, "g"); type(input, "gr"); type(input, "gra"); type(input, "grac");
    await flush(160);
    expect(searches.filter((s) => !s.settled).map((s) => s.q)).toEqual(["grac"]);
    expect(input.getAttribute("aria-expanded")).toBe("true");
    const opts = root.querySelectorAll("[role=option]");
    expect(opts).toHaveLength(2);
    expect(opts[0]!.textContent).toContain("Dallas, Texas");
    await flush(100);
    expect(root.querySelector("[role=status]")!.textContent).toBe("2 churches found. Use up and down arrows to choose.");
  });
  it("sends a settled query after a pause", async () => {
    const { input } = mount();
    type(input, "grace comm");
    await flush(800);
    expect(searches).toEqual([{ q: "grace comm", settled: false }, { q: "grace comm", settled: true }]);
  });
  it("waits for IME composition to end", async () => {
    const { input } = mount();
    input.dispatchEvent(new Event("compositionstart"));
    type(input, "教会");
    await flush(300);
    expect(searches).toEqual([]);
    input.dispatchEvent(new Event("compositionend"));
    await flush(200);
    expect(searches[0]!.q).toBe("教会");
  });
  it("moves the active option with arrows and wraps", async () => {
    responses.grac = [result("R-1", "Grace Church"), result("R-2", "Grace Chapel")];
    const { root, input } = mount();
    type(input, "grac"); await flush();
    key(input, "ArrowDown");
    expect(input.getAttribute("aria-activedescendant")).toBe(root.querySelectorAll("[role=option]")[0]!.id);
    expect(root.querySelectorAll("[role=option]")[0]!.getAttribute("aria-selected")).toBe("true");
    key(input, "ArrowDown"); key(input, "ArrowDown");
    expect(input.getAttribute("aria-activedescendant")).toBe(root.querySelectorAll("[role=option]")[0]!.id);
    key(input, "ArrowUp");
    expect(input.getAttribute("aria-activedescendant")).toBe(root.querySelectorAll("[role=option]")[1]!.id);
  });
  it("emits church-results with the shown results", async () => {
    responses.grac = [result("R-1", "Grace Church")];
    const { el, input } = mount();
    const seen: any[] = [];
    el.addEventListener("church-results", (e) => seen.push((e as CustomEvent).detail));
    type(input, "grac"); await flush();
    expect(seen).toEqual([{ query: "grac", results: [expect.objectContaining({ id: "R-1" })], settled: false, more: false }]);
  });
  it("closes on Escape", async () => {
    responses.grac = [result("R-1", "Grace Church")];
    const { input } = mount();
    type(input, "grac"); await flush();
    key(input, "Escape");
    expect(input.getAttribute("aria-expanded")).toBe("false");
  });
  it("keeps the highlighted church in place when settled results arrive", async () => {
    responses["grace comm"] = [result("R-1", "Grace Community"), result("R-2", "Grace Comm Chapel")];
    responses["grace comm|settled"] = [result("R-9", "Grace Fellowship"), result("R-1", "Grace Community"), result("R-2", "Grace Comm Chapel")];
    const { root, input } = mount();
    type(input, "grace comm"); await flush();
    key(input, "ArrowDown"); key(input, "ArrowDown");
    await flush(700);
    const opts = [...root.querySelectorAll("[role=option]")];
    expect(opts.findIndex((o) => o.getAttribute("aria-selected") === "true")).toBe(1);
    expect(opts[1]!.textContent).toContain("Grace Comm Chapel");
    expect(opts.length).toBe(3);
  });
  it("offers to add a church when nothing matches, keeping the text", async () => {
    const { root, input } = mount();
    type(input, "zzqx church"); await flush();
    expect(root.querySelector(".note")!.textContent).toContain("No matching church");
    expect(root.querySelector<HTMLAnchorElement>(".note a")!.href).toContain("heresmychurch.com");
    expect(input.value).toBe("zzqx church");
  });
});

describe("fill", () => {
  const form = `<input data-hmc-field="street"><input data-hmc-field="city" value="Plano"><input data-hmc-field="phone"><textarea data-hmc-field="serviceTimes"></textarea><input data-hmc-field="languages"><select data-hmc-field="region"><option value="">-</option><option value="TX">Texas</option></select>`;
  const pick = async (input: HTMLInputElement) => {
    responses.grac = [result("R-1", "Grace Church")];
    type(input, "grac"); await flush();
    key(input, "ArrowDown"); key(input, "Enter");
    await flush(100);
  };
  it("fills empty fields with input and change events and announces what's missing", async () => {
    const { root, input } = mount(form);
    const events: string[] = [];
    document.querySelector("[data-hmc-field=street]")!.addEventListener("input", () => events.push("input"));
    document.querySelector("[data-hmc-field=street]")!.addEventListener("change", () => events.push("change"));
    await pick(input);
    const v = (f: string) => document.querySelector<HTMLInputElement>(`[data-hmc-field=${f}]`)!.value;
    expect(v("street")).toBe("1 Main");
    expect(v("city")).toBe("Plano");
    expect(v("serviceTimes")).toBe("Sun 10:30 AM");
    expect(v("languages")).toBe("English, Spanish");
    expect(v("region")).toBe("TX");
    expect(v("phone")).toBe("");
    expect(events).toEqual(["input", "change"]);
    expect(input.value).toBe("Grace Church");
    expect(root.querySelector("[role=status]")!.textContent).toBe("Filled 4 fields. Not available: phone.");
  });
  it("starts the next search with nothing highlighted", async () => {
    const { root, input } = mount(form);
    await pick(input);
    responses.grace = [result("R-1", "Grace Church"), result("R-2", "Grace Chapel")];
    type(input, "grace"); await flush();
    expect(input.getAttribute("aria-activedescendant")).toBeNull();
    expect(root.querySelectorAll("[aria-selected=true]")).toHaveLength(0);
  });
  it("overwrites only with the overwrite attribute", async () => {
    const { el, input } = mount(form);
    el.setAttribute("overwrite", "");
    await pick(input);
    expect(document.querySelector<HTMLInputElement>("[data-hmc-field=city]")!.value).toBe("Dallas");
  });
  it("lets church-select and church-fill be cancelled", async () => {
    const a = mount(form);
    a.el.addEventListener("church-select", (e) => e.preventDefault());
    await pick(a.input);
    expect(document.querySelector<HTMLInputElement>("[data-hmc-field=street]")!.value).toBe("");
    const b = mount(form);
    let changes: unknown[] = [];
    b.el.addEventListener("church-fill", (e) => { changes = (e as CustomEvent).detail.changes; e.preventDefault(); });
    await pick(b.input);
    expect(changes.length).toBe(4);
    expect(document.querySelector<HTMLInputElement>("[data-hmc-field=street]")!.value).toBe("");
  });
  it("supports fieldMap with selectors outside the form", async () => {
    document.body.insertAdjacentHTML("beforeend", "");
    const { el, input } = mount();
    document.body.insertAdjacentHTML("beforeend", `<input id="outside">`);
    el.fieldMap = { website: "#outside" };
    await pick(input);
    expect(document.querySelector<HTMLInputElement>("#outside")!.value).toBe("https://grace.example");
  });
});

describe("helpers", () => {
  it("setNativeValue bypasses an instance setter, as React's value tracking needs", () => {
    const el = document.createElement("input");
    let tracked = "";
    Object.defineProperty(el, "value", { configurable: true, get: () => tracked, set: (v) => { tracked = `instance:${v}`; } });
    const seen: string[] = [];
    el.addEventListener("input", () => seen.push("input"));
    setNativeValue(el, "x");
    expect(tracked).toBe("");
    expect(seen).toEqual(["input"]);
  });
  it("fieldValue flattens lists and service times", () => {
    expect(fieldValue(record as never, "languages")).toBe("English, Spanish");
    expect(fieldValue(record as never, "ministries")).toBeNull();
    expect(fieldValue(record as never, "serviceTimes")).toBe("Sun 10:30 AM");
    expect(fieldValue(record as never, "id")).toBe("R-1");
  });
});

describe("icons", () => {
  function mountWith(inner: string) {
    document.body.innerHTML = `<form id="f"><church-lookup label="Your church">${inner}</church-lookup></form>`;
    const el = document.querySelector("church-lookup") as ChurchLookup;
    el.lookup = createLookup({
      fetch: (async () => Response.json({ query: "grac", results: [result("R-1", "Grace Church"), result("R-2", "Grace Chapel")], corrected: null, degraded: false, attribution: "" })) as typeof fetch,
    });
    return { el, root: el.shadowRoot!, input: el.shadowRoot!.querySelector("input")! };
  }
  it("takes a search icon through a slot", () => {
    const { root } = mountWith(`<i slot="search-icon" class="ti ti-search"></i>`);
    expect(root.querySelector("slot[name=search-icon]")).not.toBeNull();
  });
  it("copies a result icon into each row's slot", async () => {
    const { el, root, input } = mountWith(`<i slot="result-icon" class="ti ti-building-church"></i>`);
    type(input, "grac");
    await flush(160);
    const copies = el.querySelectorAll("[data-hmc-icon]");
    expect(copies).toHaveLength(2);
    expect([...copies].map((c) => c.getAttribute("slot"))).toEqual(["hmc-ic-0", "hmc-ic-1"]);
    expect(copies[0]!.getAttribute("aria-hidden")).toBe("true");
    expect(root.querySelectorAll("li slot[name^=hmc-ic-]")).toHaveLength(2);
  });
  it("accepts a template and replaces old copies on each render", async () => {
    const { el, input } = mountWith(`<template slot="result-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/></svg></template>`);
    type(input, "grac");
    await flush(160);
    type(input, "grace");
    await flush(160);
    const copies = el.querySelectorAll("[data-hmc-icon]");
    expect(copies).toHaveLength(2);
    expect(copies[0]!.querySelector("svg")).not.toBeNull();
  });
  it("falls back to the built-in icon without one", async () => {
    const { el, root, input } = mountWith("");
    type(input, "grac");
    await flush(160);
    expect(el.querySelectorAll("[data-hmc-icon]")).toHaveLength(0);
    expect(root.querySelector("li .ic svg")).not.toBeNull();
  });
});

describe("form field", () => {
  function mountForm(attrs: string, html = "") {
    document.body.innerHTML = `<form id="f"><church-lookup label="Your church" ${attrs}></church-lookup>${html}</form>`;
    const el = document.querySelector("church-lookup") as ChurchLookup;
    el.lookup = createLookup({
      fetch: (async (url: string) => {
        const u = new URL(url);
        if (u.pathname.startsWith("/v1/churches/")) return Response.json(record);
        return Response.json({ query: "grac", results: [result("R-1", "Grace Church")], corrected: null, degraded: false, attribution: "" });
      }) as typeof fetch,
    });
    return { el, form: document.querySelector("form")!, input: el.shadowRoot!.querySelector("input")!, root: el.shadowRoot! };
  }
  const pick = async (input: HTMLInputElement) => { type(input, "grac"); await flush(160); key(input, "ArrowDown"); key(input, "Enter"); await flush(10); };

  it("submits the chosen church's ID under its name", async () => {
    const { el, form, input } = mountForm(`name="church"`);
    expect(el.value).toBe("");
    await pick(input);
    expect(el.value).toBe("R-1");
    expect(el.selected?.name).toBe("Grace Church");
    expect(new FormData(form).get("church")).toBe("R-1");
  });
  it("is invalid while required and empty", async () => {
    const { el, input } = mountForm(`name="church" required`);
    if (!el.validity) return; // No ElementInternals in this DOM: nothing to check.
    expect(el.checkValidity()).toBe(false);
    await pick(input);
    expect(el.checkValidity()).toBe(true);
  });
  it("clears with the clear button and fires church-clear", async () => {
    const { el, form, input, root } = mountForm(`name="church"`);
    await pick(input);
    const btn = root.querySelector<HTMLButtonElement>("[part=clear]")!;
    expect(btn.hidden).toBe(false);
    let cleared = 0;
    el.addEventListener("church-clear", () => cleared++);
    btn.click();
    expect(cleared).toBe(1);
    expect(el.value).toBe("");
    expect(input.value).toBe("");
    expect(btn.hidden).toBe(true);
    expect(new FormData(form).get("church") ?? "").toBe("");
  });
  it("drops the choice when the name is edited", async () => {
    const { el, input } = mountForm(`name="church"`);
    await pick(input);
    type(input, "Grace Churc");
    expect(el.value).toBe("");
  });
  it("shows a saved church from its value without filling", async () => {
    const { el, input } = mountForm(`name="church" value="R-1"`, `<input id="street" data-hmc-field="street">`);
    await flush(10);
    expect(input.value).toBe("Grace Church");
    expect(el.value).toBe("R-1");
    expect((document.getElementById("street") as HTMLInputElement).value).toBe("");
  });
  it("fills on load with fill-on-load", async () => {
    mountForm(`value="R-1" fill-on-load`, `<input id="street" data-hmc-field="street">`);
    await flush(10);
    expect((document.getElementById("street") as HTMLInputElement).value).toBe("1 Main");
  });
});

describe("languages", () => {
  it("uses lang for its text and announcements", async () => {
    responses.grac = [result("R-1", "Grace Church"), result("R-2", "Grace Chapel")];
    document.body.innerHTML = `<form><church-lookup lang="es"></church-lookup></form>`;
    const el = document.querySelector("church-lookup") as ChurchLookup;
    el.lookup = createLookup({ fetch: (async () => Response.json({ query: "grac", results: responses.grac, corrected: null, degraded: false, attribution: "" })) as typeof fetch });
    const root = el.shadowRoot!;
    expect(root.querySelector("label")!.textContent).toBe("Iglesia");
    const input = root.querySelector("input")!;
    type(input, "grac");
    await flush(260);
    expect(root.querySelector("[role=status]")!.textContent).toBe("2 iglesias encontradas. Usa las flechas arriba y abajo para elegir.");
  });
  it("follows the page's lang and takes overrides", () => {
    document.body.innerHTML = `<div lang="pl"><church-lookup></church-lookup></div>`;
    const el = document.querySelector("church-lookup") as ChurchLookup;
    expect(el.shadowRoot!.querySelector("label")!.textContent).toBe("Kościół");
    el.strings = { label: "Twoja parafia" };
    expect(el.shadowRoot!.querySelector("label")!.textContent).toBe("Twoja parafia");
  });
});

describe("consent", () => {
  const meta = { fields: [], completenessWeights: {}, attribution: "", contributableFields: {
    name: { countries: "all", review: "moderated", status: "coming_soon" },
    website: { countries: "all", review: "moderated" },
    denomination: { countries: "all", review: "live" },
    phone: { countries: ["US", "CA"], review: "live" },
  } };
  let posts: { path: string; body: any }[] = [];
  function mountConsent(attrs = "", reply: any = { churchId: "R-1", results: [{ field: "website", status: "in_review" }] }) {
    posts = [];
    document.body.innerHTML = `<form><church-lookup client="acme" ${attrs}></church-lookup>
      <label for="w">Website</label><input id="w" data-hmc-field="website">
      <label for="d">Denomination</label><input id="d" data-hmc-field="denomination">
      <label for="n">Church name</label><input id="n" data-hmc-field="name"></form>`;
    const el = document.querySelector("church-lookup") as ChurchLookup;
    el.lookup = createLookup({
      client: "acme",
      fetch: (async (url: string, init?: RequestInit) => {
        const u = new URL(url);
        if (init?.method === "POST") { posts.push({ path: u.pathname, body: JSON.parse(String(init.body)) }); return Response.json(u.pathname.endsWith("/confirm") ? { churchId: "R-1", status: "confirmed" } : reply); }
        if (u.pathname === "/v1/meta") return Response.json(meta);
        if (u.pathname.startsWith("/v1/churches/")) return Response.json({ ...record, fields: { ...record.fields, country: "US", denomination: null } });
        return Response.json({ query: "grac", results: [result("R-1", "Grace Church")], corrected: null, degraded: false, attribution: "" });
      }) as typeof fetch,
    });
    return { el, input: el.shadowRoot!.querySelector("input")!, panel: el.shadowRoot!.querySelector<HTMLElement>("[part=consent]")! };
  }
  const pick = async (input: HTMLInputElement) => { type(input, "grac"); await flush(160); key(input, "ArrowDown"); key(input, "Enter"); await flush(20); };
  const edit = (id: string, v: string) => { const f = document.getElementById(id) as HTMLInputElement; f.value = v; f.dispatchEvent(new Event("change")); };

  it("offers Still correct after a fill, and confirms on click", async () => {
    const { input, panel } = mountConsent();
    await pick(input);
    expect(panel.hidden).toBe(false);
    expect(panel.textContent).toContain("Still correct?");
    panel.querySelector<HTMLButtonElement>("button")!.click();
    await flush(10);
    expect(posts).toEqual([{ path: "/v1/churches/R-1/confirm", body: { client: "acme" } }]);
    expect(panel.textContent).toContain("Thanks for confirming.");
  });
  it("lists edits unchecked and sends nothing without a click", async () => {
    const { input, panel } = mountConsent();
    await pick(input);
    edit("w", "https://new.example");
    const boxes = panel.querySelectorAll<HTMLInputElement>("input[type=checkbox]");
    expect(boxes).toHaveLength(1);
    expect(boxes[0]!.checked).toBe(false);
    expect(panel.textContent).toContain("https://grace.example");
    expect(panel.textContent).toContain("https://new.example");
    expect(panel.textContent).toContain("A moderator reviews it");
    panel.querySelector<HTMLButtonElement>(".row .bt")!.click();
    await flush(10);
    expect(posts).toHaveLength(0);
  });
  it("shares checked rows, fires church-contribute, and shows each result", async () => {
    const { el, input, panel } = mountConsent("", { churchId: "R-1", sandbox: true, results: [{ field: "website", status: "in_review" }, { field: "denomination", status: "live" }] });
    const seen: any[] = [];
    el.addEventListener("church-contribute", (e) => seen.push((e as CustomEvent).detail));
    await pick(input);
    edit("w", "https://new.example");
    edit("d", "Baptist");
    panel.querySelectorAll<HTMLInputElement>("input[type=checkbox]").forEach((b) => { b.checked = true; });
    panel.querySelector<HTMLButtonElement>(".row .bt")!.click();
    await flush(10);
    expect(seen[0]).toEqual({ churchId: "R-1", changes: [{ field: "website", value: "https://new.example" }, { field: "denomination", value: "Baptist" }] });
    expect(posts[0]).toEqual({ path: "/v1/churches/R-1/contributions", body: { client: "acme", changes: seen[0].changes } });
    expect(panel.textContent).toContain("Sent for review");
    expect(panel.textContent).toContain("Live now");
    expect(panel.textContent).toContain("Demo only: nothing was sent.");
  });
  it("lets the host cancel the send", async () => {
    const { el, input, panel } = mountConsent();
    el.addEventListener("church-contribute", (e) => e.preventDefault());
    await pick(input);
    edit("w", "https://new.example");
    panel.querySelector<HTMLInputElement>("input[type=checkbox]")!.checked = true;
    panel.querySelector<HTMLButtonElement>(".row .bt")!.click();
    await flush(10);
    expect(posts).toHaveLength(0);
  });
  it("shows name as coming soon and can't send it", async () => {
    const { input, panel } = mountConsent();
    await pick(input);
    edit("n", "Grace Church Dallas");
    const box = panel.querySelector<HTMLInputElement>("input[type=checkbox]")!;
    expect(box.disabled).toBe(true);
    expect(panel.textContent).toContain("Coming soon");
  });
  it("stays hidden with contribute=off", async () => {
    const { input, panel } = mountConsent(`contribute="off"`);
    await pick(input);
    edit("w", "https://new.example");
    expect(panel.hidden).toBe(true);
  });
  it("hides on Not now until something else changes", async () => {
    const { input, panel } = mountConsent();
    await pick(input);
    edit("w", "https://new.example");
    panel.querySelectorAll<HTMLButtonElement>(".row .bt")[1]!.click();
    expect(panel.hidden).toBe(true);
    edit("d", "Baptist");
    expect(panel.hidden).toBe(false);
  });
});
