import { describe, expect, it } from "vitest";
import { ChurchServiceTimes, parse, serialize } from "../src/service-times.ts";
import { setNativeValue } from "../src/element.ts";

describe("format", () => {
  it("round-trips the HMC format with labels, sorted by day and time", () => {
    const v = "Wed 7:00 PM; Sun 11:00 AM (Contemporary); Sun 9:00 AM";
    expect(serialize(parse(v)!)).toBe("Sun 9:00 AM; Sun 11:00 AM (Contemporary); Wed 7:00 PM");
  });
  it("reads OSM day ranges and 24-hour times", () => {
    expect(serialize(parse("Su 08:00, 10:30; Mo-We 19:00")!)).toBe("Sun 8:00 AM; Sun 10:30 AM; Mon 7:00 PM; Tue 7:00 PM; Wed 7:00 PM");
    expect(serialize(parse("Su 12:15; Sa 00:30")!)).toBe("Sun 12:15 PM; Sat 12:30 AM");
  });
  it("returns null for text it can't read", () => {
    expect(parse("Dec-Apr Fr[1] 16:00")).toBeNull();
    expect(parse("by appointment")).toBeNull();
  });
});

async function mount(value = "") {
  document.body.innerHTML = `<form><church-service-times><textarea name="times" data-hmc-field="serviceTimes">${value}</textarea></church-service-times></form>`;
  const el = document.querySelector("church-service-times") as ChurchServiceTimes;
  const ta = document.querySelector("textarea")!;
  await Promise.resolve();
  return { el, ta, root: el.shadowRoot! };
}

describe("editor", () => {
  it("shows a row per service with labelled controls, and keeps the textarea in the form", async () => {
    const { root, ta } = await mount("Sun 9:00 AM; Wed 7:00 PM (Bible study)");
    const rows = root.querySelectorAll(".row");
    expect(rows).toHaveLength(2);
    expect(rows[1]!.getAttribute("aria-label")).toBe("Service 2: Wednesday 7:00 PM");
    for (const c of root.querySelectorAll("select, input")) expect(c.getAttribute("aria-label")).toBeTruthy();
    expect(root.querySelector<HTMLInputElement>("[data-k=label]")!.value).toBe("");
    expect(new FormData(ta.form!).get("times")).toBe("Sun 9:00 AM; Wed 7:00 PM (Bible study)");
  });
  it("writes the canonical string back with input and change events", async () => {
    const { root, ta } = await mount("Sun 9:00 AM");
    const seen: string[] = [];
    ta.addEventListener("input", () => seen.push("input"));
    const hour = root.querySelector<HTMLSelectElement>("[data-k=hour]")!;
    hour.value = "10";
    hour.dispatchEvent(new Event("change", { bubbles: true }));
    expect(ta.value).toBe("Sun 10:00 AM");
    expect(seen).toEqual(["input"]);
  });
  it("adds, labels and removes services", async () => {
    const { root, ta } = await mount("Sun 9:00 AM");
    root.querySelector<HTMLButtonElement>("[data-a=add]")!.click();
    expect(ta.value).toBe("Sun 9:00 AM; Sun 11:00 AM");
    const label = root.querySelectorAll<HTMLInputElement>("[data-k=label]")[1]!;
    label.value = "Traditional";
    label.dispatchEvent(new Event("input", { bubbles: true }));
    expect(ta.value).toBe("Sun 9:00 AM; Sun 11:00 AM (Traditional)");
    root.querySelector<HTMLButtonElement>("[data-a=remove]")!.click();
    expect(ta.value).toBe("Sun 11:00 AM (Traditional)");
  });
  it("offers presets when empty", async () => {
    const { root, ta } = await mount("");
    root.querySelector<HTMLButtonElement>("[data-a=preset]")!.click();
    expect(ta.value).toBe("Sun 9:00 AM; Sun 11:00 AM");
  });
  it("re-reads the field when autofill writes to it", async () => {
    const { root, ta } = await mount("");
    setNativeValue(ta, "Su 10:30; We 19:00");
    expect(root.querySelectorAll(".row")).toHaveLength(2);
  });
  it("keeps text it can't read instead of dropping it", async () => {
    const { root, ta } = await mount("Mass by appointment");
    expect(root.querySelector("q")!.textContent).toBe("Mass by appointment");
    expect(ta.value).toBe("Mass by appointment");
    root.querySelector<HTMLButtonElement>("[data-a=add]")!.click();
    expect(ta.value).toBe("Sun 9:00 AM");
  });
  it("keeps odd minutes rather than rounding them", async () => {
    const { root } = await mount("Sun 9:20 AM");
    expect(root.querySelector<HTMLSelectElement>("[data-k=minute]")!.value).toBe("20");
  });
});
