// <church-service-times>: a row editor for service times that matches Here's My Church's own input.
// Wrap the form's field: <church-service-times><textarea name="times" data-hmc-field="serviceTimes"></textarea></church-service-times>
// The textarea stays in the form and holds the canonical string, e.g. "Sun 9:00 AM (Main Service); Wed 7:00 PM".
// Without JavaScript, the textarea still works on its own.
import { setNativeValue } from "./dom.ts";

export interface ServiceEntry { day: string; hour: string; minute: string; period: "AM" | "PM"; label: string }

const DAYS: [string, string][] = [["Sun", "Sunday"], ["Mon", "Monday"], ["Tue", "Tuesday"], ["Wed", "Wednesday"], ["Thu", "Thursday"], ["Fri", "Friday"], ["Sat", "Saturday"]];
const HOURS = ["12", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"];
const MINUTES = ["00", "15", "30", "45"];
const OSM_DAY: Record<string, number> = { su: 0, mo: 1, tu: 2, we: 3, th: 4, fr: 5, sa: 6 };
const PRESETS: [string, Omit<ServiceEntry, "label">[]][] = [
  ["Sunday morning", [{ day: "Sun", hour: "9", minute: "00", period: "AM" }, { day: "Sun", hour: "11", minute: "00", period: "AM" }]],
  ["Sunday and Wednesday", [{ day: "Sun", hour: "10", minute: "00", period: "AM" }, { day: "Wed", hour: "7", minute: "00", period: "PM" }]],
  ["Saturday evening", [{ day: "Sat", hour: "5", minute: "00", period: "PM" }]],
];

const dayIndex = (d: string) => DAYS.findIndex(([s]) => s === d);
const minutes = (e: ServiceEntry) => ((Number(e.hour) % 12) + (e.period === "PM" ? 12 : 0)) * 60 + Number(e.minute);

export function serialize(entries: ServiceEntry[]): string {
  return [...entries]
    .sort((a, b) => dayIndex(a.day) - dayIndex(b.day) || minutes(a) - minutes(b))
    .map((e) => `${e.day} ${e.hour}:${e.minute} ${e.period}${e.label.trim() ? ` (${e.label.trim()})` : ""}`)
    .join("; ");
}

function from24(day: string, hh: number, mm: string): ServiceEntry {
  return { day, hour: String(hh % 12 || 12), minute: mm, period: hh >= 12 ? "PM" : "AM", label: "" };
}

/** Read the HMC format, or OSM's "Su 08:00, 10:30; Mo-Fr 19:00". Returns null if any part can't be read. */
export function parse(value: string): ServiceEntry[] | null {
  const out: ServiceEntry[] = [];
  for (const part of value.split(";").map((s) => s.trim()).filter(Boolean)) {
    const hmc = part.match(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\w*\s+(\d{1,2}):(\d{2})\s*(AM|PM)(?:\s*\((.+)\))?$/i);
    if (hmc) {
      const day = DAYS.find(([s]) => s.toLowerCase() === hmc[1]!.slice(0, 3).toLowerCase())![0];
      out.push({ day, hour: String(Number(hmc[2])), minute: hmc[3]!, period: hmc[4]!.toUpperCase() as "AM" | "PM", label: hmc[5] ?? "" });
      continue;
    }
    const osm = part.match(/^((?:Su|Mo|Tu|We|Th|Fr|Sa)(?:\s*[-,]\s*(?:Su|Mo|Tu|We|Th|Fr|Sa))*)\s+(\d{1,2}:\d{2}(?:\s*,\s*\d{1,2}:\d{2})*)$/i);
    if (!osm) return null;
    const days = new Set<number>();
    for (const span of osm[1]!.split(",")) {
      const [a, b] = span.split("-").map((s) => OSM_DAY[s.trim().toLowerCase()]!);
      if (b === undefined) days.add(a!);
      else for (let d = a!; ; d = (d + 1) % 7) { days.add(d); if (d === b) break; }
    }
    for (const t of osm[2]!.split(",")) {
      const [h, m] = t.trim().split(":");
      if (Number(h) > 23) return null;
      for (const d of [...days].sort()) out.push(from24(DAYS[d]![0], Number(h), m!));
    }
  }
  return out;
}

const CSS = `
:host{display:block;container-type:inline-size;--_line:var(--hmc-border,var(--border,#d4d4d8));--_input:var(--hmc-input-border,var(--input,#a1a1aa));--_bg:var(--hmc-bg,var(--background,#fff));
--_muted:var(--hmc-muted,var(--muted-foreground,#52525b));--_ring:var(--hmc-accent,var(--ring,#6d28d9));--_r:var(--hmc-radius,var(--radius,10px))}
.row{display:grid;grid-template-columns:repeat(4,auto) 1fr 44px;gap:8px;align-items:center;padding:10px;margin-bottom:10px;background:color-mix(in oklab,var(--_ring) 4%,var(--_bg));border:1px solid var(--_line);border-radius:var(--_r)}
@container (max-width:560px){.row{grid-template-columns:minmax(0,1.5fr) repeat(3,minmax(0,1fr)) 44px}.row input{grid-column:1/-2;grid-row:2}}
@container (max-width:340px){.row{grid-template-columns:repeat(3,minmax(0,1fr)) 44px}.row [data-k=day]{grid-column:1/-2}.row input{grid-column:1/-1;grid-row:3}}
select,input,button{font:inherit;font-size:1rem;color:inherit;min-height:44px;box-sizing:border-box;border:1px solid var(--_input);border-radius:calc(var(--_r) - 2px);background:var(--_bg);padding:0 10px}
input,select{min-width:0;width:100%}
select{appearance:none;-webkit-appearance:none;padding-right:30px;background-image:linear-gradient(45deg,transparent 50%,var(--_muted) 50%),linear-gradient(135deg,var(--_muted) 50%,transparent 50%);background-position:calc(100% - 16px) 52%,calc(100% - 11px) 52%;background-size:5px 5px;background-repeat:no-repeat}
select:focus-visible,input:focus-visible,button:focus-visible{outline:none;border-color:var(--_ring);box-shadow:0 0 0 4px color-mix(in oklab,var(--_ring) 22%,transparent)}
button{cursor:pointer;font-weight:500}
.x{border-color:transparent;background:none;color:var(--_muted);font-size:1.375rem;line-height:1;padding:0}
.x:hover{color:inherit;background:color-mix(in oklab,var(--_ring) 8%,transparent)}
[data-a=add]{border-style:dashed;color:var(--_ring);width:100%;background:none}
[data-a=add]:hover{background:color-mix(in oklab,var(--_ring) 6%,transparent)}
.raw,.presets{font-size:.9375rem;color:var(--_muted);margin:0 0 12px}
.presets span{display:block;margin-bottom:8px}
.presets button{margin:0 8px 8px 0;border-radius:999px;padding:0 16px;color:inherit}
.presets button:hover{border-color:var(--_ring);color:var(--_ring)}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media (forced-colors:active){.row,select,input,button{border:1px solid CanvasText}select{appearance:auto;-webkit-appearance:auto;background-image:none;padding-right:10px}}
`;

const opt = (values: [string, string][], selected: string) =>
  values.map(([v, t]) => `<option value="${v}"${v === selected ? " selected" : ""}>${t}</option>`).join("");

// Importing on a server, as Next.js does while rendering, defines the class without registering it.
const Base = (typeof HTMLElement === "undefined" ? class {} : HTMLElement) as typeof HTMLElement;

export class ChurchServiceTimes extends Base {
  entries: ServiceEntry[] = [];
  private field: HTMLInputElement | HTMLTextAreaElement | null = null;
  private box!: HTMLDivElement;
  private live!: HTMLDivElement;
  private writing = false;
  private unread = "";

  connectedCallback(): void {
    if (this.shadowRoot) return;
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${CSS}</style><div role="group" part="group"></div><div class="sr" role="status" aria-live="polite"></div>`;
    this.box = root.querySelector("div")!;
    this.live = root.querySelector("[role=status]")!;
    this.box.setAttribute("aria-label", this.getAttribute("label") ?? "Service times");
    // No <slot>, so the wrapped field stays in the form but isn't drawn. It may be parsed after
    // this element connects, so bind when it appears.
    this.bind();
    queueMicrotask(() => this.bind());
    new MutationObserver(() => this.bind()).observe(this, { childList: true, subtree: true, characterData: true });
    this.box.addEventListener("change", (e) => this.edit(e.target as HTMLElement));
    this.box.addEventListener("input", (e) => { if ((e.target as HTMLElement).dataset.k === "label") this.edit(e.target as HTMLElement); });
    this.box.addEventListener("click", (e) => this.onBoxClick(e.target as HTMLElement));
    if (!this.field) this.render();
  }

  private bind(): void {
    const f = this.querySelector<HTMLInputElement | HTMLTextAreaElement>("textarea, input");
    if (!f) return;
    if (f === this.field) { if (!this.entries.length && !this.unread && f.value.trim()) this.load(f.value); return; }
    this.field = f;
    const sync = () => { if (!this.writing) this.load(f.value); };
    f.addEventListener("input", sync);
    f.addEventListener("change", sync);
    // A textarea's text can arrive after the element itself while the page is still parsing.
    this.load(f.value);
    queueMicrotask(() => { if (f.value.trim() && !this.entries.length && !this.unread) this.load(f.value); });
  }

  /** Read a value written by autofill, a person, or the page. Unreadable text is kept and shown, never dropped. */
  load(value: string): void {
    const parsed = value.trim() ? parse(value) : [];
    this.unread = parsed ? "" : value.trim();
    this.entries = parsed ?? [];
    this.render();
  }

  private write(): void {
    if (!this.field) return;
    this.writing = true;
    setNativeValue(this.field, this.unread && !this.entries.length ? this.unread : serialize(this.entries));
    this.writing = false;
  }

  private say(t: string): void { this.live.textContent = t; }

  private render(): void {
    const h = this.entries.map((e, i) => {
      const hours = HOURS.map((x) => [x, x] as [string, string]);
      const mins = (MINUTES.includes(e.minute) ? MINUTES : [...MINUTES, e.minute].sort()).map((x) => [x, x] as [string, string]);
      const name = `${DAYS[dayIndex(e.day)]![1]} ${e.hour}:${e.minute} ${e.period}`;
      return `<div class="row" part="row" role="group" aria-label="Service ${i + 1}: ${name}" data-i="${i}">
<select data-k="day" aria-label="Day">${opt(DAYS, e.day)}</select>
<select data-k="hour" aria-label="Hour">${opt(hours, e.hour)}</select>
<select data-k="minute" aria-label="Minutes">${opt(mins, e.minute)}</select>
<select data-k="period" aria-label="AM or PM">${opt([["AM", "AM"], ["PM", "PM"]], e.period)}</select>
<input data-k="label" aria-label="Label, optional" placeholder="Label, optional" value="${e.label.replace(/[&"<]/g, (c) => `&#${c.charCodeAt(0)};`)}">
<button type="button" class="x" data-a="remove" aria-label="Remove ${name}">×</button></div>`;
    }).join("");
    const raw = this.unread ? `<p class="raw" part="unread">These times couldn't be read automatically, so add them below: <q></q></p>` : "";
    const presets = !this.entries.length ? `<p class="presets" part="presets"><span>Start from a common schedule:</span>${PRESETS.map(([l], i) => `<button type="button" data-a="preset" data-p="${i}" part="preset">${l}</button>`).join("")}</p>` : "";
    this.box.innerHTML = `${raw}${h}${presets}<button type="button" data-a="add" part="add">+ Add a service time</button>`;
    // Set values directly too; some engines don't honor a `selected` added to a non-standard option.
    this.box.querySelectorAll<HTMLElement>("[data-i]").forEach((row) => {
      const e = this.entries[Number(row.dataset.i)]!;
      row.querySelectorAll<HTMLSelectElement>("select").forEach((sel) => (sel.value = e[sel.dataset.k as keyof ServiceEntry]));
    });
    const q = this.box.querySelector("q");
    if (q) q.textContent = this.unread;
  }

  private edit(t: HTMLElement): void {
    const row = t.closest<HTMLElement>("[data-i]");
    const k = t.dataset.k as keyof ServiceEntry | undefined;
    if (!row || !k) return;
    const e = this.entries[Number(row.dataset.i)]!;
    (e[k] as string) = (t as HTMLInputElement).value;
    this.write();
    if (k !== "label") {
      const name = `${DAYS[dayIndex(e.day)]![1]} ${e.hour}:${e.minute} ${e.period}`;
      row.setAttribute("aria-label", `Service ${Number(row.dataset.i) + 1}: ${name}`);
      row.querySelector("[data-a=remove]")!.setAttribute("aria-label", `Remove ${name}`);
    }
  }

  private onBoxClick(t: HTMLElement): void {
    const a = t.closest<HTMLElement>("[data-a]")?.dataset.a;
    if (!a) return;
    if (a === "add") {
      const last = this.entries[this.entries.length - 1];
      this.entries.push(last ? { ...last, hour: last.hour === "9" ? "11" : "9", label: "" } : { day: "Sun", hour: "9", minute: "00", period: "AM", label: "" });
      this.render();
      this.write();
      this.box.querySelectorAll<HTMLSelectElement>("[data-k=day]")[this.entries.length - 1]?.focus();
      this.say("Service time added.");
    } else if (a === "remove") {
      const i = Number(t.closest<HTMLElement>("[data-i]")!.dataset.i);
      this.entries.splice(i, 1);
      this.render();
      this.write();
      (this.box.querySelectorAll<HTMLElement>("[data-a=remove]")[Math.min(i, this.entries.length - 1)] ?? this.box.querySelector<HTMLElement>("[data-a=add]"))?.focus();
      this.say("Service time removed.");
    } else if (a === "preset") {
      this.entries = PRESETS[Number(t.dataset.p)]![1].map((e) => ({ ...e, label: "" }));
      this.unread = "";
      this.render();
      this.write();
      this.box.querySelector<HTMLElement>("[data-k=day]")?.focus();
      this.say(`${this.entries.length} service ${this.entries.length === 1 ? "time" : "times"} added.`);
    }
  }
}

if (typeof customElements !== "undefined" && !customElements.get("church-service-times")) customElements.define("church-service-times", ChurchServiceTimes);
